const express = require('express');
const router = express.Router();
const { submitProposal, getJobProposals, acceptProposal, rejectProposal } = require('../controllers/proposalController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Freelancer applies to a job
router.post('/:jobId', protect, authorize('freelancer'), submitProposal);

// Client views proposals for their job
router.get('/job/:jobId', protect, authorize('client'), getJobProposals);

// Client accepts/rejects a proposal
router.put('/:proposalId/accept', protect, authorize('client'), acceptProposal);
router.put('/:proposalId/reject', protect, authorize('client'), rejectProposal);

module.exports = router;