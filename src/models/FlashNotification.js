import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Splash-style notification shown in the customer app BEFORE the
// login screen (Flipkart / Myntra festive-offer pattern). Super
// admin creates entries in the admin dashboard; the customer app
// fetches active ones on launch via GET /flash-notifications/active
// and surfaces them as a dismissible carousel on top of Splash.
//
// Active rules:
//   • is_active must be true
//   • active_from (if set) must be <= now
//   • active_until (if set) must be >= now
//   • audience filters whether logged-in/guest/anyone sees it
//
// Display ordering: priority DESC, then created_at DESC.
// Seen-state lives in the customer app's AsyncStorage — backend
// doesn't track per-device dismissal (simpler, no extra writes).
const FlashNotification = sequelize.define('FlashNotification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(140),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Cloudinary / CDN URL. Optional — a text-only notification still
  // renders (icon falls back to a generic megaphone).
  image_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  cta_label: {
    type: DataTypes.STRING(60),
    allowNull: true,
  },
  cta_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  // Who sees it. 'all' = everyone (default), 'guest' = pre-login only,
  // 'logged_in' = post-login only. Customer app passes its auth state
  // to /active and the backend filters server-side.
  audience: {
    type: DataTypes.ENUM('all', 'guest', 'logged_in'),
    allowNull: false,
    defaultValue: 'all',
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  active_from: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  active_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Admin user id who created this row. Optional — kept for audit.
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Discount % to apply to matching services in the customer app's
  // Payment Summary. NULL = display-only banner with no pricing
  // effect. 50 = 50% off the base service price.
  discount_percent: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Substring / keyword that matches against service.name + service.category
  // (case-insensitive). e.g. 'aadhaar' matches every Aadhaar service;
  // 'pan' matches every PAN service. NULL = no service-side match.
  // Future: could be a regex, but plain substring is enough today.
  target_service_pattern: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'flash_notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default FlashNotification;
