import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

export default function LanguageToggle({ className = '' }) {
  const { t } = useTranslation();
  const currentLang = i18n.language || 'en';

  const toggle = () => {
    const next = currentLang.startsWith('de') ? 'en' : 'de';
    i18n.changeLanguage(next);
    localStorage.setItem('rw:lang', next);
  };

  return (
    <button
      onClick={toggle}
      className={`rw-lang-toggle ${className}`}
      title={t('language.toggle')}
      aria-label={`Switch to ${currentLang.startsWith('de') ? 'English' : 'Deutsch'}`}
    >
      {currentLang.startsWith('de') ? 'EN' : 'DE'}
    </button>
  );
}
