'use strict';
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
  lean()      { return this; } // no-op
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

  static async create(data) {
    const doc = new Transaction(data);
    return Transaction._save(doc);
  }

  static async insertMany(docs, _options = {}) {
    if (!docs || docs.length === 0) return [];
    const db = getDb();
    const rows = docs.map(d => docToRow(new Transaction(d)));
    const { data, error } = await db.from('transactions').insert(rows).select();
    if (error) throw error;
    return data || [];
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
