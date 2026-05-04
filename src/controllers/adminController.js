import { Service, User, Booking } from '../models/index.js';
import { Op } from 'sequelize';
import { getIoInstance } from '../config/socket.js';
import { sendPushNotification } from '../services/notificationService.js';

// Parse "HH:MM - HH:MM" / "HH:MM AM - HH:MM AM" / "HH:MM" into a [startMin, endMin]
// pair (minutes since midnight). Returns null if unparseable so the caller
// can skip the buffer check rather than reject the assignment outright.
const parseSlot = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim();

  // 12-hour format: "10:00 AM - 11:00 AM" → [600, 660]
  const ampm = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (ampm) {
    const toMin = (h, m, mer) => {
      let H = parseInt(h, 10);
      if (mer && mer.toUpperCase() === 'PM' && H < 12) H += 12;
      if (mer && mer.toUpperCase() === 'AM' && H === 12) H = 0;
      return H * 60 + parseInt(m, 10);
    };
    return [toMin(ampm[1], ampm[2], ampm[3]), toMin(ampm[4], ampm[5], ampm[6] || ampm[3])];
  }
  // 24-hour single time: "10:00" → [600, 660] (assume 1-hour slot)
  const single = text.match(/^(\d{1,2}):(\d{2})$/);
  if (single) {
    const start = parseInt(single[1], 10) * 60 + parseInt(single[2], 10);
    return [start, start + 60];
  }
  return null;
};

// Per the FliponeX spec: "30-minute buffer will be maintained between
// every booking to ensure the agent can travel between locations easily."
// We check both directions — the new slot can't START within 30min of an
// existing booking's END, and the new slot can't END within 30min of an
// existing booking's START.
const BUFFER_MIN = 30;

// Check whether assigning `agentId` to `targetBooking` would violate the
// 30-minute travel buffer. Returns null if OK, or an error string with
// the conflicting slot details if not.
const checkBufferConflict = async (agentId, targetBooking) => {
  const slot = parseSlot(targetBooking.preferred_time);
  if (!slot) return null;                       // no parseable time → can't enforce
  if (!targetBooking.preferred_date) return null;
  const date = String(targetBooking.preferred_date).split('T')[0];

  // Pull this rep's other live bookings on the same day.
  const others = await Booking.findAll({
    where: {
      agent_id: agentId,
      preferred_date: date,
      id: { [Op.ne]: targetBooking.id },
      status: { [Op.notIn]: ['cancelled', 'rejected', 'completed'] },
    },
    attributes: ['id', 'preferred_time', 'customer_name', 'booking_number'],
  });

  for (const other of others) {
    const otherSlot = parseSlot(other.preferred_time);
    if (!otherSlot) continue;
    // Buffered ranges: pad each slot with BUFFER_MIN on both sides, then
    // check overlap. If padded ranges intersect → conflict.
    const aStart = slot[0] - BUFFER_MIN;
    const aEnd   = slot[1] + BUFFER_MIN;
    const bStart = otherSlot[0];
    const bEnd   = otherSlot[1];
    const overlap = aStart < bEnd && bStart < aEnd;
    if (overlap) {
      const fmt = (m) => {
        const h = Math.floor(m / 60).toString().padStart(2, '0');
        const mm = (m % 60).toString().padStart(2, '0');
        return `${h}:${mm}`;
      };
      return (
        `Representative already has a booking ${fmt(otherSlot[0])}–${fmt(otherSlot[1])} ` +
        `on ${date} (booking #${other.booking_number || String(other.id).slice(0, 6)}). ` +
        `A 30-minute travel buffer is required between assignments — pick a different rep ` +
        `or reschedule one of the bookings.`
      );
    }
  }
  return null;
};

// Service Management
const getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll({
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Error fetching all services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

const createService = async (req, res) => {
  try {
    const {
      name,
      category,
      service_type = 'both',
      user_cost,
      expected_timeline,
      required_documents,
      allow_pay_after = false,
      description
    } = req.body;

    if (!name || !category || !user_cost) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, and user cost are required'
      });
    }

    const service = await Service.create({
      name,
      category,
      service_type,
      user_cost,
      expected_timeline,
      required_documents,
      allow_pay_after,
      description
    });

    res.status(201).json({
      success: true,
      data: service,
      message: 'Service created successfully'
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service'
    });
  }
};

const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.update(updates);

    res.json({
      success: true,
      data: service,
      message: 'Service updated successfully'
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
};

const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.update({ is_active: false });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
};

// User Management
const getAllUsers = async (req, res) => {
  try {
    const { role, status, kyc, search, limit, page } = req.query;

    const where = {};
    if (role) where.role = role;
    if (status === 'active') where.is_active = true;
    if (status === 'inactive') where.is_active = false;
    if (kyc === 'verified') where.is_kyc_verified = true;
    if (kyc === 'pending') where.is_kyc_verified = false;
    if (search) {
      const { Op } = await import('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const opts = { where, order: [['created_at', 'DESC']] };
    if (limit) opts.limit = parseInt(limit, 10);
    if (page && limit) opts.offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const users = await User.findAll(opts);

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, is_verified, is_kyc_verified } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updates = {};
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (typeof is_verified === 'boolean') updates.is_verified = is_verified;
    // is_kyc_verified — admin can flip this directly so reps without a
    // formal AgentKyc submission can still be marked as verified for
    // assignment (e.g., onboarded out-of-band, training reps, etc.).
    if (typeof is_kyc_verified === 'boolean') {
      updates.is_kyc_verified = is_kyc_verified;
      if (is_kyc_verified) updates.kyc_verified_at = new Date();
    }

    await user.update(updates);

    res.json({
      success: true,
      data: user,
      message: 'User status updated successfully'
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

// Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { is_active: true } });
    const totalServices = await Service.count();
    const activeServices = await Service.count({ where: { is_active: true } });
    const totalBookings = await Booking.count();
    const pendingBookings = await Booking.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalServices,
        activeServices,
        totalBookings,
        pendingBookings
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
};

// Booking Management for Admin
const getAllBookings = async (req, res) => {
  try {
    const { status, booking_type, customer_id, agent_id, page = 1, limit = 10 } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (booking_type) whereClause.booking_type = booking_type;
    if (customer_id) whereClause.customer_id = customer_id;
    if (agent_id) whereClause.agent_id = agent_id;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost']
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'rating']
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'mobile']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: bookings.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.count,
        pages: Math.ceil(bookings.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

const assignAgent = async (req, res) => {
  try {
    const { bookingId, agentId } = req.body;

    if (!bookingId || !agentId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and Representative ID are required'
      });
    }

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Booking can only be assigned when in pending status'
      });
    }

    const agent = await User.findByPk(agentId);
    if (!agent || agent.role !== 'agent' || !agent.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Representative not found or not active'
      });
    }

    // Enforce the 30-min travel buffer (spec: Booking Window §2). If
    // the chosen rep already has an adjacent booking on the same day,
    // refuse the assignment with a clear message — the admin then picks
    // a different rep or reschedules one of the conflicting jobs.
    const bufferError = await checkBufferConflict(agentId, booking);
    if (bufferError) {
      return res.status(409).json({ success: false, message: bufferError });
    }

    await booking.update({
      agent_id: agentId,
      status: 'assigned',
      assigned_at: new Date()
    });

    // Load the booking with its service so the notification payload is rich
    // enough for the agent app to render a useful preview.
    const hydrated = await Booking.findByPk(booking.id, {
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
      ],
    });

    // Real-time notification to the assigned agent's personal socket room,
    // plus an Expo push notification for offline / background delivery.
    try {
      const io = getIoInstance();
      if (io) {
        io.to(`user_${agentId}`).emit('task_assigned', {
          bookingId: hydrated.id,
          serviceName: hydrated?.service?.name || 'Service',
          customerName: hydrated?.customer?.name || 'Customer',
          customerMobile: hydrated?.customer?.mobile || null,
          address: hydrated?.service_address || null,
          preferredDate: hydrated?.preferred_date || null,
          preferredTime: hydrated?.preferred_time || null,
          message: 'A new task has been assigned to you. Open the app to accept or reject.',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[assignAgent] socket notify failed:', e?.message);
    }

    sendPushNotification(agentId, {
      title: 'New task assigned',
      message: `${hydrated?.service?.name || 'Service'} — ${hydrated?.customer?.name || 'Customer'}`,
      data: { type: 'task_assigned', bookingId: hydrated.id },
      priority: 'high',
    }).catch((e) => console.warn('[assignAgent] push notify failed:', e?.message));

    res.json({
      success: true,
      data: hydrated,
      message: 'Representative assigned successfully',
    });
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign representative'
    });
  }
};

// Reschedule a booking — Operations Manager grant per PDF. Accepts
// preferred_date and/or preferred_time, plus an optional reason that gets
// folded into the booking notes so the audit trail captures why.
const rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferred_date, preferred_time, reason } = req.body || {};

    if (!preferred_date && !preferred_time) {
      return res.status(400).json({
        success: false,
        message: 'Provide preferred_date and/or preferred_time to reschedule',
      });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule a ${booking.status} booking`,
      });
    }

    const updates = {};
    if (preferred_date) updates.preferred_date = preferred_date;
    if (preferred_time) updates.preferred_time = preferred_time;
    if (reason) {
      const prev = booking.notes ? `${booking.notes}\n` : '';
      updates.notes = `${prev}[reschedule ${new Date().toISOString()}] ${reason}`;
    }

    await booking.update(updates);
    res.json({ success: true, data: booking, message: 'Booking rescheduled' });
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({ success: false, message: 'Failed to reschedule booking' });
  }
};

// Cancel a booking — Operations Manager grant per PDF.
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Completed bookings cannot be cancelled' });
    }
    if (booking.status === 'cancelled') {
      return res.json({ success: true, data: booking, message: 'Booking was already cancelled' });
    }

    await booking.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason || 'Cancelled by admin',
    });
    res.json({ success: true, data: booking, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

const getAvailableAgents = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: {
        role: 'agent',
        is_active: true,
        online_status: true
      },
      attributes: ['id', 'name', 'mobile', 'rating', 'total_jobs_completed'],
      order: [['rating', 'DESC']]
    });

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('Error fetching available agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available representatives'
    });
  }
};

export {
  // Service Management
  getAllServices,
  createService,
  updateService,
  deleteService,
  // User Management
  getAllUsers,
  updateUserStatus,
  // Dashboard
  getDashboardStats,
  // Booking Management
  getAllBookings,
  assignAgent,
  rescheduleBooking,
  cancelBooking,
  getAvailableAgents
};
