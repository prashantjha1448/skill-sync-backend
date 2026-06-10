const express = require('express');
const router = express.Router();
const { addReview, getUserReviews } = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/:userId', getUserReviews); // Public route
router.post('/', protect, addReview); // Protected route

module.exports = router;