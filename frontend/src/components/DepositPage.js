import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionAPI } from '../services/api';
import Icon from './Icon';

function qrUrl(address) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}&ecc=M&margin=1`;
}

const NETWORK_COLORS = {
  bitcoin:  { bg: 'rgba(247,147,26,0.12)', color: '#f7931a' },
  ethereum: { bg: 'rgba(98,126,234,0.12)', color: '#627eea' },
  litecoin: { bg: 'rgba(191,191,191,0.12)', color: '#bfbfbf' },
  dogecoin: { bg: 'rgba(196,164,39,0.12)', color: '#c4a427' },
  bsc:      { bg: 'rgba(243,186,47,0.12)', color: '#f3ba2f' },
  polygon:  { bg: 'rgba(130,71,229,0.12)', color: '#8247e5' },
};

export default function DepositPage() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState({});
  const [qrErrors, setQrErrors]   = useState({});

  useEffect(() => {
    transactionAPI.getPublicDepositAddresses()
      .then(res => {
        setAddresses(res.data?.addresses || []);
        // needsSetup means table not yet created — not an error, just empty
      })
      .catch(() => setError('Failed to load deposit addresses. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const copyAddress = (id, address) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(c => ({ ...c, [id]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [id]: false })), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(c => ({ ...c, [id]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [id]: false })), 2000);
    });
  };

  return (
    <div className="rw-theme rw-page rw-recover">
      <div className="rw-recover-container" style={{ maxWidth: 640 }}>

        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: '1rem', background: 'none', border: 'none',
            color: 'var(--primary)', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.9rem', padding: 0,
          }}
        >
          &#8592; Back to Dashboard
        </button>

        {/* Header */}
        <div className="rw-recover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrowDown" size={30} color="#34c759" />
            </div>
          </div>
          <h1>Deposit / Receive</h1>
          <p className="rw-muted">
            Send crypto to the addresses below. Your balance will be updated once confirmed by the network.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            Loading deposit addresses&hellip;
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '1rem', background: 'rgba(255,68,68,0.1)', color: 'var(--danger)',
            borderRadius: 12, border: '1px solid rgba(255,68,68,0.3)', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="alertCircle" size={20} color="var(--danger)" />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && addresses.length === 0 && (
          <div className="rw-recover-box" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <Icon name="alertCircle" size={48} color="var(--warning)" />
            <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No Deposit Addresses Yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: '0.9rem' }}>
              Deposit addresses haven&apos;t been configured yet. Please contact support.
            </p>
            <button className="rw-btn rw-btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1.25rem' }}>
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Address cards */}
        {!loading && addresses.map((item) => {
          const netColor = NETWORK_COLORS[item.network] || { bg: 'rgba(96,181,255,0.1)', color: 'var(--primary)' };
          return (
            <div key={item.id} className="rw-recover-box" style={{ marginBottom: '1.25rem' }}>

              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: netColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: netColor.color, letterSpacing: '-0.5px', flexShrink: 0 }}>
                  {item.cryptocurrency}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {item.cryptocurrency}
                    <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8, textTransform: 'capitalize' }}>
                      {item.network} network
                    </span>
                  </div>
                  {item.label && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                  )}
                </div>
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(52,199,89,0.12)', color: '#34c759', border: '1px solid rgba(52,199,89,0.25)' }}>
                  Active
                </span>
              </div>

              {/* QR + address */}
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* QR Code */}
                <div style={{ flexShrink: 0, background: '#ffffff', borderRadius: 14, padding: 10, display: 'inline-flex', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                  {qrErrors[item.id] ? (
                    <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#999' }}>
                      <Icon name="qrCode" size={40} color="#ccc" />
                      <span style={{ fontSize: '0.72rem', textAlign: 'center', color: '#aaa' }}>QR unavailable</span>
                    </div>
                  ) : (
                    <img
                      src={qrUrl(item.address)}
                      alt={`QR code for ${item.cryptocurrency} deposit`}
                      width={160}
                      height={160}
                      style={{ display: 'block', borderRadius: 8 }}
                      onError={() => setQrErrors(e => ({ ...e, [item.id]: true }))}
                    />
                  )}
                </div>

                {/* Address + copy */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Deposit Address
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '0.85rem', color: '#1a1a1a',
                    wordBreak: 'break-all', padding: '0.85rem', background: '#ffffff',
                    borderRadius: 10, border: '1px solid #e0e0e0',
                    marginBottom: 12, lineHeight: 1.65, userSelect: 'all',
                  }}>
                    {item.address}
                  </div>
                  <button
                    className="rw-btn rw-btn-primary"
                    onClick={() => copyAddress(item.id, item.address)}
                    style={{ width: '100%', transition: 'all 0.2s' }}
                  >
                    {copied[item.id] ? (
                      <><span>✓</span> Copied!</>
                    ) : (
                      <>&#128203; Copy Address</>
                    )}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(255,159,10,0.07)', borderRadius: 10,
                border: '1px solid rgba(255,159,10,0.2)',
                fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
                ⚠️ Only send <strong>{item.cryptocurrency}</strong> on the <strong style={{ textTransform: 'capitalize' }}>{item.network}</strong> network to this address. Sending the wrong asset may result in permanent loss.
              </div>
            </div>
          );
        })}

        {/* Info footer */}
        {!loading && addresses.length > 0 && (
          <div style={{ padding: '1rem 1.25rem', background: 'rgba(96,181,255,0.06)', borderRadius: 12, border: '1px solid rgba(96,181,255,0.15)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong> After you send funds,
            your transaction will appear in your{' '}
            <span
              onClick={() => navigate('/transactions')}
              style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Transaction History
            </span>{' '}
            once confirmed on the blockchain.
          </div>
        )}

      </div>
    </div>
  );
}
