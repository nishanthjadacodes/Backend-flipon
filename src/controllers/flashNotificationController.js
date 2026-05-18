import { Op } from 'sequelize';
import { FlashNotification } from '../models/index.js';

// ─── Public — customer app reads this on launch ──────────────────────
//
// GET /api/flash-notifications/active
// Optional query:
//   audience=guest|logged_in (default 'guest' if the request has no
//     auth header; 'logged_in' when authenticated). We don't trust
//     the query — we recompute audience from req.user when present
//     so the API can't be tricked into surfacing logged-in-only
//     notifications to a guest.
//
// Returns only entries where is_active && (active_from is NULL or <= now)
// && (active_until is NULL or >= now). Ordered by priority DESC,
// then created_at DESC so the highest-priority newest entries land
// first in the carousel.
export const getActiveFlashNotifications = async (req, res) => {
  try {
    const now = new Date();
    const isLoggedIn = !!req.user?.id;
    const audienceFilter = isLoggedIn ? ['all', 'logged_in'] : ['all', 'guest'];

    const rows = await FlashNotification.findAll({
      where: {
        is_active: true,
        audience: { [Op.in]: audienceFilter },
        [Op.and]: [
          {
            [Op.or]: [
              { active_from: null },
              { active_from: { [Op.lte]: now } },
            ],
          },
          {
            [Op.or]: [
              { active_until: null },
              { active_until: { [Op.gte]: now } },
            ],
          },
        ],
      },
      order: [
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit: 10,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getActiveFlashNotifications error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to load flash notifications' });
  }
};

// ─── Admin — full CRUD ──────────────────────────────────────────────

export const listFlashNotifications = async (req, res) => {
  try {
    const rows = await FlashNotification.findAll({
      order: [
        ['is_active', 'DESC'],
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('listFlashNotifications error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to list flash notifications' });
  }
};

const sanitisePayload = (body, userId) => {
  const allowed = [
    'title', 'body', 'image_url', 'cta_label', 'cta_url',
    'audience', 'priority', 'is_active', 'active_from', 'active_until',
    'discount_percent', 'target_service_pattern',
  ];
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  // Coerce empty strings on date fields to null so MySQL accepts them.
  for (const k of ['active_from', 'active_until', 'target_service_pattern']) {
    if (out[k] === '') out[k] = null;
  }
  // Clamp / coerce discount_percent. Anything outside 0–100 → null
  // (treated as no discount). String inputs get parsed.
  if (out.discount_percent !== undefined) {
    const n = Number(out.discount_percent);
    out.discount_percent =
      Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n) : null;
  }
  if (userId) out.created_by = userId;
  return out;
};

export const createFlashNotification = async (req, res) => {
  try {
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const payload = sanitisePayload(req.body, req.user?.id);
    const row = await FlashNotification.create(payload);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error('createFlashNotification error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to create flash notification' });
  }
};

export const updateFlashNotification = async (req, res) => {
  try {
    const row = await FlashNotification.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Flash notification not found' });
    }
    const payload = sanitisePayload(req.body, req.user?.id);
    await row.update(payload);
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('updateFlashNotification error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to update flash notification' });
  }
};

export const deleteFlashNotification = async (req, res) => {
  try {
    const row = await FlashNotification.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Flash notification not found' });
    }
    await row.destroy();
    res.json({ success: true, message: 'Flash notification deleted' });
  } catch (error) {
    console.error('deleteFlashNotification error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to delete flash notification' });
  }
};
