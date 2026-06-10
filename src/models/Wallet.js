const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    balance: {
      type: Number,
      default: 50000 // Testing ke liye har naye user ko 50,000/- dummy balance de rahe hain
    },
    escrowBalance: {
      type: Number,
      default: 0 // Wo paise jo deal chalne tak beech mein lock rahenge
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);