const express = require('express');
const router = express.Router();
const {
  getAllUsers, searchUsers, getUserDetail,
  suspendUser, activateUser, blockUser, unblockUser,
  requestSensitiveOTP, modifyUserKyc, modifyUserBank,
  getUserHistory,
} = require('../controllers/adminUserController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);

router.get('/',             requirePermission('view_users'), getAllUsers);
router.get('/search',       requirePermission('view_users'), searchUsers);
router.get('/:userId',      requirePermission('view_users'), getUserDetail);
router.get('/:userId/history', requirePermission('view_users'), getUserHistory);
router.put('/:userId/suspend', requirePermission('suspend_user'), suspendUser);
router.put('/:userId/activate', requirePermission('suspend_user'), activateUser);
router.put('/:userId/block',   requirePermission('block_user'), blockUser);
router.put('/:userId/unblock', requirePermission('block_user'), unblockUser);
router.post('/request-otp',    requirePermission('view_users'), requestSensitiveOTP);
router.put('/:userId/kyc',     requirePermission('view_users'), modifyUserKyc);
router.put('/:userId/bank',    requirePermission('view_users'), modifyUserBank);

module.exports = router;
