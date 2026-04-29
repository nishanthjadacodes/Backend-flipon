import express from 'express';
import {
  listCompliance,
  uploadCompliance,
  renewCompliance,
  downloadCompliance,
} from '../controllers/complianceController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All routes require auth — compliance docs are private to the user that
// owns the company profile.
router.get('/', auth, listCompliance);
router.post('/upload', auth, ...uploadCompliance); // uploadCompliance is [middleware, handler]
router.post('/:id/renew', auth, renewCompliance);
router.get('/:id/download', auth, downloadCompliance);

export default router;
