import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, transactionAPI } from '../services/api';
import Icon from './Icon';

// Strip internal/admin-set labels that should never be user-visible
function cleanLabel(label) {
  if (!label) return '';
  const s = label.trim();
  // Strip any label that contains admin markers
  if (/admin.?managed|admin-managed|imported\s*\(/i.test(s)) return '';
  if (/^Watch-Only Wallet$/i.test(s)) return '';
  return s;
}

function WithdrawPage() {
  const navigate = useNavigate();

  const [wallets, setWallets] = useState([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameMsg, setRenameMsg] = useState('');

  const [form, setForm] = useState({
    fromAddress: '',
    toAddress: '',
    amount: '',
    cryptocurrency: 'BTC',
    network: 'bitcoin',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Load ALL wallets (including watch-only)
  useEffect(() => {
    walletAPI.list()
      .then((res) => {
        const all = res.data.wallets || res.data || [];
        setWallets(all);
        if (all.length > 0) {
          const first = all[0];
          setForm((f) => ({
            ...f,
            fromAddress: first.address,
            network: first.network || 'bitcoin',
            cryptocurrency: cryptoForNetwork(first.network),
          }));
        }
      })
      .catch(() => setError('Failed to load wallets.'))
      .finally(() => setWalletsLoading(false));
  }, []);

  function cryptoForNetwork(network) {
    const map = { bitcoin: 'BTC', ethereum: 'ETH', litecoin: 'LTC', dogecoin: 'DOGE', bsc: 'BNB', polygon: 'MATIC' };
    return map[network] || (network || 'BTC').toUpperCase();
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  };

  const handleWalletSelect = (e) => {
    const addr = e.target.value;
    const w = wallets.find(x => x.address === addr);
    setForm((f) => ({
      ...f,
      fromAddress: addr,
      network: w?.network || 'bitcoin',
      cryptocurrency: cryptoForNetwork(w?.network),
    }));
    setError('');
  };

  const selectedWallet = wallets.find((w) => w.address === form.fromAddress);
  const availableBalance = selectedWallet?.balanceOverrideBtc ?? null;
  const enteredAmount = parseFloat(form.amount) || 0;
  const exceedsBalance = availableBalance !== null && enteredAmount > availableBalance;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.toAddress.trim()) return setError('Recipient address is required.');
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Enter a valid amount.');
    if (exceedsBalance) return setError(`Amount exceeds your available balance of ${availableBalance} ${form.cryptocurrency}.`);
    setLoading(true);
    try {
      const res = await transactionAPI.withdraw({
        fromAddress: form.fromAddress,
        toAddress: form.toAddress.trim(),
        amount: parseFloat(form.amount),
        cryptocurrency: form.cryptocurrency,
        network: form.network,
        description: form.description.trim(),
      });
      setSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit withdrawal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (success) {
    return (
      <div className="rw-theme rw-page rw-recover">
        <div className="rw-recover-container" style={{ maxWidth: 500 }}>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(255,170,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <Icon name="clock" size={48} color="#ff9f0a" />
            </div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1.75rem', fontWeight: 800 }}>
              Request Submitted
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Your withdrawal request is <strong>pending admin approval</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              You'll receive a notification once it's approved or rejected. Check your Transaction History to track its status.
            </p>
            <div style={{
              padding: '1rem 1.25rem', background: 'var(--dark-bg)', borderRadius: 14,
              border: '1px solid var(--border-color)', fontSize: '0.875rem',
              color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'left',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Request Details</div>
              <div>Amount: <strong>{success.transaction?.amount} {success.transaction?.cryptocurrency}</strong></div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                To: {success.transaction?.toAddress}
              </div>
              <div style={{ marginTop: 4 }}>Status: <span style={{ color: '#ff9f0a', fontWeight: 600 }}>⏳ Pending</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="rw-btn rw-btn-primary" onClick={() => navigate('/transactions')} style={{ width: '100%' }}>
                View Transaction History
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="rw-btn rw-btn-secondary" onClick={() => navigate('/dashboard')} style={{ flex: 1 }}>
                  Back to Dashboard
                </button>
                <button className="rw-btn rw-btn-secondary" onClick={() => { setSuccess(null); setForm((f) => ({ ...f, toAddress: '', amount: '', description: '' })); }} style={{ flex: 1 }}>
                  New Request
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Main form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="rw-theme rw-page rw-recover">
      <div className="rw-recover-container" style={{ maxWidth: 540 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: 0 }}
        >
          &#8592; Back to Dashboard
        </button>

        {/* Header */}
        <div className="rw-recover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,69,58,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrowDown" size={28} color="#ff453a" />
            </div>
          </div>
          <h1>Withdraw Funds</h1>

        </div>

        <div className="rw-recover-box">
          {walletsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              Loading wallets…
            </div>
          ) : wallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Icon name="alertCircle" size={40} color="var(--warning)" />
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                No wallets found. Please contact support.
              </p>
              <button className="rw-btn rw-btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
                Go to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: '1.25rem',
                  background: 'rgba(255,68,68,0.1)', color: 'var(--danger)',
                  fontWeight: 600, fontSize: '0.9rem',
                  border: '1px solid rgba(255,68,68,0.3)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <Icon name="alertCircle" size={18} color="var(--danger)" />
                  {error}
                </div>
              )}

              {/* From Wallet */}
              <div className="form-group">
                <label className="form-label">From Wallet</label>
                <select
                  name="fromAddress"
                  className="form-input form-select"
                  value={form.fromAddress}
                  onChange={handleWalletSelect}
                  required
                  disabled={loading}
                >
                  {wallets.map((w) => {
                    const dl = cleanLabel(w.label);
                    return (
                      <option key={w.address} value={w.address}>
                        {w.address.slice(0, 12)}...{w.address.slice(-8)}{' '}
                        ({(w.network || 'bitcoin').toUpperCase()})
                        {dl ? ` - ${dl}` : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedWallet && (
                  <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <span>Network: <strong>{selectedWallet.network}</strong></span>
                    {availableBalance !== null && (
                      <span style={{ color: exceedsBalance ? 'var(--danger, #ef4444)' : 'inherit' }}>
                        Balance: <strong>{availableBalance} {cryptoForNetwork(selectedWallet.network)}</strong>
                      </span>
                    )}
                    {!renaming && (
                      <button type="button" onClick={() => { setRenameValue(cleanLabel(selectedWallet.label)); setRenaming(true); setRenameMsg(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-blue)', fontSize: '0.82rem', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Icon name="edit" size={13} /> Rename
                      </button>
                    )}
                  </div>
                )}
                {renaming && selectedWallet && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                    <input type="text" className="form-input" value={renameValue}
                      onChange={e => setRenameValue(e.target.value)} placeholder="Wallet nickname"
                      maxLength={40} style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', flex: 1 }} autoFocus />
                    <button type="button" className="rw-btn rw-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                      onClick={async () => {
                        try {
                          await walletAPI.renameWallet(selectedWallet.address, renameValue.trim());
                          setWallets(prev => prev.map(w => w.address === selectedWallet.address ? { ...w, label: renameValue.trim() } : w));
                          setRenaming(false);
                          setRenameMsg('Renamed.');
                          setTimeout(() => setRenameMsg(''), 2000);
                        } catch { setRenameMsg('Failed to rename.'); }
                      }}>Save</button>
                    <button type="button" className="rw-btn rw-btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                      onClick={() => setRenaming(false)}>Cancel</button>
                  </div>
                )}
                {renameMsg && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{renameMsg}</div>}
              </div>

              {/* Recipient Address */}
              <div className="form-group">
                <label className="form-label">Recipient Address</label>
                <input
                  type="text"
                  name="toAddress"
                  className="form-input"
                  value={form.toAddress}
                  onChange={handleChange}
                  placeholder="Destination wallet address"
                  required
                  disabled={loading}
                  spellCheck={false}
                />
              </div>

              {/* Amount + Crypto */}
              <div className="form-group">
                <label className="form-label">Amount</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="number"
                    name="amount"
                    className="form-input"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0.000000"
                    step="0.000001"
                    min="0.000001"
                    required
                    disabled={loading}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="form-input"
                    value={form.cryptocurrency}
                    readOnly
                    style={{ width: 100, background: 'var(--dark-bg)', opacity: 0.7, cursor: 'default' }}
                  />
                </div>
                {exceedsBalance && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--danger, #ef4444)', marginTop: 4 }}>
                    Exceeds available balance ({availableBalance} {form.cryptocurrency})
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Note <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input
                  type="text"
                  name="description"
                  className="form-input"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Reason or reference…"
                  disabled={loading}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="rw-btn rw-btn-secondary"
                  onClick={() => navigate('/dashboard')}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rw-btn rw-btn-primary"
                  disabled={loading || !form.toAddress || !form.amount || exceedsBalance}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #ff453a, #ff6b35)' }}
                >
                  {loading ? (
                    <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting…</>
                  ) : (
                    <><Icon name="arrowDown" size={18} /> Request Withdrawal</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default WithdrawPage;
