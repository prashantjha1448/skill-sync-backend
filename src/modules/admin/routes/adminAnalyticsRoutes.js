const express = require('express');
const router = express.Router();
const {
  getOverview, getUserGrowth, getRevenueGrowth, getTaskGrowth, getRecentActivity,
} = require('../controllers/adminAnalyticsController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);

router.get('/overview',         requirePermission('view_analytics'), getOverview);
router.get('/users',            requirePermission('view_analytics'), getUserGrowth);
router.get('/revenue',          requirePermission('view_analytics'), getRevenueGrowth);
router.get('/tasks',            requirePermission('view_analytics'), getTaskGrowth);
router.get('/recent-activity',  requirePermission('view_analytics'), getRecentActivity);

module.exports = router;
