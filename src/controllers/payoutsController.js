import { Op } from 'sequelize';
import { Payout, User, AuditLog } from '../models/index.js';

export const listPayouts = async (req, res) => {
  try {
    const { status, agent_id, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (agent_id) where.agent_id = agent_id;

    const rows = await Payout.findAndCountAll({
      where,
      include: [{ model: User, as: 'agent', attributes: ['id', 'name', 'mobile', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: rows.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: rows.count },
    });
  } catch (err) {
    console.error('listPayouts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payouts' });
  }
};

export const createPayout = async (req, res) => {
  try {
    const { agent_id, amount, method, note } = req.body;
    if (!agent_id || !amount) return res.status(400).json({ success: false, message: 'agent_id and amount are required' });
    const payout = await Payout.create({ agent_id, amount, method, note, status: 'requested' });
    await AuditLog.record({ actor: req.user, action: 'payout.create', resource_type: 'payout', resource_id: payout.id, metadata: { amount } });
    res.status(201).json({ success: true, data: payout });
  } catch (err) {
    console.error('createPayout error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payout' });
  }
};

export const updatePayoutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reference, note } = req.body;
    if (!['approved', 'rejected', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (allowed: approved, rejected, paid)' });
    }
    const payout = await Payout.findByPk(id);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

    const updates = { status, note: note ?? payout.note };
    if (reference) updates.reference = reference;
    if (status === 'approved') { updates.approved_by = req.user.id; updates.approved_at = new Date(); }
    if (status === 'paid') { updates.paid_at = new Date(); if (!payout.approved_at) { updates.approved_by = req.user.id; updates.approved_at = new Date(); } }

    await payout.update(updates);
    await AuditLog.record({ actor: req.user, action: `payout.${status}`, resource_type: 'payout', resource_id: payout.id });
    res.json({ success: true, data: payout });
  } catch (err) {
    console.error('updatePayoutStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update payout' });
  }
};

export const payoutStats = async (req, res) => {
  try {
    const [requested, approved, paid] = await Promise.all([
      Payout.sum('amount', { where: { status: 'requested' } }).then((v) => Number(v || 0)),
      Payout.sum('amount', { where: { status: 'approved' } }).then((v) => Number(v || 0)),
      Payout.sum('amount', { where: { status: 'paid' } }).then((v) => Number(v || 0)),
    ]);
    res.json({ success: true, data: { requested, approved, paid } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load payout stats' });
  }
};
