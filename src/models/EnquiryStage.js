import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * EnquiryStage — granular, service-specific progress tracking for an enquiry.
 *
 * The Enquiry.status ENUM is intentionally coarse (pending/quoted/accepted/
 * in_progress/completed). The REAL liaisoning work happens in dozens of
 * sub-stages that vary per service — e.g.:
 *   FSSAI: "Form B Filed" → "FBO Verification" → "Field Inspection" → "Licence Issued"
 *   Fire NOC: "Application Filed" → "Fee Paid" → "Inspection Scheduled" → "Inspection Complete" → "Compliance Report" → "NOC Issued"
 *   GST Reg: "ARN Generated" → "Officer Review" → "Clarification" → "GSTIN Issued"
 *
 * Each enquiry owns an ordered list of these rows. Admin advances them one
 * by one; each transition can fire a push notification to the customer and
 * optionally attach a note + supporting document.
 */
const EnquiryStage = sequelize.define('EnquiryStage', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  enquiry_id: { type: DataTypes.UUID, allowNull: false },

  // Order within this enquiry — 0-indexed.
  sequence: { type: DataTypes.INTEGER, allowNull: false },

  // Stable machine key (e.g. 'application_filed') — useful if the label
  // later gets translated but the identity has to stay put.
  stage_key: { type: DataTypes.STRING(80), allowNull: false },

  // Human-readable label shown to the customer.
  label: { type: DataTypes.STRING(200), allowNull: false },

  // Optional longer description / hint.
  description: { type: DataTypes.TEXT, allowNull: true },

  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'done', 'blocked', 'skipped'),
    defaultValue: 'pending',
  },

  // Timeline stamps — set by the admin as the stage advances.
  started_at:   { type: DataTypes.DATE, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },

  // Optional free-text note from the admin on this stage (e.g. inspection
  // date, officer assigned, reason for block).
  admin_note: { type: DataTypes.TEXT, allowNull: true },

  // Optional linked document (e.g. NOC PDF, inspection report). Stores a
  // documents.id so the customer can open it from the milestone.
  document_id: { type: DataTypes.UUID, allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'enquiry_stages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['enquiry_id'] },
    { fields: ['enquiry_id', 'sequence'] },
    { fields: ['status'] },
  ],
});

export default EnquiryStage;
