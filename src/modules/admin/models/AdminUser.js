const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const adminUserSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'SUPER_ADMIN'], default: 'ADMIN' },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    mobileNumber: { type: String, default: null },
    permissions: {
      type: [String],
      default: [
        'view_users', 'suspend_user', 'block_user', 'view_tasks',
        'cancel_task', 'view_payments', 'process_refund',
        'view_disputes', 'resolve_dispute', 'view_analytics', 'view_audit_logs'
      ],
    },
    // Brute force protection
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // Token management
    refreshToken: { type: String, default: null, select: false },
    lastLogin: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    createdBy: { type: String, ref: 'AdminUser', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual id
adminUserSchema.virtual('id').get(function () { return this._id; });

// Indexes
adminUserSchema.index({ role: 1, isActive: 1 });

// Hash password before save
adminUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
adminUserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Check if account is locked
adminUserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts
adminUserSchema.methods.incLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  // Lock after 5 attempts for 15 minutes
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
