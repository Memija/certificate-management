import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getInitialLanguage, normalizeLanguageTag, SUPPORTED_LANGUAGES } from './utils/systemSettings';

import en from './locales/en/translation.json';

const LOCALE_LOADERS: Record<string, () => Promise<any>> = {
  de: () => import('./locales/de/translation.json'),
  bs: () => import('./locales/bs/translation.json'),
  'sr-Cyrl': () => import('./locales/sr-Cyrl/translation.json'),
  id: () => import('./locales/id/translation.json'),
  pl: () => import('./locales/pl/translation.json'),
};

const pendingLoads = new Map<string, Promise<void>>();

export async function ensureLanguageLoaded(lng: string): Promise<void> {
  const normalized = normalizeLanguageTag(lng) || 'en';
  if (normalized === 'en' || i18n.hasResourceBundle(normalized, 'translation')) {
    return;
  }

  const loader = LOCALE_LOADERS[normalized];
  if (!loader) return;

  const existing = pendingLoads.get(normalized);
  if (existing) return existing;

  const loadPromise = loader()
    .then((mod) => {
      const bundle = mod?.default || mod;
      if (bundle) {
        i18n.addResourceBundle(normalized, 'translation', bundle, true, true);
      }
    })
    .finally(() => {
      pendingLoads.delete(normalized);
    });

  pendingLoads.set(normalized, loadPromise);
  return loadPromise;
}

export const initialLanguage = getInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => normalizeLanguageTag(lng) || 'en',
    },
  });

const origChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (async (lng?: string, callback?: any) => {
  if (lng) {
    const normalized = normalizeLanguageTag(lng) || 'en';
    await ensureLanguageLoaded(normalized);
    return origChangeLanguage(normalized, callback);
  }
  return origChangeLanguage(lng, callback);
}) as typeof i18n.changeLanguage;

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

export const initialI18nReady: Promise<void> =
  initialLanguage !== 'en'
    ? ensureLanguageLoaded(initialLanguage).then(async () => {
        await origChangeLanguage(initialLanguage);
        syncDocumentLocale(initialLanguage);
      })
    : Promise.resolve().then(() => {
        syncDocumentLocale('en');
      });

if (initialLanguage === 'en') {
  syncDocumentLocale('en');
}

i18n.on('languageChanged', (lng) => {
  syncDocumentLocale(lng);
});

if (import.meta.hot) {
  import.meta.hot.accept(['./locales/en/translation.json'], (modules) => {
    const [newEn] = modules;
    if (newEn) {
      i18n.addResourceBundle('en', 'translation', (newEn as any).default || newEn, true, true);
      i18n.emit('loaded');
    }
  });
}

export default i18n;
