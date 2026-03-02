import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supportAPI } from '../services/api';
import Icon from './Icon';

const SUBJECTS = [
  'Withdrawal issue',
  'Deposit not received',
  'KYC verification',
  'Account access',
  'Transaction question',
  'Security concern',
  'Other',
];

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: '#4a9eff', bg: 'rgba(74,158,255,0.12)' },
  in_progress: { label: 'In Progress', color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)' },
  resolved:    { label: 'Resolved',    color: '#34c759', bg: 'rgba(52,199,89,0.12)'  },
  closed:      { label: 'Closed',      color: '#8e8e93', bg: 'rgba(142,142,147,0.12)' },
};

function SupportPage() {
  const navigate = useNavigate();

  // ── tab state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'cases'

  // ── new ticket form ───────────────────────────────────────
  const [form, setForm] = useState({ subject: '', customSubject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  // ── my cases ─────────────────────────────────────────────
  const [tickets, setTickets]       = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError]     = useState(null);
  const [ticketsFetched, setTicketsFetched] = useState(false);

  const subjectValue = form.subject === 'Other' ? form.customSubject : form.subject;

  // fetch tickets when switching to the cases tab
  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const res = await supportAPI.getMyTickets();
      setTickets(res.data?.tickets || []);
      setTicketsFetched(true);
    } catch (err) {
      setTicketsError(err.response?.data?.message || 'Failed to load tickets.');
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'cases' && !ticketsFetched) {
      fetchTickets();
    }
  }, [activeTab, ticketsFetched, fetchTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject) return setResult({ ok: false, text: 'Please select a subject.' });
    if (form.subject === 'Other' && !form.customSubject.trim())
      return setResult({ ok: false, text: 'Please describe your subject.' });
    if (!form.message.trim()) return setResult({ ok: false, text: 'Message is required.' });

    setLoading(true);
    setResult(null);
    try {
      await supportAPI.submit({ subject: subjectValue.trim(), message: form.message.trim() });
      setResult({ ok: true, text: 'Your message has been sent. Our team will respond shortly.' });
      setForm({ subject: '', customSubject: '', message: '' });
      // invalidate case list so it refreshes next time
      setTicketsFetched(false);
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || 'Failed to send. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // ── tab bar ──────────────────────────────────────────────
  const TabBar = () => (
    <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
      {[
        { id: 'new',   label: '✉️ New Ticket' },
        { id: 'cases', label: '📋 My Cases'   },
      ].map(({ id, label }) => (
        <button
          key={id}
          onClick={() => { setActiveTab(id); if (id === 'new') setResult(null); }}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === id ? '2.5px solid var(--primary-blue)' : '2.5px solid transparent',
            color: activeTab === id ? 'var(--primary-blue)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: activeTab === id ? 700 : 500,
            fontSize: '0.9rem',
            marginBottom: -2,
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rw-theme rw-page rw-recover">
      <div className="rw-recover-container" style={{ maxWidth: 580 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: 0 }}
        >
          ← Back to Dashboard
        </button>

        <div className="rw-recover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(74,158,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="infoCircle" size={28} color="#4a9eff" />
            </div>
          </div>
          <h1>Support</h1>
          <p className="rw-muted" style={{ textAlign: 'center', marginTop: 4 }}>24/7 recovery assistance for critical cases</p>
        </div>

        <div className="rw-recover-box">
          <TabBar />

          {/* ── NEW TICKET TAB ─────────────────────────────── */}
          {activeTab === 'new' && (
            <>
              {result?.ok ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h2 style={{ marginBottom: 8 }}>Message Sent</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{result.text}</p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button className="rw-btn rw-btn-secondary" style={{ flex: 1 }} onClick={() => setResult(null)}>
                      New Ticket
                    </button>
                    <button className="rw-btn rw-btn-primary" style={{ flex: 1 }} onClick={() => { setActiveTab('cases'); setTicketsFetched(false); }}>
                      View My Cases
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {result && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,68,68,0.3)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {result.text}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select
                      className="form-input form-select"
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value, customSubject: '' }))}
                      required
                    >
                      <option value="">Select a topic…</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {form.subject === 'Other' && (
                    <div className="form-group">
                      <label className="form-label">Describe your topic</label>
                      <input
                        className="form-input"
                        type="text"
                        maxLength={120}
                        placeholder="Brief subject"
                        value={form.customSubject}
                        onChange={e => setForm(f => ({ ...f, customSubject: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Message</label>
                    <textarea
                      className="form-input"
                      rows={6}
                      maxLength={2000}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      placeholder="Describe your issue in detail…"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      required
                    />
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                      {form.message.length}/2000
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="rw-btn rw-btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/dashboard')} disabled={loading}>
                      Cancel
                    </button>
                    <button type="submit" className="rw-btn rw-btn-primary" style={{ flex: 1 }} disabled={loading}>
                      {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</> : 'Send Message'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ── MY CASES TAB ───────────────────────────────── */}
          {activeTab === 'cases' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  className="rw-btn rw-btn-secondary"
                  style={{ padding: '4px 14px', fontSize: '0.82rem' }}
                  onClick={() => { setTicketsFetched(false); fetchTickets(); }}
                  disabled={ticketsLoading}
                >
                  {ticketsLoading ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>

              {ticketsLoading && (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
                  Loading your cases…
                </div>
              )}

              {ticketsError && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,68,68,0.3)', fontSize: '0.9rem' }}>
                  {ticketsError}
                </div>
              )}

              {!ticketsLoading && !ticketsError && tickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <p style={{ marginBottom: 16 }}>You haven't submitted any support tickets yet.</p>
                  <button className="rw-btn rw-btn-primary" style={{ padding: '8px 24px' }} onClick={() => setActiveTab('new')}>
                    Open a Ticket
                  </button>
                </div>
              )}

              {!ticketsLoading && tickets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {tickets.map((ticket) => {
                    const tid = ticket._id || ticket.id;
                    const statusKey = ticket.status || 'open';
                    const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.open;
                    const createdAt = ticket.createdAt || ticket.created_at;
                    const adminNote = ticket.adminNote || ticket.admin_note;
                    return (
                      <div
                        key={tid}
                        style={{
                          background: 'var(--bg-soft)',
                          border: '1px solid var(--border)',
                          borderRadius: 14,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {/* header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ticket.subject}</span>
                          <span style={{
                            padding: '3px 11px',
                            borderRadius: 20,
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            background: sc.bg,
                            color: sc.color,
                          }}>
                            {sc.label}
                          </span>
                        </div>

                        {/* date */}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {createdAt ? new Date(createdAt).toLocaleString() : '—'}
                        </div>

                        {/* user message */}
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>
                          {ticket.message}
                        </div>

                        {/* admin reply */}
                        {adminNote && (
                          <div style={{
                            marginTop: 6,
                            padding: '10px 13px',
                            borderRadius: 10,
                            background: 'rgba(74,158,255,0.07)',
                            border: '1px solid rgba(74,158,255,0.2)',
                          }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-blue)', marginBottom: 4 }}>
                              💬 Support Response
                            </div>
                            <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {adminNote}
                            </div>
                          </div>
                        )}

                        {/* no reply yet indicator */}
                        {!adminNote && statusKey !== 'resolved' && statusKey !== 'closed' && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            ⏳ Awaiting support response…
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportPage;
