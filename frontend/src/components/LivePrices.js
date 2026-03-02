import React from 'react';
import Icon from './Icon';

const PRICE_ITEMS = [
  { id: 'bitcoin', symbol: 'BTC', label: 'Bitcoin', icon: '₿' },
  { id: 'ethereum', symbol: 'ETH', label: 'Ethereum', icon: '⟠' },
  { id: 'tether', symbol: 'USDT', label: 'Tether', icon: '₮' }
];

function LivePrices({ prices }) {
  if (!prices) {
    return null;
  }

  const rows = PRICE_ITEMS.map((item) => {
    const data = prices[item.id];
    return {
      id: item.id,
      symbol: item.symbol,
      name: item.label,
      icon: item.icon,
      price: data?.usd,
      change24h: data?.usd_24h_change
    };
  }).filter((item) => typeof item.price === 'number');

  if (rows.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '2.5rem', animation: 'fadeInUp 0.6s ease-out' }}>
      <h2 style={{
        marginBottom: '1.5rem',
        color: 'var(--text-primary)',
        fontSize: '1.75rem',
        fontWeight: '800',
        letterSpacing: '-0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <Icon name="trendingUp" size={24} color="var(--success)" />
        Live Market Prices
        <span style={{
          fontSize: '0.7rem',
          background: 'rgba(52, 199, 89, 0.15)',
          color: 'var(--success)',
          padding: '0.35rem 0.85rem',
          borderRadius: '20px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          Live
        </span>
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.25rem'
      }}>
        {rows.map((coin, index) => (
          <div
            key={coin.id}
            className="price-card"
            style={{
              transition: 'all 0.3s ease',
              animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(96, 181, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="price-icon"
              style={{
                background: 'linear-gradient(135deg, rgba(96, 181, 255, 0.15) 0%, rgba(96, 181, 255, 0.05) 100%)',
                fontSize: '2rem',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}
            >
              {coin.icon}
            </div>
            <div className="price-info">
              <div
                className="price-name"
                style={{
                  fontWeight: '800',
                  fontSize: '1.05rem',
                  letterSpacing: '-0.3px'
                }}
              >
                {coin.name}
              </div>
              <div
                className="price-symbol"
                style={{
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {coin.symbol}
              </div>
            </div>
            <div className="price-value">
              <div
                className="price-amount"
                style={{
                  fontWeight: '900',
                  letterSpacing: '-0.8px',
                  fontSize: '1.35rem'
                }}
              >
                ${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {typeof coin.change24h === 'number' && (
                <div
                  className={`card-change ${coin.change24h >= 0 ? 'positive' : 'negative'}`}
                  style={{
                    fontWeight: '800',
                    fontSize: '1rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '12px',
                    background: coin.change24h >= 0
                      ? 'rgba(52, 199, 89, 0.15)'
                      : 'rgba(255, 69, 58, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{coin.change24h >= 0 ? '↗' : '↘'}</span>
                  {Math.abs(coin.change24h).toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LivePrices;
