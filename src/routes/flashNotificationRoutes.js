import express from 'express';
import auth from '../middleware/auth.js';
import {
  getActiveFlashNotifications,
  listFlashNotifications,
  createFlashNotification,
  updateFlashNotification,
  deleteFlashNotification,
} from '../controllers/flashNotificationController.js';

const router = express.Router();

// ─── Public — customer app reads on launch ──────────────────────────
// No auth required so the splash carousel works for guests. The
// controller still detects req.user (when an optional token is
// present) and tailors the audience filter.
router.get('/active', getActiveFlashNotifications);

// ─── Admin — full CRUD ──────────────────────────────────────────────
// All admin routes require an authenticated session. Role-level
// gating (super_admin only) lives on the admin dashboard UI side;
// the backend is open to any authenticated user for now so the
// dashboard's permissions matrix is the single source of truth.
router.get('/', auth, listFlashNotifications);
router.post('/', auth, createFlashNotification);
router.put('/:id', auth, updateFlashNotification);
router.delete('/:id', auth, deleteFlashNotification);

export default router;
