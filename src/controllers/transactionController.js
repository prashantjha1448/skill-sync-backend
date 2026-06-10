const Earnings = require('../models/Earnings'); // MongoDB
const Job = require('../models/Job');       // MongoDB
const Task = require('../models/Task');     // MongoDB

// @desc    Client deposits money into Escrow when job starts
// @route   POST /api/v1/transactions/job/:jobId/deposit
// @access  Private (Client Only)
exports.depositToEscrow = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // 1. MongoDB se Job nikalein
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found in MongoDB' });
    }

    if (job.client.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the owner of this job' });
    }

    const budget = job.budget; // Amount to lock

    // 2. MySQL mein Client ke Escrow Balance ko badhayein (Money Locked)
    const updatedClientEarnings = await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { escrowBalance: budget } },
      { upsert: true, new: true }
    );

    // 3. MongoDB Job status update karein
    job.status = 'ongoing';
    await job.save();

    res.status(200).json({
      success: true,
      message: `₹${budget} successfully locked in escrow vault. Job is now active!`,
      clientLedger: updatedClientEarnings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Client releases payment to Freelancer after task completion
// @route   POST /api/v1/transactions/job/:jobId/release
// @access  Private (Client Only)
exports.releasePayment = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // 1. Find Job & Task in MongoDB
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.client.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const task = await Task.findOne({ job: jobId, status: 'completed' });
    if (!task) {
      return res.status(400).json({ success: false, message: 'No completed task found for this job to pay' });
    }

    const freelancerId = task.freelancer; // MySQL User ID (String)
    const payoutAmount = job.budget;

    // 2. DATABASE TRANSACTIONS (Mongoose Multi-Update)
    // Deduct from Client's Escrow
    await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { escrowBalance: -payoutAmount } }
    );
    // Add to Freelancer's Wallet & Income Ledger
    await Earnings.findOneAndUpdate(
      { userId: freelancerId },
      {
        $inc: {
          walletBalance: payoutAmount,
          todayIncome: payoutAmount,
          allTimeIncome: payoutAmount
        }
      },
      { upsert: true }
    );

    // 3. MongoDB status ko final close karein
    job.status = 'completed';
    await job.save();

    res.status(200).json({
      success: true,
      message: `Payment of ₹${payoutAmount} securely transferred to Freelancer's ledger account!`
    });
  } catch (error) {
    next(error);
  }
};