const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    aadharNumber: {
      type: String,
      required: true,
      minlength: 12,
      maxlength: 12
    },
    mobileNumber: {
      type: String,
      required: true
    },
    otp: {
      type: String // Hashed form mein save karna better hota hai production mein
    },
    otpExpiry: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Verification', verificationSchema);