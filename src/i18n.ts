import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getInitialLanguage, normalizeLanguageTag, SUPPORTED_LANGUAGES } from './utils/systemSettings';

import en from './locales/en/translation.json';
import de from './locales/de/translation.json';
import bs from './locales/bs/translation.json';
import srCyrl from './locales/sr-Cyrl/translation.json';
import id from './locales/id/translation.json';
import pl from './locales/pl/translation.json';

const resources = {
  en: { translation: en },
  de: { translation: de },
  bs: { translation: bs },
  'sr-Cyrl': { translation: srCyrl },
  id: { translation: id },
  pl: { translation: pl }
};

const initialLanguage = getInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => normalizeLanguageTag(lng) || 'en'
    }
  });

const syncDocumentLocale = (lng: string) => {
  if (typeof document !== 'undefined') {
    const normalized = normalizeLanguageTag(lng) || 'en';
    document.documentElement.lang = normalized;
    const title = i18n.t('app.title');
    if (title && title !== 'app.title') {
      document.title = title;
    }
  }
};

syncDocumentLocale(i18n.language || initialLanguage);
i18n.on('languageChanged', (lng) => {
  syncDocumentLocale(lng);
});

if (import.meta.hot) {
  import.meta.hot.accept([
    './locales/en/translation.json',
    './locales/de/translation.json',
    './locales/bs/translation.json',
    './locales/sr-Cyrl/translation.json',
    './locales/id/translation.json',
    './locales/pl/translation.json'
  ], (modules) => {
    const [newEn, newDe, newBs, newSrCyrl, newId, newPl] = modules;
    if (newEn) i18n.addResourceBundle('en', 'translation', (newEn as any).default || newEn, true, true);
    if (newDe) i18n.addResourceBundle('de', 'translation', (newDe as any).default || newDe, true, true);
    if (newBs) i18n.addResourceBundle('bs', 'translation', (newBs as any).default || newBs, true, true);
    if (newSrCyrl) i18n.addResourceBundle('sr-Cyrl', 'translation', (newSrCyrl as any).default || newSrCyrl, true, true);
    if (newId) i18n.addResourceBundle('id', 'translation', (newId as any).default || newId, true, true);
    if (newPl) i18n.addResourceBundle('pl', 'translation', (newPl as any).default || newPl, true, true);
    i18n.emit('loaded');
  });
}

export default i18n;
