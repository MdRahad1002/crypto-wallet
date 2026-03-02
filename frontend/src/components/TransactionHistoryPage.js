import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { transactionAPI } from '../services/api';
import ExportTransactions from './ExportTransactions';
import Icon from './Icon';
import { blockExplorerUrl } from '../utils/sanitizeUrl';

const PAGE_SIZE = 20;

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || '-';
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

function TxIcon({ type }) {
  const isSend = type === 'send' || type === 'withdraw';
  return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
      background: isSend
        ? 'linear-gradient(135deg, rgba(231,76,60,0.2) 0%, rgba(231,76,60,0.1) 100%)'
        : 'linear-gradient(135deg, rgba(39,174,96,0.2) 0%, rgba(39,174,96,0.1) 100%)',
      border: `2px solid ${isSend ? 'rgba(231,76,60,0.3)' : 'rgba(39,174,96,0.3)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
    }}>
      <span style={{
        color: isSend ? 'var(--transaction-sent)' : 'var(--transaction-received)',
        display: 'block', fontWeight: 'bold',
        transform: isSend ? 'rotate(45deg)' : 'rotate(135deg)',
      }}>{String.fromCharCode(0x2197)}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    confirmed: { color: '#27ae60', bg: 'rgba(39,174,96,0.12)',  label: 'Confirmed' },
    completed:  { color: '#27ae60', bg: 'rgba(39,174,96,0.12)', label: 'Completed' },
    pending:   { color: '#f39c12', bg: 'rgba(243,156,18,0.12)', label: 'Pending'   },
    failed:    { color: '#e74c3c', bg: 'rgba(231,76,60,0.12)',  label: 'Failed'    },
  };
  const s = map[status] || { color: 'var(--text-secondary)', bg: 'rgba(128,128,128,0.1)', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.3px',
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function TransactionHistoryPage() {
  const [txs, setTxs]         = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [showExport, setShowExport]     = useState(false);
  const [expandedId, setExpandedId]     = useState(null);

  const load = useCallback(async (p, type, status) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: PAGE_SIZE, skip: p * PAGE_SIZE };
      if (type)   params.type   = type;
      if (status) params.status = status;
      const { data } = await transactionAPI.getHistory(params);
      setTxs(data.transactions || []);
      setTotal(data.total || 0);
    } catch (_) {
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    load(0, typeFilter, statusFilter);
  }, [typeFilter, statusFilter, load]);

  const handlePageChange = (p) => {
    setPage(p);
    load(p, typeFilter, statusFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim().toLowerCase());
  };

  const displayed = search
    ? txs.filter(tx =>
        (tx.txHash      && tx.txHash.toLowerCase().includes(search)) ||
        (tx.fromAddress && tx.fromAddress.toLowerCase().includes(search)) ||
        (tx.toAddress   && tx.toAddress.toLowerCase().includes(search)) ||
        (tx.cryptocurrency && tx.cryptocurrency.toLowerCase().includes(search))
      )
    : txs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="dashboard" style={{ animation: 'fadeInUp 0.6s ease-out' }}>

      {/* Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0.85rem', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', transition: 'background 0.2s' }}>
          <Icon name="chevronLeft" size={16} />
          Dashboard
        </Link>
      </div>

      {/* Page header */}
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '2.75rem', color: 'white', fontWeight: 900, letterSpacing: '-1.5px', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '0.5rem' }}>
            Transaction History
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
            {total} transaction{total !== 1 ? 's' : ''} total
          </p>
        </div>
        {txs.length > 0 && (
          <div className="dashboard-actions">
            <button className="btn btn-secondary" onClick={() => setShowExport(true)}>
              <Icon name="upload" size={18} /> Export
            </button>
          </div>
        )}
      </div>

      {/* Filters card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filter:
          </label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '0.55rem 1rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All types</option>
            <option value="receive">Received</option>
            <option value="send">Sent</option>
            <option value="withdraw">Withdraw</option>
            <option value="deposit">Deposit</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.55rem 1rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <input type="text" placeholder="Hash, address, coin..."
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(''); }}
              style={{ padding: '0.55rem 1rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', minWidth: 200, outline: 'none' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem' }}>
              <Icon name="search" size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }}>&#9203;</div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading transactions...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(231,76,60,0.3)' }}>
          <div style={{ marginBottom: '0.75rem' }}><Icon name="alertCircle" size={48} color="var(--danger)" /></div>
          <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>{error}</p>
          <button className="btn btn-danger" onClick={() => load(page, typeFilter, statusFilter)}>Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayed.length === 0 && (
        <div className="transaction-list">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', animation: 'bounce 2s ease-in-out infinite' }}>
              <Icon name="repeat" size={64} color="var(--primary-blue)" />
            </div>
            <div className="empty-state-title">No transactions found</div>
            <div className="empty-state-text">
              {search || typeFilter || statusFilter
                ? 'Try adjusting your filters or search query.'
                : 'Your transaction history will appear here once you start sending or receiving crypto.'}
            </div>
          </div>
        </div>
      )}

      {/* Transaction list */}
      {!loading && !error && displayed.length > 0 && (
        <div className="transaction-list" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
          <div className="transaction-list-header">
            <h2 className="transaction-list-title" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Transactions
            </h2>
            <span style={{ background: 'rgba(102,126,234,0.1)', color: 'var(--primary-blue)', padding: '0.5rem 1rem', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.3px', animation: 'pulse 2s ease-in-out infinite' }}>
              {total} total
            </span>
          </div>

          {displayed.map((tx) => {
            const isSend   = tx.type === 'send' || tx.type === 'withdraw';
            const expanded = expandedId === tx._id;
            return (
              <div key={tx._id}>
                <div className="transaction-item" onClick={() => setExpandedId(expanded ? null : tx._id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <TxIcon type={tx.type} />
                    <div className="transaction-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="transaction-type">
                          {tx.type === 'receive' ? 'Received' : tx.type === 'send' ? 'Sent' : tx.type === 'withdraw' ? 'Withdrew' : tx.type}
                        </span>
                        <StatusBadge status={tx.status} />
                        <span style={{ background: 'rgba(102,126,234,0.1)', color: 'var(--primary-blue)', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>
                          {tx.cryptocurrency || '-'}
                        </span>
                      </div>
                      <div className="transaction-date">{formatDate(tx.timestamp)}</div>
                      {tx.txHash && (
                        <div className="transaction-hash">{tx.txHash.slice(0, 16)}...</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className={'transaction-amount ' + (isSend ? 'negative' : 'positive')}>
                        {isSend ? '- ' : '+ '}
                        {parseFloat(tx.amount || 0).toFixed(6).replace(/\.?0+$/, '') || '0'}
                      </div>
                    </div>
                    <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} color="var(--text-secondary)" />
                  </div>
                </div>

                {expanded && (
                  <div onClick={e => e.stopPropagation()} style={{
                    padding: '1.25rem 1.5rem', marginBottom: '0.5rem',
                    background: 'rgba(102,126,234,0.04)',
                    border: '1px solid var(--border-color)', borderRadius: 16,
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem 1.5rem', animation: 'fadeInUp 0.3s ease-out',
                  }}>
                    {[
                      ['Network',       tx.network       || '-'],
                      ['Block',         String(tx.blockNumber || '-')],
                      ['Confirmations', tx.confirmations != null ? String(tx.confirmations) : '-'],
                      ['From', tx.fromAddress ? shortAddr(tx.fromAddress) : '-'],
                      ['To',   tx.toAddress   ? shortAddr(tx.toAddress)   : '-'],
                      ['Description', tx.description || '-'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', fontFamily: label === 'From' || label === 'To' ? "'SF Mono','Courier New',monospace" : 'inherit' }}>
                          {val}
                        </div>
                      </div>
                    ))}
                    {tx.txHash && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                          Transaction Hash
                        </div>
                        <button
                          onClick={() => {
                            const safeUrl = blockExplorerUrl(tx.network, tx.txHash);
                            if (safeUrl !== '#') window.open(safeUrl, '_blank', 'noopener,noreferrer');
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-blue)', fontFamily: "'SF Mono','Courier New',monospace", fontSize: '0.82rem', wordBreak: 'break-all', textAlign: 'left' }}>
                          {tx.txHash}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" disabled={page === 0} onClick={() => handlePageChange(page - 1)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2)
            .reduce((acc, i, idx, arr) => { if (idx > 0 && i - arr[idx - 1] > 1) acc.push('gap'); acc.push(i); return acc; }, [])
            .map((item, idx) =>
              item === 'gap' ? (
                <span key={'gap-' + idx} style={{ padding: '0 0.25rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>...</span>
              ) : (
                <button key={item} onClick={() => handlePageChange(item)}
                  className={item === page ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', minWidth: 40 }}>
                  {item + 1}
                </button>
              )
            )}
          <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => handlePageChange(page + 1)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
            Next
          </button>
        </div>
      )}

      {showExport && (
        <ExportTransactions transactions={displayed} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
