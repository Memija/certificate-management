/**
 * Utility functions for parsing, splitting, and localizing certificate purposes
 * and Key Usage extension values.
 */

import type { SimpleTranslateFn, TranslateFn } from '@/types'

const PURPOSE_ALIASES: Record<string, string> = {
  certificatesigning: 'certificatesigning',
  certificatesign: 'certificatesign',
  keycertsign: 'certificatesigning',
  crlsigning: 'crlsigning',
  crlsign: 'crlsign',
  offlinecrlsigning: 'offlinecrlsigning',
  digitalsignature: 'digitalsignature',
  nonrepudiation: 'nonrepudiation',
  keyencipherment: 'keyencipherment',
  dataencipherment: 'dataencipherment',
  keyagreement: 'keyagreement',
  encipheronly: 'encipheronly',
  decipheronly: 'decipheronly',
  serverauth: 'serverauthentication',
  serverauthentication: 'serverauthentication',
  clientauth: 'clientauthentication',
  clientauthentication: 'clientauthentication',
  codesigning: 'codesigning',
  emailprotection: 'emailprotection',
  secureemail: 'secureemail',
  timestamping: 'timestamping',
  ocspsigning: 'ocspsigning',
  smartcardlogon: 'smartcardlogon',
  ipsecendsystem: 'ipsecendsystem',
  ipsectunnel: 'ipsectunnel',
  ipsecuser: 'ipsecuser',
  anypurpose: 'anypurpose',
  generalpurpose: 'generalpurpose',
  generalpurposenotspecified: 'generalpurposenotspecified',
  notspecified: 'notspecified',
  nonespecified: 'nonespecified',
}

function invokeTranslate(t: TranslateFn, key: string, defaultValue: string): string {
  const fn = t as SimpleTranslateFn
  return fn(key, defaultValue)
}

function hasNonPrintableChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if ((code >= 0x00 && code <= 0x08) || (code >= 0x0e && code <= 0x1f) || code >= 0x7f) {
      return true
    }
  }
  return false
}

/**
 * Splits a list of purposes that may contain comma-separated values,
 * bitmasks in parentheses like '(86)', or extra whitespace.
 */
export function splitPurposes(purposes: string[] = []): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const raw of purposes) {
    if (!raw) {
      continue
    }
    const withoutBitmask = raw.replace(/\s*\([0-9a-fA-F]+\)/g, '').trim()
    const parts = withoutBitmask.includes(',')
      ? withoutBitmask
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [withoutBitmask]

    for (const p of parts) {
      if (!p) {
        continue
      }
      const key = p.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push(p)
      }
    }
  }

  return result.length > 0 ? result : ['General Purpose']
}

/**
 * Translates an individual purpose string using react-i18next `t`.
 */
export function translatePurpose(p: string, t: TranslateFn): string {
  if (!p) {
    return ''
  }
  const clean = p.replace(/\s*\([0-9a-fA-F]+\)/g, '').trim()
  const norm = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  const alias = PURPOSE_ALIASES[norm] || norm
  const translationKey = `app.winCertStore.purposes.${alias}`
  const fallbackTranslated = invokeTranslate(t, `app.winCertStore.purposes.${norm}`, clean)
  const translated = invokeTranslate(t, translationKey, fallbackTranslated)

  return translated || clean
}

/**
 * Formats and localizes a Key Usage extension value string, such as:
 * "Digital Signature, Certificate Signing, Off-line CRL Signing, CRL Signing (86)"
 * Preserves the trailing hex bitmask e.g. "(86)" while translating each individual purpose.
 */
export function formatKeyUsageValue(val: string, t: TranslateFn): string {
  if (!val) {
    return ''
  }
  const bitmaskMatch = val.match(/\s*(\([0-9a-fA-F]+\))\s*$/)
  const bitmask = bitmaskMatch ? bitmaskMatch[1] : ''
  const clean = val.replace(/\s*\([0-9a-fA-F]+\)\s*$/, '').trim()

  if (!clean.includes(',') && !PURPOSE_ALIASES[clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()]) {
    return val
  }

  const parts = clean
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const translatedParts = parts.map((p) => translatePurpose(p, t))
  const joined = translatedParts.join(', ')

  return bitmask ? `${joined} ${bitmask}` : joined
}

/**
 * Joins a list of purposes into a comma-separated localized string.
 */
export function formatPurposesList(purposes: string[] = [], t: TranslateFn): string {
  const list = splitPurposes(purposes)
  return list.map((p) => translatePurpose(p, t)).join(', ')
}

/**
 * Formats an extension value (e.g. Key Usage, Basic Constraints, EKU, SCTs) into a readable, localized representation.
 */
export function formatExtensionValue(name = '', oid = '', value = '', t: TranslateFn): string {
  if (!value) {
    return ''
  }
  const normName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  // 1. Key Usage (2.5.29.15)
  if (normName === 'keyusage' || oid === '2.5.29.15') {
    return formatKeyUsageValue(value, t)
  }

  // 2. Extended Key Usage / Enhanced Key Usage (2.5.29.37)
  if (
    normName === 'extkeyusage' ||
    normName === 'extendedkeyusage' ||
    normName === 'enhancedkeyusage' ||
    oid === '2.5.29.37'
  ) {
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const translatedParts = parts.map((part) => {
      const match = part.match(/^([^()]+?)(?:\s*\(([\d.]+)\))?$/)
      if (match) {
        const purposeName = match[1].trim()
        const oidSuffix = match[2]
        const translated = translatePurpose(purposeName, t)
        return oidSuffix ? `${translated} (${oidSuffix})` : translated
      }
      return translatePurpose(part, t)
    })
    return translatedParts.join(', ')
  }

  // 3. Basic Constraints (2.5.29.19)
  if (normName === 'basicconstraints' || oid === '2.5.29.19') {
    let formatted = value
    if (formatted.includes('Is CA: Yes')) {
      formatted = formatted.replace(
        'Is CA: Yes',
        invokeTranslate(t, 'app.chain.isCaYes', 'Is CA: Yes'),
      )
    } else if (formatted.includes('Is CA: No')) {
      formatted = formatted.replace(
        'Is CA: No',
        invokeTranslate(t, 'app.chain.isCaNo', 'Is CA: No'),
      )
    } else if (formatted.includes('01 01 FF') || formatted.includes('01 01 ff')) {
      formatted = `${invokeTranslate(t, 'app.chain.isCaYes', 'Is CA: Yes')} (${value})`
    } else if (formatted.includes('01 01 00') || formatted.trim() === '30 00') {
      formatted = `${invokeTranslate(t, 'app.chain.isCaNo', 'Is CA: No')} (${value})`
    }

    if (formatted.includes('Path Length Constraint:')) {
      const label = invokeTranslate(t, 'app.chain.pathLenConstraint', 'Path Length Constraint')
      formatted = formatted.replace('Path Length Constraint:', `${label}:`)
    }

    return formatted
  }

  // 4. Timestamp List / SCTs (1.3.6.1.4.1.11129.2.4.2)
  if (
    normName === 'timestamplist' ||
    normName === 'certificatetransparencyscts' ||
    oid === '1.3.6.1.4.1.11129.2.4.2'
  ) {
    const bytesMatch = value.match(
      /Embedded Signed Certificate Timestamps\s*(?:\((\d+)\s*bytes\))?/i,
    )
    if (bytesMatch) {
      const baseLabel = invokeTranslate(
        t,
        'app.tlsScanner.embeddedSct',
        'Embedded Signed Certificate Timestamps',
      )
      return bytesMatch[1] ? `${baseLabel} (${bytesMatch[1]} bytes)` : baseLabel
    }
  }

  // Fallback: If value contains non-printable binary characters, format as uppercase hex pairs
  if (hasNonPrintableChars(value)) {
    return Array.from(value)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
      .join(' ')
  }

  return value
}
