const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    freelancer: {
      type: String, // Prisma/MySQL user id (UUID)
      required: true,
    },
    coverLetter: {
      type: String,
      required: [true, 'Cover letter is required'],
    },
    bidAmount: {
      type: Number,
      required: [true, 'Bid amount is required'],
    },
    estimatedDays: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Prevent a freelancer from applying to the same job twice
proposalSchema.index({ job: 1, freelancer: 1 }, { unique: true });

const Proposal = mongoose.model('Proposal', proposalSchema);
module.exports = Proposal;