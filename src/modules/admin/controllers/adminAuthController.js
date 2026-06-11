const AdminUser = require('../models/AdminUser');
const AdminSession = require('../models/AdminSession');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAdminCookies,
  clearAdminCookies,
} = require('../middleware/adminAuthMiddleware');
const { createAdminOTP, verifyAdminOTP } = require('../utils/adminOtp');
const { createAuditLog } = require('../utils/adminAuditLogger');

/**
 * @desc    Admin login with brute-force protection
 * @route   POST /api/admin/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Find admin with password field included
    const admin = await AdminUser.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check if account is locked (brute-force protection)
    if (admin.isLocked) {
      const lockMinutes = Math.ceil((admin.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked due to too many failed attempts. Try again in ${lockMinutes} minute(s).`,
      });
    }

    // Check if account is active
    if (!admin.isActive || admin.isSuspended) {
      return res.status(403).json({ success: false, message: 'Admin account is inactive or suspended.' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts (may trigger lock)
      await admin.incLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // --- Password matched — successful login ---

    // Reset login attempts and update login metadata
    admin.loginAttempts = 0;
    admin.lockUntil = null;
    admin.lastLogin = new Date();
    admin.lastLoginIp = req.ip || req.headers['x-forwarded-for'] || null;

    // Generate tokens
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // Persist refresh token on admin record
    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });

    // Create session record
    await AdminSession.create({
      adminId: admin._id,
      refreshToken,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Set HTTP-only cookies
    setAdminCookies(res, accessToken, refreshToken);

    // Audit log
    await createAuditLog({
      admin,
      actionType: 'ADMIN_LOGIN',
      targetType: 'ADMIN',
      targetId: admin._id,
      targetName: admin.name,
      description: `Admin ${admin.name} (${admin.email}) logged in successfully.`,
      req,
      severity: 'LOW',
    });

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin logout — invalidate session & clear cookies
 * @route   POST /api/admin/auth/logout
 * @access  Private (protectAdmin)
 */
exports.logout = async (req, res, next) => {
  try {
    const admin = req.admin;

    // Mark all active sessions for this admin as inactive
    await AdminSession.updateMany(
      { adminId: admin._id, isActive: true },
      { isActive: false }
    );

    // Clear refresh token on admin record
    await AdminUser.findByIdAndUpdate(admin._id, { refreshToken: null });

    // Clear HTTP-only cookies
    clearAdminCookies(res);

    // Audit log
    await createAuditLog({
      admin,
      actionType: 'ADMIN_LOGOUT',
      targetType: 'ADMIN',
      targetId: admin._id,
      targetName: admin.name,
      description: `Admin ${admin.name} (${admin.email}) logged out.`,
      req,
      severity: 'LOW',
    });

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current admin profile
 * @route   GET /api/admin/auth/me
 * @access  Private (protectAdmin)
 */
exports.getMe = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, admin: req.admin });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/admin/auth/refresh-token
 * @access  Public (requires valid refresh token)
 */
exports.refreshToken = async (req, res, next) => {
  try {
    // Get refresh token from cookie or request body
    const token = req.cookies?.adminRefreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not provided.' });
    }

    // Verify the refresh token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    if (decoded.type !== 'ADMIN_REFRESH') {
      return res.status(401).json({ success: false, message: 'Invalid token type.' });
    }

    // Find admin and verify the stored refresh token matches
    const admin = await AdminUser.findById(decoded.id).select('+refreshToken');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found.' });
    }

    if (!admin.isActive || admin.isSuspended) {
      return res.status(403).json({ success: false, message: 'Admin account is inactive or suspended.' });
    }

    if (admin.refreshToken !== token) {
      // Potential token reuse — invalidate all sessions for security
      await AdminSession.updateMany({ adminId: admin._id }, { isActive: false });
      await AdminUser.findByIdAndUpdate(admin._id, { refreshToken: null });
      return res.status(401).json({
        success: false,
        message: 'Refresh token mismatch. All sessions invalidated for security.',
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(admin);

    // Set new access token cookie
    res.cookie('adminAccessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password — send OTP to admin email/console
 * @route   POST /api/admin/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const admin = await AdminUser.findOne({ email });
    if (!admin) {
      // Don't reveal whether the email exists — always return success
      return res.status(200).json({
        success: true,
        message: 'If an admin account with that email exists, a password reset OTP has been sent.',
      });
    }

    if (!admin.isActive || admin.isSuspended) {
      return res.status(200).json({
        success: true,
        message: 'If an admin account with that email exists, a password reset OTP has been sent.',
      });
    }

    // Create OTP for PASSWORD_RESET
    await createAdminOTP(admin._id, 'PASSWORD_RESET');

    return res.status(200).json({
      success: true,
      message: 'If an admin account with that email exists, a password reset OTP has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password using OTP
 * @route   POST /api/admin/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const admin = await AdminUser.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // Verify OTP
    const otpResult = await verifyAdminOTP(admin._id, otp, 'PASSWORD_RESET');
    if (!otpResult.valid) {
      return res.status(400).json({ success: false, message: otpResult.message });
    }

    // Update password (pre-save hook handles hashing)
    admin.password = newPassword;
    admin.refreshToken = null; // Invalidate existing sessions
    admin.loginAttempts = 0;
    admin.lockUntil = null;
    await admin.save();

    // Invalidate all active sessions
    await AdminSession.updateMany({ adminId: admin._id }, { isActive: false });

    // Audit log
    await createAuditLog({
      admin,
      actionType: 'ADMIN_PASSWORD_RESET',
      targetType: 'ADMIN',
      targetId: admin._id,
      targetName: admin.name,
      description: `Admin ${admin.name} (${admin.email}) reset their password via OTP.`,
      severity: 'HIGH',
    });

    return res.status(200).json({ success: true, message: 'Password reset successfully. Please log in again.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password (authenticated admin)
 * @route   POST /api/admin/auth/change-password
 * @access  Private (protectAdmin)
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!currentPassword || !newPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and OTP are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    }

    // Fetch admin with password field
    const admin = await AdminUser.findById(req.admin._id).select('+password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Verify OTP (CHANGE_PASSWORD purpose)
    const otpResult = await verifyAdminOTP(admin._id, otp, 'CHANGE_PASSWORD');
    if (!otpResult.valid) {
      return res.status(400).json({ success: false, message: otpResult.message });
    }

    // Update password (pre-save hook handles hashing)
    admin.password = newPassword;
    await admin.save();

    // Audit log
    await createAuditLog({
      admin,
      actionType: 'ADMIN_PASSWORD_RESET',
      targetType: 'ADMIN',
      targetId: admin._id,
      targetName: admin.name,
      description: `Admin ${admin.name} (${admin.email}) changed their password.`,
      req,
      severity: 'HIGH',
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};
