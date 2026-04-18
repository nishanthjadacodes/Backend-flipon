import express from 'express';
import {
  getAgentProfile,
  updateAgentOnlineStatus,
  updateAgentProfile
} from '../controllers/profileController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get agent profile
router.get('/', auth, getAgentProfile);

// Update agent online status
router.put('/online-status', auth, updateAgentOnlineStatus);

// Update agent profile
router.put('/', auth, updateAgentProfile);

export default router;
