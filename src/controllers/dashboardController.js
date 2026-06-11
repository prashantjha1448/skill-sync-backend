const Earnings = require('../models/Earnings');
const Job = require('../models/Job');
const Task = require('../models/Task');
const Kyc = require('../models/Kyc');
const BankDetails = require('../models/BankDetails');
const User = require('../models/User');

// @route GET /api/v1/dashboard/client
exports.getClientDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const financialData = await Earnings.findOne({ userId });
    const allJobs = await Job.find({ client: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        finances: { escrowBalance: financialData?.escrowBalance || 0 },
        stats: {
          totalJobsPosted: allJobs.length,
          activeJobs: allJobs.filter((j) => ['open', 'in-progress'].includes(j.status)).length,
          completedJobs: allJobs.filter((j) => j.status === 'completed').length,
          totalSpent: allJobs
            .filter((j) => j.status === 'completed')
            .reduce((acc, job) => acc + (job.budgetRange?.min || 0), 0)
        },
        recentJobs: allJobs.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/dashboard/freelancer
exports.getFreelancerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const financialData = await Earnings.findOne({ userId });
    const myTasks = await Task.find({ freelancer: userId })
      .populate('job', 'title status budgetRange')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        finances: {
          walletBalance: financialData?.walletBalance || 0,
          todayIncome: financialData?.todayIncome || 0,
          allTimeIncome: financialData?.allTimeIncome || 0,
        },
        stats: {
          totalAssignedTasks: myTasks.length,
          pendingTasks: myTasks.filter((t) => t.status !== 'completed').length,
          completedTasks: myTasks.filter((t) => t.status === 'completed').length,
        },
        recentTasks: myTasks.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/dashboard/wallet
exports.getWallet = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const earnings = await Earnings.findOne({ userId });
    const kyc = await Kyc.findOne({ userId });
    const user = await User.findById(userId);
    const bankAccounts = await BankDetails.find({ userId });

    res.status(200).json({
      success: true,
      data: {
        balance: earnings?.walletBalance || 0,
        escrowBalance: earnings?.escrowBalance || 0,
        todayIncome: earnings?.todayIncome || 0,
        allTimeIncome: earnings?.allTimeIncome || 0,
        kycStatus: kyc?.status || 'not_submitted',
        kycVerified: kyc?.status === 'verified',
        aadharVerified: kyc?.aadharVerified || false,
        panVerified: kyc?.panVerified || false,
        hasWithdrawalPin: !!user?.withdrawalPin,
        bankAccounts: bankAccounts || [],
      },
    });
  } catch (error) {
    next(error);
  }
};