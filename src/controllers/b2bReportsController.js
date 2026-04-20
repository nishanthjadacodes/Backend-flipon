import { Op, fn, col, literal } from 'sequelize';
import {
  Enquiry,
  EnquiryStage,
  Service,
  CompanyProfile,
  sequelize,
} from '../models/index.js';

/**
 * B2B-only reports. These only touch the `enquiries` / `enquiry_stages` /
 * `company_profiles` tables — never `bookings` (which is B2C). A b2b_admin
 * consuming this is therefore unable to see B2C customer data, consistent
 * with the "Restriction" clause in the spec.
 *
 * All endpoints accept an optional ?from=YYYY-MM-DD&to=YYYY-MM-DD window.
 * Defaults: last 90 days.
 */

const parseWindow = (req) => {
  const now = new Date();
  const defFrom = new Date(now);
  defFrom.setDate(defFrom.getDate() - 90);
  const from = req.query.from ? new Date(req.query.from) : defFrom;
  const to = req.query.to ? new Date(req.query.to) : now;
  // Treat `to` as end-of-day so partial days are included.
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

// Revenue is only "recognised" once the customer accepts and work is in
// motion. rejected/cancelled/quoted don't count. Finance's view of revenue
// may differ (invoice vs recognised) — this is intentionally the
// operations-centric view.
const REVENUE_STATUSES = ['accepted', 'in_progress', 'completed'];

// Convert decimal string ("1500.00") from Sequelize → number. Postgres/MySQL
// return DECIMAL as strings to avoid JS precision loss.
const toNum = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

// ─── GET /api/admin/reports/b2b/summary ─────────────────────────────────────
export const summary = async (req, res) => {
  try {
    const { from, to } = parseWindow(req);
    const window = { created_at: { [Op.between]: [from, to] } };

    // Total enquiries + status breakdown
    const statusCounts = await Enquiry.findAll({
      where: window,
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)]));
    const totalEnquiries = Object.values(byStatus).reduce((a, b) => a + b, 0);

    // Revenue rows (accepted/in_progress/completed)
    const revenueRows = await Enquiry.findAll({
      where: {
        ...window,
        status: { [Op.in]: REVENUE_STATUSES },
      },
      attributes: ['quote_service_fee', 'quote_govt_fees'],
      raw: true,
    });
    const revenue = revenueRows.reduce(
      (sum, r) => sum + toNum(r.quote_service_fee) + toNum(r.quote_govt_fees),
      0,
    );

    // Acceptance rate — of enquiries that did receive a quote, how many were
    // accepted (vs rejected). Ignores still-open `quoted` rows.
    const quotedOrBeyond = ['quoted', 'accepted', 'rejected', 'in_progress', 'completed'];
    const accepted = ['accepted', 'in_progress', 'completed'];
    const decidedQuoted = quotedOrBeyond.reduce((a, s) => a + (byStatus[s] || 0), 0);
    const acceptedCount = accepted.reduce((a, s) => a + (byStatus[s] || 0), 0);
    const acceptanceRate = decidedQuoted > 0 ? acceptedCount / decidedQuoted : null;

    // Average time-to-quote — days between created_at and quote_issued_at
    // for enquiries that have been quoted (or beyond).
    const quotedSample = await Enquiry.findAll({
      where: {
        ...window,
        quote_issued_at: { [Op.not]: null },
      },
      attributes: ['created_at', 'quote_issued_at'],
      raw: true,
    });
    const ttqDaysSum = quotedSample.reduce((sum, r) => {
      const d = (new Date(r.quote_issued_at) - new Date(r.created_at)) / 86400000;
      return sum + (Number.isFinite(d) ? d : 0);
    }, 0);
    const avgTimeToQuoteDays = quotedSample.length > 0 ? ttqDaysSum / quotedSample.length : null;

    res.json({
      success: true,
      data: {
        window: { from, to },
        total_enquiries: totalEnquiries,
        by_status: byStatus,
        revenue_inr: Math.round(revenue * 100) / 100,
        acceptance_rate: acceptanceRate == null ? null : Math.round(acceptanceRate * 10000) / 10000,
        avg_time_to_quote_days: avgTimeToQuoteDays == null ? null : Math.round(avgTimeToQuoteDays * 10) / 10,
        revenue_recognition_note: 'Revenue sums accepted + in_progress + completed quotes (service fee + govt fees).',
      },
    });
  } catch (error) {
    console.error('b2b summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate summary' });
  }
};

// ─── GET /api/admin/reports/b2b/revenue ─────────────────────────────────────
// Time-series revenue. ?groupBy=day|week|month (default month).
export const revenueSeries = async (req, res) => {
  try {
    const { from, to } = parseWindow(req);
    const groupBy = ['day', 'week', 'month'].includes(req.query.groupBy) ? req.query.groupBy : 'month';

    // MySQL/TiDB DATE_FORMAT patterns
    const fmt = groupBy === 'day' ? '%Y-%m-%d'
      : groupBy === 'week' ? '%x-W%v' // ISO-week
      : '%Y-%m';

    const rows = await Enquiry.findAll({
      where: {
        created_at: { [Op.between]: [from, to] },
        status: { [Op.in]: REVENUE_STATUSES },
      },
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), fmt), 'bucket'],
        [fn('SUM', literal('COALESCE(quote_service_fee, 0) + COALESCE(quote_govt_fees, 0)')), 'revenue'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['bucket'],
      order: [[literal('bucket'), 'ASC']],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        window: { from, to },
        group_by: groupBy,
        series: rows.map((r) => ({
          bucket: r.bucket,
          revenue_inr: toNum(r.revenue),
          count: Number(r.count),
        })),
      },
    });
  } catch (error) {
    console.error('b2b revenue series error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate revenue series' });
  }
};

// ─── GET /api/admin/reports/b2b/funnel ──────────────────────────────────────
// Enquiry conversion funnel: submitted → quoted → accepted → completed.
export const funnel = async (req, res) => {
  try {
    const { from, to } = parseWindow(req);
    const rows = await Enquiry.findAll({
      where: { created_at: { [Op.between]: [from, to] } },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));

    // Progressive funnel — each stage counts the row AND everything downstream.
    const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const quotedOrBeyond = (byStatus.quoted || 0) + (byStatus.accepted || 0)
      + (byStatus.in_progress || 0) + (byStatus.completed || 0) + (byStatus.rejected || 0);
    const acceptedOrBeyond = (byStatus.accepted || 0) + (byStatus.in_progress || 0) + (byStatus.completed || 0);
    const completed = byStatus.completed || 0;

    res.json({
      success: true,
      data: {
        window: { from, to },
        submitted: all,
        quoted: quotedOrBeyond,
        accepted: acceptedOrBeyond,
        completed,
        raw_by_status: byStatus,
      },
    });
  } catch (error) {
    console.error('b2b funnel error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate funnel' });
  }
};

// ─── GET /api/admin/reports/b2b/by-service ──────────────────────────────────
// Top services by enquiry count + realised revenue within the window.
export const byService = async (req, res) => {
  try {
    const { from, to } = parseWindow(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const rows = await Enquiry.findAll({
      where: { created_at: { [Op.between]: [from, to] } },
      attributes: [
        'service_id',
        [fn('COUNT', col('Enquiry.id')), 'enquiry_count'],
        [fn('SUM', literal(
          `CASE WHEN status IN ('accepted','in_progress','completed')
                THEN COALESCE(quote_service_fee, 0) + COALESCE(quote_govt_fees, 0)
                ELSE 0 END`
        )), 'revenue'],
      ],
      include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'category'] }],
      group: ['service_id', 'service.id'],
      order: [[literal('revenue'), 'DESC'], [literal('enquiry_count'), 'DESC']],
      limit,
      subQuery: false,
    });

    res.json({
      success: true,
      data: {
        window: { from, to },
        rows: rows.map((r) => ({
          service_id: r.service_id,
          name: r.service?.name || '(deleted)',
          category: r.service?.category || null,
          enquiry_count: Number(r.get('enquiry_count')),
          revenue_inr: toNum(r.get('revenue')),
        })),
      },
    });
  } catch (error) {
    console.error('b2b by-service error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate by-service report' });
  }
};

// ─── GET /api/admin/reports/b2b/by-company ──────────────────────────────────
// Top corporate clients by total realised revenue within the window.
export const byCompany = async (req, res) => {
  try {
    const { from, to } = parseWindow(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const rows = await Enquiry.findAll({
      where: { created_at: { [Op.between]: [from, to] } },
      attributes: [
        'company_profile_id',
        [fn('COUNT', col('Enquiry.id')), 'enquiry_count'],
        [fn('SUM', literal(
          `CASE WHEN status IN ('accepted','in_progress','completed')
                THEN COALESCE(quote_service_fee, 0) + COALESCE(quote_govt_fees, 0)
                ELSE 0 END`
        )), 'revenue'],
      ],
      include: [{ model: CompanyProfile, as: 'companyProfile', attributes: ['id', 'legal_entity_name', 'gstin'] }],
      group: ['company_profile_id', 'companyProfile.id'],
      order: [[literal('revenue'), 'DESC']],
      limit,
      subQuery: false,
    });

    res.json({
      success: true,
      data: {
        window: { from, to },
        rows: rows.map((r) => ({
          company_profile_id: r.company_profile_id,
          legal_entity_name: r.companyProfile?.legal_entity_name || null,
          gstin: r.companyProfile?.gstin || null,
          enquiry_count: Number(r.get('enquiry_count')),
          revenue_inr: toNum(r.get('revenue')),
        })),
      },
    });
  } catch (error) {
    console.error('b2b by-company error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate by-company report' });
  }
};

// ─── GET /api/admin/reports/b2b/stage-health ────────────────────────────────
// How many enquiries are currently stuck in each granular pipeline stage?
// Helps the liaisoning expert spot bottlenecks (e.g. 8 enquiries parked on
// "Inspection Scheduled" for > 14 days).
export const stageHealth = async (req, res) => {
  try {
    const stuckDays = Number(req.query.stuck_days) || 14;
    const stuckSince = new Date(Date.now() - stuckDays * 86400000);

    const rows = await EnquiryStage.findAll({
      where: {
        status: 'in_progress',
        started_at: { [Op.lt]: stuckSince },
      },
      attributes: [
        'stage_key',
        [fn('COUNT', col('id')), 'stuck_count'],
      ],
      group: ['stage_key'],
      order: [[literal('stuck_count'), 'DESC']],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        threshold_days: stuckDays,
        stages: rows.map((r) => ({ stage_key: r.stage_key, stuck_count: Number(r.stuck_count) })),
      },
    });
  } catch (error) {
    console.error('b2b stage-health error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate stage-health report' });
  }
};

// Silences "unused" warning from sequelize helper import — kept around in
// case future queries need the named exports.
// eslint-disable-next-line no-unused-vars
const _keepSequelize = sequelize;
