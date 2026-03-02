import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import Icon from './Icon';

const rules = [
  { label: 'At least 8 characters',          test: (p) => p.length >= 8 },
  { label: 'One uppercase letter (A-Z)',      test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a-z)',      test: (p) => /[a-z]/.test(p) },
  { label: 'One number (0-9)',                test: (p) => /\d/.test(p) },
  { label: 'One special character (!@#$%^&*)', test: (p) => /[!@#$%^&*]/.test(p) },
];

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { text, ok }

  const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,100}$/;

  const strength = (() => {
    if (!form.newPassword) return 0;
    return rules.filter((r) => r.test(form.newPassword)).length;
  })();

  const strengthLabel = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#ff4444', '#ff8800', '#ffc107', '#4caf50', '#00e676'][strength];

  const canSubmit =
    !loading &&
    form.currentPassword.trim() &&
    strongPw.test(form.newPassword) &&
    form.newPassword === form.confirmPassword &&
    form.newPassword !== form.currentPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ text: 'New passwords do not match.', ok: false });
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setMessage({ text: 'New password must be different from your current password.', ok: false });
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setMessage({ text: res.data.message || 'Password changed. Signing you out…', ok: true });
      // Sessions revoked — redirect to login after 2 s
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to change password.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rw-theme rw-page rw-recover">
      <div className="rw-recover-container" style={{ maxWidth: 500 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: 0 }}
        >
          &#8592; Back to Dashboard
        </button>
        <div className="rw-recover-header">
          <h1>Change Password</h1>
          <p className="rw-muted">Enter your current password and choose a new one.</p>
        </div>

        <div className="rw-recover-box">
          <form onSubmit={handleSubmit}>
            {/* Current password */}
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Your current password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onClick={() => setShowCurrent((v) => !v)}
                  tabIndex={-1}
                >
                  <Icon name={showCurrent ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showNew ? 'text' : 'password'}
                  placeholder="New strong password"
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onClick={() => setShowNew((v) => !v)}
                  tabIndex={-1}
                >
                  <Icon name={showNew ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {/* Strength bar */}
              {form.newPassword && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 4, borderRadius: 4,
                          background: i <= strength ? strengthColor : 'var(--border)'
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Confirm new password */}
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  style={{
                    paddingRight: 44,
                    borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword
                      ? 'var(--danger)'
                      : undefined
                  }}
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                >
                  <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 4, display: 'block' }}>Passwords do not match</span>
              )}
            </div>

            {/* Password requirements */}
            <div style={{ marginBottom: '1rem', padding: '10px 14px', background: 'rgba(74,158,255,0.07)', borderRadius: 10, fontSize: '0.83rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>Password requirements:</div>
              {rules.map((r) => {
                const passed = form.newPassword ? r.test(form.newPassword) : false;
                return (
                  <div key={r.label} style={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6,
                    color: form.newPassword ? (passed ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)') : 'var(--text-muted)'
                  }}>
                    <span style={{ fontSize: '0.9rem', width: 16, textAlign: 'center' }}>
                      {form.newPassword ? (passed ? '✓' : '✗') : '•'}
                    </span>
                    {r.label}
                  </div>
                );
              })}
            </div>

            {message && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: '1rem',
                background: message.ok ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)',
                color: message.ok ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600, fontSize: '0.9rem',
                border: `1px solid ${message.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,68,68,0.3)'}`
              }}>
                {message.ok ? '✅ ' : '⚠ '}{message.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="rw-btn rw-btn-primary" type="submit" disabled={!canSubmit} style={{ flex: 1 }}>
                {loading ? 'Changing…' : 'Change Password'}
              </button>
              <button
                type="button"
                className="rw-btn rw-btn-secondary"
                onClick={() => navigate(-1)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordPage;
