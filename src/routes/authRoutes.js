const express = require('express');
const router  = express.Router();
const { registerUser, verifyRegistration, loginUser, logoutUser, getMe, socialLogin, assignRole, forgotPassword, resetPassword, checkUsername } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register',          registerUser);
router.post('/verify-registration', verifyRegistration);
router.post('/login',             loginUser);
router.post('/logout',            logoutUser);
router.post('/social',            socialLogin);          // Google + Facebook
router.post('/forgot-password',   forgotPassword);
router.post('/reset-password',    resetPassword);
router.get('/check-username',     checkUsername);
router.get('/me',       protect,  getMe);
router.put('/user/assign-role', protect, assignRole);   // SelectRole.jsx calls this

module.exports = router;