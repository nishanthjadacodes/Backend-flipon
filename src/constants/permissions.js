// Permission keys used across admin routes + RBAC middleware.
// Grouped by capability area for readability. Keep in sync with admin panel
// src/constants/roles.js (PERMISSIONS) — identical string keys on both sides.

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',

  // User management (admins, agents, customers)
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_EDIT: 'USER_EDIT',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  USER_DELETE: 'USER_DELETE',

  // Bookings / Orders
  BOOKING_VIEW: 'BOOKING_VIEW',
  BOOKING_ASSIGN: 'BOOKING_ASSIGN',
  BOOKING_RESCHEDULE: 'BOOKING_RESCHEDULE',
  BOOKING_CANCEL: 'BOOKING_CANCEL',

  // Agents
  AGENT_VIEW: 'AGENT_VIEW',
  AGENT_TRACK: 'AGENT_TRACK',
  AGENT_APPROVE: 'AGENT_APPROVE',

  // KYC / Documents
  KYC_VIEW: 'KYC_VIEW',
  KYC_VERIFY: 'KYC_VERIFY',
  DOCUMENT_VIEW: 'DOCUMENT_VIEW',
  DOCUMENT_VERIFY: 'DOCUMENT_VERIFY',
  DOCUMENT_VAULT: 'DOCUMENT_VAULT',

  // Services
  SERVICE_VIEW: 'SERVICE_VIEW',
  SERVICE_CREATE: 'SERVICE_CREATE',
  SERVICE_EDIT: 'SERVICE_EDIT',
  SERVICE_DELETE: 'SERVICE_DELETE',

  // Finance
  FINANCIAL_CONFIG: 'FINANCIAL_CONFIG',
  REVENUE_VIEW: 'REVENUE_VIEW',
  ROYALTY_APPROVE: 'ROYALTY_APPROVE',
  WALLET_MANAGE: 'WALLET_MANAGE',
  PAYOUT_APPROVE: 'PAYOUT_APPROVE',

  // Reports
  REPORTS_VIEW: 'REPORTS_VIEW',
  REPORTS_B2B: 'REPORTS_B2B',
  REPORTS_EXPORT: 'REPORTS_EXPORT',

  // Support / tickets
  TICKETS_VIEW: 'TICKETS_VIEW',
  TICKETS_MANAGE: 'TICKETS_MANAGE',
  DISPUTE_MANAGE: 'DISPUTE_MANAGE',
  CHAT_VIEW: 'CHAT_VIEW',

  // B2B pipeline
  B2B_PIPELINE: 'B2B_PIPELINE',
  B2B_REPORTS: 'B2B_REPORTS',

  // Audit + bulk
  AUDIT_LOGS_VIEW: 'AUDIT_LOGS_VIEW',
  BULK_UPLOAD: 'BULK_UPLOAD',
};

// Per-role permission maps — PDF-exact.
// Super Admin gets '*' (wildcard) matching existing seed convention.
export const ROLE_PERMISSIONS = {
  super_admin: ['*'],

  // Operations Manager: booking assign/reschedule/cancel, agent tracking,
  // document verification, dispute resolution.
  // Restriction: cannot change prices, royalty, financial settings.
  operations_manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_ASSIGN,
    PERMISSIONS.BOOKING_RESCHEDULE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.AGENT_VIEW,
    PERMISSIONS.AGENT_TRACK,
    PERMISSIONS.KYC_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_VERIFY,
    PERMISSIONS.SERVICE_VIEW,
    PERMISSIONS.DISPUTE_MANAGE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_MANAGE,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],

  // B2B / Industrial Admin: B2B pipeline, document vault, B2B-only reports.
  // Restriction: no B2C customer data, no field agent management.
  b2b_admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.B2B_PIPELINE,
    PERMISSIONS.B2B_REPORTS,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_VAULT,
    PERMISSIONS.SERVICE_VIEW,
    PERMISSIONS.REPORTS_B2B,
  ],

  // Finance & Accounts Admin: revenue reports, royalty approval, wallet/payout.
  // Restriction: cannot modify booking slots, services, or assign agents.
  finance_admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REVENUE_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ROYALTY_APPROVE,
    PERMISSIONS.WALLET_MANAGE,
    PERMISSIONS.PAYOUT_APPROVE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.AGENT_VIEW,
    PERMISSIONS.SERVICE_VIEW,
  ],

  // Customer Support Admin: booking history, tickets, chat.
  // Restriction: NO delete permissions, NO financial data, NO admin settings.
  customer_support: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_MANAGE,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.AGENT_VIEW,
    PERMISSIONS.SERVICE_VIEW,
  ],
};

export const ADMIN_ROLE_NAMES = Object.keys(ROLE_PERMISSIONS);
