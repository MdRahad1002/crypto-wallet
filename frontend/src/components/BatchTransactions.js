import React, { useState } from 'react';
import { transactionAPI } from '../services/api';
import Icon from './Icon';

function BatchTransactions({ wallets, onClose, onSuccess }) {
  const [transactions, setTransactions] = useState([
    { toAddress: '', amount: '', cryptocurrency: 'ETH' }
  ]);
  const [fromAddress, setFromAddress] = useState(wallets[0]?.address || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addTransaction = () => {
    setTransactions([
      ...transactions,
      { toAddress: '', amount: '', cryptocurrency: 'ETH' }
    ]);
  };

  const removeTransaction = (index) => {
    if (transactions.length > 1) {
      setTransactions(transactions.filter((_, i) => i !== index));
    }
  };

  const updateTransaction = (index, field, value) => {
    const updated = [...transactions];
    updated[index][field] = value;
    setTransactions(updated);
  };

  const calculateTotal = () => {
    return transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0).toFixed(4);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const wallet = wallets.find(w => w.address === fromAddress);
      
      for (const tx of transactions) {
        await transactionAPI.send({
          fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          cryptocurrency: tx.cryptocurrency,
          network: wallet.network,
          password
        });
      }
      
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Batch transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', animation: 'modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Icon name="send" size={28} color="var(--primary-blue)" />
            Batch Transactions
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '1.5rem',
          lineHeight: '1.6',
          fontSize: '0.95rem'
        }}>
          Send multiple transactions at once. Save on fees by batching all transfers into a single operation.
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
            <label className="form-label">From Wallet</label>
            <select
              className="form-select"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              required
            >
              {wallets.map((wallet, idx) => (
                <option key={idx} value={wallet.address}>
                  {wallet.network.toUpperCase()} - {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Recipients</label>
              <button
                type="button"
                onClick={addTransaction}
                className="btn btn-outline"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                <span>+</span> Add Recipient
              </button>
            </div>

            {transactions.map((tx, index) => (
              <div key={index} style={{
                padding: '1.25rem',
                background: 'var(--dark-bg)',
                borderRadius: '12px',
                marginBottom: '1rem',
                border: '1px solid var(--border-color)',
                animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                    Recipient #{index + 1}
                  </span>
                  {transactions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTransaction(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        padding: '0.25rem',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Recipient address (0x...)"
                    value={tx.toAddress}
                    onChange={(e) => updateTransaction(index, 'toAddress', e.target.value)}
                    required
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Amount"
                    value={tx.amount}
                    onChange={(e) => updateTransaction(index, 'amount', e.target.value)}
                    step="0.0001"
                    min="0"
                    required
                  />
                  <select
                    className="form-select"
                    value={tx.cryptocurrency}
                    onChange={(e) => updateTransaction(index, 'cryptocurrency', e.target.value)}
                  >
                    <option value="ETH">ETH</option>
                    <option value="BTC">BTC</option>
                    <option value="BNB">BNB</option>
                    <option value="MATIC">MATIC</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(96, 181, 255, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(96, 181, 255, 0.2)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                Total Amount:
              </span>
              <span style={{ 
                fontSize: '1.5rem', 
                fontWeight: '800', 
                color: 'var(--primary-blue)',
                letterSpacing: '-0.5px'
              }}>
                {calculateTotal()} {transactions[0].cryptocurrency}
              </span>
            </div>
            <div style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.85rem', 
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Icon name="lightbulb" size={16} /> Batching {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="lock" size={16} /> Wallet Password
              </span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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
                  Sending...
                </>
              ) : (
                <>
                  <Icon name="send" size={18} /> Send {transactions.length} Transaction{transactions.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BatchTransactions;
