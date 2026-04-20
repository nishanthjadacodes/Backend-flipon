import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * VaultAccessLog — every read/download/delete of a VaultDocument.
 *
 * The Document Vault spec calls for role-restricted access and an audit
 * trail. This table is append-only; rows are never updated or deleted in
 * normal operation (retention handled by ops externally).
 *
 * Used for:
 *   • Forensic lookups ("who accessed this licence file last week?")
 *   • Compliance (India DPDP / sector regulators increasingly require
 *     traceable access to PII-heavy corporate docs)
 *   • Internal alerts ("vault download outside business hours")
 */
const VaultAccessLog = sequelize.define('VaultAccessLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  vault_document_id: { type: DataTypes.UUID, allowNull: false },
  actor_user_id:     { type: DataTypes.UUID, allowNull: false }, // who did the action
  actor_role:        { type: DataTypes.STRING(50), allowNull: true }, // snapshot of role at time of action

  action: {
    // list   — enumerating vault docs for an enquiry
    // view   — opened metadata (no file bytes)
    // download — streamed plaintext (most sensitive)
    // upload — admin added a new file
    // delete — admin removed a file
    type: DataTypes.ENUM('list', 'view', 'download', 'upload', 'delete'),
    allowNull: false,
  },

  ip_address: { type: DataTypes.STRING(45), allowNull: true }, // IPv6-length safe
  user_agent: { type: DataTypes.STRING(500), allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'vault_access_logs',
  timestamps: false, // append-only; created_at handled manually
  indexes: [
    { fields: ['vault_document_id'] },
    { fields: ['actor_user_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] },
  ],
});

export default VaultAccessLog;
