import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Payout = sequelize.define('Payout', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  agent_id: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('requested', 'approved', 'rejected', 'paid'),
    defaultValue: 'requested',
  },
  method: { type: DataTypes.STRING(50), allowNull: true },
  reference: { type: DataTypes.STRING(100), allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  approved_by: { type: DataTypes.UUID, allowNull: true },
  approved_at: { type: DataTypes.DATE, allowNull: true },
  paid_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'payouts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['agent_id'] }, { fields: ['status'] }],
});

export default Payout;
