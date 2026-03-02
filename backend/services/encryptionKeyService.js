'use strict';
/**
 * EncryptionKeyService
 * Ensures ENCRYPTION_MASTER_KEY is available at startup.
 *
 * Priority:
 *   1. process.env.ENCRYPTION_MASTER_KEY  (set via Vercel / host env vars)
 *   2. system_config table in Supabase    (auto-generated on first boot)
 *
 * Mirrors masterKeyService but for the private-key encryption master key.
 */

const crypto = require('crypto');
const { getDb } = require('../models/db');
const logger = require('../core/logger');

const CONFIG_KEY = 'encryption_master_key';

async function initialize() {
  // 1. Already set in environment — nothing to do
  if (process.env.ENCRYPTION_MASTER_KEY) {
    logger.info('encryption_key_loaded', { source: 'env' });
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
      process.env.ENCRYPTION_MASTER_KEY = data.value;
      logger.info('encryption_key_loaded', { source: 'supabase' });
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
    logger.error('encryption_key_persist_failed', { message: persistErr.message });
    logger.warn('encryption_key_not_persisted', {
      warning: 'Private keys encrypted this session cannot be decrypted on next cold start unless ENCRYPTION_MASTER_KEY env var is set'
    });
  }

  process.env.ENCRYPTION_MASTER_KEY = newKey;
  logger.info('encryption_key_generated', { source: 'auto', persisted: true });
}

module.exports = { initialize };
