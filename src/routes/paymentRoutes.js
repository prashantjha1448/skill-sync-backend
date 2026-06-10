const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/walletController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/transactions', getTransactions);

module.exports = router;