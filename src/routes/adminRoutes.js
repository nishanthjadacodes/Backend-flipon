import express from 'express';
import {
  getAllServices,
  createService,
  updateService,
  deleteService,
  getAllUsers,
  updateUserStatus,
  getDashboardStats,
  getAllBookings,
  assignAgent,
  rescheduleBooking,
  cancelBooking,
  getAvailableAgents,
} from '../controllers/adminController.js';
import {
  dashboardSummary,
  operationalReport,
  revenueReport,
  agentPerformance,
  serviceDemand,
  zoneDemand,
  pendingDocumentation,
} from '../controllers/reportsController.js';
import {
  listTickets, getTicket, createTicket, updateTicket, ticketStats,
  listTicketMessages, sendTicketMessage,
} from '../controllers/ticketsController.js';
import {
  listPayouts, createPayout, updatePayoutStatus, payoutStats,
} from '../controllers/payoutsController.js';
import {
  listRoyalties, royaltySummary, generateRoyalty, updateRoyaltyStatus, addCommissionEntries,
} from '../controllers/royaltyController.js';
import { listAuditLogs } from '../controllers/auditController.js';
import { getConfig, updateConfig } from '../controllers/platformConfigController.js';
import { b2bPipeline, updateMilestone } from '../controllers/b2bController.js';
import { listAllEnquiriesForAdmin, issueQuoteAdmin, rejectEnquiryAdmin } from '../controllers/enquiryController.js';
import {
  listAdmins, createAdmin, updateAdmin, deactivateAdmin,
  forfeitRoyaltyForQuarter, clearRoyaltyForfeit, terminateForSelfReferral,
} from '../controllers/adminUsersController.js';
import { bulkUploadMiddleware, bulkAgents, bulkServices } from '../controllers/bulkUploadController.js';
import auth from '../middleware/auth.js';
import { requirePermission, requireRoles } from '../middleware/rbac.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

// All admin routes require an authenticated admin-role user.
router.use(auth);
router.use(requireRoles('super_admin', 'operations_manager', 'b2b_admin', 'finance_admin', 'customer_support'));

// Dashboard
router.get('/dashboard/stats', requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);
router.get('/dashboard/summary', requirePermission(PERMISSIONS.DASHBOARD_VIEW), dashboardSummary);

// Reports
router.get('/reports/operational', requirePermission(PERMISSIONS.REPORTS_VIEW), operationalReport);
router.get('/reports/revenue', requirePermission(PERMISSIONS.REVENUE_VIEW), revenueReport);
router.get('/reports/agents', requirePermission(PERMISSIONS.AGENT_VIEW), agentPerformance);
router.get('/reports/service-demand', requirePermission(PERMISSIONS.REPORTS_VIEW), serviceDemand);
router.get('/reports/zones', requirePermission(PERMISSIONS.REPORTS_VIEW), zoneDemand);
router.get('/reports/pending-documentation', requirePermission(PERMISSIONS.DOCUMENT_VIEW), pendingDocumentation);

// Service management
router.get('/services', requirePermission(PERMISSIONS.SERVICE_VIEW), getAllServices);
router.post('/services', requirePermission(PERMISSIONS.SERVICE_CREATE), createService);
router.put('/services/:id', requirePermission(PERMISSIONS.SERVICE_EDIT), updateService);
router.delete('/services/:id', requirePermission(PERMISSIONS.SERVICE_DELETE), deleteService);

// User management (customers + agents)
router.get('/users', requirePermission(PERMISSIONS.USER_VIEW), getAllUsers);
router.put('/users/:id/status', requirePermission(PERMISSIONS.USER_EDIT), updateUserStatus);

// Refer & Earn governance — anti-poaching forfeit + self-referral termination.
// Royalty-approve permission is the right gate: only finance/super-admin
// should be able to take money away from a rep's wallet path.
router.post('/users/:id/forfeit-royalty', requirePermission(PERMISSIONS.ROYALTY_APPROVE), forfeitRoyaltyForQuarter);
router.post('/users/:id/clear-royalty-forfeit', requirePermission(PERMISSIONS.ROYALTY_APPROVE), clearRoyaltyForfeit);
router.post('/users/:id/terminate-self-referral', requirePermission(PERMISSIONS.USER_DEACTIVATE), terminateForSelfReferral);

// Admin user CRUD (Super Admin only)
router.get('/admins', requirePermission(PERMISSIONS.USER_VIEW), listAdmins);
router.post('/admins', requirePermission(PERMISSIONS.USER_CREATE), createAdmin);
router.put('/admins/:id', requirePermission(PERMISSIONS.USER_EDIT), updateAdmin);
router.delete('/admins/:id', requirePermission(PERMISSIONS.USER_DEACTIVATE), deactivateAdmin);

// Bookings
router.get('/bookings', requirePermission(PERMISSIONS.BOOKING_VIEW), getAllBookings);
router.post('/bookings/assign-agent', requirePermission(PERMISSIONS.BOOKING_ASSIGN), assignAgent);
router.put('/bookings/:id/reschedule', requirePermission(PERMISSIONS.BOOKING_RESCHEDULE), rescheduleBooking);
router.put('/bookings/:id/cancel', requirePermission(PERMISSIONS.BOOKING_CANCEL), cancelBooking);

// Agents
router.get('/agents/available', requirePermission(PERMISSIONS.AGENT_VIEW), getAvailableAgents);

// Tickets (Customer Support)
router.get('/tickets', requirePermission(PERMISSIONS.TICKETS_VIEW), listTickets);
router.get('/tickets/stats', requirePermission(PERMISSIONS.TICKETS_VIEW), ticketStats);
router.get('/tickets/:id', requirePermission(PERMISSIONS.TICKETS_VIEW), getTicket);
router.post('/tickets', requirePermission(PERMISSIONS.TICKETS_MANAGE), createTicket);
router.put('/tickets/:id', requirePermission(PERMISSIONS.TICKETS_MANAGE), updateTicket);
router.get('/tickets/:id/messages', requirePermission(PERMISSIONS.TICKETS_VIEW), listTicketMessages);
router.post('/tickets/:id/messages', requirePermission(PERMISSIONS.TICKETS_MANAGE), sendTicketMessage);

// Payouts (Finance)
router.get('/payouts', requirePermission(PERMISSIONS.WALLET_MANAGE), listPayouts);
router.get('/payouts/stats', requirePermission(PERMISSIONS.WALLET_MANAGE), payoutStats);
router.post('/payouts', requirePermission(PERMISSIONS.WALLET_MANAGE), createPayout);
router.put('/payouts/:id/status', requirePermission(PERMISSIONS.PAYOUT_APPROVE), updatePayoutStatus);

// Royalty (Finance) — 2% monthly royalty + team commissions per PDF.
router.get('/royalty', requirePermission(PERMISSIONS.ROYALTY_APPROVE), listRoyalties);
router.get('/royalty/summary', requirePermission(PERMISSIONS.ROYALTY_APPROVE), royaltySummary);
router.post('/royalty/generate', requirePermission(PERMISSIONS.ROYALTY_APPROVE), generateRoyalty);
router.post('/royalty/commissions', requirePermission(PERMISSIONS.ROYALTY_APPROVE), addCommissionEntries);
router.put('/royalty/:id/status', requirePermission(PERMISSIONS.ROYALTY_APPROVE), updateRoyaltyStatus);

// Audit logs (Super Admin only — gate via AUDIT_LOGS_VIEW)
router.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW), listAuditLogs);

// Financial configuration (payment gateway, tax %, royalty %, commissions).
// Super Admin only — gate via FINANCIAL_CONFIG.
router.get('/config', requirePermission(PERMISSIONS.FINANCIAL_CONFIG), getConfig);
router.put('/config', requirePermission(PERMISSIONS.FINANCIAL_CONFIG), updateConfig);

// B2B / Industrial pipeline
router.get('/b2b/pipeline', requirePermission(PERMISSIONS.B2B_PIPELINE), b2bPipeline);
router.put('/b2b/bookings/:id/milestone', requirePermission(PERMISSIONS.B2B_PIPELINE), updateMilestone);
router.get('/enquiries', requirePermission(PERMISSIONS.B2B_PIPELINE), listAllEnquiriesForAdmin);
router.post('/enquiries/:id/quote', requirePermission(PERMISSIONS.B2B_PIPELINE), issueQuoteAdmin);
router.post('/enquiries/:id/reject', requirePermission(PERMISSIONS.B2B_PIPELINE), rejectEnquiryAdmin);

// Bulk upload (Super Admin only — BULK_UPLOAD)
router.post('/bulk/agents', requirePermission(PERMISSIONS.BULK_UPLOAD), bulkUploadMiddleware, bulkAgents);
router.post('/bulk/services', requirePermission(PERMISSIONS.BULK_UPLOAD), bulkUploadMiddleware, bulkServices);

export default router;
