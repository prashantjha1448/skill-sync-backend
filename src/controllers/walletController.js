const Earnings = require('../models/Earnings');
const Transaction = require('../models/Transaction');

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
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });

    const earnings = await Earnings.findOne({ userId: req.user.id });
    if (!earnings || earnings.walletBalance < Number(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const updated = await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { walletBalance: -Number(amount) } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `₹${amount} withdrawal initiated. Arrives in 2-3 business days.`,
      data: { newBalance: updated.walletBalance },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/payments/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = { $or: [{ sender: req.user.id }, { receiver: req.user.id }] };
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const formatted = transactions.map((tx) => ({
      ...tx.toObject(),
      type: tx.sender?.toString() === req.user.id ? 'DEBIT' : 'CREDIT',
      description:
        tx.type === 'escrow_deposit' ? 'Escrow Deposit'
        : tx.type === 'escrow_release' ? 'Payment Released'
        : 'Refund',
      status: tx.status,
    }));

    res.status(200).json({ success: true, data: { transactions: formatted, page: Number(page) } });
  } catch (error) {
    next(error);
  }
};