import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { generateOTP } from '../utils/otpGenerator.js';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  getPhoneLookupVariants,
} from '../utils/phone.js';

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';

// Second variable in the DLT template — the registered text reads
// "Your OTP for {businessName} is {OTP}" so the value here must match
// what was approved on the DLT portal.
const BUSINESS_NAME = 'FliponeX';

// Review credentials shared by the customer + rep apps for Play Store
// review. The bypass never hits Fast2SMS — the OTP is always REVIEW_OTP
// and the SMS step is skipped entirely.
const REVIEW_MOBILE = '9999999999';
const REVIEW_OTP = '1234';

// Send a DLT-approved OTP SMS via Fast2SMS.
//
// Easy-to-get-wrong details that the spec calls out:
//   - GET request with all params in the query string (not a JSON body).
//   - `message` is the numeric DLT template ID, NOT literal text.
//   - `variables_values` is pipe-separated, in the exact order the DLT
//     template defines: {OTP}|{businessName}.
//   - `numbers` is a bare 10-digit number, no +91.
//   - Read response.text() first, then JSON.parse — Fast2SMS sometimes
//     returns non-JSON on errors.
const sendOtpSms = async ({ otpCode, phone }) => {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const route = process.env.FAST2SMS_ROUTE?.trim() || 'dlt';
  const senderId = process.env.FAST2SMS_SENDER_ID?.trim();
  const templateId = process.env.FAST2SMS_TEMPLATE_ID?.trim();

  if (!apiKey) {
    return { success: false, error: 'FAST2SMS_API_KEY is not configured.' };
  }
  if (!senderId || !templateId) {
    return { success: false, error: 'FAST2SMS sender/template configuration is incomplete.' };
  }

  try {
    const url = new URL(FAST2SMS_ENDPOINT);
    url.searchParams.set('authorization', apiKey);
    url.searchParams.set('route', route);
    url.searchParams.set('sender_id', senderId);
    url.searchParams.set('message', templateId);
    url.searchParams.set('variables_values', `${otpCode}|${BUSINESS_NAME}`);
    url.searchParams.set('numbers', phone);
    url.searchParams.set('flash', '0');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const rawResponse = await response.text();
    let providerResponse = rawResponse;
    try {
      providerResponse = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      /* Fast2SMS returns non-JSON on some errors — keep the raw string. */
    }

    if (!response.ok) {
      console.error('[FAST2SMS_OTP_SEND_FAILED]', {
        status: response.status,
        phone,
        response: providerResponse,
      });
      return {
        success: false,
        error: 'SMS provider rejected the OTP request.',
        providerResponse,
      };
    }

    return { success: true, providerResponse };
  } catch (error) {
    console.error('[FAST2SMS_OTP_SEND_ERROR]', {
      phone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, error: 'Unable to reach the SMS provider right now.' };
  }
};

// OTP delivery provider — explicit env var so we don't rely on NODE_ENV.
//   OTP_PROVIDER=hardcoded  (default) — no SMS, return OTP in response.
//                                       Free; for internal testing.
//   OTP_PROVIDER=fast2sms             — real SMS via Fast2SMS DLT route.
//                                       Requires the four FAST2SMS_* env vars.
const otpProvider = () =>
  String(process.env.OTP_PROVIDER || 'hardcoded').toLowerCase();

// Legacy data may have been stored with or without the country code.
// Try all the forms when looking a user up; new sign-ups normalize on
// write so the variant set collapses to one entry over time.
const findUserByPhoneVariants = async (phone) => {
  const variants = getPhoneLookupVariants(phone);
  if (!variants.length) return null;
  return await User.findOne({ where: { mobile: { [Op.in]: variants } } });
};

const sendOTP = async (req, res) => {
  try {
    const rawMobile = req.body?.mobile;
    if (!rawMobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }
    if (!isValidPhoneNumber(rawMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit Indian mobile number.',
      });
    }

    const mobile = normalizePhoneNumber(rawMobile);
    const role = req.body?.role || 'customer';
    const isBypass = mobile === REVIEW_MOBILE;
    const otp = isBypass ? REVIEW_OTP : generateOTP();
    const otpExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Persist BEFORE sending the SMS so a successful provider response
    // can't race a failed DB write. Stub-create first-time numbers as
    // unverified; verifyOTP flips is_verified once the code matches.
    let user = await findUserByPhoneVariants(mobile);
    if (!user) {
      user = await User.create({
        mobile,
        name: `User_${mobile.slice(-4)}`,
        role,
        is_verified: false,
        is_active: true,
        otp_code: otp,
        otp_expires_at: otpExpiresAt,
      });
    } else {
      await user.update({ otp_code: otp, otp_expires_at: otpExpiresAt });
    }

    const provider = otpProvider();
    let providerResponse;
    if (!isBypass && provider === 'fast2sms') {
      const result = await sendOtpSms({ otpCode: otp, phone: mobile });
      if (!result.success) {
        // Don't pretend it sent. 502 so the client can retry instead of
        // sitting on a "waiting for OTP" screen forever.
        return res.status(502).json({
          success: false,
          message: result.error,
          providerResponse: result.providerResponse,
        });
      }
      providerResponse = result.providerResponse;
    }
    console.log(`[OTP] mobile=${mobile} otp=${otp} provider=${provider} bypass=${isBypass}`);

    // Return the OTP in the response only when we know we DIDN'T send it
    // via a real channel — bypass numbers always, hardcoded provider always,
    // and fast2sms only on non-production deploys (so staging can still
    // read the code from the response for automated tests).
    const isProduction = process.env.NODE_ENV === 'production';
    const includeDevOtp =
      isBypass ||
      provider === 'hardcoded' ||
      (provider === 'fast2sms' && !isProduction);

    res.json({
      success: true,
      message: isBypass
        ? `Bypass OTP for review account: ${otp}`
        : provider === 'fast2sms' && isProduction
          ? 'OTP sent successfully'
          : `Dev OTP (provider=${provider}): ${otp}`,
      expiresInMinutes: 30,
      ...(includeDevOtp ? { devOtp: otp, otp } : {}),
      ...(providerResponse ? { providerResponse } : {}),
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const rawMobile = req.body?.mobile;
    const otp = String(req.body?.otp || '').trim();

    if (!rawMobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and OTP are required' });
    }
    if (!/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'OTP must be 4 digits' });
    }

    const mobile = normalizePhoneNumber(rawMobile);
    const user = await findUserByPhoneVariants(mobile);

    if (!user || !user.otp_code || !user.otp_expires_at) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }
    if (new Date(user.otp_expires_at).getTime() < Date.now()) {
      await user.update({ otp_code: null, otp_expires_at: null });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }
    if (user.otp_code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Success — clear the code so it can't be reused, flip verified, stamp login.
    await user.update({
      otp_code: null,
      otp_expires_at: null,
      is_verified: true,
      last_login_at: new Date(),
    });

    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

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
const AGENT_GUEST_MOBILE = '1111111111';

// Shared helper — create-or-fetch a role-specific guest user, sign a 30-day JWT.
const issueGuestToken = async (mobile, name, role) => {
  let user = await User.findByMobile(mobile);
  if (!user) {
    user = await User.create({
      mobile,
      name,
      role,
      is_verified: true,
      is_active: true,
    });
    console.log(`[guest-login] Created shared ${role} guest user (${mobile})`);
  }
  const token = jwt.sign(
    { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  return {
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
  };
};

const guestLogin = async (_req, res) => {
  try {
    const { token, user } = await issueGuestToken(GUEST_MOBILE, 'Guest', 'customer');
    return res.json({ success: true, token, user });
  } catch (error) {
    console.error('[guest-login] Unexpected error:', error);
    res.status(500).json({ success: false, message: 'Failed to start guest session' });
  }
};

// Agent-app twin of /auth/guest-login — returns an agent-role JWT so the
// shared tester pool can see unassigned pending bookings.
const agentGuestLogin = async (_req, res) => {
  try {
    const { token, user } = await issueGuestToken(AGENT_GUEST_MOBILE, 'Partner Guest', 'agent');
    return res.json({ success: true, token, user });
  } catch (error) {
    console.error('[agent-guest-login] Unexpected error:', error);
    res.status(500).json({ success: false, message: 'Failed to start representative guest session' });
  }
};

export { sendOTP, verifyOTP, signup, guestLogin, agentGuestLogin };
