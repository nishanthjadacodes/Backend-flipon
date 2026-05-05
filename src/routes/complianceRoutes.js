import express from 'express';
import {
  listCompliance,
  uploadCompliance,
  updateCompliance,
  deleteCompliance,
  renewCompliance,
  downloadCompliance,
} from '../controllers/complianceController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All routes require auth — register rows are private to the owning user.
router.get('/', auth, listCompliance);
router.post('/upload', auth, ...uploadCompliance); // uploadCompliance is [middleware, handler]
router.patch('/:id', auth, updateCompliance);
router.delete('/:id', auth, deleteCompliance);
router.post('/:id/renew', auth, renewCompliance);
router.get('/:id/download', auth, downloadCompliance);

export default router;
