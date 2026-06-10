const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true
    },
    reviewer: {
      type: String, // MySQL Client ID
      required: true
    },
    reviewee: {
      type: String, // MySQL Freelancer ID
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

// Ek Job par ek user sirf ek hi baar review de sakta hai
reviewSchema.index({ job: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);