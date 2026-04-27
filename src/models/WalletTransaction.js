import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// One row per credit/debit on a user's wallet. Source of truth for the
// running balance shown on the customer Wallet screen.
const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // 'referral_reward' | 'referral_signup_bonus' | 'booking_redeem' |
  // 'refund' | 'promo' | 'admin_adjustment'
  source: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // Optional booking id if this txn was created in the context of a booking
  // (e.g., the redemption that paid for it, or the referral that triggered it).
  booking_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Snapshot of running balance after this txn — denormalised so the wallet
  // history can render without recomputing every row client-side.
  balance_after: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'wallet_transactions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['booking_id'] },
  ],
});

export default WalletTransaction;
