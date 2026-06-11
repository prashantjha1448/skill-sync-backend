const express = require('express');
const router = express.Router();
const {
  login, logout, getMe, refreshToken,
  forgotPassword, resetPassword, changePassword,
} = require('../controllers/adminAuthController');
const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const { createAdminOTP } = require('../utils/adminOtp');

// Public
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected
router.use(protectAdmin);
router.get('/me', getMe);
router.post('/logout', logout);
router.post('/change-password', changePassword);

// Request OTP for password change
router.post('/request-change-password-otp', async (req, res, next) => {
  try {
    await createAdminOTP(req.admin._id, 'CHANGE_PASSWORD');
    res.status(200).json({ success: true, message: 'OTP sent. Check console (dev) or mobile (prod).' });
  } catch (error) { next(error); }
});

module.exports = router;
