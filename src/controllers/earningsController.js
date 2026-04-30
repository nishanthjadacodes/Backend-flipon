import { Booking, User, Service } from '../models/index.js';

// Get representative earnings — real numbers, no mock multipliers.
// Response shape matches what the rep app's EarningsScreen expects:
//   { success, earnings: EarningRecord[], total, today, week, summary }
const getAgentEarnings = async (req, res) => {
  try {
    const agentId = req.user.id;

    const completedBookings = await Booking.findAll({
      where: {
        agent_id: agentId,
        status: 'completed',
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'partner_earning', 'user_cost'],
        },
      ],
      order: [['completed_at', 'DESC']],
    });

    const now = new Date();
    const todayStr = now.toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Per-booking commission = service.partner_earning. Coerce to Number
    // since Sequelize returns DECIMAL columns as strings.
    const commissionFor = (b) =>
      Number(b.service?.partner_earning || 0);

    const totalAmountFor = (b) =>
      Number(b.price_quoted || b.service?.user_cost || 0);

    // Each row represents one completed booking the rep earned commission on.
    const earnings = completedBookings.map((b) => ({
      id: b.id,
      taskId: String(b.id || '').substring(0, 8),
      customerName: b.customer?.name || 'Customer',
      serviceName: b.service?.name || 'Service',
      amount: totalAmountFor(b),         // gross booking value
      commission: commissionFor(b),      // rep's actual earning
      date: b.completed_at || b.updated_at || b.created_at,
      status: 'completed',
      paymentStatus: b.payment_status || 'paid',
    }));

    const sum = (arr) => arr.reduce((s, e) => s + (Number(e.commission) || 0), 0);
    const inRange = (e, since) => new Date(e.date) >= since;

    const total = sum(earnings);
    const today = sum(earnings.filter((e) => new Date(e.date).toDateString() === todayStr));
    const week = sum(earnings.filter((e) => inRange(e, weekAgo)));
    const month = sum(earnings.filter((e) => inRange(e, monthAgo)));

    const totalJobs = earnings.length;
    const averageEarningPerJob = totalJobs > 0 ? total / totalJobs : 0;

    res.json({
      success: true,
      earnings,
      total,
      today,
      week,
      month,
      summary: {
        totalEarnings: total,
        totalJobs,
        averageEarningPerJob,
        todayEarnings: today,
        thisWeekEarnings: week,
        thisMonthEarnings: month,
        pendingSettlements: 0,
      },
    });
  } catch (error) {
    console.error('Error getting representative earnings:', error);
    res.status(500).json({ success: false, message: 'Failed to get earnings' });
  }
};

export { getAgentEarnings };
