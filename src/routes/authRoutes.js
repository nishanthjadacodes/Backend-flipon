import express from 'express';
import {
  sendOTP,
  verifyOTP,
  signup,
  guestLogin,
  agentGuestLogin,
} from '../controllers/authController.js';
import { adminLogin, me, changePassword } from '../controllers/adminAuthController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Send OTP
router.post('/send-otp', sendOTP);

// Verify OTP
router.post('/verify-otp', verifyOTP);

// Signup
router.post('/signup', signup);

// Guest login — app calls this silently on splash and gets a usable JWT
// so every authenticated route keeps working without a login screen.
router.post('/guest-login', guestLogin);

// Agent-app twin — issues a shared-agent JWT so every tester of the
// AgentApp sees the unassigned pending booking pool on Dashboard / Tasks.
router.post('/agent-guest-login', agentGuestLogin);

// Admin email+password login (admin panel)
router.post('/admin/login', adminLogin);
router.get('/admin/me', auth, me);
router.post('/admin/change-password', auth, changePassword);

// Test endpoint to verify OTP functionality
router.post('/test-otp', async (req, res) => {
  console.log('=== TEST OTP ENDPOINT CALLED ===');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  console.log('Request URL:', req.originalUrl);
  console.log('Timestamp:', new Date().toISOString());
  
  res.json({
    success: true,
    message: 'OTP test endpoint is working',
    timestamp: new Date().toISOString(),
    body: req.body
  });
});

// Protected route example
router.get('/profile', auth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

export default router;
