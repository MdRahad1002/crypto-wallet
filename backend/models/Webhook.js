'use strict';
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
