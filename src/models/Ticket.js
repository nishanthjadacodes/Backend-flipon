import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  subject: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'),
    defaultValue: 'open',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },
  category: {
    type: DataTypes.ENUM('general', 'booking', 'agent', 'payment', 'kyc', 'other'),
    defaultValue: 'general',
  },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  booking_id: { type: DataTypes.UUID, allowNull: true },
  assigned_to: { type: DataTypes.UUID, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true },
  resolved_at: { type: DataTypes.DATE, allowNull: true },
  resolution_note: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['customer_id'] },
    { fields: ['assigned_to'] },
  ],
});

export default Ticket;
