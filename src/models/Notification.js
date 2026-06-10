const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: String, // MySQL User ID
      required: true
    },
    sender: {
      type: String // MySQL User ID
    },
    type: {
      type: String,
      enum: ['task_update', 'payment_alert', 'system_alert', 'new_message', 'review_received'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId, // Job, Task ya Transaction ki ID jo MongoDB mein hai
      refPath: 'onModel'
    },
    onModel: {
      type: String,
      enum: ['Job', 'Task', 'Transaction', 'Message', 'Review']
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);