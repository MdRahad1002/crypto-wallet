import React, { useState, useEffect, useCallback } from 'react';
import { tokenAPI } from '../services/api';
import Icon from './Icon';
import { sanitizeUrl } from '../utils/sanitizeUrl';

function TokenManagement({ wallet, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [popularTokens, setPopularTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddToken, setShowAddToken] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTokens = useCallback(async () => {
    if (!wallet) return;
    try {
      const response = await tokenAPI.getBalances(wallet.address, wallet.network);
      setTokens(response.data.tokens || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setLoading(false);
    }
  }, [wallet]);

  const fetchPopularTokens = useCallback(async () => {
    if (!wallet) return;
    try {
      const response = await tokenAPI.getPopular(wallet.network);
      setPopularTokens(response.data.tokens || []);
    } catch (err) {
      console.error('Error fetching popular tokens:', err);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) {
      fetchTokens();
      fetchPopularTokens();
    }
  }, [wallet, fetchTokens, fetchPopularTokens]);

  const handleAddPopularToken = async (tokenInfo) => {
    try {
      setError('');
      setSuccess('');
      await tokenAPI.add({
        walletAddress: wallet.address,
        contractAddress: tokenInfo.address,
        network: wallet.network
      });
      
      setSuccess(`${tokenInfo.symbol} added successfully!`);
      fetchTokens();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding token');
    }
  };

  const handleAddCustomToken = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const response = await tokenAPI.add({
        walletAddress: wallet.address,
        contractAddress: customTokenAddress,
        network: wallet.network
      });
      
      setSuccess(`${response.data.token.symbol} added successfully!`);
      setCustomTokenAddress('');
      setShowAddToken(false);
      fetchTokens();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding custom token');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>🪙 Token Management</h2>
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

          {success && (
            <div style={{
              padding: '12px',
              background: 'rgba(52, 199, 89, 0.1)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              borderRadius: '8px',
              color: 'var(--success)',
              marginBottom: '1rem'
            }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Wallet: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</h3>
          </div>

          {/* My Tokens */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="dollarSign" size={20} /> My Tokens
              <button
                onClick={fetchTokens}
                style={{
                  marginLeft: 'auto',
                  padding: '0.4rem 0.8rem',
                  background: 'var(--primary-blue)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <Icon name="repeat" size={16} /> Refresh All
              </button>
            </h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Loading tokens...
              </div>
            ) : tokens.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <p style={{ color: 'var(--text-secondary)' }}>No tokens added yet</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Add popular tokens or import custom ones below
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tokens.map((token, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {token.logoUrl ? (
                        <img src={sanitizeUrl(token.logoUrl)} alt={token.symbol} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                          {token.symbol[0]}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>{token.symbol}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{token.name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                        {parseFloat(token.balance).toFixed(4)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {token.symbol}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popular Tokens */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>⭐ Popular Tokens</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {popularTokens.map((token, index) => (
                <button
                  key={index}
                  onClick={() => handleAddPopularToken(token)}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(96, 181, 255, 0.1)',
                    border: '1px solid rgba(96, 181, 255, 0.3)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(96, 181, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(96, 181, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{token.symbol}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+ Add</div>
                </button>
              ))}
            </div>
          </div>

          {/* Add Custom Token */}
          <div>
            {!showAddToken ? (
              <button
                onClick={() => setShowAddToken(true)}
                className="btn btn-secondary w-full"
              >
                <Icon name="send" size={16} /> Add Custom Token
              </button>
            ) : (
              <form onSubmit={handleAddCustomToken}>
                <div className="form-group">
                  <label className="form-label">Token Contract Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    placeholder="0x..."
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Add Token
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddToken(false);
                      setCustomTokenAddress('');
                      setError('');
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TokenManagement;
