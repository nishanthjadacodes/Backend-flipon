import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AdminRole, Notification } from '../models/index.js';

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

// Pretty-print a role enum value for notification bodies.
const prettyRole = (r) =>
  String(r || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Bell-inbox notifications used by adminSignup. Both queries skip the
// new admin themselves (so a freshly-signed-up super_admin doesn't get
// pinged about their own signup) and silently no-op if nobody with the
// super_admin role exists yet (first-ever signup case).
const notifySuperAdminsOfNewAdmin = async ({ newAdmin }) => {
  try {
    const targets = await User.findAll({
      where: { role: 'super_admin', is_active: true },
      attributes: ['id'],
    });
    const ids = targets
      .map((u) => u.id)
      .filter((id) => id !== newAdmin.id);
    if (ids.length === 0) return;
    await Notification.notifyMany(ids, {
      type: 'admin.created',
      title: `🆕 New admin: ${newAdmin.name}`,
      body:
        `${newAdmin.name} just joined as ${prettyRole(newAdmin.role)}. ` +
        `Email: ${newAdmin.email}${newAdmin.mobile ? ` · Mobile: ${newAdmin.mobile}` : ''}.`,
      metadata: {
        new_admin_id: newAdmin.id,
        new_admin_name: newAdmin.name,
        new_admin_email: newAdmin.email,
        new_admin_role: newAdmin.role,
      },
    });
  } catch (e) {
    // Never block the signup flow on a notification failure.
    console.warn('[adminSignup] new-admin notify failed:', e?.message);
  }
};

const notifySuperAdminsOfJoinRequest = async ({
  name, email, mobile, requestedRole, currentHolder,
}) => {
  try {
    const targets = await User.findAll({
      where: { role: 'super_admin', is_active: true },
      attributes: ['id'],
    });
    if (targets.length === 0) return;
    await Notification.notifyMany(
      targets.map((u) => u.id),
      {
        type: 'admin.join_request',
        title: `🔔 Admin signup request: ${name}`,
        body:
          `${name} (${email}${mobile ? `, ${mobile}` : ''}) tried to claim the ` +
          `${prettyRole(requestedRole)} seat — currently held by ${currentHolder.name}. ` +
          'Contact them, deactivate the current holder, or ignore.',
        metadata: {
          requester_name: name,
          requester_email: email,
          requester_mobile: mobile,
          requested_role: requestedRole,
          current_holder_id: currentHolder.id,
          current_holder_name: currentHolder.name,
          current_holder_email: currentHolder.email,
        },
      },
    );
  } catch (e) {
    console.warn('[adminSignup] join-request notify failed:', e?.message);
  }
};

// POST /api/auth/admin/signup
//
// Creates a brand-new admin account with one of the five predefined
// roles (super_admin, operations_manager, b2b_admin, finance_admin,
// customer_support). The signup page on the admin dashboard calls this
// during initial team onboarding so each admin can self-register
// instead of needing the founder to run a SQL bootstrap.
//
// Guards:
//   • Role must be one of the 5 ADMIN_ROLES.
//   • Email is unique — a duplicate signup attempt for the same email
//     returns 409.
//   • Per-role cap: each role can have only one active admin row. The
//     business model defines exactly 5 admin seats; preventing multiple
//     super_admins (etc.) keeps responsibility unambiguous. If you ever
//     need to rotate a person out, deactivate them via Admin Controls —
//     the slot frees up and the replacement can self-register.
//   • Password ≥ 8 chars to match the change-password validator.
//
// Returns the same {token, user} envelope as adminLogin so the
// frontend can drop the new admin straight onto the dashboard without
// a second login round-trip.
export const adminSignup = async (req, res) => {
  try {
    const { name, email, password, mobile, role } = req.body || {};

    if (!name || !email || !password || !mobile || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password, mobile and role are all required',
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${ADMIN_ROLES.join(', ')}`,
      });
    }

    const normalisedEmail = String(email).toLowerCase().trim();
    const normalisedMobile = String(mobile).trim();

    // Email uniqueness — straightforward 409.
    const existingEmail = await User.findByEmail(normalisedEmail);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in instead.',
      });
    }

    // Mobile uniqueness — users.mobile is UNIQUE across customer/agent/admin
    // roles, so without this check a collision surfaces as a generic 500.
    const existingMobile = await User.findByMobile(normalisedMobile);
    if (existingMobile) {
      return res.status(409).json({
        success: false,
        message:
          'This mobile number is already registered on the platform. ' +
          'Use a different mobile, or contact ops to consolidate accounts.',
      });
    }

    // Per-role uniqueness. Only count active rows so a deactivated old
    // teammate doesn't permanently block their seat.
    const existingRole = await User.findOne({ where: { role, is_active: true } });
    if (existingRole) {
      // Tell every super_admin that someone tried to claim this taken
      // seat — it's effectively a "join request" they can act on
      // (call the person, deactivate the current holder, or politely
      // decline). The notification body carries the requester's
      // contact info so the super_admin doesn't have to dig anywhere.
      await notifySuperAdminsOfJoinRequest({
        name, email: normalisedEmail, mobile,
        requestedRole: role, currentHolder: existingRole,
      });
      return res.status(409).json({
        success: false,
        message:
          `The "${role}" seat is already filled. We've notified the Super Admin of your interest — ` +
          'they will reach out shortly. Or pick a different role.',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalisedEmail,
      mobile: normalisedMobile,
      role,
      password_hash,
      is_active: true,
      is_verified: true,
    });

    // Heads-up to every super_admin (except the one who just signed up,
    // if they self-registered as super_admin themselves) that a new
    // teammate is on board. Lets them see new additions to the team in
    // their bell inbox without having to poll the user list manually.
    await notifySuperAdminsOfNewAdmin({ newAdmin: user });

    const adminRole = await AdminRole.findOne({ where: { role_name: role } });
    const permissions = adminRole
      ? (Array.isArray(adminRole.permissions) ? adminRole.permissions : [])
      : [];

    const token = issueToken(user);
    return res.status(201).json({
      success: true,
      token,
      user: sanitize(user, permissions),
      message: 'Account created. You are now signed in.',
    });
  } catch (err) {
    console.error('adminSignup error:', err);
    return res.status(500).json({ success: false, message: 'Signup failed — please try again.' });
  }
};

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

    // Stamp last_login_at so Admin Controls can show when each
    // admin was last active. Fire-and-forget — login succeeds
    // even if the stamp write fails.
    user.update({ last_login_at: new Date() }).catch((e) =>
      console.warn('[adminLogin] last_login_at stamp failed:', e?.message),
    );

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
