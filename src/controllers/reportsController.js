import { Op, fn, col, literal } from 'sequelize';
import { Booking, User, Service } from '../models/index.js';

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const daysAgo = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x; };

const sumFinalPrice = (where) => Booking.sum('final_price', { where }).then((v) => Number(v || 0));

// Enriched dashboard for the admin overview.
// Returns: daily bookings (today/yesterday), active agents, gross revenue (this month),
// pending actions (pending bookings + pending KYC + rejected docs), trend deltas.
export const dashboardSummary = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const tomorrow = endOfDay(new Date());
    const yStart = startOfDay(daysAgo(1));
    const yEnd = endOfDay(daysAgo(1));
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(monthStart.getTime() - 1);

    const [
      todayBookings,
      yesterdayBookings,
      activeAgents,
      totalAgents,
      monthRevenue,
      lastMonthRevenue,
      pendingBookings,
      totalUsers,
      totalServices,
      totalCustomers,
    ] = await Promise.all([
      Booking.count({ where: { created_at: { [Op.between]: [today, tomorrow] } } }),
      Booking.count({ where: { created_at: { [Op.between]: [yStart, yEnd] } } }),
      User.count({ where: { role: 'agent', is_active: true, online_status: true } }),
      User.count({ where: { role: 'agent', is_active: true } }),
      sumFinalPrice({ created_at: { [Op.gte]: monthStart }, payment_status: 'paid' }),
      sumFinalPrice({ created_at: { [Op.between]: [lastMonthStart, lastMonthEnd] }, payment_status: 'paid' }),
      Booking.count({ where: { status: 'pending' } }),
      User.count(),
      Service.count({ where: { is_active: true } }),
      User.count({ where: { role: 'customer' } }),
    ]);

    const pct = (curr, prev) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    res.json({
      success: true,
      data: {
        bookings: {
          today: todayBookings,
          yesterday: yesterdayBookings,
          deltaPct: pct(todayBookings, yesterdayBookings),
        },
        agents: {
          active: activeAgents,
          total: totalAgents,
        },
        revenue: {
          thisMonth: monthRevenue,
          lastMonth: lastMonthRevenue,
          deltaPct: pct(monthRevenue, lastMonthRevenue),
        },
        pendingActions: pendingBookings,
        totals: {
          users: totalUsers,
          services: totalServices,
          customers: totalCustomers,
        },
      },
    });
  } catch (error) {
    console.error('dashboardSummary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary' });
  }
};

// Daily/weekly/monthly operational report.
// Query: period=daily|weekly|monthly (default daily), days=7 (window size)
export const operationalReport = async (req, res) => {
  try {
    const period = (req.query.period || 'daily').toLowerCase();
    const windowDays = Math.max(1, Math.min(90, parseInt(req.query.days || '7', 10)));
    const since = startOfDay(daysAgo(windowDays - 1));

    const rows = await Booking.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        'status',
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('final_price')), 0), 'revenue'],
      ],
      where: { created_at: { [Op.gte]: since } },
      group: [literal('DATE(created_at)'), 'status'],
      raw: true,
    });

    const byDate = {};
    rows.forEach((r) => {
      const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
      if (!byDate[date]) byDate[date] = { date, total: 0, completed: 0, cancelled: 0, revenue: 0 };
      const count = Number(r.count) || 0;
      byDate[date].total += count;
      byDate[date].revenue += Number(r.revenue) || 0;
      if (r.status === 'completed') byDate[date].completed += count;
      if (r.status === 'cancelled') byDate[date].cancelled += count;
    });

    const series = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = daysAgo(i).toISOString().slice(0, 10);
      series.push(byDate[d] || { date: d, total: 0, completed: 0, cancelled: 0, revenue: 0 });
    }

    res.json({ success: true, period, days: windowDays, data: series });
  } catch (error) {
    console.error('operationalReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to build operational report' });
  }
};

// Revenue report split by booking_type (consumer vs industrial).
export const revenueReport = async (req, res) => {
  try {
    const windowDays = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10)));
    const since = startOfDay(daysAgo(windowDays - 1));

    const rows = await Booking.findAll({
      attributes: [
        'booking_type',
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('final_price')), 0), 'revenue'],
      ],
      where: { created_at: { [Op.gte]: since }, payment_status: 'paid' },
      group: ['booking_type'],
      raw: true,
    });

    const data = { consumer: { count: 0, revenue: 0 }, industrial: { count: 0, revenue: 0 } };
    rows.forEach((r) => {
      data[r.booking_type] = { count: Number(r.count) || 0, revenue: Number(r.revenue) || 0 };
    });

    res.json({ success: true, windowDays, data });
  } catch (error) {
    console.error('revenueReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to build revenue report' });
  }
};

// Agent performance leaderboard.
export const agentPerformance = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20', 10)));

    const agents = await User.findAll({
      where: { role: 'agent', is_active: true },
      attributes: [
        'id', 'name', 'mobile', 'rating', 'total_jobs_completed', 'online_status', 'assigned_zone',
      ],
      order: [['total_jobs_completed', 'DESC'], ['rating', 'DESC']],
      limit,
    });

    res.json({ success: true, data: agents });
  } catch (error) {
    console.error('agentPerformance error:', error);
    res.status(500).json({ success: false, message: 'Failed to load representative performance' });
  }
};

// Service demand (count of bookings per service).
export const serviceDemand = async (req, res) => {
  try {
    const windowDays = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10)));
    const since = startOfDay(daysAgo(windowDays - 1));

    const rows = await Booking.findAll({
      attributes: [
        'service_id',
        [fn('COUNT', col('Booking.id')), 'count'],
        [fn('COALESCE', fn('SUM', col('final_price')), 0), 'revenue'],
      ],
      where: { created_at: { [Op.gte]: since } },
      include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'category'] }],
      group: ['service_id', 'service.id'],
      order: [[literal('count'), 'DESC']],
      limit: 50,
    });

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('serviceDemand error:', error);
    res.status(500).json({ success: false, message: 'Failed to load service demand' });
  }
};

// Service Demand Heatmap (zone aggregation). The PDF spec asks for
// "high-demand zones to optimize agent deployment" — we join bookings to
// their assigned agent and group by the agent's assigned_zone. Bookings
// with no agent yet are bucketed as "Unassigned".
export const zoneDemand = async (req, res) => {
  try {
    const windowDays = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10)));
    const since = startOfDay(daysAgo(windowDays - 1));

    const rows = await Booking.findAll({
      attributes: [
        [fn('COUNT', col('Booking.id')), 'count'],
        [fn('COALESCE', fn('SUM', col('final_price')), 0), 'revenue'],
      ],
      where: { created_at: { [Op.gte]: since } },
      include: [
        { model: User, as: 'agent', attributes: ['assigned_zone'] },
      ],
      group: ['agent.assigned_zone'],
      raw: true,
    });

    const byZone = rows.map((r) => ({
      zone: r['agent.assigned_zone'] || 'Unassigned',
      count: Number(r.count) || 0,
      revenue: Number(r.revenue) || 0,
    }));
    byZone.sort((a, b) => b.count - a.count);

    res.json({ success: true, windowDays, data: byZone });
  } catch (error) {
    console.error('zoneDemand error:', error);
    res.status(500).json({ success: false, message: 'Failed to build zone heatmap' });
  }
};

// Pending Documentation report — bookings whose documents are unverified or rejected.
export const pendingDocumentation = async (req, res) => {
  try {
    const rows = await Booking.findAll({
      where: { status: { [Op.in]: ['pending', 'assigned', 'accepted', 'documents_collected'] } },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'ASC']],
      limit: 200,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('pendingDocumentation error:', error);
    res.status(500).json({ success: false, message: 'Failed to load pending documentation' });
  }
};
