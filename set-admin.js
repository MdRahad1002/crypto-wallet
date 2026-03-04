#!/usr/bin/env node
/**
 * Set Single Admin User
 * Replaces all admins with a single admin account
 */

const dotenv = require('dotenv');
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

async function setAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || 'info@bluewalletsecurity.com';
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'System Admin';

    if (!password) {
      console.error('\n❌ Error: ADMIN_PASSWORD environment variable must be set\n');
      console.error('   Example: ADMIN_PASSWORD="YourSecurePassword" node set-admin.js\n');
      process.exit(1);
    }

    console.log('🔐 Setting up single admin user...\n');

    // 1. Delete all existing admin users
    console.log('📋 Removing existing admin users...');
    const { data: existingAdmins, error: fetchError } = await supabase
      .from('users')
      .select('id, email, is_admin')
      .eq('is_admin', true);

    if (fetchError) {
      console.error('❌ Error fetching admins:', fetchError.message);
      process.exit(1);
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log(`   Found ${existingAdmins.length} existing admin(s)`);
      for (const admin of existingAdmins) {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', admin.id);

        if (deleteError) {
          console.error(`   ❌ Failed to delete admin ${admin.email}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted admin: ${admin.email}`);
        }
      }
    } else {
      console.log('   No existing admins found');
    }

    // 2. Create new admin user
    console.log('\n👤 Creating new admin user...');
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          name,
          role: 'admin',
          is_admin: true,
          kyc_status: 'approved',
          recovery_status: 'KYC_APPROVED',
          two_factor_enabled: false,
          kyc_data: {
            verified: true,
            admin_created: true,
            created_at: new Date().toISOString()
          }
        }
      ])
      .select();

    if (createError) {
      console.error('❌ Error creating admin:', createError.message);
      process.exit(1);
    }

    if (newUser && newUser.length > 0) {
      const admin = newUser[0];
      console.log(`✅ Admin created successfully!\n`);
      console.log('📊 Admin Details:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${'*'.repeat(password.length)}`);
      console.log(`   Name: ${name}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Role: admin`);
      console.log(`   KYC Status: approved\n`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

setAdmin();
