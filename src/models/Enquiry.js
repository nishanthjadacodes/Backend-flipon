import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Enquiry — the B2B/industrial counterpart to Booking.
 *
 * Customer submits → pending → b2b_admin issues quote → quoted →
 * customer accepts → accepted → admin starts work → in_progress →
 * completed.
 *
 * Deliberately *not* merged into Booking: different pricing model, different
 * lifecycle, different admin role. Keeping them separate keeps each flow
 * auditable and migration-friendly.
 */
const Enquiry = sequelize.define('Enquiry', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  customer_id: { type: DataTypes.UUID, allowNull: false }, // User.id
  service_id:  { type: DataTypes.UUID, allowNull: false }, // Service.id
  company_profile_id: { type: DataTypes.UUID, allowNull: true }, // snapshot link

  // Scoping info captured at submission
  notes: { type: DataTypes.TEXT, allowNull: true },
  urgency: {
    type: DataTypes.ENUM('standard', 'urgent', 'fast_track'),
    defaultValue: 'standard',
  },
  preferred_contact_time: { type: DataTypes.STRING(80), allowNull: true },

  // Lifecycle
  status: {
    type: DataTypes.ENUM(
      'pending',      // customer submitted, no admin action yet
      'quoted',       // admin issued a quote
      'accepted',     // customer accepted the quote
      'rejected',     // customer rejected / admin unable to serve
      'in_progress',  // work underway
      'completed',    // deliverable handed over
      'cancelled'     // customer cancelled before acceptance
    ),
    defaultValue: 'pending',
  },

  // Quote fields — filled by b2b_admin
  quote_service_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  quote_govt_fees:   { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  quote_cycle: {
    // 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual'
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  quote_valid_until: { type: DataTypes.DATE, allowNull: true },
  quote_terms:       { type: DataTypes.TEXT, allowNull: true },
  quote_issued_at:   { type: DataTypes.DATE, allowNull: true },
  assigned_admin_id: { type: DataTypes.UUID, allowNull: true },

  // Customer response
  responded_at: { type: DataTypes.DATE, allowNull: true },

  // Final handover
  completed_at: { type: DataTypes.DATE, allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'enquiries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['customer_id'] },
    { fields: ['service_id'] },
    { fields: ['status'] },
    { fields: ['assigned_admin_id'] },
  ],
});

export default Enquiry;
