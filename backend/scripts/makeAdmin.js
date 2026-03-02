require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-wallet')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function promoteUserToAdmin() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('\n📝 Usage:');
      console.log('  node scripts/makeAdmin.js <email>');
      console.log('\nExample:');
      console.log('  node scripts/makeAdmin.js user@example.com\n');
      process.exit(0);
    }

    const email = args[0];

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    // Check if already admin
    if (user.isAdmin || user.role === 'admin') {
      console.log(`ℹ️  User "${user.name}" (${user.email}) is already an admin`);
      process.exit(0);
    }

    // Promote to admin
    user.role = 'admin';
    user.isAdmin = true;
    await user.save();

    console.log('\n✅ User promoted to admin successfully!\n');
    console.log('User Details:');
    console.log(`  Name:  ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role:  ${user.role}`);
    console.log(`  Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error promoting user:', error);
    process.exit(1);
  }
}

promoteUserToAdmin();
