import React, { useState } from 'react';
import { tokenAPI } from '../services/api';
import Icon from './Icon';
import { sanitizeUrl } from '../utils/sanitizeUrl';

function TokenTransferModal({ wallet, token, onClose, onSuccess }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (parseFloat(amount) > parseFloat(token.balance)) {
      setError('Insufficient token balance');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await tokenAPI.transfer({
        walletAddress: wallet.address,
        tokenAddress: token.contractAddress,
        recipientAddress: recipient,
        amount: amount
      });

      onSuccess(response.data);
      onClose();
    } catch (err) {
      console.error('Token transfer error:', err);
      setError(err.response?.data?.message || 'Failed to transfer tokens');
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(token.balance);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="send" size={24} color="var(--primary-blue)" /> Send {token.symbol}
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              padding: '12px',
              background: 'rgba(255, 69, 58, 0.1)',
              border: '1px solid rgba(255, 69, 58, 0.3)',
              borderRadius: '8px',
              color: 'var(--danger)',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <div style={{
            padding: '1rem',
            background: 'rgba(96, 181, 255, 0.1)',
            border: '1px solid rgba(96, 181, 255, 0.3)',
            borderRadius: '12px',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              {token.logoUrl ? (
                <img src={sanitizeUrl(token.logoUrl)} alt={token.symbol} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {token.symbol[0]}
                </div>
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{token.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{token.symbol}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Available Balance:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>{parseFloat(token.balance).toFixed(4)} {token.symbol}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Recipient Address</label>
              <input
                type="text"
                className="form-input"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Amount
                <button
                  type="button"
                  onClick={setMaxAmount}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.25rem 0.6rem',
                    background: 'rgba(96, 181, 255, 0.2)',
                    border: '1px solid rgba(96, 181, 255, 0.4)',
                    borderRadius: '6px',
                    color: 'var(--primary-blue)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                  disabled={loading}
                >
                  MAX
                </button>
              </label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={loading}
                required
              />
            </div>

            <div style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You will send:</span>
                <span style={{ fontWeight: '700' }}>{amount || '0.0'} {token.symbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Network:</span>
                <span style={{ fontWeight: '600' }}>{wallet.network}</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  Processing...
                </>
              ) : (
                <>
                  <Icon name="send" size={18} /> Send {token.symbol}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TokenTransferModal;
