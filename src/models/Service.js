import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  service_type: {
    type: DataTypes.ENUM('consumer', 'industrial', 'both'),
    defaultValue: 'both'
  },
  // 'fixed' = catalog price shown to user, book via Booking flow
  // 'quote' = B2B/industrial — no catalog price; goes through Enquiry → Quote flow
  pricing_model: {
    type: DataTypes.ENUM('fixed', 'quote'),
    defaultValue: 'fixed',
    allowNull: false
  },
  user_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // For quote-based (industrial) services: the "starting at" professional
  // fee shown on the catalog card before a real quote is issued. Renders as
  // "Starting at ₹5,000" — sets customer expectations so they're not
  // surprised by the admin's quote. For fixed-price services this is unused.
  indicative_price_from: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  indicative_price_to: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // Billing unit for the quote — tells the customer up-front that pricing
  // is "per filing" (GST returns) or "per employee" (EPF/ESIC) rather than
  // a single one-time fee.
  //   one_time      — single flat fee (default)
  //   per_filing    — each monthly/quarterly filing is billed
  //   per_employee  — pricing scales with headcount
  //   per_visit     — each consultation visit is billed
  //   per_report    — per assessment / report (Safety Audit, etc.)
  pricing_unit: {
    type: DataTypes.ENUM('one_time', 'per_filing', 'per_employee', 'per_visit', 'per_report'),
    defaultValue: 'one_time',
    allowNull: true
  },
  expected_timeline: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  govt_fees: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  partner_earning: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  total_expense: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  company_margin: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  required_documents: {
    type: DataTypes.JSON,
    allowNull: true
  },
  form_fields: {
    type: DataTypes.JSON,
    allowNull: true
  },
  allow_pay_after: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'services',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Service;
