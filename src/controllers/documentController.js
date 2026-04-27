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

    // Belt-and-suspenders: multer also caps at 20MB. Keep this in sync if
    // you change the limit in middleware/upload.js.
    if (req.file && req.file.size > 20 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 20MB.'
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
    }
    // No booking_id is allowed for any authenticated user — the booking
    // flow uploads supporting docs before the Booking row is created, then
    // associates them later. Per-row ownership is preserved via uploaded_by.

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

    // Check permissions. Customer + assigned agent (representative) always
    // have access. Any admin role has read access — operations managers,
    // customer support, b2b admins and finance admins all need to inspect
    // booking documents to do their jobs.
    const ADMIN_ROLES = new Set([
      'super_admin',
      'operations_manager',
      'customer_support',
      'b2b_admin',
      'finance_admin',
    ]);
    if (
      booking.customer_id !== req.user.id &&
      booking.agent_id !== req.user.id &&
      !ADMIN_ROLES.has(req.user.role)
    ) {
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

    // Add absolute file URLs. Pass `req` so getFileUrl can derive the host
    // from the request if no BASE_URL env var is configured on Render.
    const documentsWithUrls = documents.map(doc => ({
      ...doc.toJSON(),
      file_url: getFileUrl(doc.file_url, doc.category, req)
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

// Get current user's KYC / personal documents.
//
// Originally agent-only, but the customer app's DocumentsScreen also lists
// the customer's personal docs (Aadhaar / PAN / etc.) from this endpoint.
// The where clause already scopes to req.user.id so cross-tenant access
// isn't possible — the role gate was over-restrictive and made customers
// see "Could not load saved documents".
const getMyKycDocuments = async (req, res) => {
  try {
    const documents = await Document.findAll({
      where: {
        user_id: req.user.id,
        category: 'kyc'
      },
      order: [['created_at', 'DESC']]
    });

    // Add absolute file URLs. Pass req so getFileUrl can derive host from
    // the request if BASE_URL / RENDER_EXTERNAL_URL aren't configured.
    const documentsWithUrls = documents.map(doc => ({
      ...doc.toJSON(),
      file_url: getFileUrl(doc.file_url, doc.category, req)
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
    const { is_verified, status, notes } = req.body;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Accept either `is_verified` (legacy) or `status: 'approved' | 'rejected'`
    // (what the admin panel sends). Rejecting clears the verified timestamp.
    let approved;
    if (typeof status === 'string') {
      approved = status === 'approved' || status === 'verified';
    } else {
      approved = parseBoolean(is_verified);
    }

    await document.update({
      is_verified: approved,
      verified_by: req.user.id,
      verified_at: approved ? new Date() : null,
      notes: notes || document.notes,
    });

    const documentWithUrl = {
      ...document.toJSON(),
      file_url: getFileUrl(document.file_url, document.category)
    };

    console.log(`Document ${id} ${approved ? 'approved' : 'rejected'} by ${req.user?.role || 'admin'} ${req.user?.id}`);

    res.json({
      success: true,
      data: documentWithUrl,
      message: `Document ${approved ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document'
    });
  }
};

// List documents awaiting admin review. Accepts optional filters:
//   ?status=pending|approved        (default: pending)
//   ?booking_id=<uuid>               (restrict to a single booking)
//   ?category=booking|kyc|application
//   ?limit / ?page
const listPendingDocuments = async (req, res) => {
  try {
    const { status = 'pending', booking_id, category, limit = 50, page = 1 } = req.query;
    const where = {};
    if (status === 'pending') where.is_verified = false;
    if (status === 'approved' || status === 'verified') where.is_verified = true;
    if (booking_id) where.booking_id = booking_id;
    if (category) where.category = category;

    const rows = await Document.findAndCountAll({
      where,
      order: [['uploaded_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    const data = rows.rows.map((d) => ({
      ...d.toJSON(),
      file_url: getFileUrl(d.file_url, d.category),
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: rows.count,
      },
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ success: false, message: 'Failed to list documents' });
  }
};

export {
  uploadDocument,
  getBookingDocuments,
  getMyKycDocuments,
  deleteDocument,
  verifyDocument,
  listPendingDocuments,
};
