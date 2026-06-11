const express = require('express');
const router = express.Router();
const { getBalance, withdraw, getTransactions, verifyPin } = require('../controllers/walletController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/balance', getBalance);
router.post('/withdraw', withdraw);
router.post('/verify-pin', verifyPin);

module.exports = router;