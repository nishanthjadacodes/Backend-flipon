import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  actor_id: { type: DataTypes.UUID, allowNull: true },
  actor_email: { type: DataTypes.STRING(150), allowNull: true },
  actor_role: { type: DataTypes.STRING(50), allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  resource_type: { type: DataTypes.STRING(60), allowNull: true },
  resource_id: { type: DataTypes.STRING(60), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  ip: { type: DataTypes.STRING(45), allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'audit_logs',
  timestamps: false,
  indexes: [
    { fields: ['actor_id'] },
    { fields: ['action'] },
    { fields: ['resource_type', 'resource_id'] },
    { fields: ['created_at'] },
  ],
});

AuditLog.record = async function ({ actor, action, resource_type = null, resource_id = null, metadata = null, ip = null }) {
  try {
    await this.create({
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      actor_role: actor?.role || null,
      action,
      resource_type,
      resource_id: resource_id != null ? String(resource_id) : null,
      metadata,
      ip,
    });
  } catch (err) {
    console.error('AuditLog.record failed:', err.message);
  }
};

export default AuditLog;
