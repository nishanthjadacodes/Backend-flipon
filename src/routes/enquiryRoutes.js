import express from 'express';
import {
  createEnquiry,
  getMyEnquiries,
  getEnquiryById,
  acceptQuote,
  rejectQuote,
  cancelEnquiry,
} from '../controllers/enquiryController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, createEnquiry);
router.get('/mine', auth, getMyEnquiries);
router.get('/:id', auth, getEnquiryById);
router.post('/:id/accept', auth, acceptQuote);
router.post('/:id/reject', auth, rejectQuote);
router.post('/:id/cancel', auth, cancelEnquiry);

export default router;
