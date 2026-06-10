const User = require('../models/User');
const Earnings = require('../models/Earnings');
const Kyc = require('../models/Kyc');
const BankDetails = require('../models/BankDetails');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user.id);
  const userObj = user.toObject ? user.toObject() : user;
  userObj.password = undefined;
  res.status(statusCode)
    .cookie('jwt', token, {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
    .json({ success: true, token, user: userObj, data: userObj });
};

// POST /auth/register
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password, mobileNumber, role, username, gender } = req.body;

    const emailLower = email.toLowerCase().trim();

    // Check if email is already taken
    const emailUser = await User.findOne({ email: emailLower });
    if (emailUser && emailUser.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Check if username is already taken
    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      const usernameUser = await User.findOne({ username: cleanUsername });
      if (usernameUser && (usernameUser.isVerified || usernameUser.email !== emailLower)) {
        return res.status(400).json({ success: false, message: 'Username is already taken' });
      }
    }

    // Find if there is an existing unverified registration for this email
    let user = await User.findOne({ email: emailLower });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const cleanGender = (gender || 'OTHER').toUpperCase();
    const defaultAvatar = (cleanGender === 'MALE')
      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack'
      : (cleanGender === 'FEMALE')
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily'
        : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';

    if (user) {
      user.name = name;
      user.password = password; // Will be hashed automatically by pre-save hook
      user.role = (role || 'CLIENT').toUpperCase();
      user.gender = cleanGender;
      user.avatar = defaultAvatar;
      user.resetPasswordOtp = otp;
      user.resetPasswordExpires = otpExpires;
      await user.save();
    } else {
      user = await User.create({
        name,
        email,
        username,
        mobileNumber,
        password, // Will be hashed automatically by pre-save hook
        role: (role || 'CLIENT').toUpperCase(),
        gender: cleanGender,
        avatar: defaultAvatar,
        isVerified: false,
        resetPasswordOtp: otp,
        resetPasswordExpires: otpExpires
      });
      await Earnings.create({ userId: user._id }).catch(() => {});
    }

    console.log(`🔑 [DEVELOPER ONLY] Registration OTP for ${user.email} is: ${otp}`);

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify your SkillSync Account 🚀',
        message: `Hi ${user.name},\n\nYour registration OTP is: ${otp}\n\nIt expires in 10 minutes.\n\nSkillSync Team`,
      });
    } catch (err) { 
      console.error('❌ Registration Email sending failed:', err);
      console.log('Email skipped.'); 
    }

    res.status(200).json({ success: true, message: 'OTP sent to your email. Please verify.' });
  } catch (error) { next(error); }
};

// POST /auth/verify-registration
exports.verifyRegistration = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });

    if (!user || user.isVerified) {
      return res.status(400).json({ success: false, message: 'User not found or already verified' });
    }

    if (user.resetPasswordOtp !== otp || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;
    await user.save();

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// POST /auth/login
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email/Username and password required' });

    const searchKey = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: searchKey },
        { username: searchKey }
      ]
    }).select('+password');

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    sendTokenResponse(user, 200, res);
  } catch (error) { next(error); }
};

// GET /auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.id = user._id;
    user.earnings = await Earnings.findOne({ userId: req.user.id }).lean();
    user.kyc = await Kyc.findOne({ userId: req.user.id }).lean();
    user.bankDetails = await BankDetails.findOne({ userId: req.user.id }).lean();
    user.password = undefined;
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// POST /auth/logout
exports.logoutUser = async (req, res, next) => {
  try {
    res.cookie('jwt', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
    res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) { next(error); }
};

// POST /auth/social
exports.socialLogin = async (req, res, next) => {
  try {
    const { provider, token: providerToken, email, name, avatar } = req.body;

    let verifiedEmail = email;
    let verifiedName  = name;

    if (provider === 'google' && providerToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: providerToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        verifiedEmail = payload.email;
        verifiedName  = payload.name;
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid Google token' });
      }
    }

    if (!verifiedEmail) return res.status(400).json({ success: false, message: 'Email required' });

    let user = await User.findOne({ email: verifiedEmail });
    if (!user) {
      const randomPwd = Math.random().toString(36);
      user = await User.create({
        name: verifiedName || verifiedEmail.split('@')[0],
        email: verifiedEmail,
        password: randomPwd,
        isVerified: true
      });
      await Earnings.create({ userId: user._id }).catch(() => {});
    }

    sendTokenResponse(user, 200, res);
  } catch (error) { next(error); }
};

// PUT /auth/user/assign-role
exports.assignRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['CLIENT', 'FREELANCER'].includes(role?.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Role must be CLIENT or FREELANCER' });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { role: role.toUpperCase() }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const userObj = user.toObject ? user.toObject() : user;
    userObj.password = undefined;
    res.status(200).json({ success: true, message: 'Role assigned', data: userObj });
  } catch (error) { next(error); }
};

// POST /auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    console.log(`Password reset OTP for ${email}: ${otp}`);
    
    res.status(200).json({ success: true, message: 'OTP sent to email (check console for now)' });
  } catch (error) { next(error); }
};

// POST /auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.resetPasswordOtp !== otp || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword; // Will be hashed automatically by pre-save hook
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) { next(error); }
};

// GET /auth/check-username
exports.checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_]{3,}$/.test(cleanUsername)) {
      return res.status(200).json({ success: true, available: false, message: 'Invalid username format' });
    }
    const user = await User.findOne({ username: cleanUsername });
    if (user && user.isVerified) {
      return res.status(200).json({ success: true, available: false, message: 'Username is already taken' });
    }
    res.status(200).json({ success: true, available: true, message: 'Username is available' });
  } catch (error) { next(error); }
};