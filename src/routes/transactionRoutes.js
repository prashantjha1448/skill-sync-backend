const express = require('express');
const router = express.Router();
const { depositToEscrow, releasePayment } = require('../controllers/transactionController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Dono routes securely protected hain aur sirf Client hi operate kar sakta hai
router.use(protect);
router.use(authorize('client'));

router.post('/job/:jobId/deposit', depositToEscrow);
router.post('/job/:jobId/release', releasePayment);

module.exports = router;