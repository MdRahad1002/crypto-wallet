#!/usr/bin/env node
/**
 * Verify Supabase Connection Setup
 * 
 * This script checks that all required environment variables are properly configured
 * for Supabase and PostgreSQL connections.
 * 
 * Usage: node verify-supabase.js
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config();

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('   Supabase Connection Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

// Required environment variables
const requiredVars = {
  'SUPABASE_URL': 'Supabase project URL',
  'SUPABASE_SERVICE_ROLE_KEY': 'Supabase service role key (server-side)',
  'SUPABASE_ANON_KEY': 'Supabase anonymous key (client-side)',
  'POSTGRES_HOST': 'Database host',
  'POSTGRES_USER': 'Database user',
  'POSTGRES_PASSWORD': 'Database password',
  'POSTGRES_DATABASE': 'Database name'
};

let allConfigured = true;
let configuredCount = 0;

console.log('Checking Environment Variables:\n');

for (const [key, description] of Object.entries(requiredVars)) {
  const value = process.env[key];
  const status = value ? '✅' : '❌';
  const displayValue = value 
    ? (value.length > 50 ? value.substring(0, 50) + '...' : value)
    : 'NOT SET';
  
  console.log(`${status} ${key}`);
  console.log(`   Description: ${description}`);
  console.log(`   Value: ${displayValue}\n`);
  
  if (!value) {
    allConfigured = false;
  } else {
    configuredCount++;
  }
}

console.log('─────────────────────────────────────────────────────────────────');
console.log(`\nConfiguration Status: ${configuredCount}/${Object.keys(requiredVars).length} variables set\n`);

if (allConfigured) {
  console.log('✅ All required environment variables are configured!\n');
  
  // Try to connect to Supabase
  console.log('Attempting Supabase Connection Test...\n');
  
  try {
    const supabaseClient = require('./backend/services/supabaseClient');
    const { getSupabaseAdmin } = supabaseClient;
    
    const client = getSupabaseAdmin();
    
    if (client) {
      console.log('✅ Supabase admin client initialized successfully!\n');
      
      // Test simple query
      client.from('users').select('count').limit(1)
        .then(({ data, error }) => {
          if (error) {
            console.log('⚠️  Query test failed:');
            console.log(`   Error: ${error.message}\n`);
          } else {
            console.log('✅ Successfully connected to Supabase database!\n');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('   Database Connection Status: READY');
            console.log('═══════════════════════════════════════════════════════════════\n');
          }
        })
        .catch(err => {
          console.log('⚠️  Connection test error:');
          console.log(`   ${err.message}\n`);
        });
    } else {
      console.log('❌ Supabase admin client failed to initialize.\n');
      console.log('Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.\n');
    }
  } catch (error) {
    console.log('⚠️  Could not test Supabase connection:');
    console.log(`   ${error.message}\n`);
  }
} else {
  console.log('❌ Missing required environment variables!\n');
  console.log('Please set the following in your .env file:\n');
  
  for (const [key, description] of Object.entries(requiredVars)) {
    if (!process.env[key]) {
      console.log(`- ${key}`);
    }
  }
  
  console.log('\nSee SUPABASE_SETUP.md for detailed instructions.\n');
  process.exit(1);
}

console.log('Next Steps:');
console.log('1. Ensure supabase-schema.sql has been run in Supabase Dashboard');
console.log('2. Run: npm install (to install Supabase client)');
console.log('3. Start backend: npm run server');
console.log('4. Start frontend: cd frontend && npm start\n');
