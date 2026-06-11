const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_super_secret_change_in_prod';
const ADMIN_REFRESH_SECRET = process.env.ADMIN_REFRESH_SECRET || 'admin_refresh_secret_change_in_prod';

// Protect admin routes — verify access token
exports.protectAdmin = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Or from cookie
    if (!token && req.cookies?.adminAccessToken) {
      token = req.cookies.adminAccessToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin access denied. No token provided.' });
    }

    // Verify token using ADMIN_JWT_SECRET (separate from user JWT secret)
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    if (decoded.type !== 'ADMIN_ACCESS') {
      return res.status(401).json({ success: false, message: 'Invalid token type.' });
    }

    const admin = await AdminUser.findById(decoded.id).select('-password -refreshToken');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account not found.' });
    }

    if (!admin.isActive || admin.isSuspended) {
      return res.status(403).json({ success: false, message: 'Admin account is inactive or suspended.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin token.' });
  }
};

// SuperAdmin only guard
exports.requireSuperAdmin = (req, res, next) => {
  if (!req.admin?.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'SuperAdmin access required.' });
  }
  next();
};

// Permission-based guard factory
exports.requirePermission = (permission) => (req, res, next) => {
  if (req.admin?.isSuperAdmin) return next(); // SuperAdmin bypasses all
  if (!req.admin?.permissions?.includes(permission)) {
    return res.status(403).json({
      success: false,
      message: `Permission denied. Required: ${permission}`,
    });
  }
  next();
};

// Generate admin access token (15 min)
exports.generateAccessToken = (admin) => {
  return jwt.sign(
    { id: admin._id, role: admin.role, isSuperAdmin: admin.isSuperAdmin, type: 'ADMIN_ACCESS' },
    ADMIN_JWT_SECRET,
    { expiresIn: '15m' }
  );
};

// Generate admin refresh token (7 days)
exports.generateRefreshToken = (admin) => {
  return jwt.sign(
    { id: admin._id, type: 'ADMIN_REFRESH' },
    ADMIN_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify refresh token
exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, ADMIN_REFRESH_SECRET);
};

// Set token cookies
exports.setAdminCookies = (res, accessToken, refreshToken) => {
  res.cookie('adminAccessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie('adminRefreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

exports.clearAdminCookies = (res) => {
  res.clearCookie('adminAccessToken');
  res.clearCookie('adminRefreshToken');
};
