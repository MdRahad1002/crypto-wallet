import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

function Navbar({ user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-brand">
        <div className="brand-logo">
          <Icon name="wallet" size={28} color="#667eea" />
        </div>
        <span className="brand-text">CryptoWallet</span>
      </div>

      {/* Back to Dashboard — mobile only, shown on non-dashboard pages, hidden for admins */}
      {!user?.isAdmin && location.pathname !== '/dashboard' && (
        <Link to="/dashboard" className="navbar-back-btn">
          <Icon name="chevronLeft" size={18} />
          <span>Dashboard</span>
        </Link>
      )}

      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-btn"
        onClick={toggleMobileMenu}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? <Icon name="x" size={24} /> : <Icon name="menu" size={24} />}
      </button>

      <ul className={`navbar-menu ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        {user?.isAdmin ? (
          /* Admin-only navigation */
          <li>
            <Link 
              to="/admin" 
              onClick={() => setMobileMenuOpen(false)} 
              className={`navbar-link navbar-link-admin ${location.pathname === '/admin' ? 'active' : ''}`}
            >
              <Icon name="shield" size={20} />
              <span>Admin Panel</span>
            </Link>
          </li>
        ) : (
          /* Regular user navigation */
          <>
            <li>
              <Link 
                to="/dashboard" 
                onClick={() => setMobileMenuOpen(false)} 
                className={`navbar-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
              >
                <Icon name="pieChart" size={20} />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                to="/transactions"
                onClick={() => setMobileMenuOpen(false)}
                className={`navbar-link ${location.pathname === '/transactions' ? 'active' : ''}`}
              >
                <Icon name="list" size={20} />
                <span>History</span>
              </Link>
            </li>
            <li>
              <Link
                to="/settings/withdraw"
                onClick={() => setMobileMenuOpen(false)}
                className={`navbar-link ${location.pathname === '/settings/withdraw' ? 'active' : ''}`}
              >
                <Icon name="arrowDown" size={20} />
                <span>Withdraw</span>
              </Link>
            </li>
          </>
        )}
        <li className="navbar-user">
          <Icon name="user" size={20} />
          <span className="user-name">{user?.name}</span>
        </li>
        <li className="navbar-theme-toggle">
          <ThemeToggle />
        </li>
        <li>
          <button 
            onClick={() => { onLogout(); setMobileMenuOpen(false); }} 
            className="btn btn-logout"
          >
            <Icon name="logOut" size={18} />
            <span>Sign Out</span>
          </button>
        </li>
      </ul>

      {/* Mobile Menu Overlay */}
      <div 
        className={`mobile-menu-overlay${mobileMenuOpen ? ' mobile-menu-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
    </nav>
  );
}

export default Navbar;
