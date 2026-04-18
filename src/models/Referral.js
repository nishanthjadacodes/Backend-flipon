import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  referrer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  referee_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  referral_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  status: {
    // pending = signed up but no completed service
    // completed = first service completed, reward credited
    // expired = 90 days passed without completion
    type: DataTypes.ENUM('pending', 'completed', 'expired'),
    defaultValue: 'pending',
  },
  reward_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 20.00,
  },
  referee_discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 20.00,
  },
  credited_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  first_service_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'referrals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default Referral;
