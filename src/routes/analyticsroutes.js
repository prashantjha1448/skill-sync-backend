const express = require('express');
const router = express.Router();
const { getFreelancerRevenue, getClientMetrics } = require('../controllers/cobineController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/freelancer-revenue', authorize('freelancer'), getFreelancerRevenue);
router.get('/client-metrics', authorize('client'), getClientMetrics);

module.exports = router;