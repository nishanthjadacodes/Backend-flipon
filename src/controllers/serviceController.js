import { Service } from '../models/index.js';

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

    res.json({
      success: true,
      data: service
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

export {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
