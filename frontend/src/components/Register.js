import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../auth/useAuth';
import Icon from './Icon';

function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      const response = await authAPI.register(registerData);
      login(response.data.token, response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Start managing your crypto with BlueWallet Security</p>
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
                <Icon name="user" size={16} /> Full Name
              </span>
            </label>
            <input
              type="text"
              name="name"
              className="form-input"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
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
              minLength="6"
            />
            <small style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.85rem', 
              display: 'block', 
              marginTop: '0.5rem' 
            }}>
              Must be at least 6 characters
            </small>
          </div>
          
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="check" size={16} /> Confirm Password
              </span>
            </label>
            <input
              type="password"
              name="confirmPassword"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ marginTop: '1rem', fontSize: '1.05rem' }}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                Creating Account...
              </>
            ) : (
              <>
                Create Account <span style={{ marginLeft: '0.5rem' }}>→</span>
              </>
            )}
          </button>
        </form>
        
        <div className="auth-footer" style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
          Already have an account? <Link to="/login" style={{ 
            transition: 'all 0.3s ease',
            display: 'inline-block'
          }}>Sign In →</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
