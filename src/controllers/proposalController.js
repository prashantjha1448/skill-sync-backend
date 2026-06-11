const Proposal = require('../models/Proposal');
const Job = require('../models/Job');
const { createNotification } = require('../utils/notification');

// @desc    Submit a proposal for a job
// @route   POST /api/v1/proposals/:jobId
// @access  Private (Freelancers only)
const submitProposal = async (req, res, next) => {
  try {
    const Kyc = require('../models/Kyc');
    const User = require('../models/User');

    // Check Freelancer KYC (Aadhaar, PAN, and Mobile number)
    const freelancerKyc = await Kyc.findOne({ userId: req.user.id });
    const freelancerUser = await User.findById(req.user.id);
    const freelancerKycComplete = freelancerKyc && freelancerKyc.aadharVerified && freelancerKyc.panVerified && freelancerUser?.mobileNumber && freelancerUser.mobileNumber.trim().length > 0;
    
    if (!freelancerKycComplete) {
      return res.status(400).json({
        success: false,
        message: 'You must complete your KYC verification (Aadhaar, PAN, and Mobile number) before applying to jobs.'
      });
    }

    // Freelancer one active job constraint
    const activeJob = await Job.findOne({ assignedTo: req.user.id, status: 'in-progress' });
    if (activeJob) {
      return res.status(400).json({
        success: false,
        message: 'You are currently working on another active job. You must complete it first before you can apply to a new one.'
      });
    }

    const { coverLetter, bidAmount, estimatedDays } = req.body;
    const jobId = req.params.jobId;

    // Check if job exists and is open
    const job = await Job.findById(jobId);
    if (!job || job.status !== 'open') {
      res.status(404);
      throw new Error('Job not found or no longer open');
    }

    // Create proposal (MongoDB unique index will auto-reject duplicates)
    const proposal = await Proposal.create({
      job: jobId,
      freelancer: req.user.id,
      coverLetter,
      bidAmount,
      estimatedDays,
    });

    // Notify the client who posted the job
    const io = req.app.get('io');
    const senderDetail = req.user.username ? `${req.user.name} (@${req.user.username})` : req.user.name;
    await createNotification({
      recipient: String(job.client),
      sender: req.user.id,
      type: 'system_alert',
      message: `Freelancer ${senderDetail} submitted a proposal for "${job.title}"`,
      relatedId: job._id,
      onModel: 'Job',
      io,
    });

    res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400);
      next(new Error('You have already applied to this job'));
    } else {
      next(error);
    }
  }
};

// @desc    Get all proposals for a specific job
// @route   GET /api/v1/proposals/job/:jobId
// @access  Private (Only the Client who posted the job)
const getJobProposals = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);
    
    // Security check: Only the job owner can see the proposals
    if (String(job.client) !== String(req.user.id)) {
      res.status(403);
      throw new Error('Not authorized to view these proposals');
    }

    const proposals = await Proposal.find({ job: req.params.jobId }).sort('-createdAt');

    res.status(200).json({ success: true, count: proposals.length, data: proposals });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a proposal (Client only)
// @route   PUT /api/v1/proposals/:proposalId/accept
// @access  Private (Client)
const acceptProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.proposalId).populate('job');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    // Only job owner can accept
    if (String(proposal.job.client) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const Kyc = require('../models/Kyc');
    const User = require('../models/User');

    // 1. Check Client KYC (Aadhaar, PAN, and Mobile)
    const clientKyc = await Kyc.findOne({ userId: req.user.id });
    const clientUser = await User.findById(req.user.id);
    const clientKycComplete = clientKyc && clientKyc.aadharVerified && clientKyc.panVerified && clientUser?.mobileNumber && clientUser.mobileNumber.trim().length > 0;
    
    if (!clientKycComplete) {
      return res.status(400).json({
        success: false,
        message: 'You must complete your KYC verification (Aadhaar, PAN, and Mobile number) before accepting proposals or assigning jobs.'
      });
    }

    // 2. Check Freelancer KYC (Aadhaar, PAN, and Mobile)
    const freelancerKyc = await Kyc.findOne({ userId: proposal.freelancer });
    const freelancerUser = await User.findById(proposal.freelancer);
    const freelancerKycComplete = freelancerKyc && freelancerKyc.aadharVerified && freelancerKyc.panVerified && freelancerUser?.mobileNumber && freelancerUser.mobileNumber.trim().length > 0;
    
    if (!freelancerKycComplete) {
      return res.status(400).json({
        success: false,
        message: 'This freelancer has not completed their KYC verification (Aadhaar, PAN, and Mobile number). The job cannot be assigned.'
      });
    }

    // 3. Check Freelancer one active job constraint
    const activeJob = await Job.findOne({ assignedTo: proposal.freelancer, status: 'in-progress' });
    if (activeJob) {
      return res.status(400).json({
        success: false,
        message: 'This freelancer is currently working on another active job. They must complete it first before they can be assigned to a new one.'
      });
    }

    // 4. Check Client Wallet Balance
    const Earnings = require('../models/Earnings');
    const clientEarnings = await Earnings.findOne({ userId: req.user.id });
    const walletBalance = clientEarnings?.walletBalance || 0;
    if (walletBalance < proposal.bidAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. You need ₹${proposal.bidAmount} but your balance is ₹${walletBalance}. Please add funds to your wallet before hiring.`
      });
    }

    // Deduct from wallet and move to escrow
    await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $inc: { 
          walletBalance: -proposal.bidAmount,
          escrowBalance: proposal.bidAmount
        } 
      },
      { upsert: true }
    );

    // Create escrow deposit transaction record
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      sender: req.user.id,
      receiver: String(proposal.freelancer),
      job: proposal.job._id,
      amount: proposal.bidAmount,
      type: 'escrow_deposit',
      status: 'completed'
    });

    // Create associated Task in assigned status
    const Task = require('../models/Task');
    await Task.create({
      job: proposal.job._id,
      client: req.user.id,
      freelancer: proposal.freelancer,
      status: 'assigned',
    });

    proposal.status = 'accepted';
    await proposal.save();
    // Update job status and set contract budget to proposal's bidAmount
    await Job.findByIdAndUpdate(proposal.job._id, { 
      status: 'in-progress', 
      assignedTo: proposal.freelancer,
      budget: proposal.bidAmount
    });

    // Reject all other proposals
    await Proposal.updateMany({ job: proposal.job._id, _id: { $ne: proposal._id } }, { status: 'rejected' });

    // Initialize conversation by sending an automated welcome message
    const Message = require('../models/Message');
    const welcomeMessage = await Message.create({
      sender: req.user.id,
      receiver: proposal.freelancer,
      job: proposal.job._id,
      text: `Hello! I have accepted your proposal for "${proposal.job.title}". Let's collaborate!`,
    });

    // Notify the freelancer that their proposal was accepted
    const io = req.app.get('io');
    const senderDetail = req.user.username ? `${req.user.name} (@${req.user.username})` : req.user.name;
    await createNotification({
      recipient: String(proposal.freelancer),
      sender: req.user.id,
      type: 'task_update',
      message: `Client ${senderDetail} accepted your proposal for "${proposal.job.title}"`,
      relatedId: proposal.job._id,
      onModel: 'Job',
      io,
    });

    res.status(200).json({ success: true, message: 'Proposal accepted and chat initialized', data: proposal });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a proposal (Client only)
// @route   PUT /api/v1/proposals/:proposalId/reject
// @access  Private (Client)
const rejectProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.proposalId).populate('job');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    if (String(proposal.job.client) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    proposal.status = 'rejected';
    await proposal.save();

    // Notify the freelancer that their proposal was rejected
    const io = req.app.get('io');
    const senderDetail = req.user.username ? `${req.user.name} (@${req.user.username})` : req.user.name;
    await createNotification({
      recipient: String(proposal.freelancer),
      sender: req.user.id,
      type: 'system_alert',
      message: `Client ${senderDetail} rejected your proposal for "${proposal.job.title}"`,
      relatedId: proposal.job._id,
      onModel: 'Job',
      io,
    });

    res.status(200).json({ success: true, message: 'Proposal rejected', data: proposal });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitProposal, getJobProposals, acceptProposal, rejectProposal };