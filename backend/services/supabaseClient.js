/**
 * Supabase Client — Backend (server-side, service role)
 *
 * This module provides lazy-initialised Supabase clients for the backend.
 * Two clients are exposed:
 *   - admin (service role key) — full DB access, storage management, bypasses RLS
 *   - anon  (anon key)         — respects RLS policies, for user-scoped reads
 *
 * Required env vars (add to your .env):
 *   SUPABASE_URL=https://vwbijbycnqobdlvnyisw.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
 *   SUPABASE_ANON_KEY=<anon_key>
 *
 * Usage:
 *   const { getSupabaseAdmin } = require('./supabaseClient');
 *   const supabase = getSupabaseAdmin();
 *   if (supabase) { const { data } = await supabase.from('kyc_submissions').select(); }
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../core/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let _adminClient = null;
let _anonClient = null;

/**
 * Returns the Supabase admin client (service role — bypasses RLS).
 * Returns null if env vars are not configured so the app degrades gracefully.
 */
function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('supabase_admin_not_configured', {
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to enable Supabase'
    });
    return null;
  }
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    logger.info('supabase_admin_client_initialised', { url: SUPABASE_URL });
  }
  return _adminClient;
}

/**
 * Returns the Supabase anon client (obeys Row Level Security policies).
 * Safe for user-scoped reads where RLS is configured.
 */
function getSupabaseAnon() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.warn('supabase_anon_not_configured', {
      hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable Supabase'
    });
    return null;
  }
  if (!_anonClient) {
    _anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    logger.info('supabase_anon_client_initialised', { url: SUPABASE_URL });
  }
  return _anonClient;
}

/**
 * Upload a file buffer to a Supabase Storage bucket.
 * @param {string} bucket   - Bucket name (e.g. 'kyc-documents')
 * @param {string} path     - Storage path (e.g. 'userId/passport.jpg')
 * @param {Buffer} buffer   - File contents
 * @param {string} mimeType - MIME type (e.g. 'image/jpeg')
 * @returns {{ publicUrl: string|null, error: Error|null }}
 */
async function uploadFile(bucket, path, buffer, mimeType) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { publicUrl: null, error: new Error('Supabase not configured') };

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    logger.error('supabase_upload_error', { bucket, path, message: uploadError.message });
    return { publicUrl: null, error: uploadError };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: data?.publicUrl || null, error: null };
}

/**
 * Insert a row into any Supabase table, returning the inserted row.
 * @param {string} table - Table name
 * @param {object} row   - Data to insert
 * @returns {{ data: object|null, error: Error|null }}
 */
async function insertRow(table, row) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };

  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) {
    logger.error('supabase_insert_error', { table, message: error.message });
  }
  return { data: data || null, error: error || null };
}

/**
 * Ensure the kyc-documents Storage bucket exists and is configured.
 * Creates it if missing (public: true so getPublicUrl works).
 * Safe to call on every cold start — returns silently if already present.
 */
async function ensureKycBucket() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return; // Supabase not configured — skip silently

  const BUCKET = 'kyc-documents';

  // Check if bucket already exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    logger.warn('supabase_bucket_list_error', { message: listError.message });
    return;
  }

  const exists = (buckets || []).some((b) => b.name === BUCKET);
  if (exists) {
    logger.info('supabase_kyc_bucket_exists', { bucket: BUCKET });
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,                               // files readable via public URL
    fileSizeLimit: 10 * 1024 * 1024,           // 10 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  });

  if (createError) {
    // "already exists" is not a real error — anything else log as warning
    if (!createError.message?.toLowerCase().includes('already exists') &&
        !createError.message?.toLowerCase().includes('duplicate')) {
      logger.warn('supabase_kyc_bucket_create_error', { message: createError.message });
    }
    return;
  }

  logger.info('supabase_kyc_bucket_created', { bucket: BUCKET, public: true });
}

module.exports = { getSupabaseAdmin, getSupabaseAnon, uploadFile, insertRow, ensureKycBucket };
