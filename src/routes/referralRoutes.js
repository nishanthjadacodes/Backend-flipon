import express from 'express';
import {
  generateReferralCode,
  getReferralData,
  trackReferralClick,
  getReferralStats,
  applyReferralCode,
} from '../controllers/referralController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, getReferralData);
router.get('/stats', auth, getReferralStats);
router.post('/generate', auth, generateReferralCode);
router.post('/track', auth, trackReferralClick);
router.post('/apply', auth, applyReferralCode);

export default router;
