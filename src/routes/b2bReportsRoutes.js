import express from 'express';
import {
  summary,
  revenueSeries,
  funnel,
  byService,
  byCompany,
  stageHealth,
} from '../controllers/b2bReportsController.js';
import auth from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

/**
 * B2B / industrial reports, mounted under /api/admin/reports/b2b/*.
 *
 * Access model:
 *   • Every route requires auth.
 *   • Every route requires the REPORTS_B2B permission — which super_admin
 *     gets via '*' wildcard and b2b_admin gets explicitly (see
 *     src/constants/permissions.js).
 *   • Other admin roles (operations_manager, finance_admin, etc.) do NOT
 *     have REPORTS_B2B, so this route tree is invisible to them — honouring
 *     the "B2B-only" clause in the spec.
 *
 * These queries never touch the `bookings` table, so a compromised b2b_admin
 * token cannot exfiltrate B2C customer data through this surface.
 */
const router = express.Router();

const gate = [auth, requirePermission('REPORTS_B2B')];

router.get('/summary',       ...gate, summary);
router.get('/revenue',       ...gate, revenueSeries);
router.get('/funnel',        ...gate, funnel);
router.get('/by-service',    ...gate, byService);
router.get('/by-company',    ...gate, byCompany);
router.get('/stage-health',  ...gate, stageHealth);

export default router;
