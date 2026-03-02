import React, { useState } from 'react';
import { transactionAPI } from '../services/api';
import Icon from './Icon';

function SendModal({ wallets, onClose, onSuccess, initialAddress }) {
  const [formData, setFormData] = useState({
    fromAddress: wallets[0]?.address || '',
    toAddress: initialAddress || '',
    amount: '',
    cryptocurrency: 'ETH',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [estimatedGas, setEstimatedGas] = useState(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleEstimateGas = async () => {
    if (!formData.toAddress || !formData.amount) {
      setError('Please enter recipient address and amount');
      return;
    }

    try {
      const wallet = wallets.find(w => w.address === formData.fromAddress);
      const response = await transactionAPI.estimateGas({
        toAddress: formData.toAddress,
        amount: formData.amount,
        network: wallet.network
      });
      setEstimatedGas(response.data);
    } catch (err) {
      setError('Error estimating gas fee');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const wallet = wallets.find(w => w.address === formData.fromAddress);
      const response = await transactionAPI.send({
        ...formData,
        network: wallet.network
      });
      
      setTxHash(response.data.transaction.hash);
      setSuccess(true);
      
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error sending transaction');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal">
        <div className="modal-content">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1.5rem',
              width: '100px',
              height: '100px',
              background: 'rgba(52, 199, 89, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: 'var(--success)',
              fontWeight: 'bold'
            }}>
              <Icon name="checkCircle" size={48} color="var(--success)" />
            </div>
            <h2 style={{ 
              color: 'var(--text-primary)', 
              marginBottom: '0.75rem',
              fontSize: '1.75rem',
              fontWeight: '800',
              letterSpacing: '-0.5px'
            }}>
              Transaction Sent!
            </h2>
            <p style={{ 
              color: 'var(--text-secondary)', 
              marginBottom: '1.5rem',
              fontSize: '1rem',
              fontWeight: '500'
            }}>
              Your transaction has been broadcast to the network.
            </p>
            {txHash && (
              <div style={{ 
                marginTop: '1.5rem',
                padding: '1.25rem',
                background: 'var(--dark-bg)',
                borderRadius: '16px',
                wordBreak: 'break-all',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontWeight: '500'
              }}>
                {txHash}
              </div>
            )}
            <button 
              className="btn btn-primary" 
              onClick={onSuccess} 
              style={{ marginTop: '2rem', width: '100%' }}
            >
              Done →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="send" size={24} color="var(--primary-blue)" />
            Send Crypto
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

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
            <label className="form-label">From Wallet</label>
            <select
              name="fromAddress"
              className="form-input form-select"
              value={formData.fromAddress}
              onChange={handleChange}
              required
              disabled={loading}
            >
              {wallets.map((wallet) => (
                <option key={wallet.address} value={wallet.address}>
                  {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)} ({wallet.network.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Recipient Address</label>
            <input
              type="text"
              name="toAddress"
              className="form-input"
              value={formData.toAddress}
              onChange={handleChange}
              placeholder="0x..."
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              type="number"
              name="amount"
              className="form-input"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.0"
              step="0.000001"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cryptocurrency</label>
            <select
              name="cryptocurrency"
              className="form-input form-select"
              value={formData.cryptocurrency}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="ETH">Ethereum (ETH)</option>
              <option value="MATIC">Polygon (MATIC)</option>
              <option value="BNB">Binance Coin (BNB)</option>
            </select>
          </div>

          {estimatedGas && (
            <div style={{ 
              background: 'rgba(10, 132, 255, 0.1)', 
              padding: '1rem', 
              borderRadius: '12px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              border: '1px solid rgba(10, 132, 255, 0.2)',
              color: 'var(--text-primary)'
            }}>
              <strong>Estimated Gas Fee:</strong> {estimatedGas.estimatedFee} {formData.cryptocurrency}
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                Gas Price: {estimatedGas.gasPrice} Gwei
              </div>
            </div>
          )}

          <button 
            type="button" 
            className="btn btn-secondary w-full mb-3" 
            onClick={handleEstimateGas}
            disabled={loading}
          >
            <Icon name="zap" size={18} /> Estimate Gas Fee
          </button>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your wallet password"
              required
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  Sending...
                </>
              ) : (
                <>
                  <Icon name="send" size={18} /> Send
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SendModal;
