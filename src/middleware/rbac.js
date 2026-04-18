import { AdminRole } from '../models/index.js';

const roleCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const loadPermissions = async (roleName) => {
  const cached = roleCache.get(roleName);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.perms;
  const row = await AdminRole.findOne({ where: { role_name: roleName } });
  const perms = row ? (Array.isArray(row.permissions) ? row.permissions : []) : [];
  roleCache.set(roleName, { perms, at: Date.now() });
  return perms;
};

export const clearRoleCache = () => roleCache.clear();

// Legacy: keep for backwards compatibility with existing route wiring
export const isSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (req.user.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super Admin access required' });
  next();
};

// Require any of the given admin roles
export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient role for this resource' });
  }
  next();
};

// Require a specific permission key (wildcard '*' grants all)
export const requirePermission = (permissionKey) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const perms = await loadPermissions(req.user.role);
    if (perms.includes('*') || perms.includes(permissionKey)) return next();
    return res.status(403).json({ success: false, message: `Missing permission: ${permissionKey}` });
  } catch (err) {
    console.error('requirePermission error:', err);
    return res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

// Require all listed permissions
export const requireAllPermissions = (...keys) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const perms = await loadPermissions(req.user.role);
    if (perms.includes('*')) return next();
    const missing = keys.filter((k) => !perms.includes(k));
    if (missing.length === 0) return next();
    return res.status(403).json({ success: false, message: `Missing permissions: ${missing.join(', ')}` });
  } catch (err) {
    console.error('requireAllPermissions error:', err);
    return res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};
