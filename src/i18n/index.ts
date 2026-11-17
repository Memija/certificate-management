import { initReactI18next } from 'react-i18next'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import { SUPPORTED_LANGUAGES } from '@/config'
import type { SupportedLanguage } from '@/types'
import { getInitialLanguage, normalizeLanguageTag } from '@/utils/system-settings'

import en from './locales/en/translation.json'

type TranslationResource = Record<string, unknown>

interface LocaleModule {
  default?: TranslationResource
}

type LocaleLoader = () => Promise<LocaleModule | TranslationResource>

const LOCALE_LOADERS: Partial<Record<SupportedLanguage, LocaleLoader>> = {
  de: () => import('./locales/de/translation.json'),
  bs: () => import('./locales/bs/translation.json'),
  'sr-Cyrl': () => import('./locales/sr-Cyrl/translation.json'),
  id: () => import('./locales/id/translation.json'),
  pl: () => import('./locales/pl/translation.json'),
}

function extractBundle(mod: LocaleModule | TranslationResource): TranslationResource {
  const candidate = (mod as { default?: unknown }).default
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as TranslationResource
  }
  return mod as TranslationResource
}

const pendingLoads = new Map<SupportedLanguage, Promise<void>>()

export async function ensureLanguageLoaded(lng: string): Promise<void> {
  const normalized: SupportedLanguage = normalizeLanguageTag(lng) || 'en'
  if (normalized === 'en' || i18n.hasResourceBundle(normalized, 'translation')) {
    return
  }

  const loader = LOCALE_LOADERS[normalized]
  if (!loader) {
    return
  }

  const existing = pendingLoads.get(normalized)
  if (existing) {
    return existing
  }

  const loadPromise = loader()
    .then((mod) => {
      const bundle = extractBundle(mod)
      i18n.addResourceBundle(normalized, 'translation', bundle, true, true)
    })
    .finally(() => {
      pendingLoads.delete(normalized)
    })

  pendingLoads.set(normalized, loadPromise)
  return loadPromise
}

export const initialLanguage: SupportedLanguage = getInitialLanguage()

void i18n
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
  })

type ChangeLanguageCallback = Parameters<typeof i18n.changeLanguage>[1]

const origChangeLanguage = i18n.changeLanguage.bind(i18n)

i18n.changeLanguage = async (lng?: string, callback?: ChangeLanguageCallback) => {
  if (lng) {
    const normalized = normalizeLanguageTag(lng) || 'en'
    await ensureLanguageLoaded(normalized)
    return origChangeLanguage(normalized, callback)
  }
  return origChangeLanguage(lng, callback)
}

function syncDocumentLocale(lng: string): void {
  if (typeof document !== 'undefined') {
    const normalized = normalizeLanguageTag(lng) || 'en'
    document.documentElement.lang = normalized
    const title = i18n.t('app.title')
    if (title && title !== 'app.title') {
      document.title = title
    }
  }
}

export const initialI18nReady: Promise<void> =
  initialLanguage !== 'en'
    ? ensureLanguageLoaded(initialLanguage).then(async () => {
        await origChangeLanguage(initialLanguage)
        syncDocumentLocale(initialLanguage)
      })
    : Promise.resolve().then(() => {
        syncDocumentLocale('en')
      })

if (initialLanguage === 'en') {
  syncDocumentLocale('en')
}

i18n.on('languageChanged', (lng) => {
  syncDocumentLocale(lng)
})

/**
 * Registers all supported locale bundles in `i18n` for deterministic synchronous/async testing.
 */
export async function registerAllLocalesForTests(): Promise<void> {
  await Promise.all(SUPPORTED_LANGUAGES.map((lng) => ensureLanguageLoaded(lng)))
  await origChangeLanguage('en')
}

if (import.meta.hot) {
  import.meta.hot.accept(['./locales/en/translation.json'], (modules) => {
    const [newEn] = modules
    if (newEn) {
      const bundle = extractBundle(newEn as unknown as LocaleModule)
      i18n.addResourceBundle('en', 'translation', bundle, true, true)
      i18n.emit('loaded', { en: { translation: true } })
    }
  })
}

export default i18n
