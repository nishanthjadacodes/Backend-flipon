import { Document, Booking, User } from '../models/index.js';
import { uploadSingle, deleteFile, getFileUrl } from '../middleware/upload.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseBoolean } from '../utils/booleanParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload document
const uploadDocument = async (req, res) => {
  try {
    console.log('=== UPLOAD DOCUMENT START ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', req.body);
    console.log('File present:', !!req.file);
    console.log('File details:', req.file);
    console.log('User from auth:', req.user);
    
    // Handle both documentType and document_type parameters
    const { booking_id, document_type, documentType, category = 'booking', notes } = req.body;
    const docType = documentType || document_type;
    
    console.log('Document type:', docType);
    console.log('Booking ID:', booking_id);
    console.log('Category:', category);

    // Comprehensive validation
    if (!docType) {
      return res.status(400).json({
        success: false,
        message: 'Document type is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate file size
    if (req.file && req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }

    // Validate booking_id if provided
    let booking = null;
    if (booking_id) {
      try {
        booking = await Booking.findByPk(booking_id);
        if (!booking) {
          return res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        }

        // Check permissions - customer can upload to their own bookings, admin can upload to any
        if (booking.customer_id !== req.user.id && req.user.role !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: 'You can only upload documents to your own bookings'
          });
        }
      } catch (bookingError) {
        console.error('Booking validation error:', bookingError);
        return res.status(500).json({
          success: false,
          message: 'Failed to validate booking'
        });
      }
    } else {
      // If no booking_id, user must be agent or admin for general uploads
      if (req.user.role !== 'agent' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only agents and admins can upload general documents'
        });
      }
    }

    // Use database transaction for document creation
    const transaction = await Document.sequelize.transaction();
    
    try {
      // Create document record
      const document = await Document.create({
        booking_id: booking_id || null,
        user_id: req.user.id,
        document_type: docType,
        category,
        file_name: req.file.originalname,
        file_url: req.file.filename, // Store only filename
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.id,
        notes
      }, { transaction });

      await transaction.commit();

      // Return document with full URL
      const documentWithUrl = {
        ...document.toJSON(),
        file_url: getFileUrl(document.file_url, category)
      };

      console.log(`Document uploaded successfully: ${document.id} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        data: documentWithUrl,
        message: 'Document uploaded successfully'
      });

    } catch (error) {
      await transaction.rollback();
      
      console.error('Document Upload Error Details:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        booking_id: booking_id,
        document_type: docType,
        user_id: req.user?.id,
        file_received: !!req.file,
        file_size: req.file?.size,
        file_mime: req.file?.mimetype,
        user_role: req.user?.role
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to upload document',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Upload failed'
      });
    }
  } catch (error) {
    console.error('Unexpected error in uploadDocument:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get booking documents
const getBookingDocuments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check permissions
    if (booking.customer_id !== req.user.id && 
        booking.agent_id !== req.user.id && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const documents = await Document.findAll({
      where: { booking_id: bookingId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'mobile']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Add file URLs
    const documentsWithUrls = documents.map(doc => ({
      ...doc.toJSON(),
      file_url: getFileUrl(doc.file_url, doc.category)
    }));

    res.json({
      success: true,
      data: documentsWithUrls
    });
  } catch (error) {
    console.error('Error fetching booking documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents'
    });
  }
};

// Get agent KYC documents
const getMyKycDocuments = async (req, res) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Only agents can view KYC documents'
      });
    }

    const documents = await Document.findAll({
      where: { 
        user_id: req.user.id,
        category: 'kyc'
      },
      order: [['created_at', 'DESC']]
    });

    // Add file URLs
    const documentsWithUrls = documents.map(doc => ({
      ...doc.toJSON(),
      file_url: getFileUrl(doc.file_url, doc.category)
    }));

    res.json({
      success: true,
      data: documentsWithUrls
    });
  } catch (error) {
    console.error('Error fetching KYC documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC documents'
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check permissions (admin or uploader only)
    if (document.uploaded_by !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '../../uploads/', 
      document.category === 'kyc' ? 'kyc' : 'documents', 
      document.file_url
    );
    deleteFile(filePath);

    // Delete database record
    await document.destroy();

    console.log(`Document deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
};

// Verify document (Admin only)
const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified, notes } = req.body;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Properly parse boolean values from string inputs
    const parsedIsVerified = parseBoolean(is_verified);
    
    await document.update({
      is_verified: parsedIsVerified,
      verified_by: req.user.id,
      verified_at: parsedIsVerified ? new Date() : null,
      notes: notes || document.notes
    });

    const documentWithUrl = {
      ...document.toJSON(),
      file_url: getFileUrl(document.file_url, document.category)
    };

    console.log(`Document ${id} verified by admin ${req.user.id}`);

    res.json({
      success: true,
      data: documentWithUrl,
      message: `Document ${is_verified ? 'verified' : 'unverified'} successfully`
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document'
    });
  }
};

export {
  uploadDocument,
  getBookingDocuments,
  getMyKycDocuments,
  deleteDocument,
  verifyDocument
};
