import { User } from '../models/index.js';
import { uploadSingle, getStoredFileValue } from '../middleware/upload.js';

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
        email: user.email,
        profile_pic: user.profile_pic,
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

// POST /api/profile/avatar  (multipart, "file" field)
//
// Uploads a profile picture for the authenticated user. Stores the URL
// (Cloudinary in prod, /uploads/<filename> on local) on User.profile_pic
// and returns the new URL so the client can update its UI immediately.
//
// Reuses the global `uploadSingle` middleware so size limits + Cloudinary
// integration are consistent with the rest of the upload flows. Same
// endpoint serves customer + rep apps — User.role decides which UI shows
// the avatar where.
const uploadAvatar = [
  uploadSingle,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const url = getStoredFileValue(req.file);
      await user.update({ profile_pic: url });
      res.json({
        success: true,
        message: 'Profile picture updated',
        profile_pic: url,
      });
    } catch (e) {
      console.error('uploadAvatar error:', e);
      res.status(500).json({ success: false, message: 'Failed to upload avatar' });
    }
  },
];

// DELETE /api/profile/avatar
//
// Clears the user's profile picture (sets `profile_pic` to NULL) so
// the customer / rep app falls back to the first-letter initial on
// the avatar. Doesn't actually delete the underlying Cloudinary blob
// (cheap to keep around; deleting it would risk orphaning if the same
// URL is referenced from caches). Idempotent — calling on an already-
// cleared profile is a no-op success.
const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.profile_pic) {
      await user.update({ profile_pic: null });
    }
    res.json({
      success: true,
      message: 'Profile picture removed',
      profile_pic: null,
    });
  } catch (e) {
    console.error('deleteAvatar error:', e);
    res.status(500).json({ success: false, message: 'Failed to remove avatar' });
  }
};

export {
  getAgentProfile,
  updateAgentOnlineStatus,
  updateAgentProfile,
  uploadAvatar,
  deleteAvatar,
};
