import express from 'express';
import {
  getCompanyProfile,
  upsertCompanyProfile,
  acceptNDA,
  getB2BReadiness,
} from '../controllers/companyProfileController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, getCompanyProfile);
router.put('/', auth, upsertCompanyProfile);
router.get('/status', auth, getB2BReadiness);
router.post('/nda/accept', auth, acceptNDA);

export default router;
