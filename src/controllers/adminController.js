import { Service, User, Booking } from '../models/index.js';

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
    const { is_active, is_verified } = req.body;

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
        message: 'Booking ID and Agent ID are required'
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
        message: 'Agent not found or not active'
      });
    }

    await booking.update({
      agent_id: agentId,
      status: 'assigned',
      assigned_at: new Date()
    });

    res.json({
      success: true,
      data: booking,
      message: 'Agent assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign agent'
    });
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
      message: 'Failed to fetch available agents'
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
  getAvailableAgents
};
