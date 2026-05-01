import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, AuditLog, Referral } from '../models/index.js';
import { ADMIN_ROLE_NAMES } from '../constants/permissions.js';

const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  mobile: u.mobile,
  role: u.role,
  is_active: u.is_active,
  is_verified: u.is_verified,
  created_at: u.created_at,
});

export const listAdmins = async (req, res) => {
  try {
    const rows = await User.findAll({
      where: { role: { [Op.in]: ADMIN_ROLE_NAMES } },
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: rows.map(safeUser) });
  } catch (err) {
    console.error('listAdmins error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, mobile, role, password } = req.body;
    if (!name || !email || !mobile || !role || !password) {
      return res.status(400).json({ success: false, message: 'name, email, mobile, role, password are required' });
    }
    if (!ADMIN_ROLE_NAMES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${ADMIN_ROLE_NAMES.join(', ')}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const existsEmail = await User.findByEmail(email);
    if (existsEmail) return res.status(409).json({ success: false, message: 'Email already in use' });
    const existsMobile = await User.findByMobile(mobile);
    if (existsMobile) return res.status(409).json({ success: false, message: 'Mobile already in use' });

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      mobile,
      role,
      password_hash: await bcrypt.hash(password, 10),
      is_active: true,
      is_verified: true,
    });
    await AuditLog.record({ actor: req.user, action: 'admin.create', resource_type: 'user', resource_id: user.id, metadata: { role } });
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('createAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!ADMIN_ROLE_NAMES.includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Target user is not an admin' });
    }

    const allowed = ['name', 'email', 'mobile', 'role', 'is_active', 'is_verified'];
    const updates = {};
    allowed.forEach((k) => { if (k in req.body) updates[k] = req.body[k]; });
    if (updates.email) updates.email = updates.email.toLowerCase();
    if (updates.role && !ADMIN_ROLE_NAMES.includes(updates.role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${ADMIN_ROLE_NAMES.join(', ')}` });
    }
    if (req.body.password) {
      if (req.body.password.length < 8) return res.status(400).json({ success: false, message: 'Password must be ≥ 8 characters' });
      updates.password_hash = await bcrypt.hash(req.body.password, 10);
    }
    await user.update(updates);
    await AuditLog.record({ actor: req.user, action: 'admin.update', resource_type: 'user', resource_id: id, metadata: Object.keys(updates) });
    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('updateAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to update admin' });
  }
};

export const deactivateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.update({ is_active: false });
    await AuditLog.record({ actor: req.user, action: 'admin.deactivate', resource_type: 'user', resource_id: id });
    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('deactivateAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate admin' });
  }
};

// End of the calendar quarter `now` falls in (used by the anti-poaching
// forfeit window — quarter is Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec).
const endOfQuarter = (now = new Date()) => {
  const q = Math.floor(now.getMonth() / 3);     // 0..3
  const monthAfterQuarter = (q + 1) * 3;        // 3, 6, 9, 12
  return new Date(now.getFullYear(), monthAfterQuarter, 1, 0, 0, 0, 0);
};

// POST /admin/users/:id/forfeit-royalty
// Per policy 4.2 — admin flags an anti-poaching violation; royalty for
// the rest of the current quarter is forfeited. Reason is mandatory so
// the audit trail captures the rationale.
export const forfeitRoyaltyForQuarter = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Reason required (anti-poaching evidence).' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const until = endOfQuarter(new Date());
    await user.update({
      royalty_forfeited_until: until,
      royalty_forfeit_reason: String(reason).substring(0, 250),
    });
    await AuditLog.record({
      actor: req.user,
      action: 'royalty.forfeit',
      resource_type: 'user',
      resource_id: id,
      metadata: { until: until.toISOString(), reason },
    });
    res.json({
      success: true,
      message: `Royalty forfeited until ${until.toISOString().substring(0, 10)}`,
      data: { royalty_forfeited_until: until, royalty_forfeit_reason: reason },
    });
  } catch (err) {
    console.error('forfeitRoyaltyForQuarter error:', err);
    res.status(500).json({ success: false, message: 'Failed to forfeit royalty' });
  }
};

// POST /admin/users/:id/clear-royalty-forfeit
// Reverses a forfeit (e.g. dispute resolved in agent's favour).
export const clearRoyaltyForfeit = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.update({ royalty_forfeited_until: null, royalty_forfeit_reason: null });
    await AuditLog.record({
      actor: req.user,
      action: 'royalty.forfeit_cleared',
      resource_type: 'user',
      resource_id: id,
    });
    res.json({ success: true, message: 'Royalty forfeit cleared' });
  } catch (err) {
    console.error('clearRoyaltyForfeit error:', err);
    res.status(500).json({ success: false, message: 'Failed to clear forfeit' });
  }
};

// POST /admin/users/:id/terminate-self-referral
// Per policy 4.3 — confirmed self-referral via duplicate accounts results
// in immediate account termination. We deactivate the user, expire any
// outstanding referrals they own, and forfeit any pending royalty.
export const terminateForSelfReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Hard deactivate the offender's account.
    await user.update({
      is_active: false,
      royalty_forfeited_until: new Date('2099-12-31'),
      royalty_forfeit_reason: `Self-referral violation: ${String(reason || 'admin-confirmed').substring(0, 220)}`,
    });

    // Expire any pending referrals they originated AND any pending
    // referrals where they are the referee — neither side should pay out
    // when the relationship was fraudulent.
    await Referral.update(
      { status: 'expired' },
      {
        where: {
          status: 'pending',
          [Op.or]: [{ referrer_id: id }, { referee_id: id }],
        },
      },
    );

    await AuditLog.record({
      actor: req.user,
      action: 'user.terminate.self_referral',
      resource_type: 'user',
      resource_id: id,
      metadata: { reason: reason || null },
    });
    res.json({ success: true, message: 'Account terminated; pending referrals expired.' });
  } catch (err) {
    console.error('terminateForSelfReferral error:', err);
    res.status(500).json({ success: false, message: 'Failed to terminate account' });
  }
};
