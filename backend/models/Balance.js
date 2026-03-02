'use strict';
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
