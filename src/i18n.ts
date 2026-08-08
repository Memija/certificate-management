import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
