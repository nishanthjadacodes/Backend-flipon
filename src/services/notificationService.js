import { User } from '../models/index.js';
import { getIoInstance } from '../config/socket.js';
import Expo from 'expo-server-sdk';

// Initialize Expo SDK
const expo = new Expo();

/**
 * Send push notification to single user
 */
export const sendPushNotification = async (userId, notification) => {
  try {
    console.log(`=== PUSH NOTIFICATION START ===`);
    console.log(`Sending to user: ${userId}`);
    console.log(`Notification:`, notification);

    // Get user's Expo push token
    const user = await User.findByPk(userId);
    if (!user || !user.expo_push_token) {
      console.log(`No Expo push token found for user: ${userId}`);
      return { success: false, message: 'User has no registered push token' };
    }

    // Prepare push message
    const pushMessage = {
      to: user.expo_push_token,
      sound: 'default',
      title: notification.title || 'FlipOn Digital',
      body: notification.message || notification.body || 'You have a new notification',
      data: notification.data || {},
      priority: notification.priority || 'high',
      channelId: 'default',
      badge: notification.badge || 1,
      ttl: notification.ttl || 86400, // 24 hours
    };

    console.log('Push message prepared:', pushMessage);

    // Send push notification
    const result = await expo.sendPushNotificationsAsync([pushMessage]);

    const ticket = result[0];
    if (!ticket || ticket.status === 'error') {
      const errMsg = ticket?.details?.error || ticket?.message || 'Unknown error';
      console.error('Push notification error:', ticket);
      return {
        success: false,
        message: `Failed to send push notification: ${errMsg}`,
        error: ticket
      };
    }

    console.log(`Push notification sent successfully to user: ${userId}`);
    return {
      success: true,
      message: 'Push notification sent successfully',
      data: {
        userId,
        messageId: ticket.id,
        status: ticket.status
      }
    };

  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { 
      success: false, 
      message: 'Failed to send push notification',
      error: error.message 
    };
  }
};

/**
 * Send push notification to multiple users
 */
export const sendBulkPushNotification = async (notifications) => {
  try {
    console.log(`=== BULK PUSH NOTIFICATION START ===`);
    console.log(`Sending ${notifications.length} notifications`);

    // Get all user tokens for the notifications
    const userIds = notifications.map(n => n.userId);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'expo_push_token']
    });

    // Filter users with valid tokens
    const validUsers = users.filter(user => user.expo_push_token);
    console.log(`Found ${validUsers.length} users with valid push tokens`);

    if (validUsers.length === 0) {
      return { 
        success: false, 
        message: 'No users with valid push tokens found' 
      };
    }

    // Prepare push messages
    const pushMessages = validUsers.map(user => {
      const notification = notifications.find(n => n.userId === user.id);
      return {
        to: user.expo_push_token,
        sound: 'default',
        title: notification?.title || 'FlipOn Digital',
        body: notification?.message || notification?.body || 'You have a new notification',
        data: notification?.data || {},
        priority: notification?.priority || 'high',
        channelId: 'default',
        badge: notification?.badge || 1,
        ttl: notification?.ttl || 86400
      };
    }).filter(Boolean); // Remove undefined entries

    console.log(`Prepared ${pushMessages.length} push messages`);

    // Send bulk push notifications
    const chunks = [];
    for (let i = 0; i < pushMessages.length; i += 100) {
      chunks.push(pushMessages.slice(i, i + 100));
    }

    let totalSent = 0;
    for (const chunk of chunks) {
      try {
        const result = await expo.sendPushNotificationsAsync(chunk);

        const sentCount = result.filter(t => t.status === 'ok').length;
        const errCount = result.length - sentCount;
        if (errCount > 0) {
          console.error(`Push notification chunk: ${errCount} error(s)`, result.filter(t => t.status !== 'ok'));
        }
        totalSent += sentCount;
        console.log(`Sent chunk: ${sentCount} ok, ${errCount} failed`);
      } catch (error) {
        console.error('Error sending push chunk:', error);
      }
    }

    console.log(`Bulk push notification completed: ${totalSent} sent successfully`);
    return { 
      success: true, 
      message: `Sent ${totalSent} push notifications successfully`,
      sentCount: totalSent,
      failedCount: notifications.length - totalSent
    };

  } catch (error) {
    console.error('Error in sendBulkPushNotification:', error);
    return { 
      success: false, 
      message: 'Failed to send bulk push notifications',
      error: error.message 
    };
  }
};

/**
 * Send booking-related push notifications
 */
export const sendBookingNotification = async (userId, bookingId, status, message) => {
  const notification = {
    title: 'Booking Update',
    body: message || `Your booking status has been updated to ${status}`,
    data: {
      type: 'booking_update',
      bookingId,
      status,
      action: 'status_change'
    },
    priority: 'high'
  };

  return await sendPushNotification(userId, notification);
};

/**
 * Send payment-related push notifications
 */
export const sendPaymentNotification = async (userId, bookingId, amount, status) => {
  const notification = {
    title: 'Payment Update',
    body: `Payment of ₹${amount} ${status} for booking ${bookingId}`,
    data: {
      type: 'payment_update',
      bookingId,
      amount,
      status,
      action: 'payment_processed'
    },
    priority: 'high'
  };

  return await sendPushNotification(userId, notification);
};

/**
 * Send document upload notifications
 */
export const sendDocumentNotification = async (userId, documentType, fileName) => {
  const notification = {
    title: 'Document Uploaded',
    body: `Your ${documentType} document (${fileName}) has been uploaded successfully`,
    data: {
      type: 'document_upload',
      documentType,
      fileName,
      action: 'document_uploaded'
    },
    priority: 'medium'
  };

  return await sendPushNotification(userId, notification);
};

/**
 * Send job completion notifications
 */
export const sendJobCompletionNotification = async (userId, bookingId, completionOTP) => {
  const notification = {
    title: 'Job Completed',
    body: `Your job for booking ${bookingId} has been completed. Completion OTP: ${completionOTP}`,
    data: {
      type: 'job_completion',
      bookingId,
      completionOTP,
      action: 'job_completed'
    },
    priority: 'high'
  };

  return await sendPushNotification(userId, notification);
};

/**
 * Send location update notifications to admins
 */
export const sendLocationUpdateNotification = async (agentId, agentName, location) => {
  const notification = {
    title: 'Agent Location Update',
    body: `Agent ${agentName} (${agentId}) has updated their location`,
    data: {
      type: 'location_update',
      agentId,
      agentName,
      location,
      action: 'location_updated'
    },
    priority: 'low'
  };

  // Send to admin users
  return await sendBulkPushNotification([
    { userId: 'admin', notification }
  ]);
};

/**
 * Get notification history for user
 */
export const getNotificationHistory = async (userId, limit = 20, offset = 0) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // In a real implementation, you would fetch from a notifications table
    // For now, return empty history
    return {
      success: true,
      data: [],
      message: 'Notification history retrieved successfully'
    };

  } catch (error) {
    console.error('Error fetching notification history:', error);
    return { 
      success: false, 
      message: 'Failed to fetch notification history' 
    };
  }
};
