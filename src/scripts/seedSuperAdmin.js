/**
 * Seed SuperAdmin Script
 * Run once: node src/scripts/seedSuperAdmin.js
 *
 * Reads credentials from .env:
 *   SUPER_ADMIN_NAME=Super Admin
 *   SUPER_ADMIN_EMAIL=superadmin@skillsync.com
 *   SUPER_ADMIN_PASSWORD=SuperAdmin@123
 *   SUPER_ADMIN_MOBILE=+919999999999
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../modules/admin/models/AdminUser');

const seed = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not set in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    // Check if SuperAdmin already exists
    const existing = await AdminUser.findOne({ isSuperAdmin: true });
    if (existing) {
      console.log(`⚠️  SuperAdmin already exists: ${existing.name} (${existing.email})`);
      console.log('   Only ONE SuperAdmin is allowed. Skipping.');
      process.exit(0);
    }

    const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@skillsync.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const mobileNumber = process.env.SUPER_ADMIN_MOBILE || '+919999999999';

    const superAdmin = await AdminUser.create({
      name,
      email,
      password, // pre-save hook hashes automatically
      mobileNumber,
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      isActive: true,
      isSuspended: false,
      permissions: [], // SuperAdmin bypasses all permission checks
      createdBy: null,
    });

    console.log('✅ SuperAdmin created successfully!');
    console.log(`   Name:  ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role:  ${superAdmin.role}`);
    console.log(`   ID:    ${superAdmin._id}`);
    console.log('');
    console.log('🔐 Login at: POST /api/admin/auth/login');
    console.log(`   Body: { "email": "${email}", "password": "${password}" }`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
