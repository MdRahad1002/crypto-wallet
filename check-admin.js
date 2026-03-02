#!/usr/bin/env node
/**
 * Check Admin Users in Supabase
 * Lists all admin users in the database
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmins() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Checking for Admin Users');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Query for admin users
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_admin, created_at')
      .eq('is_admin', true);

    if (error) {
      console.log('⚠️  Database Query Error:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}\n`);
      
      if (error.code === 'PGRST116') {
        console.log('ℹ️  The "users" table has not been created yet.');
        console.log('   Please run the schema setup in Supabase Dashboard:');
        console.log('   1. Go to SQL Editor');
        console.log('   2. Run backend/scripts/supabase-schema.sql\n');
      }
      return;
    }

    if (!data || data.length === 0) {
      console.log('ℹ️  No admin users found in the database.\n');
      console.log('To create an admin user, run:');
      console.log('   node backend/scripts/createAdmin.js\n');
      return;
    }

    console.log(`Found ${data.length} admin user(s):\n`);
    
    data.forEach((admin, index) => {
      console.log(`Admin #${index + 1}:`);
      console.log(`  ID:        ${admin.id}`);
      console.log(`  Email:     ${admin.email}`);
      console.log(`  Name:      ${admin.name || 'Not set'}`);
      console.log(`  Role:      ${admin.role}`);
      console.log(`  Is Admin:  ${admin.is_admin}`);
      console.log(`  Created:   ${new Date(admin.created_at).toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkAdmins();
