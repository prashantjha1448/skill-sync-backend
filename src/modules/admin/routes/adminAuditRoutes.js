const express = require('express');
const router = express.Router();
const { getAllAuditLogs, getAuditLogDetail, getAdminActivityLogs } = require('../controllers/adminAuditController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);

router.get('/',                   requirePermission('view_audit_logs'), getAllAuditLogs);
router.get('/admin/:adminId',     requirePermission('view_audit_logs'), getAdminActivityLogs);
router.get('/:logId',             requirePermission('view_audit_logs'), getAuditLogDetail);

module.exports = router;
