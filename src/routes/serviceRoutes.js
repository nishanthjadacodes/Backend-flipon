import express from 'express';
import {
  getAllServices,
  getServiceById
} from '../controllers/serviceController.js';

const router = express.Router();

// Public routes only
router.get('/', getAllServices);
router.get('/:id', getServiceById);

export default router;
