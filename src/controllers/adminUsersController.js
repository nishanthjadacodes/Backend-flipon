import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, AuditLog } from '../models/index.js';
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
