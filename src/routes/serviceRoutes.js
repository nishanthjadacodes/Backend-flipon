import express from 'express';
import {
  getAllServices,
  getServiceById,
  getTrendingServices,
  getOffers,
} from '../controllers/serviceController.js';

const router = express.Router();

// Public routes only. Trending + offers must be declared BEFORE `/:id` so the
// router doesn't try to interpret them as service IDs.
router.get('/trending', getTrendingServices);
router.get('/offers', getOffers);
router.get('/', getAllServices);
router.get('/:id', getServiceById);

export default router;
