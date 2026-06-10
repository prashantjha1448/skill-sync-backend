const express = require('express');
const router = express.Router();
const { updateTaskStatus } = require('../controllers/taskController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Only freelancer updates the status during execution
router.put('/:taskId/status', updateTaskStatus);

module.exports = router;