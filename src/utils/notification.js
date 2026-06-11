const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Helper to create a notification, save to MongoDB, and broadcast via Socket.io
 */
const createNotification = async ({ recipient, sender, type, message, relatedId, onModel, io }) => {
  try {
    if (!recipient) return null;

    // Save notification to Database
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      relatedId,
      onModel,
    });

    const notificationData = notification.toObject();

    // Populate sender details if available
    if (sender) {
      const senderUser = await User.findById(sender).select('name profilePic avatar').lean();
      if (senderUser) {
        notificationData.senderInfo = {
          name: senderUser.name,
          profilePic: senderUser.profilePic || senderUser.avatar,
        };
      }
    }

    // Broadcast in real-time if io instance is provided
    if (io) {
      io.to(recipient).emit('receive_notification', notificationData);
      console.log(`🔔 Socket notification sent to user ${recipient}`);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

module.exports = { createNotification };
