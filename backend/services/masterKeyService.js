'use strict';
/**
 * MasterKeyService
 * Ensures WALLET_MASTER_KEY is available at startup.
 *
 * Priority:
 *   1. process.env.WALLET_MASTER_KEY  (set via Vercel / host env vars)
 *   2. system_config table in Supabase (auto-generated on first boot)
 *
 * This means the key is never lost between cold-starts even without manually
 * configuring an env var — the DB is the persistent store.
 */

const crypto = require('crypto');
const { getDb } = require('../models/db');
const logger = require('../core/logger');

const CONFIG_KEY = 'wallet_master_key';

async function initialize() {
  // 1. Already set in environment — nothing to do
  if (process.env.WALLET_MASTER_KEY) {
    logger.info('master_key_loaded', { source: 'env' });
    return;
  }

  const db = getDb();

  // 2. Try loading from system_config table
  try {
    const { data, error } = await db
      .from('system_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .single();

    if (!error && data?.value) {
      process.env.WALLET_MASTER_KEY = data.value;
      logger.info('master_key_loaded', { source: 'supabase' });
      return;
    }
  } catch (_) {
    // table may not exist yet — fall through to generate
  }

  // 3. Generate a fresh key, persist it, and inject into process.env
  const newKey = crypto.randomBytes(32).toString('hex');

  try {
    await db.from('system_config').upsert(
      { key: CONFIG_KEY, value: newKey, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch (persistErr) {
    logger.error('master_key_persist_failed', { message: persistErr.message });
    // Refusing to use an ephemeral key — seeds encrypted with it would become
    // permanently unrecoverable after the next cold start.
    throw new Error(
      'WALLET_MASTER_KEY is not set and could not be persisted to system_config. ' +
      'Set WALLET_MASTER_KEY as an environment variable to fix this.'
    );
  }

  process.env.WALLET_MASTER_KEY = newKey;
  logger.info('master_key_generated', { source: 'auto', persisted: true });
}

module.exports = { initialize };
