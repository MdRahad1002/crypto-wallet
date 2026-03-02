import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../auth/useAuth';
import '../styles/AdminLogin.css';
import Icon from './Icon';

function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      
      // Check if user is admin
      if (!response.data.user.isAdmin && response.data.user.role !== 'admin') {
        setError('Admin access required. This account does not have admin privileges.');
        setLoading(false);
        return;
      }

      login(response.data.token, response.data.user);
      // Fetch CSRF token now that refreshToken cookie is set
      try { await authAPI.fetchCsrfToken(); } catch (_) { /* non-fatal */ }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-wrapper">
        {/* Left Section - Branding */}
        <div className="admin-login-brand">
          <div className="admin-logo-container">
            <div className="admin-logo"><Icon name="shield" size={64} color="#667eea" /></div>
            <h1>Admin Portal</h1>
            <p>Secure Administration Access</p>
          </div>
          <div className="admin-features">
            <div className="feature-item">
              <span className="feature-icon"><Icon name="pieChart" size={20} /></span>
              <span>System Analytics</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon"><Icon name="user" size={20} /></span>
              <span>User Management</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon"><Icon name="lock" size={20} /></span>
              <span>Security Controls</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon"><Icon name="settings" size={20} /></span>
              <span>Audit Logs</span>
            </div>
          </div>
        </div>

        {/* Right Section - Login Form */}
        <div className="admin-login-form">
          <div className="form-header">
            <h2>Administrator Login</h2>
            <p>Enter your admin credentials to access the control panel</p>
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-icon"><Icon name="alertTriangle" size={18} /></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <span className="label-icon"><Icon name="user" size={16} /></span>
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                className="form-input"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <span className="label-icon"><Icon name="lock" size={16} /></span>
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Verifying Credentials...
                </>
              ) : (
                <>
                  <Icon name="unlock" size={18} />
                  Unlock Admin Panel
                </>
              )}
            </button>
          </form>

          <div className="form-footer">
            <p>
              Not an admin? 
              <a href="/login" className="back-link"> Back to User Login</a>
            </p>
          </div>

          <div className="security-notice">
            <span className="notice-icon"><Icon name="shield" size={20} /></span>
            <p>This portal is restricted to authorized administrators only. All access is logged and monitored.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
