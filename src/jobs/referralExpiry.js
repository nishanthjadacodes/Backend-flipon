// Daily referral-expiry job — flips Referral rows to 'expired' once their
// 90-day window passes without a completed first service.
//
// Per the Refer & Earn policy: "Referral credits are valid for 90 days from
// the date of credit." We track this on the Referral row via expires_at
// (set at applyReferralCode time). Without this job the rows stay 'pending'
// forever, polluting the rep's network view and making the milestone count
// inaccurate.
//
// Implementation note: same single-process setInterval pattern as the
// compliance alerts job. Runs once an hour — cheap query (single UPDATE),
// idempotent (only touches still-pending rows past their expiry).

import { Op } from 'sequelize';
import { Referral } from '../models/index.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

const runOnce = async () => {
  try {
    const now = new Date();
    const [updated] = await Referral.update(
      { status: 'expired' },
      {
        where: {
          status: 'pending',
          expires_at: { [Op.lt]: now },
        },
      },
    );
    if (updated > 0) {
      console.log(`[referral-expiry] marked ${updated} pending referral(s) as expired`);
    }
  } catch (e) {
    console.error('[referral-expiry] sweep failed:', e);
  }
};

let started = false;
export const startReferralExpiryScheduler = () => {
  if (started) return;
  started = true;
  // First run after 90s so the DB has time to come up; then hourly.
  setTimeout(runOnce, 90 * 1000);
  setInterval(runOnce, ONE_HOUR_MS);
  console.log('[referral-expiry] scheduler started (every 1h)');
};
