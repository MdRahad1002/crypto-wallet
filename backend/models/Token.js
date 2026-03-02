'use strict';
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
