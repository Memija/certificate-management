import { describe, expect, it } from 'vitest'

import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '@/config'

import i18n, { ensureLanguageLoaded, registerAllLocalesForTests } from './index'
import bs from './locales/bs/translation.json'
import de from './locales/de/translation.json'
import en from './locales/en/translation.json'
import id from './locales/id/translation.json'
import pl from './locales/pl/translation.json'
import srCyrl from './locales/sr-Cyrl/translation.json'

function collectCanonicalKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys = new Set<string>()
  for (const [k, v] of Object.entries(obj)) {
    const normalizedKey = k.replace(/_(zero|one|two|few|many|other)$/, '_<plural>')
    const nextPath = prefix ? `${prefix}.${normalizedKey}` : normalizedKey
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const childKey of collectCanonicalKeyPaths(v as Record<string, unknown>, nextPath)) {
        keys.add(childKey)
      }
    } else {
      keys.add(nextPath)
    }
  }
  return [...keys].sort()
}

const SECTION_HEADER_TITLE_KEYS = [
  'app.header.secureBootTitle',
  'app.header.secureBootSubtitle',
  'app.header.winCertTitle',
  'app.header.winCertSubtitle',
  'app.nav.expiry-dashboard',
  'app.dashboard.subtitle',
  'app.trustStore.inspector.eyebrow',
  'app.trustStore.inspector.title',
  'app.crl.eyebrow',
  'app.crl.title',
  'app.chain.eyebrow',
  'app.chain.title',
  'app.csr.eyebrow',
  'app.csr.title',
  'app.keyMatcher.title',
  'app.keyMatcher.subtitle',
  'app.keyGenerator.title',
  'app.keyGenerator.subtitle',
  'app.formatConverter.title',
  'app.formatConverter.subtitle',
  'app.tlsScanner.title',
  'app.tlsScanner.subtitle',
  'app.ocsp.eyebrow',
  'app.ocsp.title',
  'app.ctLog.eyebrow',
  'app.ctLog.title',
  'app.educationCenter.title',
  'app.educationCenter.subtitle',
] as const

describe('i18n configuration & locale parity', () => {
  it('maintains full nested leaf-key parity across all 6 supported locales', () => {
    const enTopKeys = Object.keys(en).sort()
    const enLeafKeys = collectCanonicalKeyPaths(en as Record<string, unknown>)
    const bundles: Record<string, Record<string, unknown>> = {
      de,
      bs,
      'sr-Cyrl': srCyrl,
      id,
      pl,
    }

    for (const [code, bundle] of Object.entries(bundles)) {
      expect(Object.keys(bundle).sort(), `top-level keys for ${code}`).toEqual(enTopKeys)
      expect(collectCanonicalKeyPaths(bundle), `leaf-key parity for ${code}`).toEqual(enLeafKeys)
    }
  })

  it('loads all locales, switches active language cleanly, and localizes every section header', async () => {
    await registerAllLocalesForTests()
    expect(LANGUAGE_META).toHaveLength(SUPPORTED_LANGUAGES.length)

    for (const key of SECTION_HEADER_TITLE_KEYS) {
      expect(i18n.exists(key, { lng: 'en' }), `missing en key: ${key}`).toBe(true)
    }

    for (const lang of SUPPORTED_LANGUAGES) {
      await ensureLanguageLoaded(lang)
      await i18n.changeLanguage(lang)
      expect(i18n.hasResourceBundle(lang, 'translation')).toBe(true)
      expect(document.documentElement.lang).toBe(lang)

      if (lang !== 'en') {
        for (const key of SECTION_HEADER_TITLE_KEYS) {
          const localizedValue = i18n.t(key)
          const englishValue = i18n.t(key, { lng: 'en' })
          expect(localizedValue, `${key} in ${lang} should not be raw key`).not.toBe(key)
          expect(localizedValue, `${key} in ${lang} should be localized`).not.toBe(englishValue)
        }
      }
    }
  })
})
