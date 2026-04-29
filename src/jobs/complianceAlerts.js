// Daily compliance-alert scheduler — sends 90/60/30-day push notifications
// for documents that are about to expire.
//
// Implementation note: Render's free dyno is single-process, so we use a
// plain setInterval loop rather than node-cron. The job runs every 6 hours
// (~4 times/day) which gives us at-most-1 notification per tier per doc
// while tolerating restarts.

import { Op } from 'sequelize';
import { VaultDocument, User } from '../models/index.js';
import { sendPushNotification } from '../services/notificationService.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// Alert tiers, ordered most-imminent first. The cron picks the highest-tier
// alert that hasn't yet been sent for a given document.
const TIERS = [
  {
    key: '30',
    daysMin: 0,
    daysMax: 30,
    title: '🚨 Action Required Immediately',
    body: (label) =>
      `${label} expires in under 30 days. Tap to renew via FliponeX and avoid penalties.`,
  },
  {
    key: '60',
    daysMin: 30,
    daysMax: 60,
    title: '⏳ Renewal Reminder',
    body: (label) =>
      `${label} expires in 60 days. FliponeX experts are ready to handle the renewal.`,
  },
  {
    key: '90',
    daysMin: 60,
    daysMax: 90,
    title: '📅 Early Warning',
    body: (label) =>
      `${label} expires in 90 days. Should we start the documentation now?`,
  },
];

const COMPLIANCE_LABELS = {
  factory_license: 'Factory License',
  fire_noc: 'Fire NOC',
  pollution_noc: 'Pollution NOC',
  gst_certificate: 'GST Certificate',
  incorporation: 'Certificate of Incorporation',
  iso_cert: 'ISO Certification',
  trade_license: 'Trade License',
  esi_pf: 'ESI / PF Registration',
  other: 'Compliance Document',
};

// Pick the most urgent tier that hasn't already been notified for this doc.
const pickTier = (daysLeft, lastTierSent) => {
  for (const tier of TIERS) {
    if (daysLeft >= tier.daysMin && daysLeft < tier.daysMax) {
      // If we already sent this tier or a more-urgent one, skip.
      if (!lastTierSent) return tier;
      if (Number(lastTierSent) > Number(tier.key)) return tier; // newer tier is smaller (30<60<90)
      return null;
    }
  }
  return null;
};

const runOnce = async () => {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 91 * ONE_DAY_MS); // anything expiring in <=91 days

    const docs = await VaultDocument.findAll({
      where: {
        compliance_type: { [Op.ne]: null },
        expiry_date: {
          [Op.gte]: now,
          [Op.lte]: horizon,
        },
      },
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'expo_push_token', 'name'] },
      ],
    });

    let sent = 0;
    for (const doc of docs) {
      // Don't re-spam — skip if we already sent any alert in the last 24h.
      if (doc.last_alert_sent_at && now - new Date(doc.last_alert_sent_at) < ONE_DAY_MS) continue;

      const exp = new Date(doc.expiry_date);
      exp.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((exp - now) / ONE_DAY_MS);
      if (daysLeft < 0) continue; // already expired — separate post-expiry flow

      const tier = pickTier(daysLeft, doc.last_alert_tier);
      if (!tier) continue;

      const label = COMPLIANCE_LABELS[doc.compliance_type] || doc.compliance_type;

      try {
        await sendPushNotification(doc.customer_id, {
          title: tier.title,
          message: tier.body(label),
          data: {
            type: 'compliance_alert',
            document_id: doc.id,
            tier: tier.key,
            daysLeft,
          },
          priority: tier.key === '30' ? 'high' : 'normal',
        });
        await doc.update({
          last_alert_tier: tier.key,
          last_alert_sent_at: now,
        });
        sent += 1;
      } catch (pushErr) {
        console.error(`[compliance-alerts] push failed for doc ${doc.id}:`, pushErr?.message);
      }
    }

    if (sent > 0) {
      console.log(`[compliance-alerts] scanned ${docs.length} docs, sent ${sent} notifications`);
    }
  } catch (e) {
    console.error('[compliance-alerts] scan failed:', e);
  }
};

// Boot the loop. First run is delayed 60s after server start so the DB has
// time to come up; subsequent runs every 6h.
let started = false;
export const startComplianceAlertScheduler = () => {
  if (started) return;
  started = true;
  setTimeout(runOnce, 60 * 1000);
  setInterval(runOnce, SIX_HOURS_MS);
  console.log('[compliance-alerts] scheduler started (every 6h)');
};

export { runOnce };
