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

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(jobs)).catch(() => {});
    }

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
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

    // If the logged-in user is the job owner, enrich with proposal + freelancer data
    if (req.user && String(job.client) === String(req.user.id)) {
      const proposals = await Proposal.find({ job: id }).sort('-createdAt').lean();

      const enrichedProposals = await Promise.all(
        proposals.map(async (proposal) => {
          try {
            const rawFreelancer = await User.findById(proposal.freelancer)
              .select('name email profilePic avatar title mobileNumber')
              .lean();
            let freelancer = null;
            if (rawFreelancer) {
              freelancer = {
                ...rawFreelancer,
                id: rawFreelancer._id,
                phone: rawFreelancer.mobileNumber,
                profilePic: rawFreelancer.profilePic || rawFreelancer.avatar
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
            .select('name username profilePic avatar email')
            .lean();
          if (clientInfo) {
            clientInfo.id = clientInfo._id;
            clientInfo.profilePic = clientInfo.profilePic || clientInfo.avatar;
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