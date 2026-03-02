import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../auth/useAuth';
import Icon from './Icon';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      login(response.data.token, response.data.user);
      // Fetch CSRF token now that refreshToken cookie is set - this binds
      // the CSRF cookie to the session so all subsequent POSTs are allowed
      try { await authAPI.fetchCsrfToken(); } catch (_) { /* non-fatal */ }
      const requestedPath = location.state?.from?.pathname;
      const isSafePath = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//');
      const redirectTo = isSafePath ? requestedPath : '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div className="auth-logo" style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}>
            <img src="/bluewallet-logo.svg" alt="BlueWallet Security" style={{ height: 44, marginBottom: 4 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Security</span>
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your BlueWallet Security account</p>
        </div>
        
        {error && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem 1.25rem', 
            background: 'rgba(255, 69, 58, 0.15)', 
            borderRadius: '16px', 
            textAlign: 'center',
            border: '1px solid rgba(255, 69, 58, 0.3)',
            fontWeight: '600',
            color: 'var(--danger)',
            animation: 'shake 0.5s ease-in-out'
          }}>
            <Icon name="alertTriangle" size={18} color="var(--danger)" /> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form" style={{ animation: 'fadeInUp 0.5s ease-out 0.2s both' }}>
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="user" size={16} /> Email Address
              </span>
            </label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleChange}
              required
              style={{ transition: 'all 0.3s ease' }}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="lock" size={16} /> Password
              </span>
            </label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              style={{ transition: 'all 0.3s ease' }}
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ marginTop: '1rem', fontSize: '1.05rem' }}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                Signing in...
              </>
            ) : (
              <>
                Sign In <span style={{ marginLeft: '0.5rem' }}>→</span>
              </>
            )}
          </button>
        </form>
        
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(74, 158, 255, 0.07)',
          borderRadius: '12px',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#888',
          border: '1px solid rgba(74, 158, 255, 0.15)'
        }}>
          Forgot your password? Contact your administrator to have it reset.
        </div>
      </div>
    </div>
  );
}

export default Login;
