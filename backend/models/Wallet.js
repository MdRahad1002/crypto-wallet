'use strict';
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
