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
import auth from '../middleware/auth.js';

const router = express.Router();

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
