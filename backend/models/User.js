'use strict';
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

// ── Chainable wrapper for findById (supports .select(), .lean(), .populate()) ──
class FindByIdQuery {
  constructor(id) { this._id = id; }
  select() { return this; }  // no-op — password excluded by DTO layer
  lean()   { return this; }  // no-op — always plain objects
  populate() { return this; } // no-op
  _resolve() { return this._id ? loadFull(this._id) : Promise.resolve(null); }
  then(resolve, reject) { return this._resolve().then(resolve, reject); }
  catch(reject) { return this._resolve().catch(reject); }
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

  static findById(id) {
    if (!id) return new FindByIdQuery(null);
    return new FindByIdQuery(String(id));
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
