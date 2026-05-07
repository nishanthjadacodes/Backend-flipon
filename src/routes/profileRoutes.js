import express from 'express';
import {
  getAgentProfile,
  updateAgentOnlineStatus,
  updateAgentProfile,
  uploadAvatar,
  deleteAvatar,
} from '../controllers/profileController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get agent profile
router.get('/', auth, getAgentProfile);

// Update agent online status
router.put('/online-status', auth, updateAgentOnlineStatus);

// Update agent profile
router.put('/', auth, updateAgentProfile);

// Upload / replace profile picture (multipart, "file" field)
router.post('/avatar', auth, ...uploadAvatar);

// Remove the current profile picture (clears User.profile_pic to NULL).
router.delete('/avatar', auth, deleteAvatar);

export default router;
