import { Op } from 'sequelize';
import { Royalty, Booking, PlatformConfig, AuditLog } from '../models/index.js';

// Utility — resolve the platform-wide royalty percentage from the
// Financial Config panel set by Super Admin. Defaults to 2 per the PDF.
const getRoyaltyPercentage = async () => {
  try {
    const row = await PlatformConfig.findOne({ where: { key: 'royalty_percentage' } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : 2;
  } catch {
    return 2;
  }
};

// Return a period string "YYYY-MM" for a given month offset from today
// (0 = current month, 1 = last month, …).
const periodFor = (monthsAgo = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 7);
};

const periodBounds = (period) => {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return { start, end };
};

// GET /api/admin/royalty
//   ?period=YYYY-MM             (optional)
//   ?status=pending|approved|…  (optional)
export const listRoyalties = async (req, res) => {
  try {
    const { period, status, limit = 200, page = 1 } = req.query;
    const where = {};
    if (period) where.period = period;
    if (status) where.status = status;

    const rows = await Royalty.findAndCountAll({
      where,
      order: [['period', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    res.json({
      success: true,
      data: rows.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: rows.count,
      },
    });
  } catch (err) {
    console.error('listRoyalties error:', err);
    res.status(500).json({ success: false, message: 'Failed to list royalties' });
  }
};

// GET /api/admin/royalty/summary
// Returns an at-a-glance view for the Finance dashboard:
//   { period, percentage, basis_revenue, amount, rows: [] }
// rows[] includes any already-persisted entries for the period plus a
// synthetic 'platform' draft if no ledger entry exists yet.
export const royaltySummary = async (req, res) => {
  try {
    const period = req.query.period || periodFor(1); // default: last closed month
    const { start, end } = periodBounds(period);
    const percentage = await getRoyaltyPercentage();

    const basis = await Booking.sum('final_price', {
      where: {
        created_at: { [Op.gte]: start, [Op.lt]: end },
        payment_status: 'paid',
      },
    }).then((v) => Number(v || 0));

    const amount = Math.round(((basis * percentage) / 100) * 100) / 100;

    const rows = await Royalty.findAll({
      where: { period },
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      data: {
        period,
        percentage,
        basis_revenue: basis,
        expected_amount: amount,
        rows,
      },
    });
  } catch (err) {
    console.error('royaltySummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load royalty summary' });
  }
};

// POST /api/admin/royalty/generate  { period }
// Creates the "platform" royalty row for the period if it doesn't exist.
// Idempotent — returns the existing row if already generated.
export const generateRoyalty = async (req, res) => {
  try {
    const period = req.body?.period || periodFor(1);
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'period must be YYYY-MM' });
    }

    const percentage = await getRoyaltyPercentage();
    const { start, end } = periodBounds(period);

    const basis = await Booking.sum('final_price', {
      where: {
        created_at: { [Op.gte]: start, [Op.lt]: end },
        payment_status: 'paid',
      },
    }).then((v) => Number(v || 0));

    const amount = Math.round(((basis * percentage) / 100) * 100) / 100;

    const [row, created] = await Royalty.findOrCreate({
      where: { period, category: 'royalty', beneficiary_type: 'platform', beneficiary_id: null },
      defaults: {
        beneficiary_name: `Platform royalty ${period}`,
        basis_revenue: basis,
        percentage,
        amount,
        status: 'pending',
      },
    });

    if (!created) {
      // Refresh the basis + amount if the period's gross changed (bookings
      // may have been finalized after first generation).
      if (Number(row.basis_revenue) !== basis || Number(row.percentage) !== percentage) {
        await row.update({ basis_revenue: basis, percentage, amount });
      }
    }

    await AuditLog.record({
      actor: req.user,
      action: created ? 'royalty.generate' : 'royalty.refresh',
      resource_type: 'royalty',
      resource_id: row.id,
      metadata: { period, basis, percentage, amount },
    });

    res.status(created ? 201 : 200).json({ success: true, data: row });
  } catch (err) {
    console.error('generateRoyalty error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate royalty' });
  }
};

// PUT /api/admin/royalty/:id/status  { status: 'approved'|'rejected'|'paid', notes? }
export const updateRoyaltyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    if (!['approved', 'rejected', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (approved | rejected | paid)' });
    }

    const row = await Royalty.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: 'Royalty entry not found' });

    const updates = { status, notes: notes ?? row.notes };
    if (status === 'approved' && !row.approved_at) {
      updates.approved_by = req.user?.id;
      updates.approved_at = new Date();
    }
    if (status === 'paid') {
      updates.paid_at = new Date();
      if (!row.approved_at) {
        updates.approved_by = req.user?.id;
        updates.approved_at = new Date();
      }
    }

    await row.update(updates);
    await AuditLog.record({
      actor: req.user,
      action: `royalty.${status}`,
      resource_type: 'royalty',
      resource_id: row.id,
      metadata: { period: row.period },
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('updateRoyaltyStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update royalty' });
  }
};

// POST /api/admin/royalty/commissions  { period, entries: [{ beneficiary_name, amount, notes }] }
// Adds custom commission rows for a period (team bonuses, ad-hoc
// commissions). Each row starts as 'pending' awaiting approval.
export const addCommissionEntries = async (req, res) => {
  try {
    const { period, entries } = req.body || {};
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'period must be YYYY-MM' });
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'entries[] required' });
    }

    const created = [];
    for (const entry of entries) {
      if (!entry.beneficiary_name || entry.amount === undefined) continue;
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const row = await Royalty.create({
        period,
        category: 'commission',
        beneficiary_type: entry.beneficiary_type || 'team',
        beneficiary_id: entry.beneficiary_id || null,
        beneficiary_name: String(entry.beneficiary_name).slice(0, 150),
        basis_revenue: 0,
        percentage: 0,
        amount,
        notes: entry.notes || null,
        status: 'pending',
      });
      created.push(row);
    }

    await AuditLog.record({
      actor: req.user,
      action: 'royalty.commission.add',
      resource_type: 'royalty',
      metadata: { period, count: created.length },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('addCommissionEntries error:', err);
    res.status(500).json({ success: false, message: 'Failed to record commissions' });
  }
};
