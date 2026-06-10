const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    bankName: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['pending', 'verified'],
      default: 'pending' // Admin ya Penny Drop testing se verify hoga
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankAccount', bankAccountSchema);