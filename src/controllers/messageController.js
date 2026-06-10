const Message = require('../models/Message');
const User = require('../models/User');

// POST /messages
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, jobId, text } = req.body;
    if (!receiverId || !jobId || !text)
      return res.status(400).json({ success: false, message: 'receiverId, jobId and text required' });

    const message = await Message.create({ sender: req.user.id, receiver: receiverId, job: jobId, text });

    // Emit via socket if available
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('receive_message', {
        ...message.toObject(),
        senderId:   req.user.id,
        senderName: req.user.name,
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
};

// GET /messages/:jobId/:otherUserId
exports.getMessages = async (req, res, next) => {
  try {
    const { jobId, otherUserId } = req.params;
    const messages = await Message.find({
      job: jobId,
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });

    // Mark as read
    await Message.updateMany(
      { job: jobId, sender: otherUserId, receiver: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, data: messages });
  } catch (error) { next(error); }
};

// GET /messages/conversations
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).populate('job', 'title').sort({ createdAt: -1 });

    const convMap = new Map();
    for (const msg of messages) {
      const otherUserId = msg.sender === userId ? msg.receiver : msg.sender;
      const jobId       = msg.job?._id?.toString() || msg.job?.toString();
      const key         = `${jobId}_${otherUserId}`;

      if (!convMap.has(key)) {
        let otherUserName = otherUserId;
        let otherUserProfilePic = null;
        let otherUserAvatar = null;
        try {
          const u = await User.findById(otherUserId).select('name profilePic avatar');
          if (u) {
            otherUserName = u.name;
            otherUserProfilePic = u.profilePic;
            otherUserAvatar = u.avatar;
          }
        } catch {}

        convMap.set(key, {
          jobId,
          otherUserId,
          jobTitle:        msg.job?.title || '',
          name:            otherUserName,
          profilePic:      otherUserProfilePic || otherUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserName}`,
          lastMessage:     msg.text,
          lastMessageTime: new Date(msg.createdAt).toLocaleDateString('en-IN'),
          unreadCount:     0,
        });
      }
      if (msg.receiver === userId && !msg.isRead) convMap.get(key).unreadCount += 1;
    }

    res.status(200).json({ success: true, conversations: Array.from(convMap.values()) });
  } catch (error) { next(error); }
};