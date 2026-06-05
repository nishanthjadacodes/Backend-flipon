import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// One-shot invite tokens for admin onboarding. Replaces the open
// /admin/signup endpoint: a super_admin creates a row here with the
// target email + role, shares the resulting link (containing the raw
// token) with the recipient out of band, and the recipient redeems
// the link to create their account.
//
// Security shape:
//   • The raw token NEVER touches the DB. We store SHA-256(token) in
//     token_hash and re-hash + lookup on accept. A DB compromise
//     therefore can't be replayed against the accept endpoint.
//   • Tokens are 32 random bytes hex-encoded — 64 chars, ~2^256
//     entropy. Brute force is infeasible.
//   • Single-use: accepted_at is set on consumption and the accept
//     endpoint rejects anything with a non-null accepted_at.
//   • Time-bounded: expires_at defaults to now() + 7 days at create
//     time. The accept endpoint rejects expired rows.
//
// Revoke = DELETE the row. Once gone, the link 404s.
const AdminInvite = sequelize.define('AdminInvite', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  // Where the invite was sent. Lowercased + trimmed at create time.
  // No unique constraint — a super_admin may legitimately re-issue an
  // invite to the same email after the first one expires or is
  // revoked. Listing endpoints filter on accepted_at IS NULL +
  // expires_at > now() to show only "live" invites.
  email: { type: DataTypes.STRING(150), allowNull: false },

  // The role the recipient will receive on acceptance. Must be one of
  // the admin roles; the controller validates this against
  // ADMIN_ROLE_NAMES before insert.
  role: { type: DataTypes.STRING(40), allowNull: false },

  // SHA-256(raw_token). 64 hex chars. We lookup by this on accept by
  // re-hashing whatever token the client sends. UNIQUE so two distinct
  // raw tokens can't collide on a lookup.
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },

  // Who issued the invite. Joins to users.id; the accept endpoint
  // records this in the audit log entry for the created user so we
  // know who authorized whom.
  invited_by: { type: DataTypes.UUID, allowNull: true },

  // Expiry — defaults to 7 days post-create at the controller level
  // (not via DB DEFAULT because expression defaults are messy across
  // MySQL/TiDB versions). Acceptance after this time returns 410 Gone.
  expires_at: { type: DataTypes.DATE, allowNull: false },

  // Stamped on first successful acceptance. Once non-null, the invite
  // is dead — re-using the same link gets a 409.
  accepted_at: { type: DataTypes.DATE, allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'admin_invites',
  timestamps: false,
  indexes: [
    // Lookup-by-token on accept. UNIQUE so we never have two live
    // invites pointing at the same row.
    { fields: ['token_hash'], unique: true, name: 'admin_invites_token_hash_idx' },
    // Listing pending invites for a given email + status sweep.
    { fields: ['email', 'accepted_at'], name: 'admin_invites_email_status_idx' },
    // Expiry sweep — if we add a janitor job later it'll filter on this.
    { fields: ['expires_at'], name: 'admin_invites_expires_idx' },
  ],
});

export default AdminInvite;
