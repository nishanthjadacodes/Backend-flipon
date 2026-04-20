import { sequelize } from '../config/database.js';
import User from './User.js';
import Service from './Service.js';
import AdminRole from './AdminRole.js';
import Booking from './Booking.js';
import Document from './Document.js';
import AgentKyc from './AgentKyc.js';
import Referral from './Referral.js';
import Ticket from './Ticket.js';
import AuditLog from './AuditLog.js';
import Payout from './Payout.js';
import CompanyProfile from './CompanyProfile.js';
import Enquiry from './Enquiry.js';
import EnquiryStage from './EnquiryStage.js';

// Define associations
User.hasMany(Booking, { foreignKey: 'customer_id', as: 'customerBookings' });
User.hasMany(Booking, { foreignKey: 'agent_id', as: 'agentBookings' });
Booking.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Booking.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

Service.hasMany(Booking, { foreignKey: 'service_id', as: 'bookings' });
Booking.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

// Document associations
Document.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(Document, { foreignKey: 'booking_id', as: 'documents' });

Document.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });
User.hasMany(Document, { foreignKey: 'uploaded_by', as: 'uploadedDocuments' });

Document.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
User.hasMany(Document, { foreignKey: 'user_id', as: 'documents' });

// Agent KYC associations
User.hasOne(AgentKyc, { foreignKey: 'agent_id', as: 'agentKyc' });
AgentKyc.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

AgentKyc.belongsTo(Document, { foreignKey: 'aadhaar_front_id', as: 'aadhaarFront' });
AgentKyc.belongsTo(Document, { foreignKey: 'aadhaar_back_id', as: 'aadhaarBack' });
AgentKyc.belongsTo(Document, { foreignKey: 'pan_card_id', as: 'panCard' });
AgentKyc.belongsTo(Document, { foreignKey: 'profile_photo_id', as: 'profilePhoto' });
AgentKyc.belongsTo(Document, { foreignKey: 'address_proof_id', as: 'addressProof' });

// Referral associations
User.hasMany(Referral, { foreignKey: 'referrer_id', as: 'sentReferrals' });
User.hasMany(Referral, { foreignKey: 'referee_id', as: 'receivedReferrals' });
Referral.belongsTo(User, { foreignKey: 'referrer_id', as: 'referrer' });
Referral.belongsTo(User, { foreignKey: 'referee_id', as: 'referee' });

// Ticket associations
Ticket.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Ticket.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
Ticket.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Ticket.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

// Payout associations
Payout.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });
Payout.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// Company profile (B2B) — one per user
User.hasOne(CompanyProfile, { foreignKey: 'user_id', as: 'companyProfile' });
CompanyProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Enquiry (B2B quote-based booking sibling)
User.hasMany(Enquiry,   { foreignKey: 'customer_id',       as: 'customerEnquiries' });
User.hasMany(Enquiry,   { foreignKey: 'assigned_admin_id', as: 'assignedEnquiries' });
Enquiry.belongsTo(User, { foreignKey: 'customer_id',       as: 'customer' });
Enquiry.belongsTo(User, { foreignKey: 'assigned_admin_id', as: 'assignedAdmin' });

Service.hasMany(Enquiry,   { foreignKey: 'service_id', as: 'enquiries' });
Enquiry.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

CompanyProfile.hasMany(Enquiry,   { foreignKey: 'company_profile_id', as: 'enquiries' });
Enquiry.belongsTo(CompanyProfile, { foreignKey: 'company_profile_id', as: 'companyProfile' });

// EnquiryStage — per-enquiry granular progress tracker (ordered list).
Enquiry.hasMany(EnquiryStage,    { foreignKey: 'enquiry_id', as: 'stages' });
EnquiryStage.belongsTo(Enquiry,  { foreignKey: 'enquiry_id', as: 'enquiry' });
EnquiryStage.belongsTo(Document, { foreignKey: 'document_id', as: 'document' });

// Sync all models with database
const syncModels = async () => {
  try {
    await sequelize.sync({ alter: process.env.DB_ALTER === 'true' });
    // Create new tables only (won't touch existing ones)
    await Referral.sync();
    await Ticket.sync();
    await AuditLog.sync();
    await Payout.sync();
    await CompanyProfile.sync();
    await Enquiry.sync();
    await EnquiryStage.sync();
    console.log('Database models synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database models:', error);
    throw error;
  }
};

export {
  User,
  Service,
  AdminRole,
  Booking,
  Document,
  AgentKyc,
  Referral,
  Ticket,
  AuditLog,
  Payout,
  CompanyProfile,
  Enquiry,
  EnquiryStage,
  sequelize,
  syncModels
};
