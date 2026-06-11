const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const redisClient = require('../config/redis');
const User = require('../models/User');
const Earnings = require('../models/Earnings');

// @desc    Create a new Job
// @route   POST /api/v1/jobs
// @access  Private (Client Only)
exports.createJob = async (req, res, next) => {
  try {
    const Kyc = require('../models/Kyc');
    const User = require('../models/User');

    // Enforce KYC check (Aadhaar, PAN, and Mobile number)
    const kyc = await Kyc.findOne({ userId: req.user.id });
    const user = await User.findById(req.user.id);

    const isKycVerified = kyc && kyc.aadharVerified && kyc.panVerified;
    const hasMobile = user && user.mobileNumber && user.mobileNumber.trim().length > 0;

    if (!isKycVerified || !hasMobile) {
      return res.status(400).json({
        success: false,
        message: 'KYC verification (Aadhaar, PAN, and Mobile number) is required to post a new job. Please complete your profile and KYC verification first.',
      });
    }

    const {
      title,
      description,
      category,
      minBudget,
      maxBudget,
      budget,
      location,
      skillsRequired,
    } = req.body;

    const jobLocation = location?.coordinates
      ? location
      : {
          type: 'Point',
          coordinates: location?.coordinates || [77.209, 28.6139],
          address: location?.address || 'India',
        };

    const job = await Job.create({
      title,
      description,
      category,
      skillsRequired: skillsRequired || [],
      budgetRange: {
        min: minBudget ?? budget?.min ?? budget,
        max: maxBudget ?? budget?.max ?? budget,
      },
      location: jobLocation,
      client: req.user.id,
    });

    if (redisClient.isOpen) {
      await redisClient.del('jobs:active').catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active jobs (With Redis Caching)
// @route   GET /api/v1/jobs
// @access  Public
exports.getJobs = async (req, res, next) => {
  try {
    const cacheKey = 'jobs:active';

    // 1. Pehle Redis Cache ki superfast memory mein check karein
    if (redisClient.isOpen) {
      const cachedJobs = await redisClient.get(cacheKey).catch(() => null);
      if (cachedJobs) {
        console.log('Serving from Redis Cache ⚡');
        return res.status(200).json({
          success: true,
          count: JSON.parse(cachedJobs).length,
          data: JSON.parse(cachedJobs),
        });
      }
    }

    console.log('Serving from MongoDB 🗄️');
    const jobs = await Job.find({ status: 'open' }).sort({ createdAt: -1 });

    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        try {
          const clientInfo = await User.findById(job.client)
            .select('name username profilePic avatar email kycVerified')
            .lean();
          if (clientInfo) {
            clientInfo.id = clientInfo._id;
            clientInfo.profilePic = clientInfo.profilePic || clientInfo.avatar;
            clientInfo.isVerified = !!(clientInfo.kycVerified);
          }
          return { ...job.toObject(), clientInfo };
        } catch {
          return job.toObject();
        }
      })
    );

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(enrichedJobs)).catch(() => {});
    }

    res.status(200).json({
      success: true,
      count: enrichedJobs.length,
      data: enrichedJobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single job by ID
// @route   GET /api/v1/jobs/:id
// @access  Public
exports.getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const jobData = job.toObject();

    // Fetch clientInfo
    try {
      const clientInfo = await User.findById(job.client)
        .select('name username profilePic avatar email kycVerified')
        .lean();
      if (clientInfo) {
        clientInfo.id = clientInfo._id;
        clientInfo.profilePic = clientInfo.profilePic || clientInfo.avatar;
        clientInfo.isVerified = !!(clientInfo.kycVerified);
        jobData.clientInfo = clientInfo;
      }
    } catch {}

    // If the logged-in user is the job owner, enrich with proposal + freelancer data
    if (req.user && String(job.client) === String(req.user.id)) {
      const proposals = await Proposal.find({ job: id }).sort('-createdAt').lean();

      const enrichedProposals = await Promise.all(
        proposals.map(async (proposal) => {
          try {
            const rawFreelancer = await User.findById(proposal.freelancer)
              .select('name email profilePic avatar title mobileNumber isVerified kycVerified')
              .lean();
            let freelancer = null;
            if (rawFreelancer) {
              freelancer = {
                ...rawFreelancer,
                id: rawFreelancer._id,
                phone: rawFreelancer.mobileNumber,
                profilePic: rawFreelancer.profilePic || rawFreelancer.avatar,
                isVerified: !!(rawFreelancer.kycVerified),
              };
            }
            return { ...proposal, freelancerInfo: freelancer };
          } catch {
            return { ...proposal, freelancerInfo: null };
          }
        })
      );

      jobData.proposals = enrichedProposals;
    } else if (req.user && req.user.role === 'FREELANCER') {
      const myProposal = await Proposal.findOne({ job: id, freelancer: req.user.id }).lean();
      if (myProposal) {
        jobData.myProposal = myProposal;
      }
    }

    res.status(200).json({
      success: true,
      data: jobData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search and Filter Jobs & Freelancers
// @route   GET /api/v1/jobs/search
// @access  Public
exports.searchJobs = async (req, res, next) => {
  try {
    const { keyword, minBudget, maxBudget, location, category } = req.query;
    
    let jobQuery = { status: 'open' };
    let freelancerQuery = { role: 'FREELANCER', isAvailable: true };

    if (keyword) {
      // Find matching user IDs by name or username (case insensitive)
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { username: { $regex: keyword, $options: 'i' } }
        ]
      }).select('_id');
      const matchingUserIds = matchingUsers.map(u => u._id.toString());

      jobQuery.$or = [
        { title: { $regex: keyword, $options: 'i' } }, 
        { description: { $regex: keyword, $options: 'i' } },
        { skillsRequired: { $in: [new RegExp(keyword, 'i')] } },
        { client: { $in: matchingUserIds } }
      ];

      freelancerQuery.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { username: { $regex: keyword, $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { bio: { $regex: keyword, $options: 'i' } },
        { skills: { $in: [new RegExp(keyword, 'i')] } }
      ];
    }

    if (category && category !== 'all' && category !== 'All') {
      jobQuery.category = { $regex: new RegExp(`^${category}$`, 'i') };
      freelancerQuery.skills = { $in: [new RegExp(category, 'i')] };
    }

    if (minBudget) jobQuery['budgetRange.min'] = { $gte: Number(minBudget) };
    if (maxBudget) jobQuery['budgetRange.max'] = { $lte: Number(maxBudget) };

    if (location) {
      jobQuery['location.address'] = { $regex: location, $options: 'i' };
      freelancerQuery['location.city'] = { $regex: location, $options: 'i' };
    }

    // Query Jobs
    const jobs = await Job.find(jobQuery).sort({ createdAt: -1 }).lean();

    // Enrich jobs with clientInfo
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        try {
          const clientInfo = await User.findById(job.client)
            .select('name username profilePic avatar email kycVerified')
            .lean();
          if (clientInfo) {
            clientInfo.id = clientInfo._id;
            clientInfo.profilePic = clientInfo.profilePic || clientInfo.avatar;
            clientInfo.isVerified = !!(clientInfo.kycVerified);
          }
          return { ...job, clientInfo };
        } catch {
          return { ...job, clientInfo: null };
        }
      })
    );

    // Query Freelancers
    const freelancers = await User.find(freelancerQuery)
      .select('-password')
      .sort({ averageRating: -1 })
      .lean();

    res.status(200).json({
      success: true,
      jobsCount: enrichedJobs.length,
      freelancersCount: freelancers.length,
      jobs: enrichedJobs,
      freelancers: freelancers,
      data: enrichedJobs // Backwards compatibility for list calls reading .data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Job
// @route   PUT /api/v1/jobs/:id
// @access  Private (Client Only)
exports.updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (String(job.client) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'User not authorized to update this job' });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (redisClient.isOpen) {
      await redisClient.del('jobs:active').catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Job
// @route   DELETE /api/v1/jobs/:id
// @access  Private (Client Only)
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (String(job.client) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'User not authorized to delete this job' });
    }

    await job.deleteOne();

    if (redisClient.isOpen) {
      await redisClient.del('jobs:active').catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get jobs posted by logged-in client
// @route   GET /api/v1/jobs/my-jobs
// @access  Private (Client)
exports.getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ client: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get landing page stats (Live Jobs, Freelancers, Clients, Total Paid Out)
// @route   GET /api/v1/jobs/stats
// @access  Public
exports.getLandingStats = async (req, res, next) => {
  try {
    const activeJobs = await Job.countDocuments({ status: 'open' });
    const freelancers = await User.countDocuments({ role: 'FREELANCER' });
    const clients = await User.countDocuments({ role: 'CLIENT' });

    // Calculate sum of allTimeIncome from Earnings collection
    const earningsAgg = await Earnings.aggregate([
      { $group: { _id: null, total: { $sum: '$allTimeIncome' } } }
    ]);
    const totalPaidOut = earningsAgg[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        freelancers,
        clients,
        totalPaidOut
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete a job (Mutual Approval by client and freelancer)
// @route   PUT /api/v1/jobs/:id/complete
// @access  Private
exports.completeJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const userId = req.user.id.toString();
    const isClient = job.client.toString() === userId;
    const isFreelancer = job.assignedTo && job.assignedTo.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ success: false, message: 'Not authorized to perform this action' });
    }

    if (job.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Job is not in-progress' });
    }

    if (isClient) {
      job.completionRequestedByClient = true;
    }
    if (isFreelancer) {
      job.completionRequestedByFreelancer = true;
    }

    // If both client and freelancer approve completion
    if (job.completionRequestedByClient && job.completionRequestedByFreelancer) {
      job.status = 'completed';
      
      // Release payment to freelancer's wallet
      const payoutAmount = job.budget || 0;
      const freelancerId = job.assignedTo;

      // Deduct from Client's Escrow
      await Earnings.findOneAndUpdate(
        { userId: job.client },
        { $inc: { escrowBalance: -payoutAmount } }
      );

      // Add to Freelancer's Wallet & Income Ledger
      await Earnings.findOneAndUpdate(
        { userId: freelancerId },
        {
          $inc: {
            walletBalance: payoutAmount,
            todayIncome: payoutAmount,
            allTimeIncome: payoutAmount,
            completedJobs: 1
          }
        },
        { upsert: true }
      );

      // Set associated Task status to completed if it exists
      const Task = require('../models/Task');
      await Task.findOneAndUpdate(
        { job: job._id },
        { status: 'completed', completedAt: Date.now() }
      ).catch(() => {});

      // Create escrow release transaction record
      const Transaction = require('../models/Transaction');
      await Transaction.create({
        sender: job.client,
        receiver: String(freelancerId),
        job: job._id,
        amount: payoutAmount,
        type: 'escrow_release',
        status: 'completed'
      });

      // Notify both parties
      const { createNotification } = require('../utils/notification');
      const io = req.app.get('io');
      
      // Notify client
      await createNotification({
        recipient: String(job.client),
        sender: userId,
        type: 'payment_alert',
        message: `Job "${job.title}" has been successfully completed. ₹${payoutAmount} released from escrow.`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });

      // Notify freelancer
      await createNotification({
        recipient: String(freelancerId),
        sender: userId,
        type: 'payment_alert',
        message: `Job "${job.title}" has been completed. ₹${payoutAmount} transferred to your wallet!`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });
    } else {
      // Notify the other party about the completion request
      const { createNotification } = require('../utils/notification');
      const io = req.app.get('io');
      const senderName = req.user.name;
      const recipientId = isClient ? String(job.assignedTo) : String(job.client);
      
      await createNotification({
        recipient: recipientId,
        sender: userId,
        type: 'task_update',
        message: `${senderName} has marked "${job.title}" as completed. Please approve to release payment.`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });
    }

    await job.save();

    if (redisClient.isOpen) {
      await redisClient.del('jobs:active').catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Completion request registered',
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a job (Mutual Approval by client and freelancer)
// @route   PUT /api/v1/jobs/:id/cancel
// @access  Private
exports.cancelJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const userId = req.user.id.toString();
    const isClient = job.client.toString() === userId;
    const isFreelancer = job.assignedTo && job.assignedTo.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ success: false, message: 'Not authorized to perform this action' });
    }

    if (job.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Job is not in-progress' });
    }

    if (isClient) {
      job.cancellationRequestedByClient = true;
    }
    if (isFreelancer) {
      job.cancellationRequestedByFreelancer = true;
    }

    // If both client and freelancer approve cancellation
    if (job.cancellationRequestedByClient && job.cancellationRequestedByFreelancer) {
      job.status = 'cancelled';
      
      // Refund payment to client's wallet
      const refundAmount = job.budget || 0;
      const freelancerId = job.assignedTo;

      // Deduct from Client's Escrow
      await Earnings.findOneAndUpdate(
        { userId: job.client },
        { $inc: { escrowBalance: -refundAmount } }
      );

      // Refund to Client's Wallet
      await Earnings.findOneAndUpdate(
        { userId: job.client },
        { $inc: { walletBalance: refundAmount } },
        { upsert: true }
      );

      // Set associated Task status to cancelled if it exists
      const Task = require('../models/Task');
      await Task.findOneAndUpdate(
        { job: job._id },
        { status: 'cancelled' }
      ).catch(() => {});

      // Create escrow refund transaction record
      const Transaction = require('../models/Transaction');
      await Transaction.create({
        sender: String(freelancerId),
        receiver: job.client,
        job: job._id,
        amount: refundAmount,
        type: 'refund',
        status: 'completed'
      });

      // Notify both parties
      const { createNotification } = require('../utils/notification');
      const io = req.app.get('io');
      
      // Notify client
      await createNotification({
        recipient: String(job.client),
        sender: userId,
        type: 'payment_alert',
        message: `Job "${job.title}" has been cancelled. ₹${refundAmount} has been refunded to your wallet.`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });

      // Notify freelancer
      await createNotification({
        recipient: String(freelancerId),
        sender: userId,
        type: 'system_alert',
        message: `Job "${job.title}" has been mutually cancelled. Escrow has been refunded to client.`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });
    } else {
      // Notify the other party about the cancellation request
      const { createNotification } = require('../utils/notification');
      const io = req.app.get('io');
      const senderName = req.user.name;
      const recipientId = isClient ? String(job.assignedTo) : String(job.client);
      
      await createNotification({
        recipient: recipientId,
        sender: userId,
        type: 'system_alert',
        message: `${senderName} has requested to cancel the job "${job.title}". Please approve to cancel.`,
        relatedId: job._id,
        onModel: 'Job',
        io,
      });
    }

    await job.save();

    if (redisClient.isOpen) {
      await redisClient.del('jobs:active').catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation request registered',
      data: job
    });
  } catch (error) {
    next(error);
  }
};