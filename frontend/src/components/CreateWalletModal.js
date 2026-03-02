import React, { useState } from 'react';
import { walletAPI } from '../services/api';
import Icon from './Icon';

function CreateWalletModal({ onClose, onSuccess }) {
  const [network, setNetwork] = useState('ethereum');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdWallet, setCreatedWallet] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await walletAPI.create({ network, password });
      setCreatedWallet(response.data);
    } catch (err) {
      const details = err.response?.data?.errors;
      if (Array.isArray(details) && details.length > 0) {
        setError(details.map((detail) => detail.message).join(' '));
      } else {
        setError(err.response?.data?.message || 'Error creating wallet');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            <span style={{ marginRight: '0.5rem' }}>+</span>
            Create Wallet
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {!createdWallet ? (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message" style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem 1.25rem', 
                background: 'rgba(255, 69, 58, 0.1)', 
                borderRadius: '16px',
                border: '1px solid rgba(255, 69, 58, 0.2)',
                fontWeight: '600'
              }}>
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Blockchain Network</label>
              <select
                className="form-input form-select"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                disabled={loading}
              >
                <option value="bitcoin">₿ Bitcoin</option>
                <option value="ethereum">⟠ Ethereum</option>
                <option value="polygon">⬡ Polygon</option>
                <option value="bsc">◆ Binance Smart Chain</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Encryption Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                required
                disabled={loading}
              />
              <small style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '0.875rem', 
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                fontWeight: '500'
              }}>
                <Icon name="lock" size={16} /> This password encrypts your private key. Keep it safe!
              </small>
              <small style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                display: 'block',
                marginTop: '0.5rem'
              }}>
                Must be at least 8 characters with uppercase, lowercase, number, and special character.
              </small>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    Create →
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ 
              textAlign: 'center', 
              padding: '1.5rem',
              background: 'rgba(48, 209, 88, 0.1)',
              borderRadius: '12px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Icon name="checkCircle" size={48} color="var(--success)" />
              </div>
              <strong style={{ color: 'var(--success)', fontSize: '1.1rem' }}>Wallet created successfully!</strong>
            </div>

            <div style={{ 
              background: 'var(--dark-bg)', 
              padding: '1.5rem', 
              borderRadius: '12px', 
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Wallet Address:</strong>
                <div style={{ 
                  wordBreak: 'break-all', 
                  fontFamily: 'monospace', 
                  fontSize: '0.875rem',
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--card-bg)',
                  borderRadius: '8px',
                  color: 'var(--primary-blue)'
                }}>
                  {createdWallet.address}
                </div>
              </div>

              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                <strong>Network:</strong> {createdWallet.network.toUpperCase()}
              </div>

              {createdWallet.mnemonic && (
                <div style={{ 
                  background: 'rgba(255, 214, 10, 0.1)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '2px solid var(--warning)'
                }}>
                  <strong style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon name="alertTriangle" size={18} /> Recovery Phrase - Save This!
                  </strong>
                  <div style={{ 
                    marginTop: '0.75rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    wordBreak: 'break-all',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}>
                    {createdWallet.mnemonic}
                  </div>
                  <small style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', color: 'var(--warning)' }}>
                    <Icon name="infoCircle" size={16} /> Write this down and keep it in a safe place. You'll need it to recover your wallet.
                  </small>
                </div>
              )}
            </div>

            <button className="btn btn-success w-full" onClick={handleComplete}>
              <Icon name="check" size={18} /> I've Saved My Recovery Phrase
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateWalletModal;
