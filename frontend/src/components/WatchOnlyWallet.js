import React, { useState } from 'react';
import { walletAPI } from '../services/api';
import Icon from './Icon';

function WatchOnlyWallet({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    address: '',
    network: 'ethereum',
    label: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await walletAPI.addWatchOnly(formData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add watch-only wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ animation: 'modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Icon name="eye" size={28} color="var(--primary-blue)" />
            Watch-Only Wallet
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '1.5rem', 
          lineHeight: '1.6',
          fontSize: '0.95rem'
        }}>
          Monitor any wallet without needing the private key. Perfect for tracking cold storage or paper wallets.
        </p>

        {error && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            background: 'rgba(255, 69, 58, 0.15)', 
            borderRadius: '12px',
            color: 'var(--danger)',
            animation: 'shake 0.5s ease-in-out'
          }}>
            <Icon name="alertTriangle" size={18} color="var(--danger)" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="wallet" size={16} /> Wallet Label
              </span>
            </label>
            <input
              type="text"
              name="label"
              className="form-input"
              placeholder="My Cold Storage"
              value={formData.label}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="settings" size={16} /> Network
              </span>
            </label>
            <select
              name="network"
              className="form-select"
              value={formData.network}
              onChange={handleChange}
            >
              <option value="ethereum">Ethereum</option>
              <option value="bitcoin">Bitcoin</option>
              <option value="polygon">Polygon</option>
              <option value="bsc">Binance Smart Chain</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="wallet" size={16} /> Public Address
              </span>
            </label>
            <input
              type="text"
              name="address"
              className="form-input"
              placeholder="0x... or bc1..."
              value={formData.address}
              onChange={handleChange}
              required
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <small style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.85rem', 
              display: 'block', 
              marginTop: '0.5rem' 
            }}>
              Enter the public address you want to watch
            </small>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginTop: '2rem' 
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  Adding...
                </>
              ) : (
                <>
                  <Icon name="eye" size={18} /> Add Watch-Only
                </>
              )}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(96, 181, 255, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(96, 181, 255, 0.2)'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--primary-blue)', display: 'block', marginBottom: '0.5rem' }}>
              ℹ️ About Watch-Only Wallets
            </strong>
            Watch-only wallets let you monitor balances and transactions without exposing private keys. Perfect for:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>Tracking cold storage</li>
              <li>Monitoring paper wallets</li>
              <li>Viewing exchange wallets</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WatchOnlyWallet;
