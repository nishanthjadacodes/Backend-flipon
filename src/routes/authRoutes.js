import express from 'express';
import {
  sendOTP,
  verifyOTP,
  signup,
  guestLogin,
  agentGuestLogin,
  deleteAccount,
} from '../controllers/authController.js';
import { adminLogin, adminSignup, me, changePassword } from '../controllers/adminAuthController.js';
import { getInviteByToken, acceptInvite } from '../controllers/adminInviteController.js';
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

// Account deletion — Google Play 2024+ policy requirement. The mobile app's
// Profile → Delete Account button calls this. Anonymises the row, frees
// the mobile UNIQUE slot, deactivates the account. Auth-required.
router.post('/delete-account', auth, deleteAccount);

// Admin email+password login (admin panel)
router.post('/admin/login', adminLogin);
// Admin self-signup — used by the dashboard's /signup page during
// initial team onboarding so each admin can register themselves with
// their role + email + password instead of needing the founder to
// run a SQL bootstrap. Backend enforces one active admin per role.
router.post('/admin/signup', adminSignup);
// Admin invite acceptance — public because the token IS the auth. The
// dashboard's /accept-invite page calls GET first to validate + pre-fill
// the email/role, then POSTs the new password to complete onboarding.
// Both endpoints return 410 Gone (without confirming token validity)
// when the token is unknown, expired, or already used.
router.get('/admin/invite/:token', getInviteByToken);
router.post('/admin/accept-invite', acceptInvite);
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
