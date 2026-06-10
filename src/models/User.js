import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },

  expo_push_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  mobile: {
    type: DataTypes.STRING(15),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  referral_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Avatar / profile picture URL. Either a Cloudinary URL (production) or
  // a relative /uploads/avatars/<file> path (local fallback). Customers
  // and reps both use this field — the column is on the shared User model.
  profile_pic: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM(
      'super_admin',
      'operations_manager',
      'b2b_admin',
      'finance_admin',
      'customer_support',
      'agent',
      'customer'
    ),
    defaultValue: 'agent'
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  online_status: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Heartbeat timestamp — the rep app PUTs /profile/online-status every
  // 30s while online + foreground, and the controller stamps NOW() here.
  // Admin's getAllUsers/getAvailableAgents treat anything older than 90s
  // as offline regardless of the boolean above, so a rep whose app dies
  // shows offline within ~90s without needing them to toggle off.
  // Without this declaration Sequelize was silently dropping the column
  // from update payloads — the field never made it into the DB and the
  // staleness check always saw NULL, so reps stayed forever-online.
  last_online_ping_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  current_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  current_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  last_location_update: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 0
  },
  total_jobs_completed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  fcm_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_kyc_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  kyc_submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  kyc_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  assigned_zone: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Digital NDA acceptance for B2B (industrial) bookings. NULL until accepted.
  nda_accepted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // In-app wallet balance — referral cashback, refunds, promo credits.
  wallet_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false
  },
  // Earned via the Gold Star milestone (25 successful referrals). Drives
  // priority queue placement when admins assign reps and surfaces a badge
  // in the rep app's Profile + Referral screens.
  is_priority_user: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  // Anti-poaching forfeit window. Per the Agent Referral & Royalty Policy:
  // "Any agent found violating [the anti-poaching rule] will forfeit their
  // royalty earnings for that quarter." Admin sets this to the end-of-quarter
  // date when a violation is confirmed; the royalty payout job skips
  // referrers whose `now < royalty_forfeited_until`.
  royalty_forfeited_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  royalty_forfeit_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // Stamped on every successful admin login (including dev-open
  // synthetic admin) so Admin Controls can show "active 2h ago"
  // per row instead of guessing from updated_at.
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 4-digit OTP login codes — persisted on the user row so a Render
  // free-tier sleep doesn't lose pending codes (the previous in-memory
  // Map would vanish on restart). Cleared on successful verifyOTP so a
  // code can't be reused; the 30-minute expiry is enforced at the
  // controller, not by a DB constraint.
  otp_code: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  otp_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Free-text postal address captured on first-time customer signup
  // (name, email, address are entered between mobile + OTP). Optional
  // because rep accounts and existing customers may never see the
  // signup form.
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Class method to find user by mobile
User.findByMobile = async function(mobile) {
  return await this.findOne({ where: { mobile } });
};

User.findByEmail = async function(email) {
  if (!email) return null;
  return await this.findOne({ where: { email: email.toLowerCase().trim() } });
};

export default User;
