import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Booking } from '../models/index.js';

// Single shared Razorpay client. Falls back to undefined if env vars are
// missing — the controller checks before using.
const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

const requireRazorpay = (res) => {
  if (!razorpay) {
    res.status(500).json({
      success: false,
      message: 'Payment gateway not configured (missing RAZORPAY_KEY_ID/SECRET)',
    });
    return false;
  }
  return true;
};

const findOwnedBooking = async (bookingId, userId) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) return { booking: null, error: { status: 404, message: 'Booking not found' } };
  if (booking.customer_id !== userId) {
    return { booking: null, error: { status: 403, message: 'Access denied - booking does not belong to user' } };
  }
  return { booking, error: null };
};

// 1. Create a Razorpay order for a booking. The app uses the returned
//    order_id to open the native checkout. Amount must be in paise (₹×100).
const createOrder = async (req, res) => {
  try {
    if (!requireRazorpay(res)) return;

    const { booking_id, amount } = req.body;
    if (!booking_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'booking_id and amount are required',
      });
    }

    const { booking, error } = await findOwnedBooking(booking_id, req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    const amountPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay receipt has a 40-char hard limit. Truncate the booking UUID.
      receipt: `bk_${String(booking_id).slice(0, 32)}`,
      notes: { booking_id, customer_id: req.user.id },
    });

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error('createOrder error:', err);
    res.status(500).json({ success: false, message: err?.error?.description || 'Failed to create order' });
  }
};

// 2. Verify the signature Razorpay returns after the user completes checkout.
//    HMAC(SHA256, key_secret) of `<order_id>|<payment_id>` must match the
//    razorpay_signature. Only then mark the booking paid.
const verifyPayment = async (req, res) => {
  try {
    if (!requireRazorpay(res)) return;

    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'booking_id, razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
    }

    const { booking, error } = await findOwnedBooking(booking_id, req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    // Pull the authoritative amount + status from Razorpay rather than trusting
    // the client-provided amount.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({
        success: false,
        message: `Payment not successful (status: ${payment.status})`,
      });
    }

    await booking.update({
      payment_status: 'paid',
      payment_method: payment.method || 'online',
      transaction_id: razorpay_payment_id,
      amount_paid: Number(payment.amount) / 100,
      paid_at: new Date(),
    });

    res.json({
      success: true,
      message: 'Payment verified and recorded',
      data: {
        booking_id,
        payment_status: 'paid',
        transaction_id: razorpay_payment_id,
        amount_paid: Number(payment.amount) / 100,
        payment_method: payment.method,
      },
    });
  } catch (err) {
    console.error('verifyPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

// Legacy endpoint kept for backwards compatibility — older app builds still
// call /payments/process. New builds use createOrder + verifyPayment.
const processPayment = async (req, res) => {
  try {
    const { booking_id, payment_method, transaction_id, amount } = req.body;
    if (!booking_id || !payment_method || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, payment method, and amount are required',
      });
    }
    const { booking, error } = await findOwnedBooking(booking_id, req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await booking.update({
      payment_status: 'paid',
      payment_method,
      transaction_id,
      amount_paid: parseFloat(amount),
      paid_at: new Date(),
    });

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        booking_id,
        payment_status: 'paid',
        amount_paid: amount,
        payment_method,
        paid_at: new Date(),
      },
    });
  } catch (err) {
    console.error('processPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { booking_id } = req.params;
    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    const { booking, error } = await findOwnedBooking(booking_id, req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    res.json({
      success: true,
      data: {
        booking_id,
        payment_status: booking.payment_status,
        amount_paid: booking.amount_paid,
        payment_method: booking.payment_method,
        paid_at: booking.paid_at,
      },
    });
  } catch (err) {
    console.error('getPaymentStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment status' });
  }
};

export { createOrder, verifyPayment, processPayment, getPaymentStatus };
