import { User, WalletTransaction, Booking } from '../models/index.js';
import { sequelize } from '../config/database.js';

// GET /api/wallet/balance — current balance + recent transactions
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'wallet_balance'] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const transactions = await WalletTransaction.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    res.json({
      success: true,
      balance: parseFloat(user.wallet_balance || 0),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        source: t.source,
        description: t.description,
        bookingId: t.booking_id,
        balanceAfter: parseFloat(t.balance_after),
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wallet' });
  }
};

// POST /api/wallet/redeem — apply wallet credits to a booking.
// Spec: max 50% of booking value can be paid from wallet credits.
const redeemWallet = async (req, res) => {
  const { bookingId, amount } = req.body;
  if (!bookingId || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'bookingId and positive amount required' });
  }

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const booking = await Booking.findByPk(bookingId, { transaction: t });
    if (!booking || booking.customer_id !== req.user.id) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const balance = parseFloat(user.wallet_balance || 0);
    const bookingTotal = parseFloat(booking.price_quoted || 0);
    const maxRedeemable = Math.floor(bookingTotal * 0.5);

    if (amount > balance) {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${balance}` });
    }
    if (amount > maxRedeemable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Max ₹${maxRedeemable} (50%) can be redeemed for this booking`,
      });
    }

    const newBalance = balance - amount;
    await user.update({ wallet_balance: newBalance }, { transaction: t });
    await WalletTransaction.create({
      user_id: req.user.id,
      type: 'debit',
      amount,
      source: 'booking_redeem',
      description: `Redeemed for booking ${booking.booking_number || bookingId}`,
      booking_id: bookingId,
      balance_after: newBalance,
    }, { transaction: t });

    await t.commit();
    res.json({ success: true, balance: newBalance, redeemed: amount });
  } catch (error) {
    await t.rollback();
    console.error('Redeem wallet error:', error);
    res.status(500).json({ success: false, message: 'Failed to redeem wallet' });
  }
};

// Internal helper — credit a user's wallet (used by referral reward trigger,
// admin adjustments, refunds, etc.). Caller passes a Sequelize transaction
// when the credit must atomically commit with surrounding logic.
export const creditWallet = async ({ userId, amount, source, description, bookingId = null, transaction = null }) => {
  const user = await User.findByPk(userId, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (!user) throw new Error(`User ${userId} not found`);
  const balance = parseFloat(user.wallet_balance || 0);
  const newBalance = balance + parseFloat(amount);
  await user.update({ wallet_balance: newBalance }, { transaction });
  await WalletTransaction.create({
    user_id: userId,
    type: 'credit',
    amount,
    source,
    description,
    booking_id: bookingId,
    balance_after: newBalance,
  }, { transaction });
  return newBalance;
};

export { getWalletBalance, redeemWallet };
