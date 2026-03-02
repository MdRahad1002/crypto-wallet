import React, { useState } from 'react';
import ExportTransactions from './ExportTransactions';
import Icon from './Icon';

function TransactionList({ transactions }) {
  const [showExport, setShowExport] = useState(false);
  
  const formatDate = (date) => {
    if (!date) return '—';
    const txDate = new Date(date);
    return txDate.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeIcon = (type) => {
    if (type === 'send' || type === 'withdraw') {
      return (
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255, 69, 58, 0.2) 0%, rgba(255, 69, 58, 0.1) 100%)',
          border: '2px solid rgba(255, 69, 58, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          transition: 'all 0.3s ease',
          animation: 'scaleIn 0.5s ease-out'
        }}>
          <span style={{ 
            color: '#FF453A', 
            transform: 'rotate(45deg)', 
            display: 'block',
            fontWeight: 'bold'
          }}>↗</span>
        </div>
      );
    } else {
      return (
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.2) 0%, rgba(52, 199, 89, 0.1) 100%)',
          border: '2px solid rgba(52, 199, 89, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          transition: 'all 0.3s ease',
          animation: 'scaleIn 0.5s ease-out'
        }}>
          <span style={{ 
            color: '#34C759', 
            transform: 'rotate(135deg)', 
            display: 'block',
            fontWeight: 'bold'
          }}>↗</span>
        </div>
      );
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="transaction-list" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
        <div className="transaction-list-header">
          <h2 className="transaction-list-title" style={{ 
            fontSize: '1.75rem',
            fontWeight: '800',
            letterSpacing: '-0.5px'
          }}>
            Recent Transactions
          </h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ animation: 'bounce 2s ease-in-out infinite', display: 'flex', justifyContent: 'center' }}>
            <Icon name="infoCircle" size={64} color="var(--primary-blue)" />
          </div>
          <div className="empty-state-title">No transactions yet</div>
          <div className="empty-state-text">
            Your transaction history will appear here once you start sending or receiving crypto.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
      <div className="transaction-list-header">
        <h2 className="transaction-list-title" style={{ 
          fontSize: '1.75rem',
          fontWeight: '800',
          letterSpacing: '-0.5px'
        }}>
          Recent Transactions
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ 
            background: 'rgba(96, 181, 255, 0.1)',
            color: 'var(--primary-blue)',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '600',
            letterSpacing: '0.3px',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            {transactions.length} transactions
          </span>
          <button 
            className="btn btn-primary"
            onClick={() => setShowExport(true)}
            style={{
              padding: '0.6rem 1.2rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              background: 'var(--gradient-blue)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(96, 181, 255, 0.3)'
            }}
          >
            <Icon name="upload" size={18} /> Export
          </button>
        </div>
      </div>
      {transactions.map((tx) => (
        <div key={tx._id} className="transaction-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {getTypeIcon(tx.type)}
            <div className="transaction-info">
              <div className="transaction-type">
                {tx.type === 'send' || tx.type === 'withdraw' ? 
                  (tx.toAddress ? formatAddress(tx.toAddress) : 'Sent') : 
                  'Received'}
              </div>
              <div className="transaction-date">
                {formatDate(tx.timestamp)}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div 
              className={`transaction-amount ${tx.type === 'send' || tx.type === 'withdraw' ? 'negative' : 'positive'}`}
            >
              {tx.type === 'send' || tx.type === 'withdraw' ? '- ' : '+ '}{parseFloat(tx.amount).toFixed(3)}
            </div>
          </div>
        </div>
      ))}
      
      {showExport && (
        <ExportTransactions 
          transactions={transactions}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

export default TransactionList;
