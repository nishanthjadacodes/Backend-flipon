import { Booking, User, Service } from '../models/index.js';
import { Op } from 'sequelize';
import { generateOTP } from '../utils/otpGenerator.js';
import { getIoInstance } from '../config/socket.js';
import {
  sendBookingNotification,
  sendPaymentNotification,
  sendDocumentNotification,
  sendJobCompletionNotification
} from '../services/notificationService.js';

// Create new booking
const createBooking = async (req, res) => {
  try {
    console.log('=== BOOKING CREATION START ===');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);
    
    // Handle alternative field names with more flexible mapping - MUST BE DEFINED FIRST
    const finalServiceId = req.body.service_id || req.body.serviceId || req.body.service || null;

    // Normalize booking_type — only 'consumer' and 'industrial' are valid; everything else maps to 'consumer'
    const rawBookingType = req.body.booking_type || req.body.bookingType || 'consumer';
    const finalBookingType = ['consumer', 'industrial'].includes(rawBookingType) ? rawBookingType : 'consumer';

    const finalCustomerName = req.body.customer_name || req.body.name || req.body.full_name || req.body.customer || req.body.applicant_name || req.user?.name || req.user?.mobile || null;
    const finalMobile = req.body.customer_mobile || req.body.mobile || req.body.mobile_number || req.body.phone || null;
    const finalAddress = req.body.service_address || req.body.address || req.body.customer_address || req.body.location || null;
    
    // Resolve date — frontend sends 'selected_date', standard field is 'preferred_date'
    const rawDate = req.body.preferred_date || req.body.selected_date || null;
    const preferred_date = rawDate ? rawDate.split('T')[0] : null; // DATEONLY: strip time part

    // Resolve time — frontend sends a selected_time_slot object like { startTime: '08:00', display: '...' }
    const rawTimeSlot = req.body.selected_time_slot;
    const preferred_time = req.body.preferred_time ||
      (rawTimeSlot?.display || (rawTimeSlot?.startTime ? `${rawTimeSlot.startTime} - ${rawTimeSlot.endTime}` : null)) ||
      null;

    // Extract remaining fields
    const {
      customer_email,
      government_documents,
      home_service_details,
      industrial_service_details,
      notes,
      priority = 'medium'
    } = req.body;
    
    console.log('Enhanced field mapping:', {
      receivedFields: Object.keys(req.body),
      finalFields: {
        finalServiceId,
        finalBookingType,
        finalCustomerName,
        finalMobile,
        finalAddress
      },
      otherFields: {
        customer_email,
        preferred_date,
        preferred_time,
        government_documents,
        home_service_details,
        industrial_service_details,
        notes,
        priority
      }
    });

    
    if (!finalServiceId || !finalBookingType || !finalCustomerName || !finalMobile || !finalAddress) {
      console.log('Enhanced validation failed:', {
        finalServiceId: !!finalServiceId,
        finalBookingType: !!finalBookingType,
        finalCustomerName: !!finalCustomerName,
        finalMobile: !!finalMobile,
        finalAddress: !!finalAddress,
        receivedFields: Object.keys(req.body)
      });
      return res.status(400).json({
        success: false,
        message: 'Service ID, booking type, customer name, mobile, and address are required',
        debug: {
          receivedFields: Object.keys(req.body),
          finalFields: {
            finalServiceId: !!finalServiceId,
            finalBookingType: !!finalBookingType,
            finalCustomerName: !!finalCustomerName,
            finalMobile: !!finalMobile,
            finalAddress: !!finalAddress
          }
        }
      });
    }

    // Validate booking type specific fields
    if (finalBookingType === 'industrial' && !industrial_service_details) {
      return res.status(400).json({
        success: false,
        message: 'Industrial service details are required for industrial services'
      });
    }

    // Get service details
    const service = await Service.findByPk(finalServiceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        debug: {
          serviceId: finalServiceId,
          originalServiceId: req.body.service_id || req.body.serviceId || req.body.service
        }
      });
    }

    const booking = await Booking.create({
      customer_id: req.user.id,
      service_id: finalServiceId,
      booking_type: finalBookingType,
      customer_name: finalCustomerName,
      customer_mobile: finalMobile,
      customer_email,
      service_address: finalAddress,
      preferred_date,
      preferred_time,
      government_documents,
      home_service_details,
      industrial_service_details,
      documents_required: service.required_documents,
      price_quoted: service.user_cost,
      notes,
      priority
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

    // Emit WebSocket event for real-time booking creation
    const io = getIoInstance();
    if (io) {
      io.to('role_admin').emit('booking_created', {
        bookingId: booking.id,
        customerId: booking.customer_id,
        serviceId: booking.service_id,
        status: booking.status,
        createdBy: req.user.name,
        timestamp: new Date()
      });
      
      io.to(`user_${booking.customer_id}`).emit('booking_confirmed', {
        bookingId: booking.id,
        serviceId: booking.service_id,
        status: 'pending',
        message: 'Your booking has been created successfully',
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('=== BOOKING CREATION ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      sql: error.sql,
      parameters: error.parameters
    });
    console.error('Request data that failed:', {
      service_id: req.body.service_id || req.body.serviceId || req.body.service,
      booking_type: req.body.booking_type || req.body.bookingType,
      customer_name: req.body.customer_name || req.body.name || req.body.full_name || req.body.customer,
      customer_mobile: req.body.customer_mobile || req.body.mobile || req.body.mobile_number || req.body.phone,
      customer_email: req.body.customer_email,
      service_address: req.body.service_address || req.body.address || req.body.customer_address || req.body.location,
      address: req.body.address,
      preferred_date: req.body.preferred_date,
      preferred_time: req.body.preferred_time,
      government_documents: req.body.government_documents,
      home_service_details: req.body.home_service_details,
      industrial_service_details: req.body.industrial_service_details,
      notes: req.body.notes,
      priority: req.body.priority,
      user_id: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Booking creation failed'
    });
  }
};

// Get customer bookings
const getCustomerBookings = async (req, res) => {
  try {
    const { status, booking_type, page = 1, limit = 10 } = req.query;
    
    const whereClause = { customer_id: req.user.id };
    
    if (status) whereClause.status = status;
    if (booking_type) whereClause.booking_type = booking_type;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'rating']
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
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks', 'description']
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'rating', 'total_jobs_completed']
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'mobile']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to view this booking
    if (booking.customer_id !== req.user.id && req.user.role !== 'super_admin' && booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details'
    });
  }
};

// Agent accept/reject booking
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'accept' or 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either accept or reject'
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Booking can only be accepted or rejected when in assigned status'
      });
    }

    if (booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update bookings assigned to you'
      });
    }

    const updates = {
      status: action === 'accept' ? 'accepted' : 'cancelled',
      agent_notes: notes,
      accepted_at: action === 'accept' ? new Date() : null,
      cancelled_at: action === 'reject' ? new Date() : null,
      cancellation_reason: action === 'reject' ? notes : null
    };

    await booking.update(updates);

    res.json({
      success: true,
      data: booking,
      message: `Booking ${action}ed successfully`
    });

    // Emit WebSocket event for real-time booking status updates
    const io = getIoInstance();
    if (io) {
      io.to(`booking_${id}`).emit('booking_status_changed', {
        bookingId: id,
        status: updates.status,
        updatedBy: req.user.name,
        timestamp: new Date(),
        action: action
      });
      
      // Notify customer about status change
      io.to(`user_${booking.customer_id}`).emit('booking_update_notification', {
        bookingId: id,
        status: updates.status,
        message: `Your booking has been ${action}ed`,
        timestamp: new Date()
      });

      // Send push notification for booking status change
      await sendBookingNotification(booking.customer_id, id, updates.status, `Your booking has been ${action}ed`);
    }
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status'
    });
  }
};

// Update job status (agent)
const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, documents_collected, submission_details, notes } = req.body;

    const validStatuses = ['documents_collected', 'submitted', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status transition'
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update bookings assigned to you'
      });
    }

    const updates = {
      status,
      agent_notes: notes
    };

    if (status === 'documents_collected') {
      updates.documents_collected = documents_collected;
      updates.documents_collected_at = new Date();
    }

    if (status === 'submitted') {
      updates.submission_details = submission_details;
      updates.submitted_at = new Date();
    }

    if (status === 'completed') {
      // Generate completion OTP
      const completionOTP = generateOTP();
      updates.completion_otp = completionOTP;
      updates.completion_otp_generated_at = new Date();
      console.log(`Completion OTP for booking ${id}: ${completionOTP}`);
    }

    await booking.update(updates);

    res.json({
      success: true,
      data: booking,
      message: `Job status updated to ${status} successfully`
    });

    // Emit WebSocket event for real-time job status updates
    const io = getIoInstance();
    if (io) {
      io.to(`booking_${id}`).emit('job_status_changed', {
        bookingId: id,
        status: status,
        updatedBy: req.user.name,
        timestamp: new Date()
      });
      
      // Notify customer about job status change
      io.to(`user_${booking.customer_id}`).emit('job_update_notification', {
        bookingId: id,
        status: status,
        message: `Job status updated to ${status}`,
        timestamp: new Date()
      });

      // Send push notification for job status changes
      await sendJobCompletionNotification(booking.customer_id, id, status === 'completed' ? updates.completion_otp : null);

      // Send document upload notifications if documents are collected
      if (status === 'documents_collected') {
        await sendDocumentNotification(booking.customer_id, 'documents_collected', 'All required documents have been collected');
      }

      // Send submission notification if job is submitted
      if (status === 'submitted') {
        await sendDocumentNotification(booking.customer_id, 'job_submitted', 'Your job has been submitted to the relevant authorities');
      }

      // Send completion notification if job is completed
      if (status === 'completed') {
        await sendJobCompletionNotification(booking.customer_id, id, updates.completion_otp);
      }
    }
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status'
    });
  }
};

// Verify completion OTP
const verifyCompletionOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp, rating, feedback } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only customer can verify completion'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be completed before verification'
      });
    }

    if (booking.completion_otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    const updates = {
      completion_verified_at: new Date(),
      customer_rating: rating,
      customer_feedback: feedback
    };

    await booking.update(updates);

    // Update agent's rating and job count
    if (booking.agent_id && rating) {
      const agent = await User.findByPk(booking.agent_id);
      if (agent) {
        await agent.update({
          rating: rating,
          total_jobs_completed: agent.total_jobs_completed + 1
        });
      }
    }

    res.json({
      success: true,
      data: booking,
      message: 'Service completion verified successfully'
    });
  } catch (error) {
    console.error('Error verifying completion OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify completion'
    });
  }
};

// Get agent bookings
const getAgentBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereClause = { agent_id: req.user.id };
    if (status) whereClause.status = status;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
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
    console.error('Error fetching agent bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Cancel booking (customer)
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    if (!['pending', 'assigned'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking can only be cancelled when in pending or assigned status'
      });
    }

    await booking.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason || 'Customer cancelled'
    });

    res.json({
      success: true,
      data: booking,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

// Upload document for booking
const uploadDocument = async (req, res) => {
  try {
    const { bookingId } = req.params;
    // Handle both documentType and document_type parameters
    const { documentType, document_type } = req.body;
    const docType = documentType || document_type;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!docType) {
      return res.status(400).json({
        success: false,
        message: 'Document type is required'
      });
    }

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload documents for your own bookings'
      });
    }

    // Update government_documents with the uploaded file
    const currentDocuments = booking.government_documents || {};
    currentDocuments[docType] = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date()
    };

    await booking.update({
      government_documents: currentDocuments
    });

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentType: docType,
        filename: req.file.filename,
        originalName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// Accept task (agent)
const acceptTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findByPk(id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Task can only be accepted when in pending status'
      });
    }
    
    await booking.update({
      agent_id: req.user.id,
      status: 'assigned',
      assigned_at: new Date()
    });
    
    res.json({
      success: true,
      message: 'Task accepted successfully',
      task: booking
    });
  } catch (error) {
    console.error('Error accepting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept task'
    });
  }
};

// Reject task (agent)
const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const booking = await Booking.findByPk(id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Task can only be rejected when in pending status'
      });
    }
    
    await booking.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason || 'Agent rejected the task'
    });
    
    res.json({
      success: true,
      message: 'Task rejected successfully',
      task: booking
    });
  } catch (error) {
    console.error('Error rejecting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject task'
    });
  }
};

// Get agent tasks (alias for getAgentBookings for React Native app)
// Returns: bookings assigned to this agent + all unassigned pending bookings (new requests)
const getAgentTasks = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    // Map AgentApp status names back to backend DB statuses
    const mapStatusToDb = (s) => {
      switch (s) {
        case 'new':         return ['pending'];
        case 'accepted':    return ['assigned', 'accepted'];
        case 'in_progress': return ['documents_collected', 'submitted'];
        case 'completed':   return ['completed'];
        case 'cancelled':   return ['cancelled'];
        default:            return null; // 'all' or unknown → no filter
      }
    };

    // Base: this agent's tasks + all unassigned pending bookings
    const whereClause = {
      [Op.or]: [
        { agent_id: req.user.id },
        { agent_id: null, status: 'pending' },
      ]
    };

    // Apply status filter (if not 'all')
    const dbStatuses = status ? mapStatusToDb(status) : null;
    if (dbStatuses) {
      whereClause.status = { [Op.in]: dbStatuses };
    }

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
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

    // Transform data for React Native AgentApp
    // Map backend statuses → AgentApp statuses
    const mapStatus = (s) => {
      switch (s) {
        case 'pending': return 'new';
        case 'assigned':
        case 'accepted': return 'accepted';
        case 'documents_collected':
        case 'submitted': return 'in_progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return s;
      }
    };

    const tasks = bookings.rows.map(booking => ({
      id: booking.id,
      customerName: booking.customer_name || booking.customer?.name || 'Unknown',
      customerMobile: booking.customer_mobile || booking.customer?.mobile || 'Unknown',
      serviceName: booking.service?.name || 'Unknown Service',
      serviceType: booking.service?.category || 'general',
      address: booking.service_address || 'No address provided',
      amount: booking.service?.partner_earning || 0,
      status: mapStatus(booking.status),
      createdAt: booking.created_at,
      assignedAt: booking.assigned_at,
      completedAt: booking.completed_at,
      preferredDate: booking.preferred_date,
      preferredTime: booking.preferred_time,
      distance: '2.5 km',
    }));

    res.json({
      success: true,
      tasks: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.count,
        pages: Math.ceil(bookings.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching agent tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
};

export {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  updateBookingStatus,
  updateJobStatus,
  verifyCompletionOTP,
  getAgentBookings,
  cancelBooking,
  uploadDocument,
  acceptTask,
  rejectTask,
  getAgentTasks
};
