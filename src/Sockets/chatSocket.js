const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('../utils/notification');

const chatSocketHandler = (io) => {
  io.on('connection', (socket) => {
    
    // User joins their personal room automatically if userId is attached
    if (socket.userId) {
      socket.join(socket.userId);
      console.log(`👤 User ${socket.userId} joined personal socket room`);

      // 1. Mark all pending "sent" messages as "delivered" since user is now online
      (async () => {
        try {
          const undelivered = await Message.find({ receiver: socket.userId, status: 'sent' });
          if (undelivered.length > 0) {
            await Message.updateMany(
              { receiver: socket.userId, status: 'sent' },
              { $set: { status: 'delivered' } }
            );

            // Group by job & sender to notify active senders
            const groups = {};
            for (const msg of undelivered) {
              const key = `${msg.job}_${msg.sender}`;
              groups[key] = { jobId: msg.job.toString(), senderId: msg.sender };
            }

            for (const key in groups) {
              const { jobId, senderId } = groups[key];
              io.to(senderId).emit('messages_delivered', { jobId, receiverId: socket.userId });
            }
          }
        } catch (err) {
          console.error('Error updating message delivery status on reconnect:', err);
        }
      })();
    }

    // Support setup event if frontend calls it
    socket.on('setup', (userData) => {
      if (userData?._id) {
        socket.join(userData._id);
        socket.emit('connected');
      }
    });

    // User joins a conversation room (format: jobId_otherUserId)
    socket.on('join_room', async ({ roomId }) => {
      socket.join(roomId);
      console.log(`💬 Socket ${socket.id} joined room: ${roomId}`);

      // 2. Mark messages in this room as read automatically
      const parts = roomId.split('_');
      if (parts.length === 2 && socket.userId) {
        const [jobId, otherUserId] = parts;
        try {
          const unread = await Message.find({
            job: jobId,
            sender: otherUserId,
            receiver: socket.userId,
            status: { $ne: 'read' }
          });

          if (unread.length > 0) {
            await Message.updateMany(
              { job: jobId, sender: otherUserId, receiver: socket.userId },
              { $set: { status: 'read', isRead: true } }
            );
            // Notify the sender that their messages have been read
            io.to(otherUserId).emit('messages_read', { jobId, readerId: socket.userId });
          }
        } catch (err) {
          console.error('Error marking messages as read on join_room:', err);
        }
      }
    });

    // Support mark_read event explicitly
    socket.on('mark_read', async ({ jobId, senderId }) => {
      const myId = socket.userId;
      if (!myId) return;
      try {
        const unread = await Message.find({
          job: jobId,
          sender: senderId,
          receiver: myId,
          status: { $ne: 'read' }
        });

        if (unread.length > 0) {
          await Message.updateMany(
            { job: jobId, sender: senderId, receiver: myId },
            { $set: { status: 'read', isRead: true } }
          );
          io.to(senderId).emit('messages_read', { jobId, readerId: myId });
        }
      } catch (err) {
        console.error('Error in mark_read socket event:', err);
      }
    });

    // Support join_chat event for backwards compatibility
    socket.on('join_chat', (room) => {
      socket.join(room);
      console.log(`💬 Socket ${socket.id} joined room: ${room}`);
    });

    // Handle incoming chat messages
    socket.on('send_message', async ({ jobId, receiverId, text, fileUrl, fileType, location }) => {
      try {
        // Find sender from socket context (auth middleware)
        const senderId = socket.userId;
        if (!senderId) {
          return console.error('Socket send_message error: senderId not resolved');
        }

        // Check if either user has blocked the other
        const senderUserObj = await User.findById(senderId).select('blockedUsers');
        const receiverUserObj = await User.findById(receiverId).select('blockedUsers');
        if (
          (senderUserObj && senderUserObj.blockedUsers && senderUserObj.blockedUsers.includes(receiverId)) ||
          (receiverUserObj && receiverUserObj.blockedUsers && receiverUserObj.blockedUsers.includes(senderId))
        ) {
          console.log(`🚫 Message blocked: ${senderId} and ${receiverId} have blocked each other`);
          return;
        }

        // Check if receiver is currently online
        const recipientSockets = io.sockets.adapter.rooms.get(receiverId);
        const isOnline = recipientSockets && recipientSockets.size > 0;

        // Create the message in MongoDB
        const message = await Message.create({
          sender: senderId,
          receiver: receiverId,
          job: jobId,
          text: text || '',
          fileUrl: fileUrl || null,
          fileType: fileType || 'text',
          location: location || undefined,
          status: isOnline ? 'delivered' : 'sent',
        });

        // Resolve sender name
        const sender = await User.findById(senderId).select('name');
        const senderName = sender ? sender.name : 'User';

        const messagePayload = {
          ...message.toObject(),
          _id: message._id.toString(),
          senderId,
          senderName,
          timestamp: message.createdAt.toISOString(),
        };

        // Room IDs
        const roomId = `${jobId}_${receiverId}`;
        const reverseRoomId = `${jobId}_${senderId}`;

        // Emit to the conversation rooms so active chat panels get it
        io.to(roomId).emit('receive_message', messagePayload);
        io.to(reverseRoomId).emit('receive_message', messagePayload);

        // Also emit to the receiver's personal user room
        io.to(receiverId).emit('receive_message', messagePayload);

        // Emit status update back to sender
        if (isOnline) {
          io.to(senderId).emit('messages_delivered', { jobId, receiverId });
        }

        // 3. Create a Notification for the message if the receiver does NOT have the chat open
        const receiverActiveRoom = `${jobId}_${senderId}`;
        const roomSockets = io.sockets.adapter.rooms.get(receiverActiveRoom);
        
        let isReceiverInRoom = false;
        if (roomSockets && roomSockets.size > 0 && recipientSockets) {
          for (const sId of recipientSockets) {
            if (roomSockets.has(sId)) {
              isReceiverInRoom = true;
              break;
            }
          }
        }

        if (!isReceiverInRoom) {
          let notificationText = text;
          if (fileType === 'image') notificationText = '📷 Sent a photo';
          else if (fileType === 'video') notificationText = '🎥 Sent a video';
          else if (fileType === 'audio') notificationText = '🎵 Sent an audio message';
          else if (fileType === 'location') notificationText = '📍 Shared a location';
          else if (fileType === 'document') notificationText = '📁 Shared a document';

          await createNotification({
            recipient: receiverId,
            sender: senderId,
            type: 'new_message',
            message: `${senderName}: ${notificationText}`,
            relatedId: message._id,
            onModel: 'Message',
            io,
          });
        }
        
        console.log(`✉️ Message sent from ${senderName} to user ${receiverId} (Status: ${message.status})`);
      } catch (err) {
        console.error('Socket message sending failed:', err);
      }
    });

    // Handle typing status updates
    socket.on('typing_status', ({ roomId, userId, isTyping }) => {
      // Broadcast to other users in this conversation room
      socket.to(roomId).emit('typing_status', { roomId, userId, isTyping });

      // Broadcast to reverse conversation room
      const parts = roomId.split('_');
      if (parts.length === 2) {
        const [jobId, otherUserId] = parts;
        const reverseRoom = `${jobId}_${userId}`;
        socket.to(reverseRoom).emit('typing_status', { roomId: reverseRoom, userId, isTyping });
      }
    });

    // Legacy typing events compatibility
    socket.on('typing', (room) => socket.in(room).emit('typing'));
    socket.on('stop_typing', (room) => socket.in(room).emit('stop_typing'));

    // --- WebRTC Calling Signaling ---
    socket.on('call_user', async ({ to, offer, isVideo, callerName, jobId }) => {
      const from = socket.userId;
      if (!from) return;

      // Check if either user has blocked the other
      const senderUserObj = await User.findById(from).select('blockedUsers');
      const receiverUserObj = await User.findById(to).select('blockedUsers');
      if (
        (senderUserObj && senderUserObj.blockedUsers && senderUserObj.blockedUsers.includes(to)) ||
        (receiverUserObj && receiverUserObj.blockedUsers && receiverUserObj.blockedUsers.includes(from))
      ) {
        console.log(`🚫 Call blocked: ${from} and ${to} have blocked each other`);
        socket.emit('call_declined');
        return;
      }

      console.log(`📞 Socket ${socket.id} calling user ${to} (isVideo: ${isVideo})`);
      io.to(to).emit('incoming_call', { from, offer, isVideo, callerName, jobId });
    });

    socket.on('answer_call', ({ to, answer }) => {
      const from = socket.userId;
      if (!from) return;
      console.log(`📞 Socket ${socket.id} answered call to ${to}`);
      io.to(to).emit('call_accepted', { from, answer });
    });

    socket.on('decline_call', ({ to }) => {
      console.log(`📞 Socket ${socket.id} declined call to ${to}`);
      io.to(to).emit('call_declined');
    });

    socket.on('end_call', ({ to }) => {
      console.log(`📞 Socket ${socket.id} ended call with ${to}`);
      io.to(to).emit('call_ended');
    });

    socket.on('ice_candidate', ({ to, candidate }) => {
      const from = socket.userId;
      if (!from) return;
      io.to(to).emit('ice_candidate', { from, candidate });
    });
  });
};

module.exports = chatSocketHandler;