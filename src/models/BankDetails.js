const mongoose = require('mongoose');
const crypto = require('crypto');

const bankDetailsSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    accountNo: {
      type: String,
      required: true,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankDetails', bankDetailsSchema);
