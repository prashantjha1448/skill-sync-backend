const express = require('express');
const router = express.Router();
const { sendAadharOTP, verifyAadharOTP, addPanCard, addBankAccount } = require('../controllers/kycController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.post('/send-otp', upload.single('file'), sendAadharOTP);
router.post('/verify-otp', verifyAadharOTP);
router.post('/pan', upload.single('file'), addPanCard);
router.post('/bank', addBankAccount);

module.exports = router;