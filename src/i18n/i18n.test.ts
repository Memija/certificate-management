import { describe, expect, it } from 'vitest'

import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '@/config'

import i18n, { ensureLanguageLoaded, registerAllLocalesForTests } from './index'
import bs from './locales/bs/translation.json'
import de from './locales/de/translation.json'
import en from './locales/en/translation.json'
import id from './locales/id/translation.json'
import pl from './locales/pl/translation.json'
import srCyrl from './locales/sr-Cyrl/translation.json'

function collectLeafKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const nextPath = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeyPaths(v as Record<string, unknown>, nextPath))
    } else {
      keys.push(nextPath)
    }
  }
  return keys.sort()
}

describe('i18n configuration & locale parity', () => {
  it('maintains top-level namespace parity across all 6 supported locales', () => {
    const enTopKeys = Object.keys(en).sort()
    const bundles: Record<string, Record<string, unknown>> = {
      de,
      bs,
      'sr-Cyrl': srCyrl,
      id,
      pl,
    }

    for (const [code, bundle] of Object.entries(bundles)) {
      expect(Object.keys(bundle).sort(), `top-level keys for ${code}`).toEqual(enTopKeys)
      expect(collectLeafKeyPaths(bundle).length).toBeGreaterThan(100)
    }
  })

  it('loads all locales and switches active language cleanly', async () => {
    await registerAllLocalesForTests()
    expect(LANGUAGE_META).toHaveLength(SUPPORTED_LANGUAGES.length)

    for (const lang of SUPPORTED_LANGUAGES) {
      await ensureLanguageLoaded(lang)
      await i18n.changeLanguage(lang)
      expect(i18n.hasResourceBundle(lang, 'translation')).toBe(true)
      expect(document.documentElement.lang).toBe(lang)
    }
  })
})
