import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Dev / admin-panel-open mode: when ADMIN_DEV_OPEN=true is set in the Render
// environment, requests that arrive without a JWT are treated as if they came
// from a super_admin. This lets the admin dashboard call /api/admin/* without
// a login screen. DO NOT leave this enabled once the admin panel ships real
// auth — it gives anyone on the internet super-admin access to the API.
const devOpen = () =>
  String(process.env.ADMIN_DEV_OPEN || '').toLowerCase() === 'true';

const SYNTHETIC_SUPER_ADMIN = Object.freeze({
  id: 0,
  email: 'dev-open@flipon.local',
  mobile: '0000000000',
  role: 'super_admin',
  name: 'Dev Open (ADMIN_DEV_OPEN)',
});

// 30-second cache of {userId -> is_active}. Without it, every authenticated
// request would do a User.findByPk just to check the deactivation flag —
// fine on a free-tier dashboard but wasteful at scale. 30s is short enough
// that a Super Admin's "Deactivate" click in Team takes effect within
// half a minute on the target's next request.
const activeCache = new Map(); // userId -> { active: boolean, at: number }
const ACTIVE_TTL_MS = 30 * 1000;

const isUserActive = async (userId) => {
  if (userId == null || userId === 0) return true; // synthetic super admin
  const cached = activeCache.get(userId);
  if (cached && Date.now() - cached.at < ACTIVE_TTL_MS) return cached.active;
  const row = await User.findByPk(userId, { attributes: ['id', 'is_active'] });
  const active = !!(row && row.is_active);
  activeCache.set(userId, { active, at: Date.now() });
  return active;
};

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (devOpen()) {
        req.user = SYNTHETIC_SUPER_ADMIN;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Live re-check of the deactivation flag so a Super Admin's
    // "Deactivate" click takes effect within ~30s on the target's next
    // request — instead of waiting up to 30 days for the JWT to expire.
    // The check is cached per user id so a chatty client doesn't hammer
    // the DB. If the user was hard-deleted the JWT is rejected with the
    // same 403 — "account no longer exists" leaks no extra info.
    const active = await isUserActive(decoded.id);
    if (!active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Contact your Super Admin.',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      // If the token is bad but dev-open is on, still allow the request so
      // stale/expired tokens don't break the admin panel.
      if (devOpen()) {
        req.user = SYNTHETIC_SUPER_ADMIN;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

// Allow controllers / Team UI to invalidate a specific user's active-cache
// entry right after deactivation so the next request goes to DB
// immediately instead of waiting for the 30s TTL. Optional integration —
// the cache is correct either way, this just trims the window.
export const invalidateActiveCacheFor = (userId) => {
  if (userId != null) activeCache.delete(userId);
};

export default auth;
