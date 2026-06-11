const express = require('express');
const router = express.Router();
const {
  getAllTasks, getTaskDetail, cancelTask, forceCompleteTask, reopenTask,
} = require('../controllers/adminTaskController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);

router.get('/',               requirePermission('view_tasks'), getAllTasks);
router.get('/:taskId',        requirePermission('view_tasks'), getTaskDetail);
router.put('/:taskId/cancel', requirePermission('cancel_task'), cancelTask);
router.put('/:taskId/complete', requirePermission('cancel_task'), forceCompleteTask);
router.put('/:taskId/reopen', requirePermission('cancel_task'), reopenTask);

module.exports = router;
