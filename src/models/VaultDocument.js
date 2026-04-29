import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * VaultDocument — corporate document storage for the B2B/industrial flow.
 *
 * Deliberately separate from the general `documents` table so:
 *   • B2C queries never accidentally surface sensitive corporate content.
 *   • Access rules can be stricter (encrypted-at-rest, audit-logged).
 *   • Size limits can be higher (licence PDFs, compliance reports, audits
 *     easily run 50–100 MB vs. the 20 MB cap on the B2C table).
 *
 * Each row represents one encrypted file on disk. Filename on disk is
 * randomised; retrieve via the vault download endpoint which decrypts in
 * memory and streams plaintext. The original filename + mime are stored as
 * metadata only.
 */
const VaultDocument = sequelize.define('VaultDocument', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  // Scope — a vault doc is always tied to either an enquiry (most common)
  // or a company_profile (e.g. annual retainer docs not tied to a specific
  // enquiry).
  enquiry_id:         { type: DataTypes.UUID, allowNull: true },
  company_profile_id: { type: DataTypes.UUID, allowNull: false },
  customer_id:        { type: DataTypes.UUID, allowNull: false }, // denormalised for fast scoping

  // Uploader metadata — who on the admin side put this here. For customer
  // uploads this is the customer's own user id (though customers typically
  // use the general documents upload path, not the vault).
  uploaded_by: { type: DataTypes.UUID, allowNull: false },

  // Original filename as shown to the user (e.g. "Factory_Licence_2026.pdf")
  original_name: { type: DataTypes.STRING(255), allowNull: false },

  // Randomised on-disk filename (opaque). Never exposed to the client.
  stored_name: { type: DataTypes.STRING(128), allowNull: false },

  mime_type: { type: DataTypes.STRING(120), allowNull: false },

  // Sizes in bytes. Ciphertext bytes (written to disk) vs. plaintext bytes
  // (as reported to the user). Encrypted blob has a small fixed overhead
  // (IV + auth tag) plus the GCM stream, which is effectively plaintext-size.
  plaintext_size:  { type: DataTypes.BIGINT, allowNull: false },
  ciphertext_size: { type: DataTypes.BIGINT, allowNull: false },

  // AES-256-GCM parameters stored alongside the ciphertext. IV is per-file
  // (never reused). auth_tag verifies integrity on decryption.
  iv:       { type: DataTypes.STRING(48), allowNull: false },    // hex-encoded 12 bytes
  auth_tag: { type: DataTypes.STRING(48), allowNull: false },    // hex-encoded 16 bytes

  // Classification for access control and retention policies.
  tier: {
    // standard   — routine corporate docs (GST cert, PAN card)
    // sensitive  — higher-stakes (board resolutions, audited financials)
    // deliverable — admin-issued outputs (NOC, licence, certificate) that the
    //               customer is meant to download and keep
    type: DataTypes.ENUM('standard', 'sensitive', 'deliverable'),
    defaultValue: 'standard',
  },

  // Customers only see rows where this is true. Lets admins draft + upload
  // internal working docs without exposing them prematurely.
  visible_to_customer: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Optional descriptive note (e.g. "Fire NOC renewal application — v2")
  note: { type: DataTypes.TEXT, allowNull: true },

  // ─── Smart Alert / Compliance fields ─────────────────────────────────────
  // Set when this vault row is a statutory document the factory owner needs
  // to renew before it expires (Factory Licence, Fire NOC, Pollution NOC,
  // GST certificate, etc.). NULL for normal vault docs.
  compliance_type: {
    type: DataTypes.ENUM(
      'factory_license',
      'fire_noc',
      'pollution_noc',
      'gst_certificate',
      'incorporation',
      'iso_cert',
      'trade_license',
      'esi_pf',
      'other',
    ),
    allowNull: true,
  },

  // Date the document expires. The 90/60/30-day alert cron uses this column.
  // NULL when not a compliance doc (regular vault uploads).
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  // Last alert tier we already pushed for this document — used to dedupe
  // notifications. Values: '90', '60', '30', or NULL (no alert sent yet).
  last_alert_tier: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },

  // Stamp of the last alert we sent. Cron skips a row if last_alert_sent_at
  // is within 24h, even when a new tier becomes due (avoids notification
  // spam if the cron over-runs).
  last_alert_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'vault_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['enquiry_id'] },
    { fields: ['company_profile_id'] },
    { fields: ['customer_id'] },
    { fields: ['tier'] },
    { fields: ['compliance_type'] },
    { fields: ['expiry_date'] },
  ],
});

export default VaultDocument;
