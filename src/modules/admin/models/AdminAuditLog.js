const mongoose = require('mongoose');
const crypto = require('crypto');

const adminAuditLogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    adminId: { type: String, ref: 'AdminUser', required: true, index: true },
    adminName: { type: String, required: true },
    adminEmail: { type: String, required: true },
    actionType: {
      type: String,
      required: true,
      enum: [
        'USER_SUSPEND', 'USER_ACTIVATE', 'USER_BLOCK', 'USER_UNBLOCK',
        'USER_KYC_MODIFY', 'USER_BANK_MODIFY', 'USER_EMAIL_MODIFY', 'USER_MOBILE_MODIFY',
        'TASK_CANCEL', 'TASK_COMPLETE', 'TASK_REOPEN',
        'PAYMENT_REFUND', 'PAYMENT_HOLD',
        'DISPUTE_RESOLVE', 'DISPUTE_CLOSE',
        'ADMIN_CREATE', 'ADMIN_SUSPEND', 'ADMIN_ACTIVATE', 'ADMIN_DELETE',
        'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'ADMIN_PASSWORD_RESET',
        'SENSITIVE_OTP_SENT', 'SENSITIVE_OTP_VERIFIED',
        'SYSTEM_SETTING_CHANGE',
      ],
    },
    targetType: {
      type: String,
      enum: ['USER', 'TASK', 'PAYMENT', 'DISPUTE', 'ADMIN', 'SYSTEM'],
      required: true,
    },
    targetId: { type: String, default: null },
    targetName: { type: String, default: null },
    description: { type: String, required: true },
    oldData: { type: mongoose.Schema.Types.Mixed, default: null },
    newData: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
adminAuditLogSchema.index({ actionType: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetId: 1 });
adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
