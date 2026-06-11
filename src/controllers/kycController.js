const User = require('../models/User');
const BankDetails = require('../models/BankDetails');
const Kyc = require('../models/Kyc');
const cloudinary = require('../config/cloudinary');
const bcrypt = require('bcryptjs');

const uploadToCloudinary = async (file, folder) => {
  if (!file) return null;
  const b64 = Buffer.from(file.buffer).toString('base64');
  const dataURI = `data:${file.mimetype};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataURI, { folder });
  return result.secure_url;
};

// @desc    Send Aadhaar Verification OTP
// @route   POST /api/v1/kyc/send-otp
// @access  Private
exports.sendAadharOTP = async (req, res, next) => {
  try {
    const { aadharNumber } = req.body;
    if (!aadharNumber || aadharNumber.length !== 12 || /\D/.test(aadharNumber)) {
      return res.status(400).json({ success: false, message: 'Valid 12-digit Aadhaar number is required' });
    }

    // Check if Aadhaar is already verified
    const existingKyc = await Kyc.findOne({ userId: req.user.id });
    if (existingKyc && existingKyc.aadharVerified) {
      return res.status(400).json({ success: false, message: 'Aadhaar already verified' });
    }

    // Check if Aadhaar is already registered by another user
    const checkAadhar = await Kyc.findOne({ aadharNumber, userId: { $ne: req.user.id } });
    if (checkAadhar) {
      return res.status(400).json({ success: false, message: 'Aadhaar number is already registered by another user' });
    }

    // Upload Aadhaar image if provided
    let aadharImageUrl = null;
    if (req.file) {
      aadharImageUrl = await uploadToCloudinary(req.file, 'localwork_kyc');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Kyc.findOneAndUpdate(
      { userId: req.user.id },
      {
        aadharNumber,
        aadharOtp: otp,
        aadharOtpExpiry: otpExpiry,
        ...(aadharImageUrl && { aadharImage: aadharImageUrl }),
        aadharVerified: false,
        status: 'pending'
      },
      { upsert: true, new: true }
    );

    // Log OTP to the console
    console.log(`📲 Aadhaar OTP for ${req.user.name}: ${otp}`);

    res.status(200).json({ success: true, message: 'OTP sent to your registered mobile number' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Aadhaar OTP
// @route   POST /api/v1/kyc/verify-otp
// @access  Private
exports.verifyAadharOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    const kyc = await Kyc.findOne({ userId: req.user.id });
    if (!kyc) return res.status(404).json({ success: false, message: 'KYC record not found' });
    if (kyc.aadharVerified) return res.status(400).json({ success: false, message: 'Aadhaar already verified' });

    if (kyc.aadharOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date(kyc.aadharOtpExpiry) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    kyc.aadharVerified = true;
    kyc.aadharOtp = null;
    kyc.aadharOtpExpiry = null;
    await kyc.save();

    res.status(200).json({ success: true, message: 'Aadhaar verified successfully! Please link your PAN card.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add PAN details and verify
// @route   POST /api/v1/kyc/pan
// @access  Private
exports.addPanCard = async (req, res, next) => {
  try {
    const { panCard } = req.body;
    if (!panCard || panCard.length !== 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-character PAN number is required' });
    }

    const kyc = await Kyc.findOne({ userId: req.user.id });
    if (!kyc || !kyc.aadharVerified) {
      return res.status(400).json({ success: false, message: 'Please verify Aadhaar first' });
    }

    if (kyc.panVerified) {
      return res.status(400).json({ success: false, message: 'PAN card already verified' });
    }

    // Check if PAN card is registered by another user
    const checkPan = await Kyc.findOne({ panCard: panCard.toUpperCase(), userId: { $ne: req.user.id } });
    if (checkPan) {
      return res.status(400).json({ success: false, message: 'PAN card is already registered by another user' });
    }

    // Upload PAN image if provided
    let panImageUrl = null;
    if (req.file) {
      panImageUrl = await uploadToCloudinary(req.file, 'localwork_kyc');
    }

    kyc.panCard = panCard.toUpperCase();
    kyc.panVerified = true;
    kyc.status = 'verified';
    if (panImageUrl) kyc.panImage = panImageUrl;
    await kyc.save();

    // Mark KYC as verified on User — kycVerified = Aadhaar + PAN both done
    await User.findByIdAndUpdate(req.user.id, { isVerified: true, kycVerified: true });

    res.status(200).json({ success: true, message: 'PAN verified! KYC completed successfully.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add Bank Details & Withdrawal PIN
// @route   POST /api/v1/kyc/bank
// @access  Private
exports.addBankAccount = async (req, res, next) => {
  try {
    const { accountNo, ifscCode, bankName, pin, confirmPin } = req.body;
    if (!accountNo || !ifscCode || !bankName) {
      return res.status(400).json({ success: false, message: 'All bank details are required' });
    }

    // Verify KYC status is verified
    const kyc = await Kyc.findOne({ userId: req.user.id });
    if (!kyc || kyc.status !== 'verified') {
      return res.status(400).json({ success: false, message: 'KYC verification must be completed first' });
    }

    // Set up PIN if provided (first time setup or PIN update)
    if (pin) {
      if (pin !== confirmPin) {
        return res.status(400).json({ success: false, message: 'PINs do not match' });
      }
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Withdrawal PIN must be exactly 4 digits' });
      }

      // Hash PIN
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pin, salt);
      await User.findByIdAndUpdate(req.user.id, { withdrawalPin: hashedPin });
    }

    // Create a new bank account record (allows multiple accounts)
    const bank = await BankDetails.create({
      userId: req.user.id,
      accountNo,
      ifscCode: ifscCode.toUpperCase(),
      bankName
    });

    res.status(201).json({ success: true, message: 'Bank account linked and Withdrawal PIN configured successfully!', data: bank });
  } catch (error) {
    next(error);
  }
};