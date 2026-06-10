const mongoose = require('mongoose');
const crypto = require('crypto');

const earningsSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      ref: 'User',
    },
    walletBalance: {
      type: Number,
      default: 0.0,
    },
    escrowBalance: {
      type: Number,
      default: 0.0,
    },
    todayIncome: {
      type: Number,
      default: 0.0,
    },
    allTimeIncome: {
      type: Number,
      default: 0.0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earnings', earningsSchema);
