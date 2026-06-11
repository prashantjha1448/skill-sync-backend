const AdminAuditLog = require('../models/AdminAuditLog');

// GET /api/admin/audit — all audit logs paginated & filterable
exports.getAllAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.actionType) filter.actionType = req.query.actionType;
    if (req.query.adminId) filter.adminId = req.query.adminId;
    if (req.query.targetType) filter.targetType = req.query.targetType;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/audit/:logId
exports.getAuditLogDetail = async (req, res, next) => {
  try {
    const log = await AdminAuditLog.findById(req.params.logId).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Audit log not found.' });
    res.status(200).json({ success: true, data: log });
  } catch (error) { next(error); }
};

// GET /api/admin/audit/admin/:adminId — logs for a specific admin
exports.getAdminActivityLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = { adminId: req.params.adminId };

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};
