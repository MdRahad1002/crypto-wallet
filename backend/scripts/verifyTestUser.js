const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-wallet')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  wallets: Array,
  twoFactorEnabled: Boolean,
  createdAt: Date
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

const User = mongoose.model('User', userSchema);

async function verifyUser() {
  try {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email) {
      console.error('❌ TEST_USER_EMAIL environment variable is required');
      console.error('   Usage: TEST_USER_EMAIL=<email> TEST_USER_PASSWORD=<password> node verifyTestUser.js');
      process.exit(1);
    }

    if (!password) {
      console.error('❌ TEST_USER_PASSWORD environment variable is required');
      console.error('   Usage: TEST_USER_EMAIL=<email> TEST_USER_PASSWORD=<password> node verifyTestUser.js');
      process.exit(1);
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ User found');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Password hash:', user.password ? 'exists' : 'missing');
    
    const isMatch = await user.comparePassword(password);
    console.log('\n🔑 Password verification:', isMatch ? '✅ CORRECT' : '❌ INCORRECT');
    
    if (!isMatch) {
      console.log('\n🔄 Updating password...');
      const salt = await bcrypt.genSalt(10);
      // password is sourced from TEST_USER_PASSWORD env variable - not hardcoded
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      console.log('✅ Password updated successfully');
      
      // Verify again
      const updatedUser = await User.findOne({ email });
      const isNowMatch = await updatedUser.comparePassword(password);
      console.log('🔑 New password verification:', isNowMatch ? '✅ CORRECT' : '❌ INCORRECT');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyUser();
