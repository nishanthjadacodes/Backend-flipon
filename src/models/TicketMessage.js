import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Threaded chat on a support ticket. Used by Customer Support Admin to
// communicate with the customer (and optionally the agent) without leaving
// the ticket. Each new admin message fires an Expo push notification to
// the customer so the conversation behaves like in-app chat.
const TicketMessage = sequelize.define('TicketMessage', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  ticket_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: true,               // system messages may have no sender
  },
  // sender_role lets the UI render "Support" vs "Customer" bubbles without
  // having to join users; role is a frozen snapshot taken at send time.
  sender_role: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'system',
  },
  sender_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  channel: {
    type: DataTypes.ENUM('chat', 'system'),
    allowNull: false,
    defaultValue: 'chat',
  },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'ticket_messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['ticket_id'] },
    { fields: ['created_at'] },
  ],
});

export default TicketMessage;
