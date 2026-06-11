const AdminOTP = require('../models/AdminOTP');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Create and save OTP record
exports.createAdminOTP = async (adminId, purpose, targetUserId = null) => {
  // Invalidate any existing unused OTPs for same admin+purpose
  await AdminOTP.updateMany(
    { adminId, purpose, isUsed: false },
    { isUsed: true }
  );

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await AdminOTP.create({ adminId, otp, purpose, targetUserId, expiresAt });

  // In production, send via SMS. For now, log to console.
  console.log(`🔐 [ADMIN OTP] ${purpose} OTP for Admin ${adminId}: ${otp} (expires in 10 min)`);

  return otp;
};

// Verify OTP
exports.verifyAdminOTP = async (adminId, otp, purpose) => {
  const record = await AdminOTP.findOne({
    adminId,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, message: 'OTP not found or expired. Please request a new OTP.' };
  }

  if (record.attempts >= 3) {
    await record.updateOne({ isUsed: true });
    return { valid: false, message: 'Too many OTP attempts. Please request a new OTP.' };
  }

  if (record.otp !== otp) {
    await record.updateOne({ $inc: { attempts: 1 } });
    return { valid: false, message: `Invalid OTP. ${2 - record.attempts} attempt(s) remaining.` };
  }

  // Mark as used
  await record.updateOne({ isUsed: true });
  return { valid: true, targetUserId: record.targetUserId };
};
