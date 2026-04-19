import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { generateOTP } from '../utils/otpGenerator.js';

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

// Send real SMS via Fast2SMS
const sendSMS = async (mobile, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_FAST2SMS_API_KEY_HERE') {
    console.log('[SMS] No Fast2SMS key configured — OTP logged to console only');
    return false;
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: mobile,
        flash: 0,
      }),
    });
    const data = await response.json();
    console.log(`[SMS] Fast2SMS response:`, data);
    return data.return === true;
  } catch (error) {
    console.error('[SMS] Fast2SMS error:', error.message);
    return false;
  }
};

const sendOTP = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const otp = generateOTP();
    otpStore.set(mobile, { otp, createdAt: Date.now() });

    const smsSent = await sendSMS(mobile, otp);
    console.log(`[OTP] Mobile: ${mobile}, OTP: ${otp}, SMS sent: ${smsSent}`);

    // In development, when SMS isn't sent, return the OTP in the response
    // so the app can prefill / show it to the user. Never do this in production.
    const devMode = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: smsSent
        ? `OTP sent to +91${mobile}`
        : devMode
          ? `Dev mode OTP (SMS gateway not configured): ${otp}`
          : 'OTP sent successfully',
      ...(devMode && !smsSent ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { mobile, otp, role = 'agent' } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and OTP are required' });
    }

    const stored = otpStore.get(mobile);

    // Check OTP exists
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    // Check 5-minute expiry
    if (Date.now() - stored.createdAt > 5 * 60 * 1000) {
      otpStore.delete(mobile);
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    // Verify
    if (stored.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Find or create user
    let user = await User.findByMobile(mobile);
    if (!user) {
      user = await User.create({
        mobile,
        name: `User_${mobile.slice(-4)}`,
        role: role || 'agent',
        is_verified: true,
      });
      console.log(`Created new user for mobile: ${mobile}`);
    } else {
      await user.update({ is_verified: true });
      console.log(`Updated existing user for mobile: ${mobile}`);
    }

    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    otpStore.delete(mobile);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
        online_status: user.online_status,
        rating: user.rating,
        total_jobs_completed: user.total_jobs_completed,
      },
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};

const signup = async (req, res) => {
  try {
    const { mobile, name, email, role = 'agent' } = req.body;
    if (!mobile || !name) {
      return res.status(400).json({ success: false, message: 'Mobile and name are required' });
    }

    const existing = await User.findByMobile(mobile);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({ mobile, name, email, role, is_verified: false, is_active: true });

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      user: { id: user.id, mobile: user.mobile, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Failed to register' });
  }
};

// ─── Guest login ───────────────────────────────────────────────────────────
// Temporary auth scheme: the app calls this silently on launch and gets a
// usable JWT without showing any login screen. Backed by a single shared
// `guest_customer` row so every existing authenticated route (profile,
// bookings, enquiries, etc.) keeps working end-to-end. Swap this out for
// real SSO / OTP / Firebase later when needed.
const GUEST_MOBILE = '0000000000';
const guestLogin = async (_req, res) => {
  try {
    let user = await User.findByMobile(GUEST_MOBILE);
    if (!user) {
      user = await User.create({
        mobile: GUEST_MOBILE,
        name: 'Guest',
        role: 'customer',
        is_verified: true,
        is_active: true,
      });
      console.log('[guest-login] Created shared guest user');
    }

    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error('[guest-login] Unexpected error:', error);
    res.status(500).json({ success: false, message: 'Failed to start guest session' });
  }
};

export { sendOTP, verifyOTP, signup, guestLogin };
