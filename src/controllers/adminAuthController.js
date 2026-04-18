import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AdminRole } from '../models/index.js';

const ADMIN_ROLES = [
  'super_admin',
  'operations_manager',
  'b2b_admin',
  'finance_admin',
  'customer_support',
];

const issueToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, mobile: user.mobile, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

const sanitize = (user, permissions) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  is_active: user.is_active,
  is_verified: user.is_verified,
  permissions: permissions || [],
});

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Not an admin account' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account disabled' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const role = await AdminRole.findOne({ where: { role_name: user.role } });
    const permissions = role ? (Array.isArray(role.permissions) ? role.permissions : []) : [];

    const token = issueToken(user);
    return res.json({ success: true, token, user: sanitize(user, permissions) });
  } catch (err) {
    console.error('adminLogin error:', err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const role = await AdminRole.findOne({ where: { role_name: user.role } });
    const permissions = role ? (Array.isArray(role.permissions) ? role.permissions : []) : [];
    return res.json({ success: true, user: sanitize(user, permissions) });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    const user = await User.findByPk(req.user.id);
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, message: 'No password set for this account' });
    }
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });
    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();
    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};
