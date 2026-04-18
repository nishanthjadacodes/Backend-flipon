import express from 'express';
import {
  updateLocation,
  getLocation,
  reverseGeocode
} from '../controllers/geolocationController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Update user's current location
router.post('/update', auth, updateLocation);

// Get user's current location
router.get('/current', auth, getLocation);

// Reverse geocode coordinates to address
router.get('/reverse-geocode', auth, reverseGeocode);

export default router;
