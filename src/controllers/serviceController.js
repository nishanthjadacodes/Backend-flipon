import { Service, Booking, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { getChecklistForCategory } from '../config/b2bDocChecklists.js';

const getAllServices = async (req, res) => {
  try {
    console.log('=== GET SERVICES REQUEST ===');
    console.log('Query params:', req.query);
    console.log('Request headers:', req.headers);
    console.log('Request URL:', req.url);
    
    const { type } = req.query;
    let whereClause = { is_active: true };

    console.log('Initial whereClause:', whereClause);
    console.log('Type parameter:', type);

    if (type === 'consumer') {
      whereClause.service_type = ['consumer', 'both'];
    } else if (type === 'industrial') {
      whereClause.service_type = ['industrial', 'both'];
    }

    console.log('Final whereClause:', whereClause);

    const services = await Service.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    console.log('Services found:', services.length);
    console.log('Services data:', services.map(s => ({ id: s.id, name: s.name, type: s.service_type })));

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findOne({
      where: { id, is_active: true }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // For industrial / B2B services, attach the per-category document
    // checklist (Bank Statements + DSC for GST, Building Plans for NOC,
    // etc. — see src/config/b2bDocChecklists.js). Frontend uses this to
    // render the upload list on the EnquiryScreen. Returns null for
    // categories that don't match a known industrial bucket — frontend
    // skips the section in that case.
    const checklist = getChecklistForCategory(service.category);
    res.json({
      success: true,
      data: {
        ...service.toJSON(),
        b2b_doc_checklist: checklist,
      }
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service'
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

// GET /api/services/trending — services ranked by booking volume in the
// last 30 days. Falls back to all active services if there's no booking
// history yet (fresh installs / first month after launch).
const getTrendingServices = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const counts = await Booking.findAll({
      attributes: [
        'service_id',
        [sequelize.fn('COUNT', sequelize.col('service_id')), 'booking_count'],
      ],
      where: {
        service_id: { [Op.ne]: null },
        created_at: { [Op.gte]: since },
      },
      group: ['service_id'],
      order: [[sequelize.literal('booking_count'), 'DESC']],
      limit: 6,
      raw: true,
    });

    let services = [];
    if (counts.length) {
      const ids = counts.map((c) => c.service_id);
      const rows = await Service.findAll({ where: { id: ids, is_active: true } });
      // Re-order rows to match the trending rank.
      services = ids
        .map((id) => rows.find((r) => r.id === id))
        .filter(Boolean);
    }

    if (!services.length) {
      services = await Service.findAll({
        where: { is_active: true },
        order: [['name', 'ASC']],
        limit: 6,
      });
    }

    res.json({ success: true, data: services });
  } catch (error) {
    console.error('Get trending services error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending services' });
  }
};

// GET /api/services/offers — promotional offers (currently config-driven so
// admin can edit without redeploying).
const getOffers = async (req, res) => {
  try {
    // Hard-coded for now; swap to PlatformConfig.findOne({ where: { key: 'offers' } })
    // once the admin "Manage Offers" UI is wired up.
    const offers = [
      {
        id: 'first_booking_20_off',
        title: '₹20 OFF on First Booking',
        description: 'Use your friend\'s referral code at signup to get ₹20 off your very first service.',
        discount: 20,
        type: 'flat',
        validUntil: null,
        bannerColor: '#F4A100',
      },
      {
        id: 'fast_track_save_50',
        title: 'Fast-Track Service for ₹50',
        description: 'Skip the queue — get any service in 90 minutes for just ₹50 extra.',
        discount: 0,
        type: 'upsell',
        validUntil: null,
        bannerColor: '#003153',
      },
      {
        id: 'b2b_factory_camp',
        title: 'Industrial Factory Camps',
        description: 'On-site documentation drives for factories of 50+ workers. Quote within 24h.',
        discount: 0,
        type: 'b2b',
        validUntil: null,
        bannerColor: '#1B4B72',
      },
    ];

    res.json({ success: true, data: offers });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch offers' });
  }
};

export {
  getAllServices,
  getServiceById,
  getTrendingServices,
  getOffers,
  createService,
  updateService,
  deleteService
};
