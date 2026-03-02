import React from 'react';
import Icon from './Icon';

function ExportTransactions({ transactions, onClose }) {
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Cryptocurrency', 'Address', 'Status', 'Hash'];
    const rows = transactions.map(tx => [
      new Date(tx.timestamp).toLocaleString(),
      tx.type,
      tx.amount,
      tx.cryptocurrency,
      tx.toAddress || tx.fromAddress || 'N/A',
      tx.status,
      tx.hash || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(transactions, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Icon name="download" size={28} color="var(--primary-blue)" />
            Export Transactions
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '1.5rem',
          lineHeight: '1.6'
        }}>
          Download your transaction history in your preferred format.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={exportToCSV}
            className="btn btn-primary"
            style={{ 
              width: '100%',
              justifyContent: 'flex-start',
              padding: '1.25rem'
            }}
          >
            <span style={{ marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
              <Icon name="pieChart" size={24} color="white" />
            </span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontWeight: '800', marginBottom: '0.25rem' }}>Export as CSV</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                Compatible with Excel and Google Sheets
              </div>
            </div>
          </button>

          <button
            onClick={exportToJSON}
            className="btn btn-secondary"
            style={{ 
              width: '100%',
              justifyContent: 'flex-start',
              padding: '1.25rem'
            }}
          >
            <span style={{ marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
              <Icon name="copy" size={24} />
            </span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontWeight: '800', marginBottom: '0.25rem' }}>Export as JSON</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                Complete data structure for developers
              </div>
            </div>
          </button>
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(96, 181, 255, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(96, 181, 255, 0.2)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: 'var(--primary-blue)', display: 'block', marginBottom: '0.5rem' }}>
            ℹ️ Export Details
          </strong>
          Exporting {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} from your history. Files include date, type, amount, address, status, and transaction hash.
        </div>

        <button
          onClick={onClose}
          className="btn btn-outline"
          style={{ width: '100%', marginTop: '1rem' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ExportTransactions;
