const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true
    },
    client: {
      type: String,
      required: true
    },
    freelancer: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['assigned', 'traveling', 'working', 'completed', 'cancelled'],
      default: 'assigned'
    },
    // Timestamps for tracking exact moments
    assignedAt: { type: Date, default: Date.now },
    travelingAt: { type: Date },
    startedWorkingAt: { type: Date },
    completedAt: { type: Date },
    
    // Last known location caching (optional but good for tracking history)
    lastKnownLocation: {
      latitude: Number,
      longitude: Number
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);