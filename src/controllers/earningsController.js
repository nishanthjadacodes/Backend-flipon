import { Op } from 'sequelize';
import { Booking, User, Service } from '../models/index.js';

// Get representative earnings — real numbers, no mock multipliers.
// Response shape matches what the rep app's EarningsScreen expects:
//   { success, earnings: EarningRecord[], total, today, week, summary }
const getAgentEarnings = async (req, res) => {
  try {
    const agentId = req.user.id;

    // Count BOTH 'completed' (customer OTP-verified, fully closed) AND
    // 'submitted' (rep finished the work, customer hasn't entered OTP
    // yet). Reps need to see their day's earnings the moment they
    // finish a task — not have to wait for the customer to find a
    // quiet moment to enter the OTP. This is display logic only:
    // actual payout still gates on 'completed' downstream.
    const completedBookings = await Booking.findAll({
      where: {
        agent_id: agentId,
        status: { [Op.in]: ['completed', 'submitted'] },
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'partner_earning', 'user_cost'],
        },
      ],
      // Sort by whichever timestamp made the booking "earned" — same
      // fallback chain used below for the per-row date.
      order: [
        ['completed_at', 'DESC'],
        ['submitted_at', 'DESC'],
        ['updated_at', 'DESC'],
      ],
    });

    const now = new Date();
    const todayStr = now.toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Per-booking commission = service.partner_earning. Coerce to Number
    // since Sequelize returns DECIMAL columns as strings.
    //
    // FALLBACK CHAIN — admins haven't always configured partner_earning
    // on every service (the column is allowNull:true). When it's null/0
    // we don't want the rep to see ₹0 after a real completion. Fall
    // back to: price_quoted (what the customer paid for THIS booking)
    // → service.user_cost (catalog price). This guarantees the rep
    // sees a non-zero number after every completion until admin
    // properly configures the partner cut per service.
    const commissionFor = (b) => {
      const partnerCut = Number(b.service?.partner_earning || 0);
      if (partnerCut > 0) return partnerCut;
      const gross = Number(b.price_quoted || b.service?.user_cost || 0);
      return gross;
    };

    const totalAmountFor = (b) =>
      Number(b.price_quoted || b.service?.user_cost || 0);

    // Each row represents one earning the rep has banked. Date
    // preference order:
    //   1. completed_at (status='completed', customer OTP-verified)
    //   2. submitted_at (status='submitted', rep finished work,
    //      customer hasn't OTP'd yet — treat as earned today)
    //   3. updated_at (last DB write — usually around completion time)
    //   4. created_at (oldest fallback)
    //
    // paymentStatus reflects the booking's actual state so the rep app
    // can surface "₹X awaiting verification" separately if it wants.
    const earnings = completedBookings.map((b) => {
      const isPending = b.status === 'submitted';
      return {
        id: b.id,
        taskId: String(b.id || '').substring(0, 8),
        customerName: b.customer?.name || 'Customer',
        serviceName: b.service?.name || 'Service',
        amount: totalAmountFor(b),         // gross booking value
        commission: commissionFor(b),      // rep's actual earning
        date: b.completed_at || b.submitted_at || b.updated_at || b.created_at,
        status: b.status,
        // Pending = work done but customer OTP not yet entered.
        // Paid = booking closed and paid out.
        paymentStatus: isPending ? 'pending' : (b.payment_status || 'paid'),
      };
    });

    const sum = (arr) => arr.reduce((s, e) => s + (Number(e.commission) || 0), 0);
    const inRange = (e, since) => new Date(e.date) >= since;

    const total = sum(earnings);
    const today = sum(earnings.filter((e) => new Date(e.date).toDateString() === todayStr));
    const week = sum(earnings.filter((e) => inRange(e, weekAgo)));
    const month = sum(earnings.filter((e) => inRange(e, monthAgo)));

    // Subtotal of work that's done but not yet OTP-verified — useful
    // for the rep app to show "₹X awaiting customer confirmation".
    const pendingTotal = sum(earnings.filter((e) => e.status === 'submitted'));

    const totalJobs = earnings.length;
    const averageEarningPerJob = totalJobs > 0 ? total / totalJobs : 0;

    res.json({
      success: true,
      earnings,
      total,
      today,
      week,
      month,
      pending: pendingTotal,
      summary: {
        totalEarnings: total,
        totalJobs,
        averageEarningPerJob,
        todayEarnings: today,
        thisWeekEarnings: week,
        thisMonthEarnings: month,
        pendingSettlements: pendingTotal,
      },
    });
  } catch (error) {
    console.error('Error getting representative earnings:', error);
    res.status(500).json({ success: false, message: 'Failed to get earnings' });
  }
};

export { getAgentEarnings };
