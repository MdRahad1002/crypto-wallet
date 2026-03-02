'use strict';
const { getDb } = require('./db');

function rowToDoc(row) {
  if (!row) return null;
  return {
    _id: row.id, id: row.id,
    userId: row.user_id,
    name:   row.name,
    email:  row.email,
    subject: row.subject,
    message: row.message,
    status:  row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

const SupportTicket = {
  async create({ userId, name, email, subject, message }) {
    const db = getDb();
    const { data, error } = await db
      .from('support_tickets')
      .insert({ user_id: userId ? String(userId) : null, name: name || '', email: email || '', subject, message })
      .select()
      .single();
    if (error) throw error;
    return rowToDoc(data);
  },

  async find(filter = {}, { sort = { createdAt: -1 }, limit = 200 } = {}) {
    const db = getDb();
    let q = db.from('support_tickets').select('*');
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.userId) q = q.eq('user_id', String(filter.userId));
    q = q.order('created_at', { ascending: sort.createdAt === 1 });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(rowToDoc);
  },

  async findByIdAndUpdate(id, updates) {
    const db = getDb();
    const row = {};
    if (updates.status    !== undefined) row.status     = updates.status;
    if (updates.adminNote !== undefined) row.admin_note = updates.adminNote;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('support_tickets')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToDoc(data);
  },
};

module.exports = SupportTicket;

