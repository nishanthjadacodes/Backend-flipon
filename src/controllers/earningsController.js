import { Booking, User, Service } from '../models/index.js';

// Get agent earnings
const getAgentEarnings = async (req, res) => {
  try {
    const agentId = req.user.id;
    
    // Get completed bookings for the agent
    const completedBookings = await Booking.findAll({
      where: { 
        agent_id: agentId,
        status: 'completed'
      },
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'mobile']
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'partner_earning']
        }
      ],
      order: [['completed_at', 'DESC']]
    });

    // Calculate earnings
    const totalEarnings = completedBookings.reduce((sum, booking) => {
      return sum + (booking.service?.partner_earning || 0);
    }, 0);

    const todayEarnings = completedBookings.filter(booking => {
      const today = new Date();
      const bookingDate = new Date(booking.completed_at);
      return bookingDate.toDateString() === today.toDateString();
    }).reduce((sum, booking) => {
      return sum + (booking.service?.partner_earning || 0);
    }, 0);

    // Create transaction history
    const transactions = completedBookings.map(booking => ({
      id: booking.id,
      type: 'earning',
      amount: booking.service?.partner_earning || 0,
      description: `Service: ${booking.service?.name || 'Unknown'}`,
      customer: booking.customer?.name || 'Unknown',
      date: booking.completed_at,
      status: 'completed'
    }));

    // Mock commission breakdown
    const commissionBreakdown = {
      totalEarnings,
      totalJobs: completedBookings.length,
      averageEarningPerJob: completedBookings.length > 0 ? totalEarnings / completedBookings.length : 0,
      todayEarnings,
      thisWeekEarnings: totalEarnings * 0.3, // Mock calculation
      thisMonthEarnings: totalEarnings * 0.8, // Mock calculation
      pendingSettlements: 0, // Mock data
      lastSettlement: '2024-04-01', // Mock data
      nextSettlement: '2024-05-01' // Mock data
    };

    res.json({
      success: true,
      earnings: commissionBreakdown,
      transactions: transactions,
      summary: {
        totalEarnings,
        totalJobs: completedBookings.length,
        todayEarnings,
        pendingSettlements: 0
      }
    });
  } catch (error) {
    console.error('Error getting agent earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get earnings'
    });
  }
};

export {
  getAgentEarnings
};
