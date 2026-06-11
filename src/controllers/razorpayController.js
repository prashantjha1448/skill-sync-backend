const crypto = require('crypto');
const Earnings = require('../models/Earnings');
const Transaction = require('../models/Transaction');

// Razorpay SDK - graceful fallback if not installed
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  Razorpay = null;
}

const getRazorpayInstance = () => {
  if (!Razorpay) throw new Error('Razorpay package not installed. Run: npm install razorpay');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
  });
};

// @desc    Create Razorpay Order
// @route   POST /api/v1/payments/razorpay/create-order
// @access  Private
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount } = req.body; // amount in INR
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `receipt_${req.user.id}_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay Payment & Credit Wallet
// @route   POST /api/v1/payments/razorpay/verify
// @access  Private
exports.verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Credit wallet balance
    const amountINR = amount / 100; // convert paise to INR
    const updatedEarnings = await Earnings.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { walletBalance: amountINR } },
      { upsert: true, new: true }
    );

    // Create deposit transaction record
    await Transaction.create({
      sender: req.user.id,
      receiver: req.user.id,
      amount: amountINR,
      type: 'deposit',
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      message: `₹${amountINR} added to wallet successfully!`,
      newBalance: updatedEarnings.walletBalance,
    });
  } catch (error) {
    next(error);
  }
};
