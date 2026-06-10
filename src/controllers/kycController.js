const User         = require('../models/User');
const BankDetails  = require('../models/BankDetails');
const Verification = require('../models/Verification');
const redisClient  = require('../config/redis');

// POST /kyc/send-otp
exports.sendAadharOTP = async (req, res, next) => {
  try {
    const { aadharNumber, mobileNumber } = req.body;
    if (!aadharNumber || !mobileNumber)
      return res.status(400).json({ success: false, message: 'Aadhar and mobile required' });

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP in MongoDB (upsert per user)
    await Verification.findOneAndUpdate(
      { user: req.user.id },
      { aadharNumber, mobileNumber, otp, otpExpiry, status: 'pending' },
      { new: true, upsert: true }
    );

    // Cache in Redis with 10-min TTL (fallback if Mongo slow)
    if (redisClient.isOpen) {
      await redisClient.setEx(`otp:${req.user.id}`, 600, otp).catch(() => {});
    }

    // TODO: Replace with Twilio / Fast2SMS in production
    console.log(`📲 OTP for ${mobileNumber}: ${otp}`);

    res.status(200).json({ success: true, message: 'OTP sent to registered mobile number' });
  } catch (error) { next(error); }
};

// POST /kyc/verify-otp
exports.verifyAadharOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;

    const record = await Verification.findOne({ user: req.user.id });
    if (!record) return res.status(404).json({ success: false, message: 'No pending verification found' });
    if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (record.otpExpiry < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });

    record.status     = 'verified';
    record.otp        = undefined;
    record.otpExpiry  = undefined;
    await record.save();

    // Mark verified in MongoDB User model
    await User.findByIdAndUpdate(req.user.id, { isVerified: true });

    if (redisClient.isOpen) await redisClient.del(`otp:${req.user.id}`).catch(() => {});

    res.status(200).json({ success: true, message: 'KYC verified! Profile is now trusted.' });
  } catch (error) { next(error); }
};

// POST /kyc/bank
exports.addBankAccount = async (req, res, next) => {
  try {
    const { accountNo, ifscCode, bankName } = req.body;
    if (!accountNo || !ifscCode || !bankName)
      return res.status(400).json({ success: false, message: 'All bank fields required' });

    const bank = await BankDetails.findOneAndUpdate(
      { userId: req.user.id },
      { accountNo, ifscCode: ifscCode.toUpperCase(), bankName },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, message: 'Bank account linked', data: bank });
  } catch (error) { next(error); }
};