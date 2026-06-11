const Task = require('../models/Task');
const Job = require('../models/Job');
const sendEmail = require('../utils/sendEmail');
const sendWhatsApp = require('../utils/sendWhatsApp');
const { createNotification } = require('../utils/notification');

// @desc    Update Task Status (With Live Socket, Email & WhatsApp alerts)
// @route   PUT /api/v1/tasks/:taskId/status
// @access  Private (Freelancer Only)
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    // Populate client and freelancer details to get their email/mobile numbers
    const task = await Task.findById(taskId)
      .populate('client', 'name email mobileNumber')
      .populate('freelancer', 'name email mobileNumber');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.freelancer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    task.status = status;
    if (status === 'traveling') task.travelingAt = Date.now();
    if (status === 'working') task.startedWorkingAt = Date.now();
    if (status === 'completed') task.completedAt = Date.now();

    await task.save();

    // Context message generate kiya
    let alertMessage = '';
    if (status === 'traveling') alertMessage = `Freelancer ${task.freelancer.name} is now on the way to your location! 🏍️`;
    if (status === 'working') alertMessage = `Work has been started by ${task.freelancer.name}. 🛠️`;
    if (status === 'completed') alertMessage = `Task has been marked completed by ${task.freelancer.name}. Please verify and release funds. ✅`;

    // 1. Live Socket + DB Notification to Client
    const io = req.app.get('io');
    await createNotification({
      recipient: task.client._id.toString(),
      sender: req.user._id.toString(),
      type: 'task_update',
      message: alertMessage,
      relatedId: task._id,
      onModel: 'Task',
      io,
    });

    // 2. Multi-Channel Alerts (Email & WhatsApp) in background
    try {
      // Client ko alert bheja
      if (task.client.email) {
        sendEmail({
          email: task.client.email,
          subject: `Task Update: ${status.toUpperCase()}`,
          message: `Hi ${task.client.name},\n\n${alertMessage}`
        });
      }
      if (task.client.mobileNumber) {
        sendWhatsApp(task.client.mobileNumber, alertMessage);
      }

      // Freelancer ko confirmation alert bheja
      if (task.freelancer.email) {
        sendEmail({
          email: task.freelancer.email,
          subject: `Task Status Synced`,
          message: `Hi ${task.freelancer.name},\n\nYou updated the task status to: ${status}.`
        });
      }
    } catch (alertError) {
      console.log('⚠️ External alerts logged, but background delivery skipped.', alertError);
    }

    res.status(200).json({
      success: true,
      message: `Task status updated to ${status} and alerts triggered!`,
      data: task
    });
  } catch (error) {
    next(error);
  }
};