const mongoose = require('mongoose');
const crypto = require('crypto');

const kycSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      ref: 'User',
    },
    aadharNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    panCard: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    aadharVerified: {
      type: Boolean,
      default: false,
    },
    panVerified: {
      type: Boolean,
      default: false,
    },
    aadharOtp: {
      type: String,
      default: null,
    },
    aadharOtpExpiry: {
      type: Date,
      default: null,
    },
    aadharImage: {
      type: String,
      default: null,
    },
    panImage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Kyc', kycSchema);
