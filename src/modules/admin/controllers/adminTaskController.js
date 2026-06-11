const Job = require('../../../models/Job');
const User = require('../../../models/User');
const Proposal = require('../../../models/Proposal');
const { createAuditLog } = require('../utils/adminAuditLogger');

// GET /api/admin/tasks
exports.getAllTasks = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = { $regex: req.query.category, $options: 'i' };

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(filter),
    ]);

    // Enrich with client info
    const enriched = await Promise.all(jobs.map(async (j) => {
      const client = await User.findById(j.client).select('name email username profilePic avatar').lean();
      let freelancer = null;
      if (j.freelancer) freelancer = await User.findById(j.freelancer).select('name email username profilePic avatar').lean();
      return { ...j, clientInfo: client, freelancerInfo: freelancer };
    }));

    res.status(200).json({
      success: true, data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/tasks/:taskId
exports.getTaskDetail = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.taskId).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Task/Job not found.' });

    const [client, freelancer, proposals] = await Promise.all([
      User.findById(job.client).select('-password').lean(),
      job.freelancer ? User.findById(job.freelancer).select('-password').lean() : null,
      Proposal.find({ job: job._id }).lean(),
    ]);

    res.status(200).json({ success: true, data: { ...job, clientInfo: client, freelancerInfo: freelancer, proposals } });
  } catch (error) { next(error); }
};

// PUT /api/admin/tasks/:taskId/cancel
exports.cancelTask = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.taskId);
    if (!job) return res.status(404).json({ success: false, message: 'Task not found.' });

    const oldData = { status: job.status };
    job.status = 'cancelled';
    await job.save();

    await createAuditLog({
      admin: req.admin, actionType: 'TASK_CANCEL', targetType: 'TASK',
      targetId: job._id, targetName: job.title,
      description: `Force-cancelled job "${job.title}". Reason: ${req.body.reason || 'Admin action'}`,
      oldData, newData: { status: 'cancelled' }, req, severity: 'HIGH',
    });

    res.status(200).json({ success: true, message: 'Task cancelled.', data: job });
  } catch (error) { next(error); }
};

// PUT /api/admin/tasks/:taskId/complete
exports.forceCompleteTask = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.taskId);
    if (!job) return res.status(404).json({ success: false, message: 'Task not found.' });

    const oldData = { status: job.status };
    job.status = 'completed';
    await job.save();

    await createAuditLog({
      admin: req.admin, actionType: 'TASK_COMPLETE', targetType: 'TASK',
      targetId: job._id, targetName: job.title,
      description: `Force-completed job "${job.title}".`,
      oldData, newData: { status: 'completed' }, req, severity: 'HIGH',
    });

    res.status(200).json({ success: true, message: 'Task marked as completed.', data: job });
  } catch (error) { next(error); }
};

// PUT /api/admin/tasks/:taskId/reopen
exports.reopenTask = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.taskId);
    if (!job) return res.status(404).json({ success: false, message: 'Task not found.' });

    const oldData = { status: job.status };
    job.status = 'open';
    job.freelancer = null;
    await job.save();

    await createAuditLog({
      admin: req.admin, actionType: 'TASK_REOPEN', targetType: 'TASK',
      targetId: job._id, targetName: job.title,
      description: `Reopened job "${job.title}".`,
      oldData, newData: { status: 'open' }, req, severity: 'MEDIUM',
    });

    res.status(200).json({ success: true, message: 'Task reopened.', data: job });
  } catch (error) { next(error); }
};
