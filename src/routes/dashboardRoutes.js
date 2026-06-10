const express = require('express');
const router = express.Router();
const { getClientDashboard, getFreelancerDashboard, getWallet } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Dashboard access ke liye user ka logged-in hona zaroori hai
router.use(protect);

// Alag-alag roles ke liye strict routes
router.get('/client', authorize('client'), getClientDashboard);
router.get('/freelancer', authorize('freelancer'), getFreelancerDashboard);
router.get('/wallet', getWallet);

module.exports = router;