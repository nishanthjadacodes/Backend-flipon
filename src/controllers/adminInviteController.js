import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, AdminRole, AdminInvite, AuditLog } from '../models/index.js';
import { ADMIN_ROLE_NAMES } from '../constants/permissions.js';

// ─── Helpers ────────────────────────────────────────────────────────
// issueToken + sanitize duplicate the small helpers in
// adminAuthController.js. Keeping a copy here avoids cross-controller
// imports until we refactor them into src/utils/adminAuthHelpers.js —
// a separate cleanup PR that doesn't belong inside the invite-flow
// change.
const issueToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, mobile: user.mobile, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

const sanitizeUser = (user, permissions) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  is_active: user.is_active,
  is_verified: user.is_verified,
  permissions: permissions || [],
});

const sanitizeInvite = (row, includeLink = false, rawToken = null) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  invited_by: row.invited_by,
  expires_at: row.expires_at,
  accepted_at: row.accepted_at,
  created_at: row.created_at,
  // The link is only returned on the create response — once we've
  // saved the hash we can't reconstruct the raw token, so the super
  // admin gets exactly one chance to copy + share it.
  link: includeLink && rawToken
    ? buildAcceptUrl(rawToken)
    : undefined,
});

const hashToken = (raw) =>
  crypto.createHash('sha256').update(String(raw)).digest('hex');

// Build the recipient-facing accept-invite URL the super admin shares
// out of band. ADMIN_DASHBOARD_URL points at whatever host the Next.js
// admin dashboard is deployed under (fliponex.com/admin in production,
// localhost:3000 in dev). The dashboard's /accept-invite page reads
// the token query param and walks the user through password setup.
const buildAcceptUrl = (rawToken) => {
  const base = (process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/accept-invite?token=${encodeURIComponent(rawToken)}`;
};

// ─── Super-admin endpoints (mounted under /api/admin/users/invites) ─

// POST /api/admin/users/invites
// Body: { email, role }
// Returns: { invite: { ..., link } }  ← link contains the raw token,
//                                       super admin must save it now
export const createInvite = async (req, res) => {
  try {
    const { email, role } = req.body || {};
    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'email and role are required' });
    }
    if (!ADMIN_ROLE_NAMES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${ADMIN_ROLE_NAMES.join(', ')}`,
      });
    }

    const normalisedEmail = String(email).toLowerCase().trim();

    // Block invites to an email that already has an active admin row —
    // they should sign in instead. The error is informative so the
    // super admin can confirm vs. an actual typo.
    const existingUser = await User.findByEmail(normalisedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account already exists for ${normalisedEmail}. Ask them to sign in.`,
      });
    }

    // Soft-block on a live pending invite to the same email so we don't
    // accumulate duplicates that the recipient is confused by. Super
    // admin can revoke + re-issue if needed.
    const pendingInvite = await AdminInvite.findOne({
      where: {
        email: normalisedEmail,
        accepted_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });
    if (pendingInvite) {
      return res.status(409).json({
        success: false,
        message: `A pending invite already exists for ${normalisedEmail}. Revoke it first if you want to re-issue.`,
      });
    }

    // Token: 32 random bytes hex-encoded = 64 chars, ~2^256 entropy.
    // We hand the raw token to the caller exactly once (in the link)
    // and persist only the SHA-256 — so DB compromise can't replay
    // active invites.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const token_hash = hashToken(rawToken);

    // 7 day expiry, configurable via env if the team ever wants a
    // shorter or longer window for a specific cohort.
    const ttlDays = Number(process.env.ADMIN_INVITE_TTL_DAYS) || 7;
    const expires_at = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const invite = await AdminInvite.create({
      email: normalisedEmail,
      role,
      token_hash,
      invited_by: req.user?.id || null,
      expires_at,
    });

    await AuditLog.record({
      actor: req.user,
      action: 'admin.invite.create',
      resource_type: 'admin_invite',
      resource_id: invite.id,
      metadata: { email: normalisedEmail, role, expires_at },
    });

    return res.status(201).json({
      success: true,
      data: sanitizeInvite(invite, true, rawToken),
      message:
        'Invite created. Copy the link from `data.link` and share it ' +
        'with the recipient — the raw token is shown only this once.',
    });
  } catch (err) {
    console.error('createInvite error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create invite' });
  }
};

// GET /api/admin/users/invites?status=pending|accepted|expired|all
// Returns the team's invite history, paginated implicitly to recent
// rows (cap 200) so the super-admin Team UI can show a status table.
export const listInvites = async (req, res) => {
  try {
    const status = String(req.query?.status || 'pending').toLowerCase();
    const now = new Date();
    const where = {};
    if (status === 'pending') {
      where.accepted_at = null;
      where.expires_at = { [Op.gt]: now };
    } else if (status === 'accepted') {
      where.accepted_at = { [Op.not]: null };
    } else if (status === 'expired') {
      where.accepted_at = null;
      where.expires_at = { [Op.lte]: now };
    }
    // status=all → no filter

    const rows = await AdminInvite.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    return res.json({
      success: true,
      data: rows.map((r) => sanitizeInvite(r, false)),
    });
  } catch (err) {
    console.error('listInvites error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list invites' });
  }
};

// DELETE /api/admin/users/invites/:id
// Hard delete — once revoked, the link 404s on accept. Audit log
// keeps the record of who revoked what.
export const revokeInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const invite = await AdminInvite.findByPk(id);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    if (invite.accepted_at) {
      return res.status(409).json({
        success: false,
        message: 'Invite has already been accepted — revoke the user instead.',
      });
    }
    await invite.destroy();
    await AuditLog.record({
      actor: req.user,
      action: 'admin.invite.revoke',
      resource_type: 'admin_invite',
      resource_id: id,
      metadata: { email: invite.email, role: invite.role },
    });
    return res.json({ success: true, message: 'Invite revoked' });
  } catch (err) {
    console.error('revokeInvite error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke invite' });
  }
};

// ─── Public endpoints (mounted under /api/auth/admin) ────────────────
// Token is the auth — these don't require a JWT. The accept-invite
// page calls getInviteByToken on mount to pre-fill email/role, then
// the user submits acceptInvite with the password they chose.

// GET /api/auth/admin/invite/:token
// Returns { email, role, expires_at } so the dashboard can show
// "You've been invited as Operations Manager for jane@…" before the
// user fills in the password. Same 410 envelope whether the token is
// unknown, expired, or already used — we don't want the endpoint to
// confirm which tokens are real for a token-guessing attacker.
export const getInviteByToken = async (req, res) => {
  try {
    const raw = req.params?.token;
    if (!raw) return res.status(400).json({ success: false, message: 'token required' });
    const token_hash = hashToken(raw);
    const invite = await AdminInvite.findOne({ where: { token_hash } });
    if (!invite || invite.accepted_at || invite.expires_at <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This invite link is invalid or no longer active. Ask your Super Admin for a fresh one.',
      });
    }
    return res.json({
      success: true,
      data: {
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
      },
    });
  } catch (err) {
    console.error('getInviteByToken error:', err);
    return res.status(500).json({ success: false, message: 'Failed to validate invite' });
  }
};

// POST /api/auth/admin/accept-invite
// Body: { token, name, password, mobile }
// Returns { token, user } same envelope as adminLogin so the dashboard
// can drop the new admin straight into the session.
export const acceptInvite = async (req, res) => {
  try {
    const { token, name, password, mobile } = req.body || {};
    if (!token || !name || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'token, name, password and mobile are all required',
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const token_hash = hashToken(token);
    const invite = await AdminInvite.findOne({ where: { token_hash } });
    if (!invite || invite.accepted_at || invite.expires_at <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This invite link is invalid or no longer active. Ask your Super Admin for a fresh one.',
      });
    }

    const normalisedMobile = String(mobile).trim();

    // Re-check email + mobile uniqueness at the moment of acceptance —
    // someone may have signed up via /admin/users (the create-admin
    // path) since the invite was issued, or registered as a
    // customer/agent with that mobile. The shared users table has
    // UNIQUE(email) + UNIQUE(mobile) across all roles, so failing to
    // pre-check would surface as a generic 500 from the INSERT — same
    // class of bug we fixed in adminSignup.
    const existsEmail = await User.findByEmail(invite.email);
    if (existsEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Sign in instead.',
      });
    }
    const existsMobile = await User.findByMobile(normalisedMobile);
    if (existsMobile) {
      return res.status(409).json({
        success: false,
        message:
          'This mobile number is already registered on the platform. ' +
          'Use a different mobile, or contact ops to consolidate accounts.',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: invite.email,
      mobile: normalisedMobile,
      role: invite.role,
      password_hash,
      is_active: true,
      is_verified: true,
    });

    // Mark the invite consumed BEFORE issuing the JWT. If anything
    // fails after this point (audit log, perm lookup) the user row +
    // accepted_at are both set, which is the safe state — no replay
    // possible.
    await invite.update({ accepted_at: new Date() });

    // Stamp last_login_at so the Team page shows "active just now"
    // instead of "—" right after the new admin lands on the dashboard.
    // Mirrors the same fire-and-forget pattern adminLogin uses.
    user.update({ last_login_at: new Date() }).catch((e) =>
      console.warn('[acceptInvite] last_login_at stamp failed:', e?.message),
    );

    await AuditLog.record({
      actor: { id: invite.invited_by },
      action: 'admin.invite.accept',
      resource_type: 'user',
      resource_id: user.id,
      metadata: { invite_id: invite.id, role: invite.role, email: invite.email },
    });

    const adminRole = await AdminRole.findOne({ where: { role_name: invite.role } });
    const permissions = adminRole
      ? (Array.isArray(adminRole.permissions) ? adminRole.permissions : [])
      : [];

    const jwtToken = issueToken(user);
    return res.status(201).json({
      success: true,
      token: jwtToken,
      user: sanitizeUser(user, permissions),
      message: 'Account created. You are now signed in.',
    });
  } catch (err) {
    console.error('acceptInvite error:', err);
    return res.status(500).json({ success: false, message: 'Failed to accept invite — please try again.' });
  }
};
