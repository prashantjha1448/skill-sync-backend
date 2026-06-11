const mongoose = require('mongoose');
const crypto = require('crypto');

const adminOTPSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    adminId: { type: String, required: true, ref: 'AdminUser', index: true },
    otp: { type: String, required: true }, // stored as plain (console-logged), or hashed in prod
    purpose: {
      type: String,
      enum: ['LOGIN', 'SENSITIVE_ACTION', 'PASSWORD_RESET', 'MOBILE_CHANGE', 'CHANGE_PASSWORD'],
      required: true,
    },
    targetUserId: { type: String, default: null }, // for SENSITIVE_ACTION on a user
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

adminOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
adminOTPSchema.index({ adminId: 1, purpose: 1, isUsed: 1 });

module.exports = mongoose.model('AdminOTP', adminOTPSchema);
