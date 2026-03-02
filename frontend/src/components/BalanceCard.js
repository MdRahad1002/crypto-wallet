import React from 'react';
import Icon from './Icon';

function BalanceCard({ wallet }) {
  const getNetworkIcon = (network) => {
    const icons = {
      ethereum: '⟠',
      polygon: '⬡',
      bsc: '◆',
      bitcoin: '₿',
      btc: '₿'
    };
    return icons[network] || <Icon name="wallet" size={20} />;
  };

  const getNetworkGradient = (network) => {
    const gradients = {
      ethereum: 'linear-gradient(135deg, #627EEA 0%, #8A9FFF 100%)',
      polygon: 'linear-gradient(135deg, #8247E5 0%, #A882FF 100%)',
      bsc: 'linear-gradient(135deg, #F0B90B 0%, #FFD633 100%)',
      bitcoin: 'linear-gradient(135deg, #F7931A 0%, #FFB84D 100%)',
      btc: 'linear-gradient(135deg, #F7931A 0%, #FFB84D 100%)'
    };
    return gradients[network] || 'linear-gradient(135deg, #60B5FF 0%, #3A9FFF 100%)';
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="wallet-card" style={{ 
      background: getNetworkGradient(wallet.network),
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="wallet-header">
        <div>
          <div className="wallet-name" style={{ 
            fontSize: '1.1rem',
            fontWeight: '700',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {wallet.network.charAt(0).toUpperCase() + wallet.network.slice(1)} Wallet
          </div>
          <div className="wallet-type">Main Account</div>
        </div>
        <div style={{ 
          fontSize: '2.8rem', 
          opacity: 0.95,
          animation: 'bounce 3s ease-in-out infinite',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
        }}>
          {getNetworkIcon(wallet.network)}
        </div>
      </div>
      
      <div className="wallet-balance">
        <div className="wallet-balance-label" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          Balance
        </div>
        <div className="wallet-balance-amount" style={{ 
          textShadow: '0 3px 10px rgba(0,0,0,0.2)',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          {parseFloat(wallet.native.balance).toFixed(4)} <span style={{ fontSize: '1.8rem', fontWeight: '700' }}>{wallet.native.symbol}</span>
        </div>
        <div className="wallet-balance-fiat" style={{ 
          opacity: 0.95,
          fontWeight: '600',
          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          Last updated: Just now
        </div>
      </div>

      <div className="wallet-address" style={{ 
        fontWeight: '600',
        letterSpacing: '0.5px'
      }}>
        {formatAddress(wallet.address)}
      </div>

      {wallet.tokens && wallet.tokens.length > 0 && (
        <div style={{ 
          marginTop: '1.5rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          position: 'relative',
          zIndex: 1,
          animation: 'fadeIn 1s ease-out'
        }}>
          <div style={{ 
            fontSize: '0.75rem', 
            opacity: 0.9, 
            marginBottom: '0.75rem', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            fontWeight: '700',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            Tokens ({wallet.tokens.length})
          </div>
          {wallet.tokens.slice(0, 3).map((token, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.65rem',
              fontSize: '0.9rem',
              padding: '0.75rem 1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '14px',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.transform = 'translateX(5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}>
              <span style={{ fontWeight: '700', opacity: 0.95 }}>{token.cryptocurrency}</span>
              <span style={{ fontWeight: '800' }}>{parseFloat(token.balance).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BalanceCard;
