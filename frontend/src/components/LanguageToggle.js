import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation();
  const current = (i18n.language || 'en').startsWith('de') ? 'de' : 'en';

  const set = (lang) => {
    if (lang !== current) {
      i18n.changeLanguage(lang);
      localStorage.setItem('rw:lang', lang);
    }
  };

  return (
    <div className={`rw-lang-switcher ${className}`}>
      <button
        onClick={() => set('en')}
        className={`rw-lang-btn${current === 'en' ? ' active' : ''}`}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        onClick={() => set('de')}
        className={`rw-lang-btn${current === 'de' ? ' active' : ''}`}
        aria-label="Zu Deutsch wechseln"
      >
        DE
      </button>
    </div>
  );
}
