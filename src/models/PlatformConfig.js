import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Single-row key/value platform configuration — tax percentage, royalty
// percentage, payment gateway mode, etc. Gated to Super Admin per the PDF's
// "Financial Configuration" grant. Keeps one record per key so individual
// values can be updated without losing the rest.
const PlatformConfig = sequelize.define('PlatformConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  key: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Marks values that must never be surfaced to non-Super-Admin callers
  // (e.g. razorpay key secret). The admin controller masks these on read.
  is_secret: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'platform_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default PlatformConfig;
