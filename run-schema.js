require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');
const { Client } = require('pg');

const sql = fs.readFileSync(__dirname + '/backend/scripts/supabase-schema.sql', 'utf8');

// Strip sslmode from the connection string so the ssl object below takes effect
const connStr = (process.env.POSTGRES_URL_NON_POOLING || '').replace(/[?&]sslmode=[^&]*/g, '');
const client = new Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres');
    await client.query(sql);
    console.log('Schema applied successfully');
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
run();
