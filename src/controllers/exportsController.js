// Server-side CSV exports for the admin panel's Global Exports feature.
//
// Each handler streams CSV directly via Content-Disposition so the
// browser saves a .csv file. Every export records an AuditLog entry
// (action: `export.<type>`) so a Super Admin can see who downloaded
// what data, when, and how many rows.
//
// Why server-side: the prior frontend-only `downloadCsv()` helper was
// limited to whatever the UI had paginated into memory, and it left
// no audit trail. These endpoints query the full dataset and log the
// download — the two RBAC gaps flagged in the audit.

import { Op } from 'sequelize';
import { User, Booking, Service } from '../models/index.js';
import AuditLog from '../models/AuditLog.js';

// ─── CSV serialization (server-side equivalent of utils/csv.ts) ──────────
const escapeCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows, columns) => {
  if (!rows || rows.length === 0) {
    // Always return a header line so the file isn't an empty 0-byte
    // download — the user at least sees what would have been exported.
    return columns.map((c) => escapeCell(c.label)).join(',') + '\n';
  }
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
};

const sendCsv = (res, filename, csv) => {
  // Filename gets timestamped so successive downloads don't overwrite
  // each other in the user's Downloads folder.
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const finalName = filename.includes('.csv')
    ? filename
    : `${filename}-${stamp}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${finalName}"`);
  res.status(200).send(csv);
};

// ─── 1. Financial export ─────────────────────────────────────────────────
// Every completed booking with the agent's commission, the customer-
// paid gross, payment status, and dates. This is what finance team
// reconciles against the bank statement and Razorpay dashboard.
export const exportFinancial = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        status: { [Op.in]: ['completed', 'submitted'] },
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile', 'email'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'mobile'] },
        { model: Service, as: 'service', attributes: ['id', 'name', 'category', 'partner_earning', 'user_cost'] },
      ],
      order: [['completed_at', 'DESC']],
      limit: 50000, // hard ceiling — even mid-tier MySQL handles this fine
    });

    const columns = [
      { label: 'Booking ID',        value: (b) => b.id },
      { label: 'Status',            value: (b) => b.status },
      { label: 'Customer Name',     value: (b) => b.customer?.name || '' },
      { label: 'Customer Mobile',   value: (b) => b.customer?.mobile || '' },
      { label: 'Customer Email',    value: (b) => b.customer?.email || '' },
      { label: 'Agent Name',        value: (b) => b.agent?.name || '' },
      { label: 'Agent Mobile',      value: (b) => b.agent?.mobile || '' },
      { label: 'Service',           value: (b) => b.service?.name || '' },
      { label: 'Category',          value: (b) => b.service?.category || '' },
      { label: 'Gross (₹)',         value: (b) => Number(b.price_quoted || b.service?.user_cost || 0).toFixed(2) },
      { label: 'Agent Commission (₹)', value: (b) => {
          const cut = Number(b.service?.partner_earning || 0);
          if (cut > 0) return cut.toFixed(2);
          return Number(b.price_quoted || b.service?.user_cost || 0).toFixed(2);
        }
      },
      { label: 'Payment Status',    value: (b) => b.payment_status || '' },
      { label: 'Payment Method',    value: (b) => b.payment_method || '' },
      { label: 'Created At',        value: (b) => b.created_at ? new Date(b.created_at).toISOString() : '' },
      { label: 'Completed At',      value: (b) => b.completed_at ? new Date(b.completed_at).toISOString() : '' },
    ];

    const csv = toCsv(bookings, columns);

    await AuditLog.record({
      actor: req.user,
      action: 'export.financial',
      resource_type: 'export',
      metadata: { rows: bookings.length },
      ip: req.ip,
    });

    sendCsv(res, 'flipone-financial-export', csv);
  } catch (err) {
    console.error('exportFinancial error:', err);
    res.status(500).json({ success: false, message: 'Failed to export financial data' });
  }
};

// ─── 2. Users export ─────────────────────────────────────────────────────
// All users — customers, agents, admins — for compliance / GDPR-style
// data inventory. Sensitive cols (password_hash, OTP) are deliberately
// excluded; this is a roster export, not a credentials dump.
export const exportUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'id', 'name', 'email', 'mobile', 'role',
        'is_active', 'is_verified', 'created_at', 'updated_at',
      ],
      order: [['created_at', 'DESC']],
      limit: 50000,
    });

    const columns = [
      { label: 'User ID',     value: (u) => u.id },
      { label: 'Name',        value: (u) => u.name || '' },
      { label: 'Email',       value: (u) => u.email || '' },
      { label: 'Mobile',      value: (u) => u.mobile || '' },
      { label: 'Role',        value: (u) => u.role || '' },
      { label: 'Active',      value: (u) => (u.is_active ? 'Yes' : 'No') },
      { label: 'Verified',    value: (u) => (u.is_verified ? 'Yes' : 'No') },
      { label: 'Created At',  value: (u) => u.created_at ? new Date(u.created_at).toISOString() : '' },
      { label: 'Updated At',  value: (u) => u.updated_at ? new Date(u.updated_at).toISOString() : '' },
    ];

    const csv = toCsv(users, columns);

    await AuditLog.record({
      actor: req.user,
      action: 'export.users',
      resource_type: 'export',
      metadata: { rows: users.length },
      ip: req.ip,
    });

    sendCsv(res, 'flipone-users-export', csv);
  } catch (err) {
    console.error('exportUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to export users' });
  }
};

// ─── 3. Agents export ────────────────────────────────────────────────────
// Just the field-rep roster with KYC + earnings totals. Useful for
// payroll reconciliation and KYC audit.
export const exportAgents = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: { role: 'agent' },
      attributes: [
        'id', 'name', 'email', 'mobile', 'is_active', 'is_verified',
        'kyc_verified_at', 'rating', 'total_jobs_completed',
        'wallet_balance', 'online_status', 'created_at',
      ],
      order: [['created_at', 'DESC']],
      limit: 50000,
    });

    const columns = [
      { label: 'Agent ID',          value: (a) => a.id },
      { label: 'Name',              value: (a) => a.name || '' },
      { label: 'Email',             value: (a) => a.email || '' },
      { label: 'Mobile',            value: (a) => a.mobile || '' },
      { label: 'Active',            value: (a) => (a.is_active ? 'Yes' : 'No') },
      { label: 'KYC Verified',      value: (a) => (a.is_verified ? 'Yes' : 'No') },
      { label: 'KYC Verified At',   value: (a) => a.kyc_verified_at ? new Date(a.kyc_verified_at).toISOString() : '' },
      { label: 'Rating',            value: (a) => a.rating != null ? Number(a.rating).toFixed(1) : '' },
      { label: 'Jobs Completed',    value: (a) => a.total_jobs_completed || 0 },
      { label: 'Wallet Balance (₹)', value: (a) => Number(a.wallet_balance || 0).toFixed(2) },
      { label: 'Online Now',        value: (a) => (a.online_status ? 'Yes' : 'No') },
      { label: 'Created At',        value: (a) => a.created_at ? new Date(a.created_at).toISOString() : '' },
    ];

    const csv = toCsv(agents, columns);

    await AuditLog.record({
      actor: req.user,
      action: 'export.agents',
      resource_type: 'export',
      metadata: { rows: agents.length },
      ip: req.ip,
    });

    sendCsv(res, 'flipone-agents-export', csv);
  } catch (err) {
    console.error('exportAgents error:', err);
    res.status(500).json({ success: false, message: 'Failed to export agents' });
  }
};
