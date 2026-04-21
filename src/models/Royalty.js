import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Monthly royalty ledger — per the PDF, Finance & Accounts Admin verifies
// and approves the 2% Monthly Royalty and team commissions. One row per
// (period, beneficiary) combination. A "beneficiary" is either a named
// recipient (founder, ops head, etc.) or an agent for commissions.
//
// The 2% default is read from platform_configs.royalty_percentage at
// generation time, so changing the percentage in the Super Admin's
// Financial Config panel propagates into subsequent months.
const Royalty = sequelize.define('Royalty', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  period: {
    type: DataTypes.STRING(7),      // YYYY-MM, e.g. "2026-04"
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('royalty', 'commission'),
    allowNull: false,
    defaultValue: 'royalty',
  },
  beneficiary_type: {
    type: DataTypes.ENUM('platform', 'agent', 'team'),
    allowNull: false,
    defaultValue: 'platform',
  },
  beneficiary_id: {
    type: DataTypes.UUID,
    allowNull: true,                  // null for platform-level royalty
  },
  beneficiary_name: {
    type: DataTypes.STRING(150),
    allowNull: false,                 // snapshot, stays stable across renames
  },
  basis_revenue: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,                  // gross revenue the percentage applies to
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,                 // snapshot of the % at approval time
    defaultValue: 2,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,                 // basis_revenue * percentage / 100
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'paid'),
    allowNull: false,
    defaultValue: 'pending',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'royalties',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['period'] },
    { fields: ['status'] },
    { fields: ['beneficiary_type', 'beneficiary_id'] },
  ],
});

export default Royalty;
