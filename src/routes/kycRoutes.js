import express from 'express';
import {
  submitKyc,
  getMyKycStatus,
  getPendingKyc,
  getAgentKycDetails,
  verifyAgentKyc
} from '../controllers/kycController.js';
import auth from '../middleware/auth.js';
import { uploadKYC } from '../middleware/upload.js';
import { isSuperAdmin } from '../middleware/rbac.js';

const router = express.Router();

// Agent KYC routes
router.post('/agent/kyc/submit', auth, uploadKYC, submitKyc);
router.get('/agent/kyc/status', auth, getMyKycStatus);

// Admin KYC routes
router.get('/admin/kyc/pending', auth, isSuperAdmin, getPendingKyc);
router.get('/admin/kyc/:agentId', auth, isSuperAdmin, getAgentKycDetails);
router.put('/admin/kyc/:agentId/verify', auth, isSuperAdmin, verifyAgentKyc);

export default router;
