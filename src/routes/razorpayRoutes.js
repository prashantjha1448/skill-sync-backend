const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment } = require('../controllers/razorpayController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyRazorpayPayment);

module.exports = router;
