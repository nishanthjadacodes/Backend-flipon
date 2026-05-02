import express from 'express';
import {
  generateReferralCode,
  getReferralData,
  trackReferralClick,
  getReferralStats,
  applyReferralCode,
  backfillMissedReferralRewards,
} from '../controllers/referralController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, getReferralData);
router.get('/stats', auth, getReferralStats);
router.post('/generate', auth, generateReferralCode);
router.post('/track', auth, trackReferralClick);
router.post('/apply', auth, applyReferralCode);
router.post('/backfill', auth, backfillMissedReferralRewards);

export default router;
