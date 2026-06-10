const express = require('express');
const router = express.Router();
const { sendAadharOTP, verifyAadharOTP, addBankAccount } = require('../controllers/kycController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/send-otp', sendAadharOTP);
router.post('/verify-otp', verifyAadharOTP);
router.post('/bank', addBankAccount);

module.exports = router;