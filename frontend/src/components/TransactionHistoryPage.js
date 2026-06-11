import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { transactionAPI, pricesAPI } from '../services/api';
import ExportTransactions from './ExportTransactions';
import Icon from './Icon';
import { blockExplorerUrl } from '../utils/sanitizeUrl';

const PAGE_SIZE = 20;

function formatDate(ts, lng) {
  if (!ts) return '-';
  // normalizePrimitive may have converted the numeric ms timestamp to a string
  // ("1709123456000"). new Date(string-of-digits) returns Invalid Date in most
  // browsers — parse it as a number first.
  const numeric = Number(ts);
  const d = new Date(Number.isFinite(numeric) && numeric > 0 ? numeric : ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString(lng === 'de' ? 'de-DE' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || '-';
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

const PRICE_KEY = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether',
  MATIC: 'matic-network', BNB: 'binancecoin', WBTC: 'bitcoin',
};

function toUsd(amount, crypto, prices) {
  const key = PRICE_KEY[String(crypto || '').toUpperCase()] || String(crypto || '').toLowerCase();
  const rate = prices?.[key]?.usd;
  if (!rate || !amount) return null;
  const val = Number(amount) * rate;
  if (!Number.isFinite(val) || val <= 0) return null;
  return val < 0.01
    ? '< $0.01'
    : '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function normalizePrimitive(value, fallback = '-') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.length ? normalizePrimitive(value[0], fallback) : fallback;
  if (typeof value === 'object') {
    if ('status' in value && (typeof value.status === 'string' || typeof value.status === 'number' || typeof value.status === 'boolean')) {
      return String(value.status);
    }
    if ('confirmed' in value) {
      const c = value.confirmed;
      if (typeof c === 'boolean') return c ? 'confirmed' : 'pending';
      if (typeof c === 'string') return c.toLowerCase() === 'true' ? 'confirmed' : 'pending';
    }
    if ('value' in value && (typeof value.value === 'string' || typeof value.value === 'number')) {
      return String(value.value);
    }
    if ('symbol' in value && typeof value.symbol === 'string') {
      return value.symbol;
    }
    // Critical: never let unknown objects reach JSX
    return fallback;
  }
  return fallback;
}

function normalizeTx(tx) {
  const type = normalizePrimitive(tx?.type, 'transaction').toLowerCase();
  const status = normalizePrimitive(tx?.status, 'pending').toLowerCase();
  const cryptocurrency = normalizePrimitive(tx?.cryptocurrency, '-');
  const network = normalizePrimitive(tx?.network, '-');
  return {
    ...tx,
    type,
    status,
    cryptocurrency,
    network,
    txHash: normalizePrimitive(tx?.txHash, ''),
    fromAddress: normalizePrimitive(tx?.fromAddress, ''),
    toAddress: normalizePrimitive(tx?.toAddress, ''),
    amount: Number(tx?.amount || 0),
    confirmations: tx?.confirmations != null ? Number(tx.confirmations) : null,
  };
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const safeStatus = normalizePrimitive(status, 'pending').toLowerCase();
  const map = {
    confirmed: { color: '#27ae60', bg: 'rgba(39,174,96,0.12)',  label: t('transactions.confirmed') },
    completed: { color: '#27ae60', bg: 'rgba(39,174,96,0.12)',  label: t('transactions.completed') },
    pending:   { color: '#f39c12', bg: 'rgba(243,156,18,0.12)', label: t('transactions.pending') },
    failed:    { color: '#e74c3c', bg: 'rgba(231,76,60,0.12)',  label: t('transactions.failed') },
  };
  const s = map[safeStatus] || { color: 'var(--text-secondary)', bg: 'rgba(128,128,128,0.1)', label: safeStatus };
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
  const { t, i18n } = useTranslation();
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
  
  // Real-time polling states
  const [lastUpdated, setLastUpdated]   = useState(new Date());
  const [autoRefresh, setAutoRefresh]   = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const latestRequestRef = useRef(0);

  const [prices, setPrices] = useState({});
  useEffect(() => {
    pricesAPI.getLivePrices()
      .then(({ data }) => setPrices(data || {}))
      .catch(() => {});
  }, []);

  const makeStableTxId = useCallback((tx, idx = 0) => {
    const hash = normalizePrimitive(tx?.txHash, '').trim().toLowerCase();
    if (hash) return `h:${hash}`;
    const id = normalizePrimitive(tx?._id, '').trim();
    if (id) return `i:${id}`;
    const ts = normalizePrimitive(tx?.timestamp, '0');
    const net = normalizePrimitive(tx?.network, '-').toLowerCase();
    const from = normalizePrimitive(tx?.fromAddress, '-').toLowerCase();
    const to = normalizePrimitive(tx?.toAddress, '-').toLowerCase();
    const amt = Number(tx?.amount || 0);
    const type = normalizePrimitive(tx?.type, 'transaction').toLowerCase();
    return `f:${net}|${type}|${ts}|${from}|${to}|${amt}|${idx}`;
  }, []);

  const load = useCallback(async (p, type, status, isAutoRefresh = false) => {
    const requestId = ++latestRequestRef.current;
    if (!isAutoRefresh) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const params = { limit: PAGE_SIZE, skip: p * PAGE_SIZE };
      if (type)   params.type   = type;
      if (status) params.status = status;
      const { data } = await transactionAPI.getLiveHistory(params);
      if (requestId !== latestRequestRef.current) return;

      const normalized = (data.transactions || []).map((tx, idx) => {
        const safe = normalizeTx(tx);
        return {
          ...safe,
          stableId: makeStableTxId(safe, idx),
        };
      });

      setTxs(normalized);
      setTotal(Number(data.total || 0));
      setLastUpdated(new Date());
    } catch (_) {
      if (requestId === latestRequestRef.current && !isAutoRefresh) {
        setError(t('transactions.loadFailed'));
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t, makeStableTxId]);

  // Initial load and real-time polling setup
  useEffect(() => {
    setPage(0);
    load(0, typeFilter, statusFilter, false);
  }, [typeFilter, statusFilter, load]);

  // Real-time polling effect
  useEffect(() => {
    if (!autoRefresh) return;

    const pollInterval = setInterval(() => {
      load(page, typeFilter, statusFilter, true);
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [autoRefresh, page, typeFilter, statusFilter, load]);

  const handlePageChange = (p) => {
    setPage(p);
    load(p, typeFilter, statusFilter, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleManualRefresh = () => {
    load(page, typeFilter, statusFilter, false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim().toLowerCase());
  };

  const displayed = useMemo(() => {
    const base = search
      ? txs.filter(tx =>
          (normalizePrimitive(tx.txHash, '').toLowerCase().includes(search)) ||
          (normalizePrimitive(tx.fromAddress, '').toLowerCase().includes(search)) ||
          (normalizePrimitive(tx.toAddress, '').toLowerCase().includes(search)) ||
          (normalizePrimitive(tx.cryptocurrency, '').toLowerCase().includes(search))
        )
      : txs;

    return base.map((tx, idx) => ({
      ...tx,
      _id: normalizePrimitive(tx?.stableId, makeStableTxId(tx, idx)),
      txHash: normalizePrimitive(tx?.txHash, ''),
      fromAddress: normalizePrimitive(tx?.fromAddress, ''),
      toAddress: normalizePrimitive(tx?.toAddress, ''),
      network: normalizePrimitive(tx?.network, '-'),
      cryptocurrency: normalizePrimitive(tx?.cryptocurrency, '-'),
      timestamp: normalizePrimitive(tx?.timestamp, ''),
      blockNumber: normalizePrimitive(tx?.blockNumber, normalizePrimitive(tx?.block_height, '-')),
      confirmations: normalizePrimitive(tx?.confirmations, '-'),
      amount: Number(tx?.amount || 0),
      status: normalizePrimitive(tx?.status, 'pending').toLowerCase(),
      type: normalizePrimitive(tx?.type, 'transaction').toLowerCase(),
    }));
  }, [txs, search, makeStableTxId]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="dashboard" style={{ animation: 'fadeInUp 0.6s ease-out' }}>

      {/* Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0.85rem', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', transition: 'background 0.2s' }}>
          <Icon name="chevronLeft" size={16} />
          {t('transactions.backToDashboard')}
        </Link>
      </div>

      {/* Page header */}
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '2.75rem', color: 'white', fontWeight: 900, letterSpacing: '-1.5px', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '0.5rem' }}>
            Transaction History
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
              {total} transaction{total !== 1 ? 's' : ''} total
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.08)', padding: '0.5rem 1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
              {autoRefresh && !refreshing && (
                <>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: '#27ae60', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }}></span>
                  <span>Live</span>
                </>
              )}
              {refreshing && (
                <>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: '#f39c12', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                  <span>Updating...</span>
                </>
              )}
              {!autoRefresh && (
                <>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(255,255,255,0.4)', borderRadius: '50%' }}></span>
                  <span>Last: {lastUpdated.toLocaleTimeString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name={autoRefresh ? 'repeat' : 'xCircle'} size={16} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleManualRefresh}
            disabled={loading || refreshing}
            title="Refresh transactions now"
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="repeat" size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
          {txs.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowExport(true)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="upload" size={18} /> {t('transactions.export')}
            </button>
          )}
        </div>
      </div>

      {/* Filters card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('transactions.filter')}
          </label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '0.55rem 1rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">{t('transactions.allTypes')}</option>
            <option value="receive">{t('transactions.received')}</option>
            <option value="send">{t('transactions.sent')}</option>
            <option value="withdraw">{t('transactions.withdraw')}</option>
            <option value="deposit">{t('transactions.deposit')}</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.55rem 1rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">{t('transactions.allStatuses')}</option>
            <option value="confirmed">{t('transactions.confirmed')}</option>
            <option value="completed">{t('transactions.completed')}</option>
            <option value="pending">{t('transactions.pending')}</option>
            <option value="failed">{t('transactions.failed')}</option>
          </select>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <input type="text" placeholder={t('transactions.searchPlaceholder')}
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
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('transactions.loading')}</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(231,76,60,0.3)' }}>
          <div style={{ marginBottom: '0.75rem' }}><Icon name="alertCircle" size={48} color="var(--danger)" /></div>
          <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>{error}</p>
          <button className="btn btn-danger" onClick={handleManualRefresh}>{t('transactions.retry')}</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayed.length === 0 && (
        <div className="transaction-list">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', animation: 'bounce 2s ease-in-out infinite' }}>
              <Icon name="repeat" size={64} color="var(--primary-blue)" />
            </div>
            <div className="empty-state-title">{t('transactions.noTransactions')}</div>
            <div className="empty-state-text">
              {search || typeFilter || statusFilter
                ? t('transactions.noTransactionsHint')
                : t('transactions.emptyHistory')}
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
                          {tx.type === 'receive'
                            ? t('transactions.received')
                            : tx.type === 'send'
                              ? t('transactions.sent')
                              : tx.type === 'withdraw'
                                ? t('transactions.withdrew')
                                : (typeof tx.type === 'string' ? tx.type : 'transaction')}
                        </span>
                        <StatusBadge status={tx.status} />
                        <span style={{ background: 'rgba(102,126,234,0.1)', color: 'var(--primary-blue)', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>
                          {tx.cryptocurrency || '-'}
                        </span>
                      </div>
                      <div className="transaction-date">{formatDate(normalizePrimitive(tx.timestamp, ''), i18n.language)}</div>
                      {normalizePrimitive(tx.txHash, '') && (
                        <div className="transaction-hash">{normalizePrimitive(tx.txHash, '').slice(0, 16)}...</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className={'transaction-amount ' + (isSend ? 'negative' : 'positive')}>
                        {isSend ? '- ' : '+ '}
                        {parseFloat(tx.amount || 0).toFixed(6).replace(/\.?0+$/, '') || '0'}
                        {' '}{tx.cryptocurrency || ''}
                      </div>
                      {toUsd(tx.amount, tx.cryptocurrency, prices) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2 }}>
                          {toUsd(tx.amount, tx.cryptocurrency, prices)}
                        </div>
                      )}
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
                      [t('transactions.network'),       normalizePrimitive(tx.network, '-')],
                      [t('transactions.block'),         String(tx.blockNumber || '-')],
                      [t('transactions.confirmations'), tx.confirmations != null ? String(tx.confirmations) : '-'],
                      ['Value (USD)', toUsd(tx.amount, tx.cryptocurrency, prices) || '-'],
                      [t('transactions.from'), normalizePrimitive(tx.fromAddress, '') ? shortAddr(normalizePrimitive(tx.fromAddress, '')) : '-'],
                      [t('transactions.to'),   normalizePrimitive(tx.toAddress, '')   ? shortAddr(normalizePrimitive(tx.toAddress, ''))   : '-'],
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
                    {normalizePrimitive(tx.txHash, '') && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                          {t('transactions.txHash')}
                        </div>
                        <button
                          onClick={() => {
                            const safeUrl = blockExplorerUrl(normalizePrimitive(tx.network, '-'), normalizePrimitive(tx.txHash, ''));
                            if (safeUrl !== '#') window.open(safeUrl, '_blank', 'noopener,noreferrer');
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-blue)', fontFamily: "'SF Mono','Courier New',monospace", fontSize: '0.82rem', wordBreak: 'break-all', textAlign: 'left' }}>
                          {normalizePrimitive(tx.txHash, '')}
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
            {t('transactions.prev')}
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
            {t('transactions.next')}
          </button>
        </div>
      )}

      {showExport && (
        <ExportTransactions transactions={displayed} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
