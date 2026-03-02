require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto-wallet';

const DEMO_USER = {
  email: (process.env.TEST_USER_EMAIL || 'demo.user@local.dev').toLowerCase(),
  password: process.env.TEST_USER_PASSWORD || 'DemoUser!123',
  name: process.env.TEST_USER_NAME || 'Demo User'
};

const DEMO_ADMIN = {
  email: (process.env.TEST_ADMIN_EMAIL || 'demo.admin@local.dev').toLowerCase(),
  password: process.env.TEST_ADMIN_PASSWORD || 'DemoAdmin!123',
  name: process.env.TEST_ADMIN_NAME || 'Demo Admin'
};

async function ensureUser({ email, password, name, role, isAdmin }) {
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({ email, password, name, wallets: [] });
  } else {
    user.name = name;
    if (!user.password) {
      user.password = password;
    }
  }

  user.role = role;
  user.isAdmin = isAdmin;

  await user.save();
  return user;
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);

    const createdUser = await ensureUser({
      ...DEMO_USER,
      role: 'user',
      isAdmin: false
    });

    const createdAdmin = await ensureUser({
      ...DEMO_ADMIN,
      role: 'admin',
      isAdmin: true
    });

    console.log('✅ Demo accounts are ready');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User:  ${createdUser.email}`);
    console.log('Pass:  [from TEST_USER_PASSWORD or DemoUser!123]');
    console.log(`Admin: ${createdAdmin.email}`);
    console.log('Pass:  [from TEST_ADMIN_PASSWORD or DemoAdmin!123]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed demo accounts:', error.message);
    process.exit(1);
  }
}

run();
