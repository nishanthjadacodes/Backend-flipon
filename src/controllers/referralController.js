import { User, Referral, Booking } from '../models/index.js';
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

    // Milestones per policy: Bronze 5, Silver 10, Gold 25
    const milestones = {
      bronze: { required: 5, achieved: successfulReferrals >= 5, bonus: 50, received: successfulReferrals >= 5 },
      silver: { required: 10, achieved: successfulReferrals >= 10, bonus: 150, received: successfulReferrals >= 10 },
      gold: { required: 25, achieved: successfulReferrals >= 25, bonus: 500, received: successfulReferrals >= 25, status: 'Priority User' },
    };

    // Royalty: 2% of downline agents' completed booking values this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const downlineAgentIds = referrals.filter(r => r.referee_id).map(r => r.referee_id);
    let totalTeamBusiness = 0;
    let activeMentees = 0;

    if (downlineAgentIds.length > 0) {
      const downlineBookings = await Booking.findAll({
        where: {
          agent_id: { [Op.in]: downlineAgentIds },
          status: 'completed',
          completed_at: { [Op.gte]: monthStart },
        },
        attributes: ['agent_id', 'price_quoted'],
      });
      totalTeamBusiness = downlineBookings.reduce((sum, b) => sum + parseFloat(b.price_quoted || 0), 0);
      activeMentees = new Set(downlineBookings.map(b => b.agent_id)).size;
    }

    // Personal activity check (min 5 tasks/month for royalty eligibility)
    const personalTasks = await Booking.count({
      where: {
        agent_id: req.user.id,
        status: 'completed',
        completed_at: { [Op.gte]: monthStart },
      },
    });

    const currentMonthRoyalty = personalTasks >= 5 ? Math.round(totalTeamBusiness * 0.02) : 0;

    // Format referral list
    const referralList = referrals.map(r => ({
      id: r.id,
      name: r.referee?.name || 'Pending Signup',
      mobile: r.referee?.mobile || '',
      status: r.status,
      signupDate: r.referee?.created_at || r.created_at,
      firstServiceDate: r.first_service_completed_at,
      reward: r.status === 'completed' ? parseFloat(r.reward_amount) : 0,
      rewardDate: r.credited_at,
      expiryDate: r.expires_at,
    }));

    res.json({
      success: true,
      referralCode: user.referral_code,
      referralLink: `https://fliponex.app/referral/${user.referral_code}`,
      totalReferrals,
      successfulReferrals,
      totalEarned,
      availableCredits,
      usedCredits: 0,
      expiredCredits: 0,
      referrals: referralList,
      milestones,
      royalty: {
        totalTeamBusiness,
        activeMentees,
        currentMonthRoyalty,
        personalTasksCompleted: personalTasks,
        minimumTeamTurnoverMet: totalTeamBusiness >= 5000,
        qualityScore: parseFloat(user.rating || 0),
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

export { generateReferralCode, getReferralData, trackReferralClick, getReferralStats, applyReferralCode };
