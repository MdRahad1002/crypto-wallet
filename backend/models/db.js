'use strict';
/**
 * Shared Supabase helpers for model adapters.
 * Converts MongoDB-style filter objects → Supabase query filters.
 */
const { getSupabaseAdmin } = require('../services/supabaseClient');

function getDb() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  return db;
}

// camelCase field names → PostgreSQL snake_case column names
const COLUMN_MAP = {
  _id: 'id', id: 'id',
  userId: 'user_id', webhookId: 'webhook_id', createdBy: 'created_by',
  createdAt: 'created_at', updatedAt: 'updated_at', lastUpdated: 'last_updated',
  isActive: 'is_active', isAdmin: 'is_admin',
  kycStatus: 'kyc_status', kycReviewMessage: 'kyc_review_message',
  recoveryStatus: 'recovery_status', kycData: 'kyc_data',
  twoFactorEnabled: 'two_factor_enabled',
  txHash: 'tx_hash', fromAddress: 'from_address', toAddress: 'to_address',
  blockNumber: 'block_number', confirmedAt: 'confirmed_at',
  lastCheckedAt: 'last_checked_at', gasUsed: 'gas_used', gasFee: 'gas_fee',
  adminNote: 'admin_note', adminEdited: 'admin_edited', adminEditedAt: 'admin_edited_at',
  walletAddress: 'wallet_address', contractAddress: 'contract_address',
  isCustom: 'is_custom', logoUrl: 'logo_url', priceUsd: 'price_usd',
  watchOnly: 'watch_only', encryptedPrivateKey: 'encrypted_private_key',
  encryptedDataKey: 'encrypted_data_key', keyId: 'key_id',
  balanceOverrideBtc: 'balance_override_btc', balanceOverrideUsd: 'balance_override_usd',
  balanceUpdatedAt: 'balance_updated_at', encryptedMnemonic: 'encrypted_mnemonic',
  encryptedSeed: 'encrypted_seed', createdByAdminId: 'created_by_admin_id',
  seedShownAt: 'seed_shown_at',
  actorType: 'actor_type', actorId: 'actor_id',
  targetUserId: 'target_user_id', targetWalletId: 'target_wallet_id',
  userAgent: 'user_agent', eventType: 'event_type',
  nextAttemptAt: 'next_attempt_at', lastError: 'last_error',
};

function toColumn(key) {
  return COLUMN_MAP[key] || key.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
}

function dbVal(v) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

/**
 * Apply a MongoDB-style filter object to a Supabase query builder.
 */
function applyFilter(q, filter) {
  if (!filter || Object.keys(filter).length === 0) return q;
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      const parts = value.map(cond =>
        Object.entries(cond).map(([k, v]) => {
          const col = toColumn(k);
          if (v && typeof v === 'object' && v.$regex) return col + '.ilike.%' + v.$regex + '%';
          return col + '.eq.' + v;
        }).join(',')
      ).join(',');
      q = q.or(parts);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const col = toColumn(key);
      for (const [op, opVal] of Object.entries(value)) {
        const v = dbVal(opVal);
        if (op === '$gte')   q = q.gte(col, v);
        else if (op === '$lte') q = q.lte(col, v);
        else if (op === '$lt')  q = q.lt(col, v);
        else if (op === '$gt')  q = q.gt(col, v);
        else if (op === '$in')  q = q.in(col, Array.isArray(opVal) ? opVal : [opVal]);
        else if (op === '$ne')  q = q.neq(col, v);
        else if (op === '$regex') q = q.ilike(col, '%' + opVal + '%');
      }
    } else {
      const col = toColumn(key);
      if (value === null) q = q.is(col, null);
      else q = q.eq(col, dbVal(value));
    }
  }
  return q;
}

function applySort(q, sortObj) {
  if (!sortObj) return q;
  for (const [key, dir] of Object.entries(sortObj)) {
    // skip nested JSONB sorts (e.g. 'kycData.submittedAt') — handled in JS
    if (key.includes('.')) continue;
    q = q.order(toColumn(key), { ascending: dir === 1 || dir === 'asc' });
  }
  return q;
}

module.exports = { getDb, toColumn, applyFilter, applySort, dbVal };
