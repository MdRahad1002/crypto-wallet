'use strict';
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
