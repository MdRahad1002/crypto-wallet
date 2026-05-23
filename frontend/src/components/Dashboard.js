import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { walletAPI, pricesAPI } from '../services/api';
import QRScanner from './QRScanner';
import SendModal from './SendModal';
import CreateWalletModal from './CreateWalletModal';
import PriceChart from './PriceChart';
import WatchOnlyWallet from './WatchOnlyWallet';
import BatchTransactions from './BatchTransactions';
import TokenManagement from './TokenManagement';
import useUsdPricesSocket from '../hooks/useUsdPricesSocket';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import LanguageToggle from './LanguageToggle';

const formatUsd = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  });
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showWatchOnly, setShowWatchOnly] = useState(false);
  const [showBatchTransactions, setShowBatchTransactions] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showTokenManagement, setShowTokenManagement] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [selectedWalletForTokens, setSelectedWalletForTokens] = useState(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [recoveryInfo, setRecoveryInfo] = useState({ status: 'NO_KYC', message: '' });
  const [bannerOverride, setBannerOverride] = useState(null);
  const [recoveryWalletBalance, setRecoveryWalletBalance] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recoveryTransactions, setRecoveryTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const { prices: socketPrices } = useUsdPricesSocket();
  const [selectedChart, setSelectedChart] = useState('bitcoin');
  const portfolioRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userEmail = user?.email || 'user@email.com';
  const userName = user?.name || 'Client';
  const isAdmin = Boolean(user?.isAdmin);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    closeMobileMenu();
  };

  useEffect(() => {
    loadDashboardData();
    loadPrices();
    loadRecoveryStatus(); // This will load wallet balance and transactions if wallet exists
    loadNotifications();
    
    // Refresh prices every 30 seconds
    const priceInterval = setInterval(loadPrices, 30000);
    
    const recoveryInterval = setInterval(loadRecoveryStatus, 30000);
    const notificationInterval = setInterval(loadNotifications, 30000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(recoveryInterval);
      clearInterval(notificationInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (socketPrices) {
      setPrices(socketPrices);
    }
  }, [socketPrices]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load wallets, balances, and transactions in parallel
      const [walletsRes, balancesRes] = await Promise.all([
        walletAPI.list(),
        walletAPI.getAllBalances()
      ]);
      
      setWallets(Array.isArray(walletsRes.data) ? walletsRes.data : (walletsRes.data?.wallets || []));
      setBalances(balancesRes.data);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecoveryStatus = async () => {
    try {
      const response = await walletAPI.getRecoveryStatus();
      const status = response.data?.status || 'NO_KYC';
      const walletReady = Boolean(response.data?.walletExists);
      setRecoveryInfo({
        status,
        message: response.data?.message || ''
      });
      
      // Only load wallet balance and transactions if wallet exists
      if (walletReady) {
        loadRecoveryWalletBalance();
        loadRecoveryTransactions();
      } else {
        setRecoveryWalletBalance(null);
        setRecoveryTransactions([]);
      }
    } catch (error) {
      setRecoveryInfo({ status: 'NO_KYC', message: '' });
      setRecoveryWalletBalance(null);
      setRecoveryTransactions([]);
    }
  };

  const loadRecoveryWalletBalance = async () => {
    try {
      const walletRes = await walletAPI.getRecoveryWallet();
      const wallet = walletRes.data;
      if (!wallet?.address || !wallet?.network) {
        setRecoveryWalletBalance(null);
        return;
      }

      const balanceRes = await walletAPI.getBalance(wallet.address, wallet.network);
      const amount = toNumber(
        balanceRes.data?.native?.balance
        ?? balanceRes.data?.balance
        ?? balanceRes.data?.totalBtc
      );
      const symbol = wallet.network === 'bitcoin' ? 'BTC' : wallet.network.toUpperCase();
      const rate = symbol === 'BTC'
        ? prices?.bitcoin?.usd
        : symbol === 'ETH'
          ? prices?.ethereum?.usd
          : symbol === 'USDT'
            ? prices?.tether?.usd
            : null;
      const usd = typeof rate === 'number' && typeof amount === 'number' ? amount * rate : null;
      setRecoveryWalletBalance({ amount, symbol, usd });
    } catch (error) {
      // 404 is expected when recovery wallet doesn't exist yet, don't log it
      if (error?.response?.status !== 404) {
        console.error('Error loading recovery wallet balance:', error);
      }
      setRecoveryWalletBalance(null);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await walletAPI.getNotifications();
      const allNotifs = response.data?.notifications || [];
      const bannerNotif = allNotifs.find(n => {
        try { const p = JSON.parse(n.message); return p && p.isBanner === true; } catch { return false; }
      });
      const regularNotifs = allNotifs.filter(n => {
        try { const p = JSON.parse(n.message); return !(p && p.isBanner === true); } catch { return true; }
      });
      setNotifications(regularNotifs);
      if (bannerNotif) {
        try { setBannerOverride(JSON.parse(bannerNotif.message)); } catch { setBannerOverride(null); }
      } else {
        setBannerOverride(null);
      }
      setUnreadCount(response.data?.unreadCount || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const loadRecoveryTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const response = await walletAPI.getRecoveryTransactions();
      setRecoveryTransactions(response.data?.transactions || []);
    } catch (error) {
      // 404 is expected when recovery wallet doesn't exist yet, don't log it
      if (error?.response?.status !== 404) {
        console.error('Error loading recovery transactions:', error);
      }
      setRecoveryTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleDismissNotification = async (notificationId) => {
    try {
      await walletAPI.deleteNotification(notificationId);
      setNotifications(notifications.filter(n => n._id !== notificationId));
      loadNotifications(); // Refresh to update unread count
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await walletAPI.markNotificationAsRead(notificationId);
      loadNotifications(); // Refresh notifications
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const recoveryBanner = useMemo(() => {
    switch (recoveryInfo.status) {
      case 'NO_KYC':
        return { type: 'warning', text: t('dashboard.recovery.noKyc') };
      case 'KYC_SUBMITTED':
        return { type: 'info', text: t('dashboard.recovery.submitted') };
      case 'KYC_PROCESSING':
        return { type: 'info', text: t('dashboard.recovery.inProgress') };
      case 'KYC_MORE_DOCS':
        return { type: 'warning', text: recoveryInfo.message || t('dashboard.recovery.additionalDocs') };
      case 'KYC_APPROVED':
        return { type: 'success', text: t('dashboard.recovery.approved') };
      case 'SEED_READY':
        return { type: 'success', text: t('dashboard.recovery.seedReady') };
      case 'SEED_REVEALED':
        return { type: 'info', text: t('dashboard.recovery.revealed') };
      default:
        return null;
    }
  }, [recoveryInfo.message, recoveryInfo.status, t]);

  useEffect(() => {
    if (!prices || balances.length === 0) {
      return;
    }

    const priceMap = {
      BTC: prices.bitcoin?.usd,
      ETH: prices.ethereum?.usd,
      USDT: prices.tether?.usd
    };

    const totalUsd = balances.reduce((sum, wallet) => {
      const symbol = wallet?.native?.symbol?.toUpperCase();
      const rate = symbol ? priceMap[symbol] : null;
      const amount = parseFloat(wallet?.native?.balance || 0);

      if (!rate || Number.isNaN(amount)) {
        return sum;
      }

      return sum + amount * rate;
    }, 0);

    setTotalBalance(totalUsd);
  }, [balances, prices]);

  const loadPrices = async () => {
    try {
      const response = await pricesAPI.getLivePrices();
      setPrices(response.data);
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  };

  const handleWalletCreated = () => {
    setShowCreateWallet(false);
    loadDashboardData();
  };

  const handleRecover = () => {
    navigate('/recover-wallet');
  };

  const handleTransactionComplete = () => {
    setShowSendModal(false);
    loadDashboardData();
  };

  const handleViewDetails = () => {
    portfolioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const priceMap = useMemo(() => ({
    BTC: prices?.bitcoin?.usd,
    ETH: prices?.ethereum?.usd,
    USDT: prices?.tether?.usd
  }), [prices]);

  const topMetrics = useMemo(() => {
    const metrics = [
      { label: t('dashboard.metrics.totalPortfolio'), value: prices && balances.length > 0 ? formatUsd(totalBalance) : '—' },
      { label: t('dashboard.metrics.bitcoin'), value: formatUsd(priceMap.BTC) },
      { label: t('dashboard.metrics.ethereum'), value: formatUsd(priceMap.ETH) },
      { label: t('dashboard.metrics.usdt'), value: formatUsd(priceMap.USDT) }
    ];

    if (recoveryWalletBalance) {
      const frozenValue = typeof recoveryWalletBalance.amount === 'number'
        ? `${recoveryWalletBalance.amount.toFixed(6)} ${recoveryWalletBalance.symbol}`
        : '—';
      const frozenUsd = typeof recoveryWalletBalance.usd === 'number'
        ? formatUsd(recoveryWalletBalance.usd)
        : null;
      metrics.push({
        label: t('dashboard.metrics.recoveryWallet'),
        value: frozenUsd ? `${frozenValue} (${frozenUsd})` : frozenValue
      });
    }

    return metrics;
  }, [balances.length, priceMap.BTC, priceMap.ETH, priceMap.USDT, prices, totalBalance, recoveryWalletBalance, t]);

  const portfolioRows = useMemo(() => {
    // Aggregate wallets by symbol — combine all BTC wallets into one row, etc.
    const aggregated = {};
    balances.forEach((wallet) => {
      const symbol = wallet?.native?.symbol?.toUpperCase() || '';
      const network = wallet?.network || '';
      const key = `${symbol}-${network}`;
      const amount = parseFloat(wallet?.native?.balance || 0);
      if (!aggregated[key]) {
        aggregated[key] = { symbol, network, totalAmount: 0 };
      }
      aggregated[key].totalAmount += amount;
    });

    return Object.values(aggregated).map(({ symbol, network, totalAmount }) => {
      const price = priceMap[symbol];
      const usdValue = typeof price === 'number' ? totalAmount * price : null;
      const label = symbol ? `${symbol} (${network})` : network || 'Asset';
      return {
        id: `${network}-${symbol}`,
        label,
        amount: Number.isNaN(totalAmount) ? '—' : `${totalAmount.toFixed(4)} ${symbol}`.trim(),
        usdValue: usdValue ? formatUsd(usdValue) : '—'
      };
    }).filter(r => r.id).slice(0, 5);
  }, [balances, priceMap]);

  if (loading) {
    return (
      <div className="rw-theme rw-page">
        <div className="loading">
          <div className="spinner"></div>
          <p className="loading-text">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rw-theme rw-page">
      <div className="rw-app">
        {/* Mobile Menu Toggle Button */}
        <button className="rw-mobile-menu-btn" onClick={toggleMobileMenu}>
          <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={24} />
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="rw-mobile-menu-overlay" onClick={closeMobileMenu}></div>
        )}

        <aside className={`rw-sidebar ${mobileMenuOpen ? 'rw-sidebar-open' : ''}`}>
          <div className="rw-brand">
            <img
              src="/bluewallet-logo.svg"
              alt="BlueWallet Security"
              style={{ height: 32, display: 'block', marginBottom: 4 }}
            />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Security</span>
          </div>
          <nav className="rw-nav">
            <a href="#dashboard" className="rw-nav-link active" onClick={closeMobileMenu}>{t('dashboard.nav.dashboard')}</a>
            <Link to="/transactions" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.transactions')}</Link>
            <a href="#portfolio" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.portfolio')}</a>
            <a href="#charts" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.priceCharts')}</a>
            <Link to="/settings/withdraw" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.withdraw')}</Link>
            <button type="button" className="rw-nav-link" onClick={() => { handleRecover(); closeMobileMenu(); }}>
              {t('dashboard.nav.recoverWallet')}
            </button>
            <a href="#security" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.security')}</a>
            <Link to="/support" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.support')}</Link>
            {isAdmin && (
              <Link to="/admin" className="rw-nav-link" onClick={closeMobileMenu}>{t('dashboard.nav.admin')}</Link>
            )}
            <button 
              type="button" 
              className="rw-nav-link rw-nav-logout" 
              onClick={handleLogout}
              style={{ 
                color: '#e74c3c', 
                fontWeight: 600,
                borderTop: '1px solid var(--border-color)',
                marginTop: 'auto',
                paddingTop: '1rem'
              }}
            >
              <Icon name="logOut" size={18} style={{ marginRight: '0.5rem' }} />
              {t('navbar.signOut')}
            </button>
            <LanguageToggle className="sidebar" />
          </nav>
        </aside>

        <main className="rw-main">
          <div className="rw-header" id="dashboard">
            <div>
              <h1>{t('dashboard.welcomeTitle', { name: userName })}</h1>
              <p className="rw-muted">Clean recovery-first wallet overview</p>
            </div>
            <div className="rw-user-box">
              {t('dashboard.loggedInAs', { name: userName, email: userEmail })}
            </div>
          </div>

          {(bannerOverride || recoveryBanner) && (() => {
            const BANNER_ACTION_MAP = {
              recovery:         { label: 'Go to Recovery',       path: '/recover-wallet' },
              withdraw:         { label: 'Withdraw',             path: '/settings/withdraw' },
              deposit:          { label: 'Deposit',              path: '/deposit' },
              transactions:     { label: 'Transaction History',  path: '/transactions' },
              portfolio:        { label: 'View Portfolio',       hash: '#portfolio' },
              'price-charts':   { label: 'Price Charts',        hash: '#price-charts' },
              'change-password':{ label: 'Change Password',     path: '/change-password' },
              security:         { label: 'Security Settings',   hash: '#security' },
              support:          { label: 'Contact Support',     hash: '#support' },
            };
            const action = bannerOverride?.buttonAction;
            const actionInfo = BANNER_ACTION_MAP[action];
            const handleBannerBtn = () => {
              if (actionInfo?.path) { navigate(actionInfo.path); }
              else if (actionInfo?.hash) { window.location.hash = actionInfo.hash; }
              else { handleRecover(); }
            };
            const btnLabel = actionInfo?.label || 'Go to Recovery';
            return (
              <div className={`rw-alert rw-alert-${bannerOverride?.bannerType || recoveryBanner?.type} rw-alert-row`}>
                <span>{bannerOverride?.text || recoveryBanner?.text}</span>
                <button className="rw-btn rw-btn-secondary" onClick={bannerOverride ? handleBannerBtn : handleRecover}>
                  {bannerOverride ? btnLabel : t('dashboard.recovery.goToRecovery')}
                </button>
              </div>
            );
          })()}

          {/* Notifications Section */}
          {notifications.length > 0 && (
            <section className="rw-notifications-section">
              <div className="rw-notifications-header">
                <h3><Icon name="bell" size={20} /> {t('dashboard.notifications.title')} {unreadCount > 0 && <span className="rw-unread-badge">{unreadCount}</span>}</h3>
              </div>
              <div className="rw-notifications-list">
                {notifications.map((notification) => {
                  const notificationTypeClass = {
                    info: 'rw-notification-info',
                    warning: 'rw-notification-warning',
                    error: 'rw-notification-error',
                    success: 'rw-notification-success'
                  }[notification.type] || 'rw-notification-info';

                  const typeEmojiMap = {
                    success: '✅',
                    warning: '⚠️',
                    error: '❌',
                  };
                  const notifEmoji = typeEmojiMap[notification.type];

                  const priorityIconMap = {
                    urgent: 'zap',
                    high: 'flame',
                    medium: 'infoCircle',
                    low: 'lightbulb'
                  };
                  const priorityIconName = priorityIconMap[notification.priority] || 'infoCircle';

                  const priorityColorMap = {
                    urgent: '#ff4444',
                    high: '#ff8800',
                    medium: '#4a9eff',
                    low: '#ffc107'
                  };
                  const priorityColor = priorityColorMap[notification.priority] || '#4a9eff';

                  return (
                    <div
                      key={notification._id}
                      className={`rw-notification ${notificationTypeClass} ${notification.read ? 'rw-notification-read' : 'rw-notification-unread'}`}
                    >
                      <div className="rw-notification-content">
                        <span className="rw-notification-icon" style={{ fontSize: notifEmoji ? 18 : undefined }}>
                          {notifEmoji
                            ? <span style={{ fontSize: 18, lineHeight: 1 }}>{notifEmoji}</span>
                            : <Icon name={priorityIconName} size={18} color={priorityColor} />}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="rw-notification-message">{notification.message ? notification.message.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}✅❌⚠️⏳💸🔔]\s*/u, '') : ''}</span>
                          {/* CTA button for seed-phrase notifications */}
                          {notification.message && notification.message.toLowerCase().includes('seed') && (
                            <button
                              className="rw-btn rw-btn-primary"
                              style={{ alignSelf: 'flex-start', padding: '4px 14px', fontSize: '0.82rem', marginTop: 2 }}
                              onClick={() => navigate('/recover-wallet')}
                            >
                              {t('dashboard.recovery.revealSeed')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="rw-notification-actions">
                        {!notification.read && (
                          <button
                            className="rw-notification-btn rw-notification-btn-mark"
                            onClick={() => handleMarkAsRead(notification._id)}
                            title="Mark as read"
                          >
                            <Icon name="check" size={14} />
                          </button>
                        )}
                        <button
                          className="rw-notification-btn rw-notification-btn-dismiss"
                          onClick={() => handleDismissNotification(notification._id)}
                          title="Dismiss"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rw-grid">
            {topMetrics.map((metric) => (
              <div key={metric.label} className="rw-card">
                <h3>{metric.label}</h3>
                <div className="rw-value">{metric.value}</div>
              </div>
            ))}
          </section>

          <section className="rw-card rw-section" id="portfolio" ref={portfolioRef}>
            <div className="rw-section-header">
              <h3>{t('dashboard.assets.title')}</h3>
              <span className="rw-muted">{t('dashboard.assets.subtitle')}</span>
            </div>

            {portfolioRows.length === 0 ? (
              <div className="rw-empty">
                <p>{t('dashboard.assets.noAssets')}</p>
                <button className="rw-btn rw-btn-primary" onClick={() => setShowCreateWallet(true)}>
                  {t('dashboard.assets.createWallet')}
                </button>
              </div>
            ) : (
              <div className="rw-portfolio">
                {portfolioRows.map((row) => (
                  <div key={row.id} className="rw-portfolio-row">
                    <span>{row.label}</span>
                    <span>{row.amount}</span>
                    <span>{row.usdValue}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rw-actions">
              <button className="rw-btn rw-btn-primary" onClick={handleRecover}>
                {t('dashboard.assets.recoverWallet')}
              </button>
              <button className="rw-btn rw-btn-secondary" onClick={handleViewDetails}>
                {t('dashboard.assets.viewDetails')}
              </button>
            </div>
          </section>

          <section className="rw-section" id="charts">
            <div className="rw-chart-switch">
              <button
                className={`rw-btn rw-btn-secondary ${selectedChart === 'bitcoin' ? 'active' : ''}`}
                onClick={() => setSelectedChart('bitcoin')}
              >
                BTC
              </button>
              <button
                className={`rw-btn rw-btn-secondary ${selectedChart === 'ethereum' ? 'active' : ''}`}
                onClick={() => setSelectedChart('ethereum')}
              >
                ETH
              </button>
              <button
                className={`rw-btn rw-btn-secondary ${selectedChart === 'tether' ? 'active' : ''}`}
                onClick={() => setSelectedChart('tether')}
              >
                USDT
              </button>
            </div>
            <PriceChart
              coinId={selectedChart}
              className="rw-card"
              buttonClassName="rw-btn rw-btn-secondary"
              activeButtonClassName="active"
            />
          </section>

          {/* Recovery Wallet Transaction History */}
          {recoveryTransactions.length > 0 && (
            <section className="rw-card rw-section" id="recovery-transactions">
              <div className="rw-section-header">
                <h3>{t('dashboard.recovery.transactions')}</h3>
                <span className="rw-muted">
                  {loadingTransactions ? t('dashboard.loading') : t('dashboard.txCount', { count: recoveryTransactions.length })}
                </span>
              </div>
              
              <div className="rw-transaction-list">
                {recoveryTransactions.slice(0, 10).map((tx, index) => {
                  const date = tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Unknown';
                  const time = tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : '';
                  const directionIcon = tx.direction === 'received' ? '↓' : tx.direction === 'sent' ? '↑' : '↔';
                  const directionColor = tx.direction === 'received' ? 'var(--success)' : 
                                        tx.direction === 'sent' ? 'var(--danger)' : 'var(--text-muted)';
                  
                  return (
                    <div key={tx.hash || index} className="rw-transaction-item">
                      <div className="rw-transaction-icon" style={{ color: directionColor }}>
                        {directionIcon}
                      </div>
                      <div className="rw-transaction-details">
                        <div className="rw-transaction-type">
                          {tx.direction === 'received' ? t('transactions.received') : tx.direction === 'sent' ? t('transactions.sent') : t('transactions.deposit')}
                        </div>
                        <div className="rw-transaction-date">{date} {time}</div>
                        <div className="rw-transaction-hash">
                          {tx.hash ? tx.hash.substring(0, 10) + '...' + tx.hash.substring(tx.hash.length - 8) : 'N/A'}
                        </div>
                      </div>
                      <div className="rw-transaction-amount">
                        <div className="rw-transaction-value" style={{ color: directionColor }}>
                          {tx.direction === 'received' ? '+' : tx.direction === 'sent' ? '-' : ''}
                          {tx.value ? tx.value.toFixed(8) : '0.00'} {tx.cryptocurrency || 'BTC'}
                        </div>
                        {tx.status && (
                          <div className="rw-transaction-status">
                            <span className={`rw-status-badge rw-status-${tx.status}`}>
                              {tx.status}
                            </span>
                            {tx.confirmations > 0 && (
                              <span className="rw-confirmations">
                                {tx.confirmations} conf.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {recoveryTransactions.length > 10 && (
                <div className="rw-transaction-footer">
                  <p className="rw-muted">Showing 10 of {recoveryTransactions.length} transactions</p>
                </div>
              )}
            </section>
          )}

          <section className="rw-grid rw-section" id="recovery">
            <div className="rw-card">
              <h3>{t('dashboard.actions.title')}</h3>
              <p className="rw-muted">{t('dashboard.actions.subtitle')}</p>
              <div className="rw-actions rw-actions-wrap">
                <button className="rw-btn rw-btn-primary" onClick={handleRecover}>
                  {t('dashboard.actions.recover')}
                </button>
                <button className="rw-btn rw-btn-secondary" onClick={() => setShowCreateWallet(true)}>
                  {t('dashboard.actions.createWallet')}
                </button>
                <button className="rw-btn rw-btn-secondary" onClick={() => setShowWatchOnly(true)}>
                  {t('dashboard.actions.watchOnly')}
                </button>
                <button
                  className="rw-btn rw-btn-secondary"
                  onClick={() => {
                    if (wallets.length > 0) {
                      setSelectedWalletForTokens(wallets[0]);
                      setShowTokenManagement(true);
                    }
                  }}
                  disabled={wallets.length === 0}
                >
                  {t('dashboard.actions.tokens')}
                </button>
                <button
                  className="rw-btn rw-btn-secondary"
                  onClick={() => setShowBatchTransactions(true)}
                  disabled={wallets.length === 0}
                >
                  {t('dashboard.actions.batch')}
                </button>
                <button
                  className="rw-btn rw-btn-secondary"
                  onClick={() => navigate('/deposit')}
                >
                  {t('dashboard.actions.deposit')}
                </button>
                <button
                  className="rw-btn rw-btn-secondary"
                  onClick={() => setShowQRScanner(true)}
                >
                  {t('dashboard.actions.scanQr')}
                </button>
                <button
                  className="rw-btn rw-btn-primary"
                  onClick={() => setShowSendModal(true)}
                  disabled={wallets.length === 0}
                >
                  {t('dashboard.actions.send')}
                </button>
              </div>
            </div>
            <div className="rw-card" id="security">
              <h3>{t('dashboard.security.title')}</h3>
              <p className="rw-muted">{t('dashboard.security.subtitle')}</p>
              <div className="rw-status">
                <span className="rw-status-dot"></span>
                {t('dashboard.security.status')}
              </div>              <button
                className="rw-btn rw-btn-secondary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => navigate('/change-password')}
              >
                {t('dashboard.security.changePassword')}
              </button>            </div>
            <div className="rw-card" id="support">
              <h3>{t('dashboard.support.title')}</h3>
              <p className="rw-muted">{t('dashboard.support.subtitle')}</p>
              <button className="rw-btn rw-btn-primary" onClick={() => navigate('/support')}>{t('dashboard.support.contactSupport')}</button>
            </div>
          </section>

          {isAdmin && (
            <section className="rw-card rw-section" id="admin">
              <h3>Admin Console</h3>
              <p className="rw-muted">Audit logs, system health, and operational controls.</p>
              <Link className="rw-btn rw-btn-primary" to="/admin">Open Admin</Link>
            </section>
          )}
        </main>
      </div>

      {showCreateWallet && (
        <CreateWalletModal
          onClose={() => setShowCreateWallet(false)}
          onSuccess={handleWalletCreated}
        />
      )}


      {showSendModal && (
        <SendModal
          wallets={wallets}
          onClose={() => { setShowSendModal(false); setScannedAddress(''); }}
          onSuccess={handleTransactionComplete}
          initialAddress={scannedAddress}
        />
      )}

      {showWatchOnly && (
        <WatchOnlyWallet
          onClose={() => setShowWatchOnly(false)}
          onSuccess={handleWalletCreated}
        />
      )}

      {showBatchTransactions && (
        <BatchTransactions
          wallets={wallets}
          onClose={() => setShowBatchTransactions(false)}
          onSuccess={handleTransactionComplete}
        />
      )}

      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={(address) => {
          setScannedAddress(address);
          setShowQRScanner(false);
          setShowSendModal(true);
        }}
      />

      {showTokenManagement && selectedWalletForTokens && (
        <TokenManagement
          wallet={selectedWalletForTokens}
          onClose={() => {
            setShowTokenManagement(false);
            setSelectedWalletForTokens(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
