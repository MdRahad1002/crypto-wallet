/**
 * createAdmin.js — Create a real admin user in production
 *
 * Usage:
 *   node backend/scripts/createAdmin.js <email> <password> <name>
 *
 * Example:
 *   node backend/scripts/createAdmin.js admin@yourdomain.com "S3cur3P@ss!" "Platform Admin"
 *
 * The script reads MONGODB_URI from .env or the environment.
 * Run with your production URI to create the admin directly in the live database:
 *   MONGODB_URI="mongodb+srv://..." node backend/scripts/createAdmin.js ...
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// ── Password strength check ────────────────────────────────────────────────
function validatePassword(pw) {
  const errors = [];
  if (pw.length < 12)             errors.push('at least 12 characters');
  if (!/[A-Z]/.test(pw))          errors.push('one uppercase letter');
  if (!/[a-z]/.test(pw))          errors.push('one lowercase letter');
  if (!/[0-9]/.test(pw))          errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(pw))   errors.push('one special character');
  return errors;
}

// ── Prompt helper (masks input) ────────────────────────────────────────────
function prompt(question, mask = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    if (mask && process.stdout.isTTY) {
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function handler(ch) {
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          if (ch === '\u0003') process.exit();
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          rl.close();
          resolve(input);
        } else if (ch === '\u007f') {
          input = input.slice(0, -1);
        } else {
          input += ch;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('\n❌ MONGODB_URI is not set.');
    console.error('   Set it in .env or prefix the command:');
    console.error('   MONGODB_URI="mongodb+srv://..." node backend/scripts/createAdmin.js\n');
    process.exit(1);
  }

  // Warn clearly if pointing at local DB
  if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    console.warn('\n⚠️  Warning: MONGODB_URI points to LOCAL database.');
    console.warn('   To create a production admin, use your Atlas/remote URI.\n');
  } else {
    console.log('\n🌐 Connected to REMOTE database.');
  }

  // ── Collect arguments ──────────────────────────────────────────────────
  let [,, argEmail, argPassword, ...nameParts] = process.argv;
  let argName = nameParts.join(' ');

  const email     = argEmail    || await prompt('Admin email:    ');
  const password  = argPassword || await prompt('Admin password: ', true);
  const name      = argName     || await prompt('Admin name:     ');

  if (!email || !password || !name) {
    console.error('\n❌ Email, password and name are all required.\n');
    process.exit(1);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`\n❌ Invalid email address: ${email}\n`);
    process.exit(1);
  }

  // Validate password strength
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) {
    console.error('\n❌ Password too weak. It must contain:\n  - ' + pwErrors.join('\n  - ') + '\n');
    process.exit(1);
  }

  // ── Connect & create ───────────────────────────────────────────────────
  console.log('\n⏳ Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected.\n');

  // Load model AFTER connecting so indexes are registered
  const User = require('../models/User');

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.isAdmin || existing.role === 'admin') {
      console.log(`ℹ️  ${email} is already an admin. No changes made.\n`);
    } else {
      existing.role    = 'admin';
      existing.isAdmin = true;
      await existing.save();
      console.log(`✅ Existing user ${email} promoted to admin.\n`);
    }
    await mongoose.disconnect();
    process.exit(0);
  }

  const admin = new User({
    email:    email.toLowerCase(),
    password: password,   // User model pre-save hook hashes this
    name:     name.trim(),
    role:     'admin',
    isAdmin:  true,
  });

  await admin.save();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Admin user created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role:  ${admin.role}`);
  console.log(`   ID:    ${admin._id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
