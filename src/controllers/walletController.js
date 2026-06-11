const Earnings = require('../models/Earnings');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const BankDetails = require('../models/BankDetails');
const bcrypt = require('bcryptjs');

// @route GET /api/v1/wallet/balance
exports.getBalance = async (req, res, next) => {
  try {
    const earnings = await Earnings.findOne({ userId: req.user.id });
    res.status(200).json({
      success: true,
      data: {
        balance: earnings?.walletBalance || 0,
        escrowBalance: earnings?.escrowBalance || 0,
        currency: 'INR',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/v1/wallet/withdraw
exports.withdraw = async (req, res, next) => {
  try {
    const { amount, bankAccountId, pin } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    if (!bankAccountId) return res.status(400).json({ success: false, message: 'Bank account is required' });
    if (!pin) return res.status(400).json({ success: false, message: 'Withdrawal PIN is required' });

    // Load User to verify PIN
    const user = await User.findById(req.user.id);
    if (!user || !user.withdrawalPin) {
      return res.status(400).json({ success: false, message: 'Withdrawal PIN is not set up' });
    }

    const isMatch = await bcrypt.compare(pin, user.withdrawalPin);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect Withdrawal PIN' });
    }

    // Verify bank account belongs to user
    const bank = await BankDetails.findOne({ _id: bankAccountId, userId: req.user.id });
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Selected bank account not found' });
    }

    // Check balance
    const earnings = await Earnings.findOne({ userId: req.user.id });
    if (!earnings || earnings.walletBalance < Number(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance in wallet' });
    }

    // Deduct balance
    const updated = await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { walletBalance: -Number(amount) } },
      { new: true }
    );

    // Save transaction
    await Transaction.create({
      sender: req.user.id,
      receiver: req.user.id,
      amount: Number(amount),
      type: 'withdrawal',
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      message: `₹${amount} withdrawn successfully to account ending in ${bank.accountNo.slice(-4)}.`,
      data: { newBalance: updated.walletBalance },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/payments/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = { $or: [{ sender: req.user.id }, { receiver: req.user.id }] };
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const formatted = transactions.map((tx) => {
      let isDebit = false;
      if (tx.type === 'withdrawal') {
        isDebit = true;
      } else if (tx.type === 'escrow_deposit' && tx.sender === req.user.id) {
        isDebit = true;
      } else if (tx.type === 'deposit') {
        isDebit = false;
      } else if (tx.type === 'escrow_release' && tx.sender === req.user.id) {
        isDebit = true;
      } else if (tx.type === 'escrow_release' && tx.receiver === req.user.id) {
        isDebit = false;
      }

      return {
        ...tx.toObject(),
        type: isDebit ? 'DEBIT' : 'CREDIT',
        description:
          tx.type === 'escrow_deposit' ? 'Escrow Deposit (Locked)'
          : tx.type === 'escrow_release' ? 'Job Payment Received'
          : tx.type === 'deposit' ? 'Added to Wallet'
          : tx.type === 'withdrawal' ? 'Bank Withdrawal'
          : 'Refund',
        status: tx.status,
      };
    });

    res.status(200).json({ success: true, data: { transactions: formatted, page: Number(page) } });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/v1/wallet/verify-pin
exports.verifyPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, message: 'PIN is required' });

    const user = await User.findById(req.user.id);
    if (!user || !user.withdrawalPin) {
      return res.status(400).json({ success: false, message: 'Withdrawal PIN is not set up' });
    }

    const isMatch = await bcrypt.compare(pin, user.withdrawalPin);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect Withdrawal PIN' });
    }

    res.status(200).json({ success: true, message: 'PIN verified successfully' });
  } catch (error) {
    next(error);
  }
};