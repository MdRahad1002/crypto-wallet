import React, { useMemo, useState } from 'react';
import { walletAPI } from '../services/api';
import Icon from './Icon';

function normalizeMnemonic(input) {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function RecoverWallet({ onClose, onSuccess }) {
  const [mnemonic, setMnemonic] = useState('');
  const [network, setNetwork] = useState('bitcoin');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');

  const normalizedMnemonic = useMemo(
    () => (mnemonic ? normalizeMnemonic(mnemonic) : ''),
    [mnemonic]
  );

  const wordCount = normalizedMnemonic
    ? normalizedMnemonic.split(' ').filter(Boolean).length
    : 0;

  const canRecover = wordCount === 12 && !loading;

  const onRecover = async (event) => {
    event.preventDefault();
    setError('');
    setWallet(null);

    if (wordCount !== 12) {
      setError('Seed phrase must contain exactly 12 words.');
      return;
    }

    try {
      setLoading(true);
      const res = await walletAPI.recoverWallet({
        mnemonic: normalizedMnemonic,
        network
      });

      setWallet(res.data);
      setMnemonic('');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Recovery failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content recovery-modal">
        <div className="modal-header">
          <h2 className="modal-title">Recover Wallet</h2>
          {onClose && <button className="close-btn" onClick={onClose}>×</button>}
        </div>

        <div
          style={{
            background: 'rgba(255,69,58,0.12)',
            border: '1px solid rgba(255,69,58,0.35)',
            borderRadius: 12,
            padding: '1rem',
            marginBottom: '1rem'
          }}
        >
          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="alertTriangle" size={18} color="#FF453A" /> Security Warning
          </strong>
          <p style={{ marginTop: 6 }}>
            Never share your seed phrase with anyone. This platform does <b>not store or recover</b> seed phrases.
          </p>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={onRecover}>
          <div className="form-group">
            <label className="form-label">Network</label>
            <select
              className="form-input form-select"
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
            >
              <option value="bitcoin">Bitcoin (BTC)</option>
              <option value="ethereum">Ethereum (ETH)</option>
              <option value="usdt">USDT (ERC-20)</option>
            </select>
          </div>

          <label className="form-label">
            12-Word Seed Phrase ({wordCount}/12)
          </label>

          <textarea
            className="form-input"
            rows={3}
            value={mnemonic}
            onChange={(event) => setMnemonic(event.target.value)}
            placeholder="enter your 12 words separated by spaces"
            autoComplete="off"
          />

          <button
            className="btn btn-primary"
            type="submit"
            disabled={!canRecover}
            style={{ marginTop: 12 }}
          >
            {loading ? 'Recovering...' : 'Recover Wallet'}
          </button>
        </form>

        {wallet && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Wallet Recovered</h3>

            <div className="form-group">
              <label className="form-label">Network</label>
              <div
                style={{
                  background: 'var(--dark-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '0.75rem'
                }}
              >
                {wallet.network?.toUpperCase() || network.toUpperCase()}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Wallet Address</label>
              <div
                style={{
                  background: 'var(--dark-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '0.75rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}
              >
                {wallet.address}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Balance</label>
              <div
                style={{
                  background: 'var(--dark-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '0.75rem'
                }}
              >
                {wallet.balance} {wallet.network === 'usdt' ? 'USDT' : wallet.network === 'ethereum' ? 'ETH' : 'BTC'}
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Seed phrase has been cleared from memory.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecoverWallet;
