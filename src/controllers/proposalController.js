const Proposal = require('../models/Proposal');
const Job = require('../models/Job');

// @desc    Submit a proposal for a job
// @route   POST /api/v1/proposals/:jobId
// @access  Private (Freelancers only)
const submitProposal = async (req, res, next) => {
  try {
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
    proposal.status = 'accepted';
    await proposal.save();
    // Update job status
    await Job.findByIdAndUpdate(proposal.job._id, { status: 'in-progress', assignedTo: proposal.freelancer });
    // Reject all other proposals
    await Proposal.updateMany({ job: proposal.job._id, _id: { $ne: proposal._id } }, { status: 'rejected' });

    // Initialize conversation by sending an automated welcome message
    const Message = require('../models/Message');
    await Message.create({
      sender: req.user.id,
      receiver: proposal.freelancer,
      job: proposal.job._id,
      text: `Hello! I have accepted your proposal for "${proposal.job.title}". Let's collaborate!`,
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
    res.status(200).json({ success: true, message: 'Proposal rejected', data: proposal });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitProposal, getJobProposals, acceptProposal, rejectProposal };