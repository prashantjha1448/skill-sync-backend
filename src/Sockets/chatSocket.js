const Message = require('../models/Message');
const User = require('../models/User');

const chatSocketHandler = (io) => {
  io.on('connection', (socket) => {
    
    // User joins their personal room automatically if userId is attached
    if (socket.userId) {
      socket.join(socket.userId);
    }

    // Support setup event if frontend calls it
    socket.on('setup', (userData) => {
      if (userData?._id) {
        socket.join(userData._id);
        socket.emit('connected');
      }
    });

    // User joins a conversation room (format: jobId_otherUserId)
    socket.on('join_room', ({ roomId }) => {
      socket.join(roomId);
      console.log(`💬 Socket ${socket.id} joined room: ${roomId}`);
    });

    // Support join_chat event for backwards compatibility
    socket.on('join_chat', (room) => {
      socket.join(room);
      console.log(`💬 Socket ${socket.id} joined room: ${room}`);
    });

    // Handle incoming chat messages
    socket.on('send_message', async ({ jobId, receiverId, text }) => {
      try {
        // Find sender from socket context (auth middleware) or fallback
        const senderId = socket.userId || socket.handshake.query?.userId;
        if (!senderId) {
          return console.error('Socket send_message error: senderId not resolved');
        }

        // Create the message in MongoDB
        const message = await Message.create({
          sender: senderId,
          receiver: receiverId,
          job: jobId,
          text,
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

        // Also emit to the receiver's personal user room (for sidebar update/global alerts)
        io.to(receiverId).emit('receive_message', messagePayload);
        
        console.log(`✉️ Message sent from ${senderName} to user ${receiverId}`);
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
  });
};

module.exports = chatSocketHandler;