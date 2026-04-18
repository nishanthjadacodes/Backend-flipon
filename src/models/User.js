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
