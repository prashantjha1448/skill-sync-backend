const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    category: {
      type: String,
      required: [true, 'Job category is required'],
    },
    skillsRequired: [String],
    budgetRange: {
      min: Number,
      max: Number,
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'completed', 'cancelled'],
      default: 'open',
    },
    client: {
      type: String, // Prisma/MySQL user id (UUID)
      required: true,
    },
    hiredFreelancer: {
      type: String,
      default: null,
    },
    
    // 🌍 GEO-LOCATION LOGIC
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: String,
    },
  },
  { timestamps: true }
);

// Index for geo-spatial queries
jobSchema.index({ location: '2dsphere' });

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;