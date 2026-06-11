const express = require('express');
const router = express.Router();
const AdminUser = require('../models/AdminUser');
const { createAuditLog } = require('../utils/adminAuditLogger');
const { protectAdmin, requireSuperAdmin } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);
router.use(requireSuperAdmin);

// POST /api/admin/super/create-admin — SuperAdmin creates a new Admin
router.post('/create-admin', async (req, res, next) => {
  try {
    const { name, email, password, mobileNumber, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await AdminUser.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Admin with this email already exists.' });

    const admin = await AdminUser.create({
      name, email, password, mobileNumber: mobileNumber || null,
      role: 'ADMIN', isSuperAdmin: false,
      permissions: permissions || undefined, // uses default if not provided
      createdBy: req.admin._id,
    });

    await createAuditLog({
      admin: req.admin, actionType: 'ADMIN_CREATE', targetType: 'ADMIN',
      targetId: admin._id, targetName: admin.name,
      description: `SuperAdmin created new admin: ${admin.name} (${admin.email}).`,
      req, severity: 'HIGH',
    });

    res.status(201).json({
      success: true, message: 'Admin created successfully.',
      data: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions },
    });
  } catch (error) { next(error); }
});

// GET /api/admin/super/admins — list all admins
router.get('/admins', async (req, res, next) => {
  try {
    const admins = await AdminUser.find().select('-password -refreshToken').sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: admins });
  } catch (error) { next(error); }
});

// PUT /api/admin/super/admins/:adminId/suspend
router.put('/admins/:adminId/suspend', async (req, res, next) => {
  try {
    const target = await AdminUser.findById(req.params.adminId);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found.' });
    if (target.isSuperAdmin) return res.status(403).json({ success: false, message: 'Cannot suspend SuperAdmin.' });

    target.isSuspended = true;
    target.isActive = false;
    await target.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'ADMIN_SUSPEND', targetType: 'ADMIN',
      targetId: target._id, targetName: target.name,
      description: `Suspended admin ${target.name}. Reason: ${req.body.reason || 'N/A'}`,
      req, severity: 'CRITICAL',
    });

    res.status(200).json({ success: true, message: `Admin ${target.name} suspended.` });
  } catch (error) { next(error); }
});

// PUT /api/admin/super/admins/:adminId/activate
router.put('/admins/:adminId/activate', async (req, res, next) => {
  try {
    const target = await AdminUser.findById(req.params.adminId);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found.' });

    target.isSuspended = false;
    target.isActive = true;
    await target.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'ADMIN_ACTIVATE', targetType: 'ADMIN',
      targetId: target._id, targetName: target.name,
      description: `Activated admin ${target.name}.`,
      req, severity: 'HIGH',
    });

    res.status(200).json({ success: true, message: `Admin ${target.name} activated.` });
  } catch (error) { next(error); }
});

// DELETE /api/admin/super/admins/:adminId
router.delete('/admins/:adminId', async (req, res, next) => {
  try {
    const target = await AdminUser.findById(req.params.adminId);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found.' });
    if (target.isSuperAdmin) return res.status(403).json({ success: false, message: 'Cannot delete SuperAdmin.' });

    await AdminUser.deleteOne({ _id: target._id });

    await createAuditLog({
      admin: req.admin, actionType: 'ADMIN_DELETE', targetType: 'ADMIN',
      targetId: target._id, targetName: target.name,
      description: `Deleted admin ${target.name} (${target.email}).`,
      req, severity: 'CRITICAL',
    });

    res.status(200).json({ success: true, message: `Admin ${target.name} deleted.` });
  } catch (error) { next(error); }
});

// GET /api/admin/super/admins/:adminId/activity — review admin's audit trail
router.get('/admins/:adminId/activity', async (req, res, next) => {
  try {
    const AdminAuditLog = require('../models/AdminAuditLog');
    const logs = await AdminAuditLog.find({ adminId: req.params.adminId })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.status(200).json({ success: true, data: logs });
  } catch (error) { next(error); }
});

module.exports = router;
