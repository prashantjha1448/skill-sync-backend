const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * Create an audit log entry for any admin action.
 * Call this after every significant admin operation.
 */
exports.createAuditLog = async ({
  admin,
  actionType,
  targetType,
  targetId = null,
  targetName = null,
  description,
  oldData = null,
  newData = null,
  req = null,
  severity = 'LOW',
}) => {
  try {
    await AdminAuditLog.create({
      adminId: admin._id || admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      actionType,
      targetType,
      targetId,
      targetName,
      description,
      oldData,
      newData,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.headers?.['user-agent'] || null,
      severity,
    });
  } catch (err) {
    // Never let audit log failure break the main operation
    console.error('⚠️ Audit log creation failed:', err.message);
  }
};
