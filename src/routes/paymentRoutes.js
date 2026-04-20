import express from 'express';
import {
  createOrder,
  verifyPayment,
  processPayment,
  getPaymentStatus,
} from '../controllers/paymentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Razorpay flow
router.post('/create-order', auth, createOrder);
router.post('/verify', auth, verifyPayment);

// Legacy flow — kept so older app builds keep working during the rollout
router.post('/process', auth, processPayment);

router.get('/status/:booking_id', auth, getPaymentStatus);

export default router;
