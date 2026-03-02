#!/usr/bin/env node
/**
 * Create Admin User in Supabase
 * 
 * Usage:
 *   node create-admin-supabase.js <email> <password> <name>
 * 
 * Example:
 *   node create-admin-supabase.js admin@yourdomain.com "S3cur3P@ss!" "Platform Admin"
 * 
 * Or for interactive prompts:
 *   node create-admin-supabase.js
 */

const dotenv = require('dotenv');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Password validation
function validatePassword(pw) {
  const errors = [];
  if (pw.length < 12) errors.push('at least 12 characters');
  if (!/[A-Z]/.test(pw)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('one special character');
  return errors;
}

// Interactive prompt helper
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

async function createAdmin() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Create Admin User in Supabase');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get credentials from arguments or prompts
  let [,, argEmail, argPassword, ...nameParts] = process.argv;
  let argName = nameParts.join(' ');

  const email = argEmail || await prompt('Admin email: ');
  const passwordRaw = argPassword || await prompt('Admin password: ', true);
  const name = argName || await prompt('Admin name: ');

  // Validate inputs
  if (!email || !passwordRaw || !name) {
    console.error('\n❌ Email, password, and name are all required.\n');
    process.exit(1);
  }

  // Validate email format
  if (!email.includes('@')) {
    console.error('\n❌ Invalid email format.\n');
    process.exit(1);
  }

  // Validate password strength
  const passwordErrors = validatePassword(passwordRaw);
  if (passwordErrors.length > 0) {
    console.error(`\n❌ Password must have: ${passwordErrors.join(', ')}\n`);
    process.exit(1);
  }

  try {
    console.log('\nCreating admin user...\n');

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      console.error('❌ Database error:', checkError.message);
      process.exit(1);
    }

    if (existing && existing.length > 0) {
      console.error(`\n❌ Email "${email}" already exists in the database.\n`);
      process.exit(1);
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(passwordRaw, 10);

    // Insert admin user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: email.toLowerCase(),
          password: hashedPassword,
          name: name,
          role: 'admin',
          is_admin: true,
          kyc_status: 'approved', // Admins bypass KYC
          recovery_status: 'NO_KYC'
        }
      ])
      .select();

    if (error) {
      console.error(`\n❌ Failed to create admin user:`);
      console.error(`   ${error.message}\n`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.error('\n❌ Failed to create admin user (no data returned).\n');
      process.exit(1);
    }

    const adminUser = data[0];

    console.log('✅ Admin user created successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Admin User Details:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  ID:       ${adminUser.id}`);
    console.log(`  Email:    ${adminUser.email}`);
    console.log(`  Name:     ${adminUser.name}`);
    console.log(`  Role:     ${adminUser.role}`);
    console.log(`  Is Admin: ${adminUser.is_admin}`);
    console.log(`  Created:  ${new Date(adminUser.created_at).toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Next Steps:');
    console.log('  1. Start the backend: npm run server');
    console.log('  2. Log in with:');
    console.log(`     Email: ${email}`);
    console.log(`     Password: (as entered above)`);
    console.log('\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

createAdmin();
