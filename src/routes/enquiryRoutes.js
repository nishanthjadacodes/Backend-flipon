import express from 'express';
import {
  createEnquiry,
  getMyEnquiries,
  getEnquiryById,
  getEnquiryStages,
  updateEnquiryStage,
  acceptQuote,
  rejectQuote,
  cancelEnquiry,
} from '../controllers/enquiryController.js';
import auth from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = express.Router();

router.post('/',                auth, createEnquiry);
router.get('/mine',             auth, getMyEnquiries);
router.get('/:id',              auth, getEnquiryById);
router.get('/:id/stages',       auth, getEnquiryStages);
router.post('/:id/accept',      auth, acceptQuote);
router.post('/:id/reject',      auth, rejectQuote);
router.post('/:id/cancel',      auth, cancelEnquiry);

// Admin-only — advance / annotate a stage. Restricted to super_admin and
// b2b_admin so customer-support or finance roles can't touch pipeline data.
router.patch(
  '/:id/stages/:stageId',
  auth,
  requireRoles('super_admin', 'b2b_admin'),
  updateEnquiryStage,
);

export default router;
