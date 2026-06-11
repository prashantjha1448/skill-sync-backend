const User = require('../../../models/User');
const Kyc = require('../../../models/Kyc');
const BankDetails = require('../../../models/BankDetails');
const Earnings = require('../../../models/Earnings');
const Job = require('../../../models/Job');
const Transaction = require('../../../models/Transaction');
const Proposal = require('../../../models/Proposal');
const Wallet = require('../../../models/Wallet');
const { createAdminOTP, verifyAdminOTP } = require('../utils/adminOtp');
const { createAuditLog } = require('../utils/adminAuditLogger');

// GET /api/admin/users — paginated, filterable
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role.toUpperCase();
    if (req.query.kycVerified !== undefined) filter.kycVerified = req.query.kycVerified === 'true';
    if (req.query.isAvailable !== undefined) filter.isAvailable = req.query.isAvailable === 'true';

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/users/search?q=
exports.searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, message: 'Search query required.' });

    const regex = new RegExp(q, 'i');
    const orConditions = [
      { name: regex }, { username: regex }, { email: regex }, { mobileNumber: regex },
    ];
    // Try exact _id match
    if (/^[0-9a-f-]{36}$/i.test(q)) orConditions.push({ _id: q });

    const users = await User.find({ $or: orConditions })
      .select('-password').limit(30).lean();

    // Enrich with KYC status
    const enriched = await Promise.all(users.map(async (u) => {
      const kyc = await Kyc.findOne({ userId: u._id }).lean();
      return { ...u, kyc: kyc ? { status: kyc.status, aadharVerified: kyc.aadharVerified, panVerified: kyc.panVerified } : null };
    }));

    res.status(200).json({ success: true, count: enriched.length, data: enriched });
  } catch (error) { next(error); }
};

// GET /api/admin/users/:userId — full detail
exports.getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const [kyc, bank, earnings, wallet, jobs, proposals, transactions] = await Promise.all([
      Kyc.findOne({ userId: user._id }).lean(),
      BankDetails.find({ userId: user._id }).lean(),
      Earnings.findOne({ userId: user._id }).lean(),
      Wallet.findOne({ userId: user._id }).lean(),
      Job.find({ $or: [{ client: user._id }, { freelancer: user._id }] }).sort({ createdAt: -1 }).limit(20).lean(),
      Proposal.find({ freelancer: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      Transaction.find({ $or: [{ userId: user._id }, { from: user._id }, { to: user._id }] }).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    res.status(200).json({
      success: true,
      data: { ...user, kyc, bankAccounts: bank, earnings, wallet, jobs, proposals, transactions },
    });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/suspend
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldData = { isAvailable: user.isAvailable };
    user.isAvailable = false;
    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'USER_SUSPEND', targetType: 'USER',
      targetId: user._id, targetName: user.name,
      description: `Suspended user ${user.name} (${user.email}).`,
      oldData, newData: { isAvailable: false }, req, severity: 'HIGH',
    });

    res.status(200).json({ success: true, message: `User ${user.name} suspended.` });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/activate
exports.activateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldData = { isAvailable: user.isAvailable };
    user.isAvailable = true;
    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'USER_ACTIVATE', targetType: 'USER',
      targetId: user._id, targetName: user.name,
      description: `Activated user ${user.name} (${user.email}).`,
      oldData, newData: { isAvailable: true }, req, severity: 'MEDIUM',
    });

    res.status(200).json({ success: true, message: `User ${user.name} activated.` });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/block
exports.blockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldData = { isAvailable: user.isAvailable };
    user.isAvailable = false;
    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'USER_BLOCK', targetType: 'USER',
      targetId: user._id, targetName: user.name,
      description: `Blocked user ${user.name} (${user.email}). Reason: ${req.body.reason || 'N/A'}`,
      oldData, newData: { isAvailable: false, blocked: true }, req, severity: 'CRITICAL',
    });

    res.status(200).json({ success: true, message: `User ${user.name} blocked.` });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/unblock
exports.unblockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.isAvailable = true;
    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      admin: req.admin, actionType: 'USER_UNBLOCK', targetType: 'USER',
      targetId: user._id, targetName: user.name,
      description: `Unblocked user ${user.name} (${user.email}).`,
      oldData: { isAvailable: false }, newData: { isAvailable: true }, req, severity: 'MEDIUM',
    });

    res.status(200).json({ success: true, message: `User ${user.name} unblocked.` });
  } catch (error) { next(error); }
};

// POST /api/admin/users/request-otp — generate OTP for sensitive action
exports.requestSensitiveOTP = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required.' });

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ success: false, message: 'Target user not found.' });

    const otp = await createAdminOTP(req.admin._id, 'SENSITIVE_ACTION', targetUserId);

    await createAuditLog({
      admin: req.admin, actionType: 'SENSITIVE_OTP_SENT', targetType: 'USER',
      targetId: targetUserId, targetName: user.name,
      description: `OTP generated for sensitive action on user ${user.name}.`, req, severity: 'MEDIUM',
    });

    res.status(200).json({ success: true, message: 'OTP sent. Check console (dev) or mobile (prod).' });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/kyc — modify KYC (OTP-gated)
exports.modifyUserKyc = async (req, res, next) => {
  try {
    const { otp, aadharNumber, panCard } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required for KYC modification.' });

    const otpResult = await verifyAdminOTP(req.admin._id, otp, 'SENSITIVE_ACTION');
    if (!otpResult.valid) return res.status(400).json({ success: false, message: otpResult.message });

    const kyc = await Kyc.findOne({ userId: req.params.userId });
    if (!kyc) return res.status(404).json({ success: false, message: 'KYC record not found.' });

    const oldData = { aadharNumber: kyc.aadharNumber, panCard: kyc.panCard };
    if (aadharNumber) kyc.aadharNumber = aadharNumber;
    if (panCard) kyc.panCard = panCard.toUpperCase();
    await kyc.save();

    await createAuditLog({
      admin: req.admin, actionType: 'USER_KYC_MODIFY', targetType: 'USER',
      targetId: req.params.userId, description: 'Admin modified user KYC details.',
      oldData, newData: { aadharNumber: kyc.aadharNumber, panCard: kyc.panCard }, req, severity: 'CRITICAL',
    });

    res.status(200).json({ success: true, message: 'KYC details updated.', data: kyc });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:userId/bank — modify bank (OTP-gated)
exports.modifyUserBank = async (req, res, next) => {
  try {
    const { otp, accountNo, ifscCode, bankName } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required for bank modification.' });

    const otpResult = await verifyAdminOTP(req.admin._id, otp, 'SENSITIVE_ACTION');
    if (!otpResult.valid) return res.status(400).json({ success: false, message: otpResult.message });

    const bank = await BankDetails.findOne({ userId: req.params.userId });
    if (!bank) return res.status(404).json({ success: false, message: 'Bank record not found.' });

    const oldData = { accountNo: bank.accountNo, ifscCode: bank.ifscCode, bankName: bank.bankName };
    if (accountNo) bank.accountNo = accountNo;
    if (ifscCode) bank.ifscCode = ifscCode.toUpperCase();
    if (bankName) bank.bankName = bankName;
    await bank.save();

    await createAuditLog({
      admin: req.admin, actionType: 'USER_BANK_MODIFY', targetType: 'USER',
      targetId: req.params.userId, description: 'Admin modified user bank details.',
      oldData, newData: { accountNo: bank.accountNo, ifscCode: bank.ifscCode, bankName: bank.bankName },
      req, severity: 'CRITICAL',
    });

    res.status(200).json({ success: true, message: 'Bank details updated.', data: bank });
  } catch (error) { next(error); }
};

// GET /api/admin/users/:userId/history
exports.getUserHistory = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).select('name email role createdAt lastLogin').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const [jobs, proposals, transactions] = await Promise.all([
      Job.find({ $or: [{ client: userId }, { freelancer: userId }] }).sort({ createdAt: -1 }).limit(20).lean(),
      Proposal.find({ freelancer: userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Transaction.find({ $or: [{ userId }, { from: userId }, { to: userId }] }).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    res.status(200).json({ success: true, data: { user, jobs, proposals, transactions } });
  } catch (error) { next(error); }
};
