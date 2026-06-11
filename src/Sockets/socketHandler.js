const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`🟢 Live Connection Started: ${socket.id} (User: ${socket.userId || 'Guest'})`);

    // 1. PERSONAL ROOM (For Private Notifications)
    // Jab user login karega, wo apne ID ke naam ka ek room join kar lega
    socket.on('join_user_room', (userId) => {
      socket.join(userId);
      console.log(`🔔 User ${userId} is now online and ready for notifications.`);
    });

    // 2. JOB / TASK ROOM (For Live Map Tracking)
    // Client aur Freelancer ek common "Job Room" join karenge
    socket.on('join_job_room', (jobId) => {
      socket.join(jobId);
      console.log(`🗺️ Users connected to Job Room: ${jobId} for Live Tracking.`);
    });

    // 3. LIVE LOCATION TRACKING ENGINE
    // Freelancer ka phone har 3-5 second mein ye event fire karega
    socket.on('send_location', (data) => {
      // data format: { jobId, latitude, longitude }
      // Hum ye location seedha Client ko bhej denge jo us jobId room mein baitha hai
      socket.to(data.jobId).emit('receive_location', {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date()
      });
    });

    // 4. INSTANT NOTIFICATIONS (Task Assigned, Completed, etc.)
    socket.on('send_notification', (data) => {
      // data format: { receiverId, message, type }
      socket.to(data.receiverId).emit('receive_notification', {
        message: data.message,
        type: data.type, // e.g., 'task_assigned', 'payment_released'
        timestamp: new Date()
      });
    });

    // 5. User went offline
    socket.on('disconnect', () => {
      console.log(`🔴 Connection Closed: ${socket.id}`);
    });
  });
};

module.exports = socketHandler;