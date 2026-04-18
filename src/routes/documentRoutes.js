import express from 'express';
import {
  uploadDocument,
  getBookingDocuments,
  getMyKycDocuments,
  deleteDocument,
  verifyDocument
} from '../controllers/documentController.js';
import auth from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { isSuperAdmin } from '../middleware/rbac.js';

const router = express.Router();

// Upload document (Customer/Agent)
router.post('/upload', auth, uploadSingle, uploadDocument);

// Get booking documents
router.get('/bookings/:bookingId', auth, getBookingDocuments);

// Get agent KYC documents
router.get('/kyc/my', auth, getMyKycDocuments);

// Delete document
router.delete('/:id', auth, deleteDocument);

// Verify document (Admin only)
router.put('/:id/verify', auth, isSuperAdmin, verifyDocument);

export default router;
