const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-wallet', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  wallets: [{
    address: String,
    encryptedPrivateKey: String,
    network: {
      type: String,
      enum: ['ethereum', 'polygon', 'bsc', 'bitcoin', 'btc'],
      default: 'ethereum'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

function getEnvOrExit(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

// Create test user
async function createTestUser() {
  try {
    const email = getEnvOrExit('TEST_USER_EMAIL');
    const password = getEnvOrExit('TEST_USER_PASSWORD');
    const name = process.env.TEST_USER_NAME || 'Test User';

    // Check if test user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log('Test user already exists!');
      console.log(`Email: ${email}`);
      console.log('\nYou can now login with these credentials.');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new test user
    const testUser = new User({
      email,
      password: hashedPassword,
      name,
      wallets: []
    });

    await testUser.save();

    console.log('✅ Test user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${email}`);
    console.log('🔑 Password: [hidden]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ You can now login with these credentials!');
    console.log('🌐 Navigate to: http://localhost:3000');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

// Run the script
createTestUser();
