const User = require('../../../models/User');
const Job = require('../../../models/Job');
const Transaction = require('../../../models/Transaction');
const Earnings = require('../../../models/Earnings');
const AdminUser = require('../models/AdminUser');
const AdminAuditLog = require('../models/AdminAuditLog');

// Helper: aggregate by month for the last N months
const aggregateByMonth = async (Model, dateField = 'createdAt', months = 12, filter = {}) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const result = await Model.aggregate([
    { $match: { [dateField]: { $gte: startDate }, ...filter } },
    { $group: { _id: { year: { $year: `$${dateField}` }, month: { $month: `$${dateField}` } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return result.map((r) => ({ month: `${monthNames[r._id.month - 1]} ${r._id.year}`, count: r.count }));
};

// GET /api/admin/analytics/overview — dashboard stat cards
exports.getOverview = async (req, res, next) => {
  try {
    const [
      totalUsers, totalClients, totalFreelancers, totalAdmins,
      totalJobs, activeJobs, completedJobs, cancelledJobs,
      revenueAgg, earningsAgg, failedPayments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'CLIENT' }),
      User.countDocuments({ role: 'FREELANCER' }),
      AdminUser.countDocuments(),
      Job.countDocuments(),
      Job.countDocuments({ status: { $in: ['in-progress', 'open'] } }),
      Job.countDocuments({ status: 'completed' }),
      Job.countDocuments({ status: 'cancelled' }),
      Transaction.aggregate([{ $match: { status: { $in: ['completed', 'success'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Earnings.aggregate([{ $group: { _id: null, total: { $sum: '$allTimeIncome' } } }]),
      Transaction.countDocuments({ status: 'failed' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers, totalClients, totalFreelancers, totalAdmins,
        totalJobs, activeJobs, completedJobs, cancelledJobs,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalEarnings: earningsAgg[0]?.total || 0,
        failedPayments,
        activeDisputes: cancelledJobs, // proxy
      },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/analytics/users — user growth chart
exports.getUserGrowth = async (req, res, next) => {
  try {
    const data = await aggregateByMonth(User, 'createdAt', 12);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

// GET /api/admin/analytics/revenue — revenue growth chart
exports.getRevenueGrowth = async (req, res, next) => {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $in: ['completed', 'success'] } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = result.map((r) => ({ month: `${monthNames[r._id.month - 1]} ${r._id.year}`, revenue: r.revenue }));

    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

// GET /api/admin/analytics/tasks — task growth chart
exports.getTaskGrowth = async (req, res, next) => {
  try {
    const data = await aggregateByMonth(Job, 'createdAt', 12);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

// GET /api/admin/analytics/recent-activity
exports.getRecentActivity = async (req, res, next) => {
  try {
    const logs = await AdminAuditLog.find().sort({ createdAt: -1 }).limit(20).lean();
    res.status(200).json({ success: true, data: logs });
  } catch (error) { next(error); }
};
