const express = require('express');
const router = express.Router();
const { smartMatchFreelancers } = require('../controllers/smartMatchController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/smart-match', smartMatchFreelancers);

module.exports = router;