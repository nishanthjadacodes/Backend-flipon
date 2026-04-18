import express from 'express';
import {
  getAgentEarnings
} from '../controllers/earningsController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get agent earnings
router.get('/', auth, getAgentEarnings);

export default router;
