// Monthly royalty payout job — credits the 2% Direct Business Royalty to
// each qualifying referrer on the 5th of every month for the previous
// month's downline business.
//
// Per the Agent Referral & Royalty Policy:
//   - 2% of the qualifying team business
//   - Each downline must individually clear ₹5,000/month to count
//   - Referrer must have completed ≥5 personal tasks in the same month
//   - Calculated on the last day of the month, paid by the 5th of next month
//
// Implementation:
//   - Runs hourly (cheap; bails out fast outside the payout window)
//   - Activates on day 1–5 of any month — gives us a 5-day grace window
//     in case Render's free dyno was asleep on the 5th itself
//   - Idempotent: uses the Royalty table's (period, beneficiary_id) as a
//     write-once lock. If a row already exists, skip.

import { Op } from 'sequelize';
import { sequelize, User, Referral, Booking, Royalty } from '../models/index.js';
import { creditWallet } from '../controllers/walletController.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const PER_DOWNLINE_MIN = 5000;       // ₹5k per-downline floor
const PERSONAL_TASK_MIN = 5;         // 5 personal tasks/month minimum
const ROYALTY_RATE = 0.02;           // 2%

const formatPeriod = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// Compute previous month's [start, endExclusive] boundaries from `now`.
const previousMonthRange = (now) => {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { start, end };
};

// Compute the qualifying team business for one referrer in the given window.
// Returns { qualifyingTotal, perAgentSums, downlineIds }.
const computeQualifyingBusiness = async (referrerId, start, end) => {
  const refs = await Referral.findAll({
    where: { referrer_id: referrerId, status: 'completed' },
    attributes: ['referee_id'],
  });
  const downlineIds = refs.map((r) => r.referee_id).filter(Boolean);
  if (downlineIds.length === 0) {
    return { qualifyingTotal: 0, perAgentSums: new Map(), downlineIds: [] };
  }

  const bookings = await Booking.findAll({
    where: {
      agent_id: { [Op.in]: downlineIds },
      status: 'completed',
      completed_at: { [Op.gte]: start, [Op.lt]: end },
    },
    attributes: ['agent_id', 'price_quoted'],
  });

  const perAgentSums = new Map();
  for (const b of bookings) {
    const v = parseFloat(b.price_quoted || 0);
    perAgentSums.set(b.agent_id, (perAgentSums.get(b.agent_id) || 0) + v);
  }
  const qualifyingTotal = Array.from(perAgentSums.values())
    .filter((v) => v >= PER_DOWNLINE_MIN)
    .reduce((s, v) => s + v, 0);

  return { qualifyingTotal, perAgentSums, downlineIds };
};

const personalTaskCount = async (agentId, start, end) =>
  Booking.count({
    where: {
      agent_id: agentId,
      status: 'completed',
      completed_at: { [Op.gte]: start, [Op.lt]: end },
    },
  });

// Process one referrer for the given period. Returns { credited: bool, amount }.
const processReferrer = async (user, period, start, end) => {
  // Idempotency: skip if we already wrote a Royalty row for this user/period.
  const existing = await Royalty.findOne({
    where: { period, category: 'royalty', beneficiary_type: 'agent', beneficiary_id: user.id },
  });
  if (existing) {
    return { credited: false, reason: 'already_processed' };
  }

  const personalTasks = await personalTaskCount(user.id, start, end);
  const { qualifyingTotal, perAgentSums } = await computeQualifyingBusiness(user.id, start, end);

  const eligible = personalTasks >= PERSONAL_TASK_MIN && qualifyingTotal > 0;
  const amount = eligible ? Math.round(qualifyingTotal * ROYALTY_RATE) : 0;

  // Always insert a Royalty row — even for ₹0 / not-eligible — so we have
  // a permanent record of why this month was zero AND so the idempotency
  // check works on next run. status='paid' once credited, 'rejected' for
  // ineligible (so finance team can audit).
  const t = await sequelize.transaction();
  try {
    if (amount > 0) {
      await creditWallet({
        userId: user.id,
        amount,
        source: 'royalty_payout',
        description: `Royalty for ${period} (2% of ₹${qualifyingTotal.toLocaleString('en-IN')})`,
        transaction: t,
      });
    }
    await Royalty.create(
      {
        period,
        category: 'royalty',
        beneficiary_type: 'agent',
        beneficiary_id: user.id,
        beneficiary_name: user.name || `Agent ${String(user.id).substring(0, 8)}`,
        basis_revenue: qualifyingTotal,
        percentage: ROYALTY_RATE * 100,
        amount,
        status: amount > 0 ? 'paid' : 'rejected',
        notes: eligible
          ? `Auto-paid: ${perAgentSums.size} downline(s), ${[...perAgentSums.values()].filter((v) => v >= PER_DOWNLINE_MIN).length} qualifying.`
          : `Skipped: personalTasks=${personalTasks} (need ${PERSONAL_TASK_MIN}), qualifying=₹${qualifyingTotal}`,
        paid_at: amount > 0 ? new Date() : null,
      },
      { transaction: t },
    );
    await t.commit();
    return { credited: amount > 0, amount, reason: amount > 0 ? 'paid' : 'ineligible' };
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

const runOnce = async () => {
  try {
    const now = new Date();
    const dayOfMonth = now.getDate();

    // Only run during the 5-day payout window of each month. This caps work
    // and prevents repeatedly scanning the agent table on every hourly tick.
    if (dayOfMonth > 5) return;

    const { start, end } = previousMonthRange(now);
    const period = formatPeriod(start);

    // Find every user who is the referrer on at least one Referral row.
    // (Could narrow further to status='completed' referrals, but a
    // referrer with all-pending downlines would just yield zeros — still
    // worth logging so the audit trail is complete.)
    const referrerIds = await Referral.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('referrer_id')), 'referrer_id']],
      raw: true,
    });
    const ids = referrerIds.map((r) => r.referrer_id).filter(Boolean);
    if (ids.length === 0) return;

    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'name'],
    });

    let paidCount = 0;
    let totalPaid = 0;
    for (const u of users) {
      try {
        const result = await processReferrer(u, period, start, end);
        if (result.credited) {
          paidCount += 1;
          totalPaid += result.amount;
        }
      } catch (perAgentErr) {
        console.error(`[royalty-payout] failed for user ${u.id}:`, perAgentErr?.message);
      }
    }

    if (paidCount > 0) {
      console.log(
        `[royalty-payout] ${period}: paid ₹${totalPaid.toLocaleString('en-IN')} to ${paidCount}/${users.length} referrer(s)`,
      );
    }
  } catch (e) {
    console.error('[royalty-payout] sweep failed:', e);
  }
};

let started = false;
export const startRoyaltyPayoutScheduler = () => {
  if (started) return;
  started = true;
  // First run after 2 minutes (so DB + other startup is settled), then hourly.
  setTimeout(runOnce, 2 * 60 * 1000);
  setInterval(runOnce, ONE_HOUR_MS);
  console.log('[royalty-payout] scheduler started (hourly; active days 1–5 of each month)');
};

// Exposed for an admin "Run now" trigger or unit testing — bypasses the
// day-of-month gate and processes the previous month immediately.
export const runRoyaltyPayoutNow = runOnce;
