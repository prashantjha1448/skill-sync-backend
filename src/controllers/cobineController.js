const Earnings     = require('../models/Earnings');
const Transaction  = require('../models/Transaction');
const Task         = require('../models/Task');
const Job          = require('../models/Job');
const Review       = require('../models/Review');

// GET /wallet/balance
exports.getBalance = async (req, res, next) => {
  try {
    const e = await Earnings.findOne({ userId: req.user.id });
    res.status(200).json({ success: true, data: { balance: e?.walletBalance || 0, escrowBalance: e?.escrowBalance || 0, currency: 'INR' } });
  } catch (error) { next(error); }
};

// POST /wallet/withdraw
exports.withdraw = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const e = await Earnings.findOne({ userId: req.user.id });
    if (!e || e.walletBalance < Number(amount))
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    const updated = await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { walletBalance: -Number(amount) } },
      { new: true }
    );
    res.status(200).json({ success: true, message: `₹${amount} withdrawal initiated`, data: { newBalance: updated.walletBalance } });
  } catch (error) { next(error); }
};

// GET /payments/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const txs  = await Transaction.find({ $or: [{ sender: req.user.id }, { receiver: req.user.id }] })
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    const formatted = txs.map((tx) => ({
      ...tx.toObject(),
      type:        tx.sender?.toString() === req.user.id ? 'DEBIT' : 'CREDIT',
      description: tx.type === 'escrow_deposit' ? 'Escrow Deposit' : tx.type === 'escrow_release' ? 'Payment Released' : 'Refund',
    }));
    res.status(200).json({ success: true, data: { transactions: formatted, page: Number(page) } });
  } catch (error) { next(error); }
};

// ─── analyticsController ─────────────────────────────────────────────────────

// GET /analytics/freelancer-revenue
exports.getFreelancerRevenue = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const earnings = await Earnings.findOne({ userId });
    const completed= await Task.countDocuments({ freelancer: userId, status: 'completed' });
    const reviews  = await Review.find({ reviewee: userId });
    const avgRating= reviews.length ? parseFloat((reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1)) : null;

    res.status(200).json({
      success: true,
      data: {
        totalEarnings:  earnings?.allTimeIncome  || 0,
        thisMonth:      earnings?.todayIncome    || 0,
        walletBalance:  earnings?.walletBalance  || 0,
        completedJobs:  completed,
        rating:         avgRating,
        growthPercent:  0,
        weeklyData:     ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i) => ({ day, amount: i===6 ? earnings?.todayIncome||0 : 0 })),
        locationStats:  [
          { label: 'Within 5km', value: '0%' }, { label: '5 – 15km', value: '0%' },
          { label: '15 – 30km', value: '0%' },  { label: '30km+',    value: '0%' },
        ],
      },
    });
  } catch (error) { next(error); }
};

// GET /analytics/client-metrics
exports.getClientMetrics = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const earnings = await Earnings.findOne({ userId });
    const allJobs  = await Job.find({ client: userId });
    res.status(200).json({
      success: true,
      data: {
        totalSpent:        0,
        escrowBalance:     earnings?.escrowBalance || 0,
        activeHires:       allJobs.filter(j=>['open','in-progress'].includes(j.status)).length,
        completedProjects: allJobs.filter(j=>j.status==='completed').length,
        totalJobsPosted:   allJobs.length,
      },
    });
  } catch (error) { next(error); }
};

// ─── dashboardController ─────────────────────────────────────────────────────

// GET /dashboard/client
exports.getClientDashboard = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const earnings = await Earnings.findOne({ userId });
    const allJobs  = await Job.find({ client: userId }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: {
        finances: { escrowBalance: earnings?.escrowBalance || 0 },
        stats: {
          totalJobsPosted: allJobs.length,
          activeJobs:      allJobs.filter(j=>['open','in-progress'].includes(j.status)).length,
          completedJobs:   allJobs.filter(j=>j.status==='completed').length,
        },
        recentJobs: allJobs.slice(0, 5),
      },
    });
  } catch (error) { next(error); }
};

// GET /dashboard/freelancer
exports.getFreelancerDashboard = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const earnings = await Earnings.findOne({ userId });
    const myTasks  = await Task.find({ freelancer: userId }).populate('job','title status budgetRange').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: {
        finances: {
          walletBalance: earnings?.walletBalance || 0,
          todayIncome:   earnings?.todayIncome   || 0,
          allTimeIncome: earnings?.allTimeIncome  || 0,
        },
        stats: {
          totalAssignedTasks: myTasks.length,
          pendingTasks:       myTasks.filter(t=>t.status!=='completed').length,
          completedTasks:     myTasks.filter(t=>t.status==='completed').length,
        },
        recentTasks: myTasks.slice(0, 5),
      },
    });
  } catch (error) { next(error); }
};

// GET /dashboard/wallet
exports.getWallet = async (req, res, next) => {
  try {
    const e = await Earnings.findOne({ userId: req.user.id });
    res.status(200).json({
      success: true,
      data: {
        balance:       e?.walletBalance || 0,
        escrowBalance: e?.escrowBalance || 0,
        todayIncome:   e?.todayIncome   || 0,
        allTimeIncome: e?.allTimeIncome  || 0,
      },
    });
  } catch (error) { next(error); }
};