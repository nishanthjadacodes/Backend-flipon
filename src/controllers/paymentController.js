import { Booking } from '../models/index.js';

const processPayment = async (req, res) => {
  try {
    console.log('=== PAYMENT PROCESSING START ===');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);

    const { booking_id, payment_method, transaction_id, amount } = req.body;

    if (!booking_id || !payment_method || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, payment method, and amount are required'
      });
    }

    // Find booking
    const booking = await Booking.findByPk(booking_id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to user
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - booking does not belong to user'
      });
    }

    // Update booking payment status
    const paymentData = {
      payment_status: 'paid',
      payment_method,
      transaction_id,
      amount_paid: parseFloat(amount),
      paid_at: new Date()
    };

    await booking.update(paymentData);

    console.log(`Payment processed for booking ${booking_id}:`, paymentData);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        booking_id,
        payment_status: 'paid',
        amount_paid: amount,
        payment_method,
        paid_at: paymentData.paid_at
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment'
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { booking_id } = req.params;

    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    const booking = await Booking.findByPk(booking_id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to user
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - booking does not belong to user'
      });
    }

    res.json({
      success: true,
      data: {
        booking_id,
        payment_status: booking.payment_status,
        amount_paid: booking.amount_paid,
        payment_method: booking.payment_method,
        paid_at: booking.paid_at
      }
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status'
    });
  }
};

export {
  processPayment,
  getPaymentStatus
};
