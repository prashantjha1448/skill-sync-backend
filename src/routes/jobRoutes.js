const express = require('express');
const router = express.Router();

const { 
  createJob, 
  getJobs, 
  getJobById, 
  searchJobs, 
  updateJob, 
  deleteJob,
  getMyJobs,
  getLandingStats,
  completeJob,
  cancelJob,
} = require('../controllers/jobController');

const { protect, authorize, optionalProtect } = require('../middlewares/authMiddleware');

// 🚨 WARNING: Specific routes jaise '/search' hamesha '/:id' ke upar hone chahiye!
router.get('/stats', getLandingStats);
router.get('/search', searchJobs);
router.get('/my-jobs', protect, authorize('client'), getMyJobs);

// Standard Routes
router.route('/')
  .get(getJobs)
  .post(protect, authorize('client'), createJob); // Sirf client job post kar sakta hai

router.route('/:id')
  .get(optionalProtect, getJobById)
  .put(protect, authorize('client'), updateJob)
  .delete(protect, authorize('client'), deleteJob);

router.put('/:id/complete', protect, completeJob);
router.put('/:id/cancel', protect, cancelJob);

// Convenience: Apply to job (proxies to proposals)
const { submitProposal } = require('../controllers/proposalController');
router.post('/:id/apply', protect, authorize('freelancer'), (req, res, next) => {
  req.params.jobId = req.params.id;
  next();
}, submitProposal);

module.exports = router;