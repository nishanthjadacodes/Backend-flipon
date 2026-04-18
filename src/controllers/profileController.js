import { User } from '../models/index.js';

// Get agent profile
const getAgentProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['fcm_token'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
        online_status: user.online_status,
        rating: user.rating,
        total_jobs_completed: user.total_jobs_completed,
        is_kyc_verified: user.is_kyc_verified,
        kyc_submitted_at: user.kyc_submitted_at,
        kyc_verified_at: user.kyc_verified_at,
        assigned_zone: user.assigned_zone,
        current_lat: user.current_lat,
        current_lng: user.current_lng
      }
    });
  } catch (error) {
    console.error('Error getting agent profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Update agent online status
const updateAgentOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;

    // Convert string to boolean if needed
    let onlineStatus;
    if (typeof isOnline === 'boolean') {
      onlineStatus = isOnline;
    } else if (typeof isOnline === 'string') {
      onlineStatus = isOnline.toLowerCase() === 'true';
    } else {
      onlineStatus = false;
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ online_status: onlineStatus });

    res.json({
      success: true,
      message: 'Online status updated successfully',
      online_status: onlineStatus
    });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update online status'
    });
  }
};

// Update agent profile
const updateAgentProfile = async (req, res) => {
  try {
    const { name, email, current_lat, current_lng, assigned_zone } = req.body;
    
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (current_lat !== undefined) updateData.current_lat = current_lat;
    if (current_lng !== undefined) updateData.current_lng = current_lng;
    if (assigned_zone !== undefined) updateData.assigned_zone = assigned_zone;

    await user.update(updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        role: user.role,
        online_status: user.online_status,
        current_lat: user.current_lat,
        current_lng: user.current_lng,
        assigned_zone: user.assigned_zone
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

export {
  getAgentProfile,
  updateAgentOnlineStatus,
  updateAgentProfile
};
