import express from 'express';
import {
  sendPushNotification,
  sendBulkPushNotification,
  sendBookingNotification,
  sendPaymentNotification,
  sendDocumentNotification,
  sendJobCompletionNotification,
  sendLocationUpdateNotification,
  getNotificationHistory
} from '../services/notificationService.js';
import { User } from '../models/index.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// ─── POST /api/notifications/register-token ─────────────────────────────────
// Mobile app uploads its Expo push token on launch (and again if the token
// rotates). Stored on the User row so subsequent sends can look it up.
router.post('/register-token', auth, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    // Basic shape check — Expo tokens look like ExponentPushToken[...] or
    // ExpoPushToken[...]. Reject anything else.
    if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
      return res.status(400).json({ success: false, message: 'Invalid Expo push token format' });
    }
    await User.update({ expo_push_token: token }, { where: { id: req.user.id } });
    console.log(`[push] registered token for user ${req.user.id} (${platform || 'unknown platform'})`);
    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('register-token error:', error);
    res.status(500).json({ success: false, message: 'Failed to register push token' });
  }
});

// ─── DELETE /api/notifications/register-token ───────────────────────────────
// Called on logout so future pushes don't hit a device that's no longer
// logged into this account.
router.delete('/register-token', auth, async (req, res) => {
  try {
    await User.update({ expo_push_token: null }, { where: { id: req.user.id } });
    res.json({ success: true, message: 'Push token cleared' });
  } catch (error) {
    console.error('clear-token error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear push token' });
  }
});

// Send single push notification
router.post('/send', auth, async (req, res) => {
  try {
    const { userId, title, message, data, priority, badge, ttl } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const result = await sendPushNotification(userId, {
      title,
      message,
      data,
      priority,
      badge,
      ttl
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send push notification'
    });
  }
});

// Send bulk push notifications
router.post('/send-bulk', auth, async (req, res) => {
  try {
    const { notifications } = req.body;

    if (!notifications || !Array.isArray(notifications)) {
      return res.status(400).json({
        success: false,
        message: 'Notifications array is required'
      });
    }

    const result = await sendBulkPushNotification(notifications);

    res.json(result);
  } catch (error) {
    console.error('Error sending bulk push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk push notifications'
    });
  }
});

// Get notification history
router.get('/history/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await getNotificationHistory(userId, limit, offset);

    res.json(result);
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification history'
    });
  }
});

// Test push notification endpoint
router.post('/test', auth, async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'User ID, title, and message are required'
      });
    }

    const result = await sendPushNotification(userId, {
      title,
      message,
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

export default router;
