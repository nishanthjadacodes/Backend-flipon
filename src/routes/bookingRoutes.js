import express from 'express';
import {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  getAgentBookings,
  updateBookingStatus,
  updateJobStatus,
  verifyCompletionOTP,
  submitBookingReview,
  cancelBooking,
  uploadDocument,
  acceptTask,
  rejectTask,
  getAgentTasks
} from '../controllers/bookingController.js';
import auth from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed'));
    }
  }
});

const router = express.Router();

// Static routes MUST come before /:id (parameterized) routes
router.post('/', auth, createBooking);
router.get('/my-bookings', auth, getCustomerBookings);
router.get('/agent', auth, getAgentBookings);
router.get('/tasks', auth, getAgentTasks);

// Parameterized routes (/:id catches anything — must be last)
router.get('/:id', auth, getBookingDetails);
router.put('/:id/cancel', auth, cancelBooking);
router.post('/:id/upload-document', auth, upload.single('document'), uploadDocument);
router.put('/:id/status', auth, updateBookingStatus); // accept/reject
router.put('/:id/job-status', auth, updateJobStatus); // documents_collected, submitted, completed
router.post('/:id/accept', auth, acceptTask); // Accept task
router.post('/:id/reject', auth, rejectTask); // Reject task
router.post('/:id/review', auth, submitBookingReview); // customer rates the booking

// Admin agent assignment route
router.post('/:id/assign-agent', auth, (req, res, next) => {
  // Check if user is super admin
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
}, async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'Representative ID is required'
      });
    }

    const { Booking, User } = await import('../models/index.js');

    const booking = await Booking.findByPk(id);
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

    await booking.update({
      agent_id: agentId,
      status: 'assigned',
      assigned_at: new Date()
    });

    res.json({
      success: true,
      data: booking,
      message: 'Representative assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign representative'
    });
  }
});

// Customer completion verification
router.post('/:id/verify-completion', auth, verifyCompletionOTP);

export default router;
