/**
 * One-time helper: writes all Supabase model adapters and updates config files.
 * Run with: node backend/scripts/_writeSupabaseModels.js
 * Delete this file after running.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const backendDir = path.join(root, 'backend');
const modelsDir  = path.join(backendDir, 'models');

// ─────────────────────────────────────────────────────────────────────────────
// db.js — shared Supabase helpers used by every model
// ─────────────────────────────────────────────────────────────────────────────
const dbJs = `'use strict';
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
`;

// ─────────────────────────────────────────────────────────────────────────────
// User.js
// ─────────────────────────────────────────────────────────────────────────────
const userJs = `'use strict';
const bcrypt = require('bcryptjs');
const { getDb, applyFilter, applySort, dbVal } = require('./db');

// ── Row mappers ────────────────────────────────────────────────────────────
function walletRowToObj(r) {
  return {
    _id: r.id, id: r.id,
    address: r.address,
    encryptedPrivateKey: r.encrypted_private_key,
    encryptedDataKey: r.encrypted_data_key,
    keyId: r.key_id,
    network: r.network || 'ethereum',
    watchOnly: r.watch_only || false,
    label: r.label || '',
    balanceOverrideBtc: r.balance_override_btc,
    balanceOverrideUsd: r.balance_override_usd,
    balanceUpdatedAt: r.balance_updated_at ? new Date(r.balance_updated_at) : null,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
  };
}
function walletObjToRow(userId, w) {
  return {
    user_id: userId,
    address: w.address,
    encrypted_private_key: w.encryptedPrivateKey || null,
    encrypted_data_key: w.encryptedDataKey || null,
    key_id: w.keyId || null,
    network: w.network || 'ethereum',
    watch_only: w.watchOnly || false,
    label: w.label || '',
    balance_override_btc: w.balanceOverrideBtc !== undefined ? w.balanceOverrideBtc : null,
    balance_override_usd: w.balanceOverrideUsd !== undefined ? w.balanceOverrideUsd : null,
    balance_updated_at: w.balanceUpdatedAt ? dbVal(w.balanceUpdatedAt) : null,
  };
}
function notifRowToObj(r) {
  return {
    _id: r.id, id: r.id,
    message: r.message,
    type: r.type || 'info',
    priority: r.priority || 'medium',
    read: r.read || false,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    expiresAt: r.expires_at ? new Date(r.expires_at) : null,
  };
}
function notifObjToRow(userId, n) {
  return {
    user_id: userId,
    message: n.message,
    type: n.type || 'info',
    priority: n.priority || 'medium',
    read: n.read || false,
    created_at: n.createdAt ? dbVal(n.createdAt) : new Date().toISOString(),
    expires_at: n.expiresAt ? dbVal(n.expiresAt) : null,
  };
}
function tokenRowToObj(r) {
  return { tokenHash: r.token_hash, createdAt: new Date(r.created_at), expiresAt: new Date(r.expires_at) };
}

// ── Build a full UserDoc from DB rows ──────────────────────────────────────
function buildDoc(row, wallets, notifications, refreshTokens, isNew = false) {
  const doc = {
    // Identity
    _id: row.id, id: row.id,
    // Core fields
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role || 'user',
    isAdmin: row.is_admin || false,
    kycStatus: row.kyc_status || 'pending',
    kycReviewMessage: row.kyc_review_message || '',
    recoveryStatus: row.recovery_status || 'NO_KYC',
    kycData: row.kyc_data || {},
    twoFactorEnabled: row.two_factor_enabled || false,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    // Embedded arrays
    wallets: (wallets || []).map(walletRowToObj),
    notifications: (notifications || []).map(notifRowToObj),
    refreshTokens: (refreshTokens || []).map(tokenRowToObj),
    // Internal tracking
    _isNew: isNew,
    _originalPassword: row.password,
    _originalRefreshHashes: new Set((refreshTokens || []).map(r => r.token_hash)),
  };
  doc.save = () => User._save(doc);
  doc.comparePassword = (candidate) => bcrypt.compare(candidate, doc.password);
  doc.toString = () => doc.id;
  return doc;
}

// ── Load full user (with embedded arrays) by ID ────────────────────────────
async function loadFull(userId) {
  const db = getDb();
  const { data: row, error } = await db.from('users').select('*').eq('id', userId).single();
  if (error || !row) return null;
  const [{ data: wallets }, { data: notifs }, { data: tokens }] = await Promise.all([
    db.from('user_wallets').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('user_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('user_refresh_tokens').select('*').eq('user_id', userId),
  ]);
  return buildDoc(row, wallets, notifs, tokens);
}

// ── QueryBuilder ───────────────────────────────────────────────────────────
class UserQuery {
  constructor(filter) { this._filter = filter; this._sort = null; this._limit = null; this._skip = null; this._selectFields = null; }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = parseInt(n, 10); return this; }
  skip(n) { this._skip = parseInt(n, 10); return this; }
  select(f) { this._selectFields = f; return this; }
  lean() { return this; } // no-op: we always return plain objects
  async exec() {
    const db = getDb();
    let q = db.from('users').select('*');
    q = applyFilter(q, this._filter);
    q = applySort(q, this._sort);
    if (this._limit) q = q.limit(this._limit);
    if (this._skip)  q = q.range(this._skip, this._skip + (this._limit || 1000) - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data) return [];
    // Handle nested sort (e.g. kycData.submittedAt)
    let rows = data;
    if (this._sort) {
      for (const [key, dir] of Object.entries(this._sort)) {
        if (key.includes('.')) {
          const parts = key.split('.');
          rows.sort((a, b) => {
            const av = parts.reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), a);
            const bv = parts.reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), b);
            const diff = (av ? new Date(av) : 0) - (bv ? new Date(bv) : 0);
            return dir === -1 ? -diff : diff;
          });
        }
      }
    }
    // Optionally strip password
    const exclude = this._selectFields && typeof this._selectFields === 'string' ?
      this._selectFields.split(' ').filter(s => s.startsWith('-')).map(s => s.slice(1)) : [];
    return rows.map(row => {
      const doc = buildDoc(row, [], [], []);
      if (exclude.includes('password')) delete doc.password;
      return doc;
    });
  }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
}

// ── Static model ───────────────────────────────────────────────────────────
class User {
  constructor(data) {
    this._isNew = true;
    this._id = null; this.id = null;
    this.email = data.email || '';
    this.password = data.password || '';
    this.name = data.name || '';
    this.role = data.role || 'user';
    this.isAdmin = data.isAdmin || data.role === 'admin' || false;
    this.kycStatus = data.kycStatus || 'pending';
    this.kycReviewMessage = data.kycReviewMessage || '';
    this.recoveryStatus = data.recoveryStatus || 'NO_KYC';
    this.kycData = data.kycData || {};
    this.twoFactorEnabled = data.twoFactorEnabled || false;
    this.createdAt = new Date();
    this.wallets = data.wallets || [];
    this.notifications = data.notifications || [];
    this.refreshTokens = data.refreshTokens || [];
    this._originalPassword = null; // no original — definitely new
    this._originalRefreshHashes = new Set();
    this.save = () => User._save(this);
    this.comparePassword = (candidate) => bcrypt.compare(candidate, this.password);
    this.toString = () => this.id;
  }

  static async _save(doc) {
    const db = getDb();
    // Hash if password changed
    if (doc.password !== doc._originalPassword) {
      const salt = await bcrypt.genSalt(10);
      doc.password = await bcrypt.hash(doc.password, salt);
      doc._originalPassword = doc.password;
    }
    const row = {
      email: doc.email, password: doc.password, name: doc.name,
      role: doc.role, is_admin: doc.isAdmin,
      kyc_status: doc.kycStatus, kyc_review_message: doc.kycReviewMessage,
      recovery_status: doc.recoveryStatus, kyc_data: doc.kycData,
      two_factor_enabled: doc.twoFactorEnabled,
    };
    if (doc._isNew) {
      const { data, error } = await db.from('users').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id;
      doc.createdAt = new Date(data.created_at);
      doc._isNew = false;
    } else {
      const { error } = await db.from('users').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    // Sync wallets (full replace)
    await db.from('user_wallets').delete().eq('user_id', doc.id);
    if (doc.wallets.length > 0) {
      const { error } = await db.from('user_wallets').insert(doc.wallets.map(w => walletObjToRow(doc.id, w)));
      if (error) throw error;
    }
    // Sync notifications (full replace)
    await db.from('user_notifications').delete().eq('user_id', doc.id);
    if (doc.notifications.length > 0) {
      const { error } = await db.from('user_notifications').insert(doc.notifications.map(n => notifObjToRow(doc.id, n)));
      if (error) throw error;
    }
    // Sync refresh tokens (delta: insert new, delete removed)
    const original = doc._originalRefreshHashes || new Set();
    const current  = new Set((doc.refreshTokens || []).map(t => t.tokenHash));
    const removed  = [...original].filter(h => !current.has(h));
    const added    = (doc.refreshTokens || []).filter(t => !original.has(t.tokenHash));
    if (removed.length) await db.from('user_refresh_tokens').delete().in('token_hash', removed);
    if (added.length) {
      await db.from('user_refresh_tokens').insert(added.map(t => ({
        user_id: doc.id,
        token_hash: t.tokenHash,
        created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date().toISOString(),
        expires_at: t.expiresAt instanceof Date ? t.expiresAt.toISOString() : t.expiresAt,
      })));
    }
    doc._originalRefreshHashes = new Set((doc.refreshTokens || []).map(t => t.tokenHash));
    return doc;
  }

  static async findById(id) {
    if (!id) return null;
    return loadFull(String(id));
  }

  static async findOne(filter) {
    // Special case: nested refresh token lookup
    if (filter && filter['refreshTokens.tokenHash']) {
      const hash = filter['refreshTokens.tokenHash'];
      const db = getDb();
      const { data, error } = await db.from('user_refresh_tokens').select('user_id').eq('token_hash', hash).single();
      if (error || !data) return null;
      return loadFull(data.user_id);
    }
    const db = getDb();
    let q = db.from('users').select('*');
    q = applyFilter(q, filter);
    const { data, error } = await q.limit(1);
    if (error || !data || !data.length) return null;
    return loadFull(data[0].id);
  }

  static find(filter = {}) { return new UserQuery(filter); }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('users').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  static async updateMany(_filter, update) {
    // Only supports: { $pull: { refreshTokens: { tokenHash: hash } } }
    if (update && update.$pull && update.$pull.refreshTokens) {
      const hash = update.$pull.refreshTokens.tokenHash;
      if (hash) {
        const db = getDb();
        await db.from('user_refresh_tokens').delete().eq('token_hash', hash);
      }
    }
  }

  static async findByIdAndDelete(id) {
    const db = getDb();
    const { data } = await db.from('users').delete().eq('id', String(id)).select().single();
    return data;
  }

  static async findByIdAndUpdate(id, update, _opts) {
    const db = getDb();
    const row = {};
    const src = update.$set || update;
    if (src.recoveryStatus !== undefined) row.recovery_status = src.recoveryStatus;
    if (src.kycStatus      !== undefined) row.kyc_status      = src.kycStatus;
    if (src.role           !== undefined) row.role            = src.role;
    if (src.isAdmin        !== undefined) row.is_admin        = src.isAdmin;
    const { error } = await db.from('users').update(row).eq('id', String(id));
    if (error) throw error;
    return User.findById(id);
  }

  // Aggregate — handles specific pipelines used by admin.js
  static async aggregate(pipeline) {
    // Pattern 1: count total wallets → just count user_wallets rows
    const isWalletCount = JSON.stringify(pipeline).includes('walletCount');
    if (isWalletCount) {
      const db = getDb();
      const { count } = await db.from('user_wallets').select('*', { count: 'exact', head: true });
      return [{ total: count || 0 }];
    }
    // Pattern 2: user growth by day
    const match   = pipeline.find(s => s.$match);
    const group   = pipeline.find(s => s.$group);
    const db = getDb();
    if (group && group.$group && group.$group._id && typeof group.$group._id === 'object' && group.$group._id.$dateToString) {
      let q = db.from('users').select('created_at');
      if (match && match.$match && match.$match.createdAt) {
        const f = match.$match.createdAt;
        if (f.$gte) q = q.gte('created_at', dbVal(f.$gte));
      }
      const { data } = await q;
      if (!data) return [];
      const grouped = {};
      data.forEach(r => {
        const day = r.created_at.slice(0, 10);
        grouped[day] = (grouped[day] || 0) + 1;
      });
      return Object.entries(grouped)
        .map(([_id, count]) => ({ _id, count }))
        .sort((a, b) => a._id.localeCompare(b._id));
    }
    return [];
  }
}

module.exports = User;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Wallet.js
// ─────────────────────────────────────────────────────────────────────────────
const walletJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    userId: row.user_id,
    network: row.network || 'bitcoin',
    address: row.address,
    encryptedMnemonic: row.encrypted_mnemonic,
    encryptedSeed: row.encrypted_seed,
    createdByAdminId: row.created_by_admin_id,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    seedShownAt: row.seed_shown_at ? new Date(row.seed_shown_at) : null,
    revoked: row.revoked || false,
    _isNew: false,
  };
  doc.save = () => Wallet._save(doc);
  doc.toString = () => doc.id;
  return doc;
}

function docToRow(doc) {
  return {
    user_id: doc.userId,
    network: doc.network || 'bitcoin',
    address: doc.address,
    encrypted_mnemonic: doc.encryptedMnemonic || null,
    encrypted_seed: doc.encryptedSeed || null,
    created_by_admin_id: doc.createdByAdminId || null,
    seed_shown_at: doc.seedShownAt ? dbVal(doc.seedShownAt) : null,
    revoked: doc.revoked || false,
  };
}

class Wallet {
  constructor(data) {
    this._isNew = true;
    this._id = null; this.id = null;
    this.userId = data.userId || data.user_id;
    this.network = data.network || 'bitcoin';
    this.address = data.address;
    this.encryptedMnemonic = data.encryptedMnemonic || null;
    this.encryptedSeed = data.encryptedSeed || null;
    this.createdByAdminId = data.createdByAdminId || null;
    this.createdAt = new Date();
    this.seedShownAt = data.seedShownAt || null;
    this.revoked = data.revoked || false;
    this.save = () => Wallet._save(this);
    this.toString = () => this.id;
  }

  static async _save(doc) {
    const db = getDb();
    const row = docToRow(doc);
    if (doc._isNew) {
      const { data, error } = await db.from('wallets').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id;
      doc.createdAt = new Date(data.created_at);
      doc._isNew = false;
    } else {
      const { error } = await db.from('wallets').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static async findById(id) {
    const db = getDb();
    const { data, error } = await db.from('wallets').select('*').eq('id', String(id)).single();
    if (error || !data) return null;
    return rowToDoc(data);
  }

  static async findOne(filter) {
    const db = getDb();
    let q = db.from('wallets').select('*');
    q = applyFilter(q, filter);
    const { data, error } = await q.limit(1);
    if (error || !data || !data.length) return null;
    return rowToDoc(data[0]);
  }

  static async findOneAndUpdate(filter, update, _opts) {
    const db = getDb();
    let q = db.from('wallets').select('id');
    q = applyFilter(q, filter);
    const { data: rows } = await q.limit(1);
    if (!rows || !rows.length) return null;
    const id = rows[0].id;
    const updateData = update.$set || update;
    const row = {};
    if (updateData.seedShownAt !== undefined) row.seed_shown_at = dbVal(updateData.seedShownAt);
    if (updateData.revoked     !== undefined) row.revoked       = updateData.revoked;
    const { data, error } = await db.from('wallets').update(row).eq('id', id).select().single();
    if (error) throw error;
    return rowToDoc(data);
  }

  static find(filter = {}) {
    return {
      _filter: filter, _sort: null, _limit: null,
      sort(s) { this._sort = s; return this; },
      limit(n) { this._limit = parseInt(n, 10); return this; },
      async exec() {
        const db = getDb();
        let q = db.from('wallets').select('*');
        q = applyFilter(q, this._filter);
        q = applySort(q, this._sort);
        if (this._limit) q = q.limit(this._limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async deleteOne(filter) {
    const db = getDb();
    let q = db.from('wallets').delete();
    q = applyFilter(q, filter);
    const { error } = await q;
    if (error) throw error;
  }
}

module.exports = Wallet;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Transaction.js
// ─────────────────────────────────────────────────────────────────────────────
const transactionJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row, userRow) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    userId: userRow ? { _id: row.user_id, id: row.user_id, name: userRow.name, email: userRow.email } : row.user_id,
    type: row.type, cryptocurrency: row.cryptocurrency, amount: row.amount,
    fromAddress: row.from_address, toAddress: row.to_address, txHash: row.tx_hash,
    network: row.network || 'ethereum', status: row.status || 'pending',
    confirmations: row.confirmations || 0,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : null,
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : null,
    reorged: row.reorged || false,
    gasUsed: row.gas_used, gasFee: row.gas_fee, blockNumber: row.block_number,
    timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
    description: row.description || '', adminNote: row.admin_note || '',
    adminEdited: row.admin_edited || false,
    adminEditedAt: row.admin_edited_at ? new Date(row.admin_edited_at) : null,
    _isNew: false,
  };
  doc.save = () => Transaction._save(doc);
  doc.toString = () => doc.id;
  return doc;
}

function docToRow(doc) {
  const userId = typeof doc.userId === 'object' ? doc.userId.id || doc.userId._id : doc.userId;
  return {
    user_id: userId, type: doc.type, cryptocurrency: doc.cryptocurrency,
    amount: doc.amount, from_address: doc.fromAddress || null,
    to_address: doc.toAddress || null, tx_hash: doc.txHash || null,
    network: doc.network || 'ethereum', status: doc.status || 'pending',
    confirmations: doc.confirmations || 0,
    confirmed_at: doc.confirmedAt ? dbVal(doc.confirmedAt) : null,
    last_checked_at: doc.lastCheckedAt ? dbVal(doc.lastCheckedAt) : null,
    reorged: doc.reorged || false,
    gas_used: doc.gasUsed || null, gas_fee: doc.gasFee || null,
    block_number: doc.blockNumber || null,
    timestamp: doc.timestamp ? dbVal(doc.timestamp) : new Date().toISOString(),
    description: doc.description || '', admin_note: doc.adminNote || '',
    admin_edited: doc.adminEdited || false,
    admin_edited_at: doc.adminEditedAt ? dbVal(doc.adminEditedAt) : null,
  };
}

class TransactionQuery {
  constructor(filter) {
    this._filter = filter; this._sort = null; this._limit = null;
    this._skip = null; this._populateField = null;
  }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = parseInt(n, 10); return this; }
  skip(n) { this._skip = parseInt(n, 10); return this; }
  select(_f) { return this; }
  populate(field) { this._populateField = field; return this; }
  async exec() {
    const db = getDb();
    let q = db.from('transactions').select('*');
    q = applyFilter(q, this._filter);
    q = applySort(q, this._sort);
    if (this._limit) q = q.limit(this._limit);
    if (this._skip)  q = q.range(this._skip, this._skip + (this._limit || 1000) - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) return [];
    if (this._populateField === 'userId' || this._populateField) {
      const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
      const { data: users } = await db.from('users').select('id,name,email').in('id', userIds);
      const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
      return data.map(row => rowToDoc(row, userMap[row.user_id] || null));
    }
    return data.map(row => rowToDoc(row, null));
  }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
}

class Transaction {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.userId = data.userId; this.type = data.type;
    this.cryptocurrency = data.cryptocurrency || 'ETH';
    this.amount = data.amount; this.fromAddress = data.fromAddress || null;
    this.toAddress = data.toAddress || null; this.txHash = data.txHash || null;
    this.network = data.network || 'ethereum'; this.status = data.status || 'pending';
    this.confirmations = data.confirmations || 0;
    this.confirmedAt = null; this.lastCheckedAt = null; this.reorged = false;
    this.gasUsed = null; this.gasFee = null; this.blockNumber = null;
    this.timestamp = new Date(); this.description = data.description || '';
    this.adminNote = data.adminNote || ''; this.adminEdited = false; this.adminEditedAt = null;
    this.save = () => Transaction._save(this);
    this.toString = () => this.id;
  }

  static async _save(doc) {
    const db = getDb();
    const row = docToRow(doc);
    if (doc._isNew) {
      const { data, error } = await db.from('transactions').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id;
      doc._isNew = false;
    } else {
      const { error } = await db.from('transactions').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static async findById(id) {
    const db = getDb();
    const { data, error } = await db.from('transactions').select('*').eq('id', String(id)).single();
    if (error || !data) return null;
    return rowToDoc(data);
  }

  static async findOne(filter) {
    const db = getDb();
    let q = db.from('transactions').select('*');
    // remap _id → id
    const f = {};
    for (const [k, v] of Object.entries(filter)) f[k === '_id' ? 'id' : k] = v;
    q = applyFilter(q, f);
    const { data, error } = await q.limit(1);
    if (error || !data || !data.length) return null;
    return rowToDoc(data[0]);
  }

  static find(filter = {}) { return new TransactionQuery(filter); }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('transactions').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  static async deleteMany(filter) {
    const db = getDb();
    let q = db.from('transactions').delete();
    q = applyFilter(q, filter);
    const { error } = await q;
    if (error) throw error;
  }

  static async insertMany(docs) {
    const db = getDb();
    const rows = docs.map(d => docToRow(new Transaction(d)));
    const { error } = await db.from('transactions').insert(rows);
    if (error) throw error;
  }

  // Aggregate — handles specific pipelines used by admin.js
  static async aggregate(pipeline) {
    const db = getDb();
    const match  = pipeline.find(s => s.$match);
    const group  = pipeline.find(s => s.$group);
    const lim    = pipeline.find(s => s.$limit);
    const sr     = pipeline.find(s => s.$sort);
    if (!group) return [];
    let q = db.from('transactions').select('*');
    if (match && match.$match) {
      if (match.$match.timestamp) {
        const f = match.$match.timestamp;
        if (f.$gte) q = q.gte('timestamp', dbVal(f.$gte));
      }
      if (match.$match.status) {
        if (match.$match.status === 'completed') q = q.eq('status', 'completed');
        else q = q.eq('status', match.$match.status);
      }
    }
    const { data } = await q;
    if (!data) return [];
    // Group by day or cryptocurrency
    const gKey = group.$group._id;
    const grouped = {};
    data.forEach(row => {
      let key;
      if (typeof gKey === 'string' && gKey === '$cryptocurrency') key = row.cryptocurrency;
      else if (typeof gKey === 'object' && gKey.$dateToString) key = (row.timestamp || '').slice(0, 10);
      else key = row.cryptocurrency; // fallback
      if (!grouped[key]) grouped[key] = { _id: key, count: 0, totalAmount: 0 };
      grouped[key].count++;
      grouped[key].totalAmount += parseFloat(row.amount) || 0;
    });
    let result = Object.values(grouped);
    if (sr && sr.$sort && sr.$sort.count === -1) result.sort((a, b) => b.count - a.count);
    else result.sort((a, b) => (a._id || '').localeCompare(b._id || ''));
    if (lim) result = result.slice(0, lim.$limit);
    return result;
  }
}

module.exports = Transaction;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Balance.js
// ─────────────────────────────────────────────────────────────────────────────
const balanceJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    userId: row.user_id, walletAddress: row.wallet_address,
    cryptocurrency: row.cryptocurrency,
    balance: row.balance !== undefined ? parseFloat(row.balance) : 0,
    network: row.network || 'ethereum',
    lastUpdated: row.last_updated ? new Date(row.last_updated) : new Date(),
    _isNew: false,
  };
  doc.save = () => Balance._save(doc);
  return doc;
}

class Balance {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.userId = data.userId; this.walletAddress = data.walletAddress;
    this.cryptocurrency = data.cryptocurrency;
    this.balance = data.balance !== undefined ? data.balance : 0;
    this.network = data.network || 'ethereum';
    this.lastUpdated = new Date();
    this.save = () => Balance._save(this);
  }

  static async _save(doc) {
    const db = getDb();
    const row = {
      user_id: doc.userId, wallet_address: doc.walletAddress,
      cryptocurrency: doc.cryptocurrency, balance: doc.balance,
      network: doc.network || 'ethereum',
      last_updated: dbVal(doc.lastUpdated || new Date()),
    };
    if (doc._isNew) {
      const { data, error } = await db.from('balances').upsert(row, { onConflict: 'user_id,wallet_address,cryptocurrency' }).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id; doc._isNew = false;
    } else {
      const { error } = await db.from('balances').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static async findOne(filter) {
    const db = getDb();
    let q = db.from('balances').select('*');
    q = applyFilter(q, filter);
    const { data, error } = await q.limit(1);
    if (error || !data || !data.length) return null;
    return rowToDoc(data[0]);
  }

  static find(filter = {}) {
    const state = { _filter: filter, _sort: null, _limit: null };
    return {
      sort(s) { state._sort = s; return this; },
      limit(n) { state._limit = parseInt(n, 10); return this; },
      async exec() {
        const db = getDb();
        let q = db.from('balances').select('*');
        q = applyFilter(q, state._filter);
        q = applySort(q, state._sort);
        if (state._limit) q = q.limit(state._limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async deleteMany(filter) {
    const db = getDb();
    let q = db.from('balances').delete();
    q = applyFilter(q, filter);
    const { error } = await q;
    if (error) throw error;
  }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('balances').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }
}

module.exports = Balance;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Token.js
// ─────────────────────────────────────────────────────────────────────────────
const tokenJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    userId: row.user_id, walletAddress: row.wallet_address,
    contractAddress: row.contract_address, symbol: row.symbol, name: row.name,
    decimals: row.decimals !== undefined ? row.decimals : 18,
    balance: row.balance || '0', network: row.network || 'ethereum',
    isCustom: row.is_custom || false, logoUrl: row.logo_url || null,
    priceUsd: row.price_usd || null,
    lastUpdated: row.last_updated ? new Date(row.last_updated) : new Date(),
    _isNew: false,
  };
  doc.save = () => Token._save(doc);
  return doc;
}

class Token {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.userId = data.userId; this.walletAddress = data.walletAddress;
    this.contractAddress = data.contractAddress; this.symbol = data.symbol;
    this.name = data.name; this.decimals = data.decimals !== undefined ? data.decimals : 18;
    this.balance = data.balance || '0'; this.network = data.network || 'ethereum';
    this.isCustom = data.isCustom || false; this.logoUrl = data.logoUrl || null;
    this.priceUsd = data.priceUsd || null; this.lastUpdated = new Date();
    this.save = () => Token._save(this);
  }

  static async _save(doc) {
    const db = getDb();
    const lastUpdatedRaw = doc.lastUpdated;
    const lastUpdatedISO = typeof lastUpdatedRaw === 'number'
      ? new Date(lastUpdatedRaw).toISOString()
      : (lastUpdatedRaw instanceof Date ? lastUpdatedRaw.toISOString() : new Date().toISOString());
    const row = {
      user_id: doc.userId, wallet_address: doc.walletAddress,
      contract_address: doc.contractAddress, symbol: doc.symbol, name: doc.name,
      decimals: doc.decimals, balance: String(doc.balance), network: doc.network || 'ethereum',
      is_custom: doc.isCustom || false, logo_url: doc.logoUrl || null,
      price_usd: doc.priceUsd || null, last_updated: lastUpdatedISO,
    };
    if (doc._isNew) {
      const { data, error } = await db.from('tokens').upsert(row, { onConflict: 'user_id,wallet_address,contract_address' }).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id; doc._isNew = false;
    } else {
      const { error } = await db.from('tokens').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static find(filter = {}) {
    const state = { _filter: filter, _sort: null, _limit: null };
    return {
      sort(s) { state._sort = s; return this; },
      limit(n) { state._limit = parseInt(n, 10); return this; },
      async exec() {
        const db = getDb();
        let q = db.from('tokens').select('*');
        q = applyFilter(q, state._filter);
        q = applySort(q, state._sort);
        if (state._limit) q = q.limit(state._limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async findOne(filter) {
    const db = getDb();
    let q = db.from('tokens').select('*');
    q = applyFilter(q, filter);
    const { data, error } = await q.limit(1);
    if (error || !data || !data.length) return null;
    return rowToDoc(data[0]);
  }

  static async findById(id) {
    const db = getDb();
    const { data, error } = await db.from('tokens').select('*').eq('id', String(id)).single();
    if (error || !data) return null;
    return rowToDoc(data);
  }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('tokens').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  static async deleteMany(filter) {
    const db = getDb();
    let q = db.from('tokens').delete();
    q = applyFilter(q, filter);
    const { error } = await q;
    if (error) throw error;
  }
}

module.exports = Token;
`;

// ─────────────────────────────────────────────────────────────────────────────
// AuditLog.js
// ─────────────────────────────────────────────────────────────────────────────
const auditLogJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  return {
    _id: row.id, id: row.id,
    actorType: row.actor_type, actorId: row.actor_id,
    action: row.action, targetUserId: row.target_user_id,
    targetWalletId: row.target_wallet_id, network: row.network,
    ip: row.ip, userAgent: row.user_agent, success: row.success,
    details: row.details || {}, createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    // alias for auditLogger service compatibility
    timestamp: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

class AuditLog {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.actorType = data.actorType; this.actorId = data.actorId || null;
    this.action = data.action; this.targetUserId = data.targetUserId || null;
    this.targetWalletId = data.targetWalletId || null; this.network = data.network || null;
    this.ip = data.ip; this.userAgent = data.userAgent || null;
    this.success = data.success !== undefined ? data.success : true;
    this.details = data.details || {}; this.createdAt = new Date();
    this.save = () => AuditLog._save(this);
  }

  static async _save(doc) {
    const db = getDb();
    const row = {
      actor_type: doc.actorType,
      actor_id: doc.actorId ? String(doc.actorId) : null,
      action: doc.action,
      target_user_id: doc.targetUserId ? String(doc.targetUserId) : null,
      target_wallet_id: doc.targetWalletId ? String(doc.targetWalletId) : null,
      network: doc.network || null, ip: doc.ip, user_agent: doc.userAgent || null,
      success: doc.success !== undefined ? doc.success : true, details: doc.details || {},
    };
    if (doc._isNew) {
      const { data, error } = await db.from('audit_logs').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id; doc._isNew = false;
    } else {
      const { error } = await db.from('audit_logs').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static find(filter = {}) {
    const state = { _filter: filter, _sort: null, _limit: null };
    return {
      sort(s) { state._sort = s; return this; },
      limit(n) { state._limit = parseInt(n, 10); return this; },
      lean() { return this; },
      async exec() {
        const db = getDb();
        let q = db.from('audit_logs').select('*');
        q = applyFilter(q, state._filter);
        q = applySort(q, state._sort);
        if (state._limit) q = q.limit(state._limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('audit_logs').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  // MongoDB aggregate — handles market-analytics pipeline
  static async aggregate(pipeline) {
    const db = getDb();
    const match = pipeline.find(s => s.$match);
    let q = db.from('audit_logs').select('action,network');
    if (match && match.$match) {
      if (match.$match.createdAt && match.$match.createdAt.$gte)
        q = q.gte('created_at', dbVal(match.$match.createdAt.$gte));
      if (match.$match.action && match.$match.action.$in)
        q = q.in('action', match.$match.action.$in);
    }
    const { data } = await q;
    if (!data) return [];
    const grouped = {};
    data.forEach(row => {
      const key = row.action + '||' + (row.network || 'unknown');
      if (!grouped[key]) grouped[key] = { _id: { action: row.action, network: row.network }, count: 0 };
      grouped[key].count++;
    });
    return Object.values(grouped);
  }
}

module.exports = AuditLog;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Webhook.js
// ─────────────────────────────────────────────────────────────────────────────
const webhookJs = `'use strict';
const { getDb, applyFilter, applySort } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    url: row.url, secret: row.secret,
    events: row.events || [], isActive: row.is_active,
    createdBy: row.created_by, createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    _isNew: false,
  };
  doc.save = () => Webhook._save(doc);
  return doc;
}

class Webhook {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.url = data.url; this.secret = data.secret;
    this.events = data.events || []; this.isActive = data.isActive !== false;
    this.createdBy = data.createdBy || null; this.createdAt = new Date();
    this.save = () => Webhook._save(this);
  }

  static async _save(doc) {
    const db = getDb();
    const row = {
      url: doc.url, secret: doc.secret, events: doc.events || [],
      is_active: doc.isActive !== false, created_by: doc.createdBy || null,
    };
    if (doc._isNew) {
      const { data, error } = await db.from('webhooks').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id;
      doc.createdAt = new Date(data.created_at); doc._isNew = false;
    } else {
      const { error } = await db.from('webhooks').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static async findById(id) {
    const db = getDb();
    const { data, error } = await db.from('webhooks').select('*').eq('id', String(id)).single();
    if (error || !data) return null;
    return rowToDoc(data);
  }

  static find(filter = {}) {
    const state = { _filter: filter, _sort: null };
    return {
      sort(s) { state._sort = s; return this; },
      async exec() {
        const db = getDb();
        let q = db.from('webhooks').select('*');
        // Handle array-contains: { isActive: true, events: 'some-event' }
        const pureFilter = {};
        for (const [k, v] of Object.entries(state._filter)) {
          if (k === 'events' && typeof v === 'string') {
            q = q.contains('events', [v]);
          } else { pureFilter[k] = v; }
        }
        q = applyFilter(q, pureFilter);
        q = applySort(q, state._sort);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async deleteOne(filter) {
    const db = getDb();
    let q = db.from('webhooks').delete();
    // Handle _id → id
    const f = {};
    for (const [k, v] of Object.entries(filter)) f[k === '_id' ? 'id' : k] = v;
    q = applyFilter(q, f);
    const { error } = await q;
    if (error) throw error;
  }
}

module.exports = Webhook;
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebhookEvent.js
// ─────────────────────────────────────────────────────────────────────────────
const webhookEventJs = `'use strict';
const { getDb, applyFilter, applySort, dbVal } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  const doc = {
    _id: row.id, id: row.id,
    webhookId: row.webhook_id, eventType: row.event_type,
    payload: row.payload || {}, status: row.status || 'pending',
    attempts: row.attempts || 0,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : new Date(),
    lastError: row.last_error || null,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    _isNew: false,
  };
  doc.save = () => WebhookEvent._save(doc);
  return doc;
}

class WebhookEvent {
  constructor(data) {
    this._isNew = true; this._id = null; this.id = null;
    this.webhookId = data.webhookId; this.eventType = data.eventType;
    this.payload = data.payload || {}; this.status = data.status || 'pending';
    this.attempts = data.attempts || 0;
    this.nextAttemptAt = data.nextAttemptAt || new Date();
    this.lastError = data.lastError || null; this.createdAt = new Date();
    this.save = () => WebhookEvent._save(this);
  }

  static async _save(doc) {
    const db = getDb();
    const row = {
      webhook_id: doc.webhookId, event_type: doc.eventType,
      payload: doc.payload || {}, status: doc.status || 'pending',
      attempts: doc.attempts || 0,
      next_attempt_at: dbVal(doc.nextAttemptAt || new Date()),
      last_error: doc.lastError || null,
    };
    if (doc._isNew) {
      const { data, error } = await db.from('webhook_events').insert(row).select().single();
      if (error) throw error;
      doc._id = data.id; doc.id = data.id; doc._isNew = false;
    } else {
      const { error } = await db.from('webhook_events').update(row).eq('id', doc.id);
      if (error) throw error;
    }
    return doc;
  }

  static find(filter = {}) {
    const state = { _filter: filter, _sort: null, _limit: null };
    return {
      sort(s) { state._sort = s; return this; },
      limit(n) { state._limit = parseInt(n, 10); return this; },
      async exec() {
        const db = getDb();
        let q = db.from('webhook_events').select('*');
        q = applyFilter(q, state._filter);
        q = applySort(q, state._sort);
        if (state._limit) q = q.limit(state._limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToDoc);
      },
      then(resolve, reject) { return this.exec().then(resolve, reject); },
      catch(reject) { return this.exec().catch(reject); },
    };
  }

  static async insertMany(docs) {
    const db = getDb();
    const rows = docs.map(d => ({
      webhook_id: d.webhookId, event_type: d.eventType,
      payload: d.payload || {}, status: d.status || 'pending',
      attempts: d.attempts || 0,
      next_attempt_at: dbVal(d.nextAttemptAt || new Date()),
      last_error: d.lastError || null,
    }));
    const { error } = await db.from('webhook_events').insert(rows);
    if (error) throw error;
  }

  static async countDocuments(filter = {}) {
    const db = getDb();
    let q = db.from('webhook_events').select('*', { count: 'exact', head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }
}

module.exports = WebhookEvent;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Write all files
// ─────────────────────────────────────────────────────────────────────────────
const files = {
  [path.join(modelsDir, 'db.js')]: dbJs,
  [path.join(modelsDir, 'User.js')]: userJs,
  [path.join(modelsDir, 'Wallet.js')]: walletJs,
  [path.join(modelsDir, 'Transaction.js')]: transactionJs,
  [path.join(modelsDir, 'Balance.js')]: balanceJs,
  [path.join(modelsDir, 'Token.js')]: tokenJs,
  [path.join(modelsDir, 'AuditLog.js')]: auditLogJs,
  [path.join(modelsDir, 'Webhook.js')]: webhookJs,
  [path.join(modelsDir, 'WebhookEvent.js')]: webhookEventJs,
};

for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Written:', path.relative(root, filePath));
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch configLoader.js — remove MONGODB_URI from required list
// ─────────────────────────────────────────────────────────────────────────────
const configLoaderPath = path.join(backendDir, 'core', 'configLoader.js');
let configLoader = fs.readFileSync(configLoaderPath, 'utf8');
configLoader = configLoader.replace(
  "const required = ['JWT_SECRET', 'MONGODB_URI'];",
  "const required = ['JWT_SECRET'];"
);
configLoader = configLoader.replace(
  "connections: this.getConnections(),",
  "// connections removed — using Supabase, no MongoDB\n      // connections: this.getConnections(),"
);
fs.writeFileSync(configLoaderPath, configLoader, 'utf8');
console.log('Patched: configLoader.js');

// ─────────────────────────────────────────────────────────────────────────────
// Patch secretsManager.js — remove MONGODB_URI as required secret
// ─────────────────────────────────────────────────────────────────────────────
const secretsMgrPath = path.join(backendDir, 'services', 'secretsManager.js');
let secretsMgr = fs.readFileSync(secretsMgrPath, 'utf8');
secretsMgr = secretsMgr.replace(
  "{ name: 'MONGODB_URI', env: 'MONGODB_URI', required: true },",
  "{ name: 'MONGODB_URI', env: 'MONGODB_URI', required: false },"
);
fs.writeFileSync(secretsMgrPath, secretsMgr, 'utf8');
console.log('Patched: secretsManager.js');

console.log('\nAll files written. Now run the server.js patch manually or check the output above.');
console.log('Important: run backend/scripts/supabase-schema.sql in your Supabase SQL Editor.');
