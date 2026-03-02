'use strict';
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
