import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'var(--border-color)',
        border: 'none',
        borderRadius: '20px',
        padding: '0.5rem 1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '1.25rem',
        transition: 'all 0.3s ease',
        color: 'var(--text-primary)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--primary-blue)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--border-color)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={20} />
    </button>
  );
}

export default ThemeToggle;
