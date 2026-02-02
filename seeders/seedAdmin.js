require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mbm';

const defaultAdmin = {
  name: process.env.ADMIN_NAME || 'Admin',
  email: process.env.ADMIN_EMAIL || 'admin@lishnutech.com',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  role: 'admin',
  isActive: true,
  approvalStatus: 'approved',
};

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const existing = await User.findOne({ email: defaultAdmin.email });
    if (existing) {
      console.log('Admin user already exists:', existing.email);
      process.exit(0);
      return;
    }

    const admin = await User.create(defaultAdmin);
    console.log('Admin user created successfully:');
    console.log('  Email:', admin.email);
    console.log('  Name:', admin.name);
    console.log('  Role:', admin.role);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('  Password: admin123 (change after first login or set ADMIN_PASSWORD in .env)');
    }

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seedAdmin();
