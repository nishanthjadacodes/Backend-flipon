import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * CompanyProfile — B2B client onboarding data.
 *
 * Each consumer user (role=customer) may own ONE company profile.
 * Industrial bookings are gated on the presence of a complete profile
 * plus an accepted NDA (User.nda_accepted_at).
 *
 * Sourced from the FliponeX B2B data framework:
 *   • Company Profile (legal/brand name, GSTIN, PAN, TAN, CIN)
 *   • Contact Information (registered vs factory address, KDM, PoC)
 *   • Industrial Classification (MSME category, NIC code)
 */
const CompanyProfile = sequelize.define('CompanyProfile', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true, // one profile per user
  },

  // ─── Company Profile ─────────────────────────────────────────────
  legal_entity_name: { type: DataTypes.STRING(150), allowNull: false },
  entity_type: {
    // Private Ltd / LLP / Partnership / Proprietorship / Public Ltd / Other
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  brand_name: { type: DataTypes.STRING(150), allowNull: true },
  gstin: { type: DataTypes.STRING(20), allowNull: false }, // mandatory for B2B invoicing
  pan: { type: DataTypes.STRING(15), allowNull: false },
  tan: { type: DataTypes.STRING(15), allowNull: true },
  cin: { type: DataTypes.STRING(25), allowNull: true }, // only for companies registered with MCA

  // ─── Contact Information ─────────────────────────────────────────
  registered_address: { type: DataTypes.TEXT, allowNull: false },
  factory_address: { type: DataTypes.TEXT, allowNull: true }, // blank → same as registered

  // Key Decision Maker (director / owner)
  kdm_name: { type: DataTypes.STRING(100), allowNull: false },
  kdm_designation: { type: DataTypes.STRING(80), allowNull: true },
  kdm_mobile: { type: DataTypes.STRING(15), allowNull: false },
  kdm_email: { type: DataTypes.STRING(150), allowNull: true },

  // Point of Contact (day-to-day)
  poc_name: { type: DataTypes.STRING(100), allowNull: false },
  poc_designation: { type: DataTypes.STRING(80), allowNull: true },
  poc_mobile: { type: DataTypes.STRING(15), allowNull: false },
  poc_email: { type: DataTypes.STRING(150), allowNull: true },

  // ─── Industrial Classification ───────────────────────────────────
  msme_category: {
    type: DataTypes.ENUM('none', 'micro', 'small', 'medium'),
    defaultValue: 'none',
  },
  nic_code: { type: DataTypes.STRING(10), allowNull: true },

  // ─── Derived / housekeeping ──────────────────────────────────────
  is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  verified_at: { type: DataTypes.DATE, allowNull: true },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'company_profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['user_id'] },
    { fields: ['gstin'] },
  ],
});

export default CompanyProfile;
