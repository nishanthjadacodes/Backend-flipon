import express from 'express';
import {
  uploadDocument,
  getBookingDocuments,
  getMyKycDocuments,
  deleteDocument,
  verifyDocument,
  listPendingDocuments,
} from '../controllers/documentController.js';
import auth from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

// Upload document (Customer/Agent)
router.post('/upload', auth, uploadSingle, uploadDocument);

// Get booking documents
router.get('/bookings/:bookingId', auth, getBookingDocuments);

// Get agent KYC documents
router.get('/kyc/my', auth, getMyKycDocuments);

// Delete document
router.delete('/:id', auth, deleteDocument);

// Admin — list pending / verified documents for review.
router.get('/admin/pending', auth, requirePermission(PERMISSIONS.DOCUMENT_VERIFY), listPendingDocuments);

// Admin — approve / reject a document. Gated on DOCUMENT_VERIFY so both
// Super Admin (*) and Operations Manager can act per PDF spec.
router.put('/:id/verify', auth, requirePermission(PERMISSIONS.DOCUMENT_VERIFY), verifyDocument);

export default router;
