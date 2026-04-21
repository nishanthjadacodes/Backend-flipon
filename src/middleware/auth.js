import jwt from 'jsonwebtoken';

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

const auth = (req, res, next) => {
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

export default auth;
