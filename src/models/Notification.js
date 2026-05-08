import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// In-app notification inbox. Persisted server-side so that "popup
// banner on app open" works regardless of whether the device received
// a push (push tokens may be unregistered, OS may have throttled it,
// or the user may have disabled push entirely).
//
// Lifecycle: created when an event happens (booking created, agent
// assigned, quote sent, etc.) → fetched by the client on app focus →
// shown as a top-down banner → marked seen when the user taps or
// dismisses → drops out of the unread inbox.
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  // Who should see this notification. Joins to User.id.
  user_id: { type: DataTypes.UUID, allowNull: false },

  // Discriminator for icon / colour / handler. e.g. 'booking.created',
  // 'booking.assigned', 'enquiry.requested', 'quote.sent'.
  type: { type: DataTypes.STRING(60), allowNull: false },

  // Title shown in the banner header (≤ 80 chars renders nicely).
  title: { type: DataTypes.STRING(120), allowNull: false },

  // Body / subtitle (≤ 200 chars renders without truncation).
  body: { type: DataTypes.STRING(280), allowNull: true },

  // Where the banner should deep-link on tap. The client interprets
  // the route name + params to navigate via React Navigation (RN apps)
  // or router.push (admin / website). Storing as JSON keeps it
  // flexible — caller can include any param shape they need.
  //   { route: 'BookingDetails', params: { id: '...' } }
  // Null = banner is informational only, no tap action.
  deep_link: { type: DataTypes.JSON, allowNull: true },

  // Free-form payload — used for analytics / debugging. Not displayed.
  metadata: { type: DataTypes.JSON, allowNull: true },

  // When the user actually saw + acknowledged the banner. Filtering
  // on `seen_at IS NULL` gives you the unread inbox.
  seen_at: { type: DataTypes.DATE, allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'notifications',
  timestamps: false,
  indexes: [
    // Unread-inbox query — by user, unseen first, newest first.
    { fields: ['user_id', 'seen_at', 'created_at'] },
    // Type-filtered queries for analytics.
    { fields: ['type'] },
  ],
});

// Helper used by controllers to drop a notification into the inbox
// in one call. Lookups are best-effort — failures here must NEVER
// break the originating flow (e.g. if the notify call fails, the
// booking should still complete).
Notification.notify = async function ({ user_id, type, title, body = null, deep_link = null, metadata = null }) {
  if (!user_id || !type || !title) {
    console.warn('[Notification.notify] missing required field — skipped');
    return null;
  }
  try {
    return await this.create({
      user_id,
      type,
      title,
      body,
      deep_link,
      metadata,
    });
  } catch (err) {
    console.error('[Notification.notify] insert failed:', err.message);
    return null;
  }
};

// Bulk fan-out for "notify every admin / every super_admin" patterns.
// `userIds` is an array; each gets its own row (so per-user seen_at
// can track independently). Returns the number actually inserted.
Notification.notifyMany = async function (userIds, payload) {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: payload.type,
    title: payload.title,
    body: payload.body || null,
    deep_link: payload.deep_link || null,
    metadata: payload.metadata || null,
  }));
  try {
    const created = await this.bulkCreate(rows);
    return created.length;
  } catch (err) {
    console.error('[Notification.notifyMany] bulk insert failed:', err.message);
    return 0;
  }
};

export default Notification;
