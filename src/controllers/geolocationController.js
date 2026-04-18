import { User } from '../models/index.js';

const updateLocation = async (req, res) => {
  try {
    console.log('=== UPDATE LOCATION START ===');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);

    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude values'
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90, longitude must be between -180 and 180'
      });
    }

    // Update user's location
    await User.update(
      {
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date()
      },
      {
        where: { id: req.user.id }
      }
    );

    console.log(`Location updated for user ${req.user.id}: lat=${lat}, lng=${lng}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        updated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
};

const getLocation = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['current_lat', 'current_lng', 'last_location_update']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        latitude: user.current_lat,
        longitude: user.current_lng,
        last_location_update: user.last_location_update
      }
    });

  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location'
    });
  }
};

const reverseGeocode = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // For now, return a simple response
    // In production, you might want to integrate with a geocoding service
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        address: `Location at ${lat}, ${lng}`,
        note: 'Geocoding service integration needed for full address'
      }
    });

  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get address from coordinates'
    });
  }
};

export {
  updateLocation,
  getLocation,
  reverseGeocode
};
