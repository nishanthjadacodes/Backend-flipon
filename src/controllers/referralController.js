import { User, Referral, Booking, WalletTransaction } from '../models/index.js';
import { Op } from 'sequelize';

// Generate or get referral code for the logged-in agent
const generateReferralCode = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.referral_code) {
      return res.json({ success: true, referralCode: user.referral_code });
    }

    const prefix = (user.name || 'AGENT').replace(/\s/g, '').substring(0, 3).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `FLIP${prefix}${suffix}`;

    await user.update({ referral_code: code });
    res.json({ success: true, referralCode: code });
  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate referral code' });
  }
};

// Get full referral dashboard data for the logged-in agent
const getReferralData = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Auto-generate code if missing
    if (!user.referral_code) {
      const prefix = (user.name || 'AGENT').replace(/\s/g, '').substring(0, 3).toUpperCase();
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      await user.update({ referral_code: `FLIP${prefix}${suffix}` });
      await user.reload();
    }

    // Get all referrals made by this agent
    const referrals = await Referral.findAll({
      where: { referrer_id: req.user.id },
      include: [{ model: User, as: 'referee', attributes: ['id', 'name', 'mobile', 'created_at'] }],
      order: [['created_at', 'DESC']],
    });

    const totalReferrals = referrals.length;
    const successfulReferrals = referrals.filter(r => r.status === 'completed').length;
    const totalEarned = referrals
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const availableCredits = totalEarned;

    // Milestones per policy: Bronze 5, Silver 10, Gold 25.
    // `achieved` = threshold crossed (display flag).
    // `received` = bonus actually credited to wallet (truth from
    // wallet_transactions). The two can disagree briefly between the
    // referral being marked complete and the wallet credit committing,
    // or for legacy referrers who hit the threshold before this fix shipped.
    const milestoneCredits = await WalletTransaction.findAll({
      where: { user_id: req.user.id, source: 'referral_milestone' },
      attributes: ['amount'],
    });
    const creditedBonusSet = new Set(
      milestoneCredits.map((t) => Number(t.amount)),
    );
    const milestones = {
      bronze: {
        required: 5,
        achieved: successfulReferrals >= 5,
        bonus: 50,
        received: creditedBonusSet.has(50),
      },
      silver: {
        required: 10,
        achieved: successfulReferrals >= 10,
        bonus: 150,
        received: creditedBonusSet.has(150),
      },
      gold: {
        required: 25,
        achieved: successfulReferrals >= 25,
        bonus: 500,
        received: creditedBonusSet.has(500),
        status: 'Priority User',
      },
    };

    // Royalty: 2% of downline agents' completed booking values this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Last month boundaries (start of last month → start of this month)
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = monthStart; // exclusive

    const downlineAgentIds = referrals.filter(r => r.referee_id).map(r => r.referee_id);
    let totalTeamBusiness = 0;
    let qualifyingTeamBusiness = 0;     // only counts downlines hitting ₹5k/month
    let activeMentees = 0;
    let lastMonthTeamBusiness = 0;
    let lastMonthQualifyingBusiness = 0;

    // Per-downline minimum monthly turnover for royalty eligibility (per
    // policy section 2: "Royalty is triggered only when a downline agent
    // achieves a minimum monthly business volume of ₹5,000").
    const PER_DOWNLINE_MIN = 5000;

    // Per-downline rating floor (per policy 4.1 Quality Assurance).
    // A downline whose monthly avg rating drops below this is suspended
    // from the royalty basis for that month. NULL ratings (no completed
    // jobs with feedback) are treated as eligible — the agent hasn't
    // "fallen below" anything yet.
    const RATING_FLOOR = 3.5;

    if (downlineAgentIds.length > 0) {
      const [thisMonthBookings, lastMonthBookings] = await Promise.all([
        Booking.findAll({
          where: {
            agent_id: { [Op.in]: downlineAgentIds },
            status: 'completed',
            completed_at: { [Op.gte]: monthStart },
          },
          attributes: ['agent_id', 'price_quoted', 'customer_rating'],
        }),
        Booking.findAll({
          where: {
            agent_id: { [Op.in]: downlineAgentIds },
            status: 'completed',
            completed_at: { [Op.gte]: lastMonthStart, [Op.lt]: lastMonthEnd },
          },
          attributes: ['agent_id', 'price_quoted', 'customer_rating'],
        }),
      ]);

      // For each downline, compute (totalBusiness, avgRating). Then apply
      // BOTH gates: business >= ₹5k AND avg rating >= 3.5 (or no ratings).
      const aggregateByAgent = (rows) => {
        const map = new Map();
        for (const b of rows) {
          const a = b.agent_id;
          if (!map.has(a)) map.set(a, { biz: 0, ratingSum: 0, ratingCount: 0 });
          const e = map.get(a);
          e.biz += parseFloat(b.price_quoted || 0);
          if (b.customer_rating != null) {
            e.ratingSum += Number(b.customer_rating);
            e.ratingCount += 1;
          }
        }
        return map;
      };
      const qualifyingTotal = (m) => {
        let total = 0;
        for (const e of m.values()) {
          if (e.biz < PER_DOWNLINE_MIN) continue;
          const avg = e.ratingCount > 0 ? e.ratingSum / e.ratingCount : null;
          if (avg !== null && avg < RATING_FLOOR) continue;   // suspended
          total += e.biz;
        }
        return total;
      };

      const thisMonthByAgent = aggregateByAgent(thisMonthBookings);
      const lastMonthByAgent = aggregateByAgent(lastMonthBookings);

      totalTeamBusiness = thisMonthBookings.reduce((s, b) => s + parseFloat(b.price_quoted || 0), 0);
      qualifyingTeamBusiness = qualifyingTotal(thisMonthByAgent);
      lastMonthTeamBusiness = lastMonthBookings.reduce((s, b) => s + parseFloat(b.price_quoted || 0), 0);
      lastMonthQualifyingBusiness = qualifyingTotal(lastMonthByAgent);
      activeMentees = new Set(thisMonthBookings.map(b => b.agent_id)).size;
    }

    // Personal activity check (min 5 tasks/month for royalty eligibility)
    const personalTasks = await Booking.count({
      where: {
        agent_id: req.user.id,
        status: 'completed',
        completed_at: { [Op.gte]: monthStart },
      },
    });
    // Last month's personal tasks — used to show whether last month's royalty
    // qualified retroactively (the actual credit is driven by the payout job).
    const lastMonthPersonalTasks = await Booking.count({
      where: {
        agent_id: req.user.id,
        status: 'completed',
        completed_at: { [Op.gte]: lastMonthStart, [Op.lt]: lastMonthEnd },
      },
    });

    // Royalty = 2% of *qualifying* team business, only when the referrer
    // also clears their personal-activity floor of 5 tasks for that month.
    const currentMonthRoyalty =
      personalTasks >= 5 ? Math.round(qualifyingTeamBusiness * 0.02) : 0;
    const lastMonthRoyalty =
      lastMonthPersonalTasks >= 5 ? Math.round(lastMonthQualifyingBusiness * 0.02) : 0;

    // Active vs inactive flag — a referee is "active" if they have at least
    // one booking (any status except cancelled) in the last 30 days.
    const activeWindow = new Date();
    activeWindow.setDate(activeWindow.getDate() - 30);

    const refereeIds = referrals.filter(r => r.referee_id).map(r => r.referee_id);
    let activityByUser = {};
    if (refereeIds.length) {
      const recentBookings = await Booking.findAll({
        where: {
          [Op.or]: [
            { customer_id: { [Op.in]: refereeIds } },
            { agent_id: { [Op.in]: refereeIds } },
          ],
          status: { [Op.ne]: 'cancelled' },
          created_at: { [Op.gte]: activeWindow },
        },
        attributes: ['customer_id', 'agent_id'],
      });
      for (const b of recentBookings) {
        if (b.customer_id) activityByUser[b.customer_id] = true;
        if (b.agent_id) activityByUser[b.agent_id] = true;
      }
    }

    // Level-2 (downline of downline) — for the tree/network view. Each
    // direct referee may themselves have referred others; we surface those
    // grouped under each level-1 referrer.
    const level2ByParent = {};
    if (refereeIds.length) {
      const level2 = await Referral.findAll({
        where: { referrer_id: { [Op.in]: refereeIds } },
        include: [{ model: User, as: 'referee', attributes: ['id', 'name', 'mobile', 'created_at'] }],
      });
      for (const r of level2) {
        if (!level2ByParent[r.referrer_id]) level2ByParent[r.referrer_id] = [];
        level2ByParent[r.referrer_id].push({
          id: r.id,
          name: r.referee?.name || 'Pending Signup',
          mobile: r.referee?.mobile || '',
          status: r.status,
          isActive: !!activityByUser[r.referee_id],
        });
      }
    }

    // Format referral list (level 1) with active flag and nested level 2.
    const referralList = referrals.map(r => ({
      id: r.id,
      refereeId: r.referee_id,
      name: r.referee?.name || 'Pending Signup',
      mobile: r.referee?.mobile || '',
      status: r.status,
      isActive: !!activityByUser[r.referee_id],
      signupDate: r.referee?.created_at || r.created_at,
      firstServiceDate: r.first_service_completed_at,
      reward: r.status === 'completed' ? parseFloat(r.reward_amount) : 0,
      rewardDate: r.credited_at,
      expiryDate: r.expires_at,
      children: r.referee_id ? (level2ByParent[r.referee_id] || []) : [],
    }));

    const activeCount = referralList.filter(r => r.isActive).length;
    const inactiveCount = referralList.length - activeCount;

    res.json({
      success: true,
      referralCode: user.referral_code,
      referralLink: `https://fliponex.app/referral/${user.referral_code}`,
      totalReferrals,
      successfulReferrals,
      activeReferrals: activeCount,
      inactiveReferrals: inactiveCount,
      totalEarned,
      availableCredits,
      usedCredits: 0,
      expiredCredits: 0,
      referrals: referralList,
      milestones,
      royalty: {
        totalTeamBusiness,
        qualifyingTeamBusiness,         // only downlines hitting ₹5k/month
        lastMonthTeamBusiness,
        lastMonthQualifyingBusiness,
        activeMentees,
        currentMonthRoyalty,
        lastMonthRoyalty,
        personalTasksCompleted: personalTasks,
        lastMonthPersonalTasksCompleted: lastMonthPersonalTasks,
        // "Met" if at least one downline crossed the ₹5k threshold this
        // month — what the policy actually requires (used to be sum-based).
        minimumTeamTurnoverMet: qualifyingTeamBusiness > 0,
        qualityScore: parseFloat(user.rating || 0),
        // Surfaces in the rep app so the badge / waitlist priority can light
        // up after the Gold milestone fires.
        priorityUser: !!user.is_priority_user,
      },
    });
  } catch (error) {
    console.error('Get referral data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch referral data' });
  }
};

// Track referral share/click
const trackReferralClick = async (req, res) => {
  const { referralCode, source } = req.body;
  console.log(`Referral shared: code=${referralCode}, via=${source}`);
  res.json({ success: true, tracked: true });
};

// Get referral stats
const getReferralStats = async (req, res) => {
  try {
    const referrals = await Referral.findAll({ where: { referrer_id: req.user.id } });
    const total = referrals.length;
    const successful = referrals.filter(r => r.status === 'completed').length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthly = referrals.filter(r => new Date(r.created_at) >= monthStart).length;

    res.json({
      success: true,
      totalReferrals: total,
      successfulReferrals: successful,
      conversionRate: total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
      averageRewardPerReferral: 20,
      monthlyReferrals: monthly,
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// Apply a referral code during signup
const applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const newUserId = req.user.id;

    if (!referralCode) return res.status(400).json({ success: false, message: 'Referral code required' });

    const referrer = await User.findOne({ where: { referral_code: referralCode } });
    if (!referrer) return res.status(404).json({ success: false, message: 'Invalid referral code' });
    if (referrer.id === newUserId) return res.status(400).json({ success: false, message: 'Cannot refer yourself' });

    const existing = await Referral.findOne({ where: { referee_id: newUserId } });
    if (existing) return res.status(400).json({ success: false, message: 'Already referred' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await Referral.create({
      referrer_id: referrer.id,
      referee_id: newUserId,
      referral_code: referralCode,
      status: 'pending',
      reward_amount: 20,
      referee_discount: 20,
      expires_at: expiresAt,
    });

    res.json({ success: true, message: 'Referral applied! ₹20 off your first service.', discount: 20 });
  } catch (error) {
    console.error('Apply referral code error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply referral code' });
  }
};

// POST /api/referrals/backfill — backstop for referrals that should have
// been credited but weren't (e.g. completions that happened before the
// trigger was wired into /job-status). Scans every still-pending Referral
// row owned by the caller, checks if the referee has any completed
// booking ≥ ₹99, and fires the credit if so. Idempotent — only updates
// rows that are actually still 'pending'.
//
// Safe to expose to authenticated reps: they can only backfill their own
// rewards, and the policy gates (≥₹99, status='pending') stay intact.
const backfillMissedReferralRewards = async (req, res) => {
  try {
    const { Booking, sequelize } = await import('../models/index.js');
    const { creditWallet } = await import('./walletController.js');
    const { Op } = await import('sequelize');

    const pending = await Referral.findAll({
      where: { referrer_id: req.user.id, status: 'pending' },
    });
    if (pending.length === 0) {
      return res.json({ success: true, credited: 0, message: 'Nothing to backfill.' });
    }

    let credited = 0;
    let totalAmount = 0;
    for (const ref of pending) {
      // Find the earliest completed booking where the referee was either
      // the customer OR the agent — whichever direction the policy fires
      // for this referral.
      const firstCompleted = await Booking.findOne({
        where: {
          status: 'completed',
          [Op.or]: [{ customer_id: ref.referee_id }, { agent_id: ref.referee_id }],
        },
        order: [['completed_at', 'ASC']],
        attributes: ['id', 'price_quoted', 'completed_at'],
      });
      if (!firstCompleted) continue;
      const value = parseFloat(firstCompleted.price_quoted || 0);
      if (value < 99) {
        // Mark as completed so it stops surfacing in pending lists, but
        // don't credit (sub-₹99 booking, per policy).
        await ref.update({
          status: 'completed',
          first_service_completed_at: firstCompleted.completed_at || new Date(),
        });
        continue;
      }

      const t = await sequelize.transaction();
      try {
        await ref.update(
          {
            status: 'completed',
            first_service_completed_at: firstCompleted.completed_at || new Date(),
            credited_at: new Date(),
          },
          { transaction: t },
        );
        await creditWallet({
          userId: ref.referrer_id,
          amount: 20,
          source: 'referral_reward',
          description: 'Backfilled — referee\'s first paid service',
          bookingId: firstCompleted.id,
          transaction: t,
        });
        await t.commit();
        credited += 1;
        totalAmount += 20;
      } catch (e) {
        await t.rollback();
        console.error('[referral-backfill] failed for referral', ref.id, e?.message);
      }
    }

    res.json({
      success: true,
      credited,
      totalAmount,
      message: credited > 0
        ? `Credited ₹${totalAmount} across ${credited} previously-missed referral(s).`
        : 'No referrals were eligible — referees haven\'t completed a paid service yet.',
    });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ success: false, message: 'Backfill failed' });
  }
};

export {
  generateReferralCode,
  getReferralData,
  trackReferralClick,
  getReferralStats,
  applyReferralCode,
  backfillMissedReferralRewards,
};
