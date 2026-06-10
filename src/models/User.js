const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    
    // Email Trackers
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    isEmailEdited: { type: Boolean, default: false }, // Rule: Can only edit email once
    
    // Username (optional, unique)
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    
    // Mobile Trackers
    mobileNumber: { type: String },
    isMobileEdited: { type: Boolean, default: false }, // Rule: Can only edit mobile once
    
    password: { type: String, required: [true, 'Password is required'], select: false },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], default: 'OTHER' },
    role: { type: String, enum: ['CLIENT', 'FREELANCER', 'ADMIN'], default: 'CLIENT' },
    avatar: { type: String, default: null },
    profilePic: { type: String, default: null },
    
    // Profile information
    title: { type: String, default: '' },
    bio: { type: String, default: '' },
    skills: { type: [String], default: [] },
    hourlyRate: { type: Number, default: 0 },
    
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
      address: String,
      city: String,
    },
    
    serviceRadius: { type: Number, default: 25 },
    isAvailable: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0 },
    totalJobsCompleted: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    
    // Security & OTP fields
    twoFactorEnabled: { type: Boolean, default: false },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for compatibility with user.id
userSchema.virtual('id').get(function () {
  return this._id;
});

// 2dsphere index for radius search (Geo-spatial)
userSchema.index({ location: '2dsphere' });

// Hash password before saving (Fixed for latest Mongoose)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password utility for Login
userSchema.methods.comparePassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;