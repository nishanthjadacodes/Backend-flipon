import express from 'express';
import {
  processPayment,
  getPaymentStatus
} from '../controllers/paymentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Process payment
router.post('/process', auth, processPayment);

// Get payment status
router.get('/status/:booking_id', auth, getPaymentStatus);

export default router;
