import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';

const STORAGE_KEY = 'mashang-admin-language';

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'zh';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'zh';
};

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
});

export const LANGUAGE_STORAGE_KEY = STORAGE_KEY;

export default i18n;
