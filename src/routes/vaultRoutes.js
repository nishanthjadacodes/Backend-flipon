import express from 'express';
import {
  uploadVaultDocument,
  listVaultDocumentsForEnquiry,
  downloadVaultDocument,
  deleteVaultDocument,
} from '../controllers/vaultController.js';
import auth from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// List — customer sees their own enquiry's visible docs, admin sees all.
// Route is auth-only; the controller checks ownership for non-admin callers.
router.get('/enquiry/:enquiryId', auth, listVaultDocumentsForEnquiry);

// Download — same dual-audience rule. Every download is audit-logged.
router.get('/:id/download', auth, downloadVaultDocument);

// Admin-only (DOCUMENT_VAULT permission): upload + delete.
// super_admin has '*' so it's covered automatically; b2b_admin has
// DOCUMENT_VAULT explicitly in the updated permission list.
router.post(
  '/upload',
  auth,
  requirePermission('DOCUMENT_VAULT'),
  uploadSingle,
  uploadVaultDocument,
);

router.delete(
  '/:id',
  auth,
  requirePermission('DOCUMENT_VAULT'),
  deleteVaultDocument,
);

export default router;
