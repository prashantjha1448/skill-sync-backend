const mongoose = require('mongoose');
const crypto = require('crypto');

const adminSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    adminId: { type: String, required: true, ref: 'AdminUser', index: true },
    refreshToken: { type: String, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

adminSessionSchema.index({ adminId: 1, isActive: 1 });
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

module.exports = mongoose.model('AdminSession', adminSessionSchema);
