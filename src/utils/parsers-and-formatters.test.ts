import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ALL_APP_MODES, getCategoryForMode, isValidAppMode } from '@/config'
import {
  EDUCATION_TOPICS,
  getCountryName,
  isValidCountryCode,
  PEM_DER_PRESETS,
  PFX_PRESETS,
} from '@/data'
import { ALL_LEARNING_TERMS } from '@/types'

import { isCrlPem, isDerCrl, parseCrlFile, parseCrlText, SAMPLE_CRL_PEM } from './crl-parser'
import { parseEfiSignatureLists } from './efi-parser'
import { formatExpiry, formatExpiryTooltip, getExpiryBreakdown } from './expiry-formatter'
import {
  formatExtensionValue,
  formatKeyUsageValue,
  formatPurposesList,
  splitPurposes,
} from './purpose-formatter'
import { generateRsaKeyPairAsync } from './rsa-key-generator'
import { createCryptographicChain } from './sample-chain-generator'
import {
  detectSystemLanguage,
  normalizeLanguageTag,
  resolveEffectiveTheme,
} from './system-settings'
import { cyrillicToLatin, latinToCyrillic, matchesSearch, stripDiacritics } from './text-search'
import { parsePemToCerts, parseTrustStoreFile } from './trust-store-parser'
import {
  getWebFallbackCertStore,
  getWebFallbackSecureBootVars,
  scanTlsClientSide,
  searchCtLogsClientSide,
  verifyOcspClientSide,
} from './web-fallbacks'

const testCertsDir = path.resolve(process.cwd(), 'test-certs')

const passthroughT = (key: string, defaultOrOpts?: string | Record<string, unknown>): string => {
  if (typeof defaultOrOpts === 'string') {
    return defaultOrOpts
  }
  if (defaultOrOpts && typeof defaultOrOpts.defaultValue === 'string') {
    let out = defaultOrOpts.defaultValue
    for (const [k, v] of Object.entries(defaultOrOpts)) {
      if (k !== 'defaultValue') {
        out = out.replace(`{{${k}}}`, String(v))
      }
    }
    return out
  }
  return key
}

describe('core cryptographic parsers, formatters, search, and fallbacks', () => {
  it('parses PEM and binary DER CRLs and rejects non-CRL files', async () => {
    expect(isCrlPem(SAMPLE_CRL_PEM)).toBe(true)
    const sample = parseCrlText(SAMPLE_CRL_PEM)
    expect(sample.issuer).toContain('CN=Test Issuing CA')
    expect(sample.revokedCertificates.length).toBeGreaterThan(0)

    const derBuf = fs.readFileSync(path.join(testCertsDir, 'test.crl'))
    const uint8 = new Uint8Array(derBuf)
    expect(isDerCrl(uint8)).toBe(true)

    const file = new File([uint8], 'test.crl')
    const parsedFile = await parseCrlFile(file)
    expect(parsedFile.fingerprintSha256).toBeTruthy()

    expect(() =>
      parseCrlText('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'),
    ).toThrow('ERR_CERT_NOT_CRL')
  })

  it('parses PEM, DER, PKCS#7, PKCS#12, and JKS trust stores', async () => {
    const pemBuf = fs.readFileSync(path.join(testCertsDir, 'test.pem'))
    const pemRes = await parseTrustStoreFile(new File([new Uint8Array(pemBuf)], 'test.pem'))
    expect(pemRes.entries.length).toBeGreaterThan(0)

    const derBuf = fs.readFileSync(path.join(testCertsDir, 'test.der'))
    const derRes = await parseTrustStoreFile(new File([new Uint8Array(derBuf)], 'test.der'))
    expect(derRes.format).toBe('X509-DER')
    expect(derRes.entries).toHaveLength(1)

    const p7bBuf = fs.readFileSync(path.join(testCertsDir, 'test.p7b'))
    const p7bRes = await parseTrustStoreFile(new File([new Uint8Array(p7bBuf)], 'test.p7b'))
    expect(p7bRes.format).toBe('PKCS7')
    expect(p7bRes.entries.length).toBeGreaterThan(0)

    const p12Buf = fs.readFileSync(path.join(testCertsDir, 'test.p12'))
    const p12NoPass = await parseTrustStoreFile(new File([new Uint8Array(p12Buf)], 'test.p12'), '')
    expect(p12NoPass.format).toBe('PKCS12')

    const jksBuf = fs.readFileSync(path.join(testCertsDir, 'test.jks'))
    const jksRes = await parseTrustStoreFile(new File([new Uint8Array(jksBuf)], 'test.jks'))
    expect(jksRes.format).toBe('JKS')
    expect(jksRes.entries.length).toBeGreaterThan(0)
  })

  it('synthesizes and parses Secure Boot EFI signature lists and certificate chains', () => {
    const vars = getWebFallbackSecureBootVars()
    expect(vars.db).toBeTruthy()
    expect(vars.KEK).toBeTruthy()
    expect(vars.PK).toBeTruthy()
    expect(vars.dbx).toBeTruthy()

    const decodeB64 = (b64: string): ArrayBuffer => {
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i)
      }
      return arr.buffer
    }

    const dbLists = parseEfiSignatureLists(decodeB64(vars.db))
    expect(dbLists.length).toBeGreaterThan(0)
    expect(dbLists[0].signatures[0].certificate?.subject).toContain('UEFI')

    const dbxLists = parseEfiSignatureLists(decodeB64(vars.dbx))
    expect(dbxLists[0].signatureTypeName).toBe('EFI_CERT_SHA256_GUID')
    expect(dbxLists[0].signatures.length).toBeGreaterThan(0)

    const webChain = createCryptographicChain('3-tier-web')
    expect(webChain).toHaveLength(3)
    expect(parsePemToCerts(webChain[0].pem)).toHaveLength(1)

    const enterpriseChain = createCryptographicChain('4-tier-enterprise')
    expect(enterpriseChain).toHaveLength(4)

    const multiLeaf = createCryptographicChain('multi-leaf-branch')
    expect(multiLeaf).toHaveLength(4)

    const brokenChain = createCryptographicChain('broken-intermediate')
    expect(brokenChain).toHaveLength(2)
  })

  it('formats expiry durations, certificate purposes, and X.509 extensions', () => {
    const base = new Date('2026-06-01T00:00:00Z')
    const future = new Date('2027-08-15T00:00:00Z')
    const past = new Date('2026-05-10T00:00:00Z')

    const futureBreakdown = getExpiryBreakdown(future, base)
    expect(futureBreakdown.isExpired).toBe(false)
    expect(futureBreakdown.years).toBe(1)

    expect(formatExpiry(future, passthroughT, 'en', { baseDate: base })).toContain('1 year')
    expect(formatExpiry(past, passthroughT, 'en', { baseDate: base })).toContain('ago')
    expect(formatExpiryTooltip(future, passthroughT, 'en', base)).toContain('days')

    expect(splitPurposes(['Digital Signature, Key Encipherment (a0)'])).toEqual([
      'Digital Signature',
      'Key Encipherment',
    ])
    expect(formatKeyUsageValue('Digital Signature, CRL Signing (86)', passthroughT)).toContain(
      '(86)',
    )
    expect(formatPurposesList(['Server Authentication'], passthroughT)).toContain(
      'Server Authentication',
    )
    expect(
      formatExtensionValue('basicConstraints', '2.5.29.19', 'Is CA: Yes', passthroughT),
    ).toContain('Is CA: Yes')
  })

  it('supports bidirectional Cyrillic-Latin transliteration and diacritic-insensitive search', () => {
    const cyr = 'Сертификат Ђорђе Љубљана'
    const lat = cyrillicToLatin(cyr)
    expect(lat).toContain('Sertifikat')
    expect(latinToCyrillic('Sertifikat')).toBe('Сертификат')
    expect(stripDiacritics('Čćžšđ')).toBe('Cczsdj')

    expect(matchesSearch(cyr, 'sertifikat dorde')).toBe(true)
    expect(matchesSearch('CN=DigiCert Global Root G2', 'digicert root')).toBe(true)
    expect(matchesSearch('CN=DigiCert Global Root G2', 'nonexistent-xyz')).toBe(false)
  })

  it('covers web fallbacks, country codes, config, education topics, and async RSA keygen', async () => {
    expect(isValidCountryCode('BA')).toBe(true)
    expect(isValidCountryCode('ZZZ')).toBe(false)
    expect(getCountryName('DE', 'en')).toBeTruthy()

    expect(Object.keys(EDUCATION_TOPICS).sort()).toEqual([...ALL_LEARNING_TERMS].sort())
    expect(PEM_DER_PRESETS[0].createFile().name).toContain('.pem')
    expect(PFX_PRESETS.length).toBeGreaterThan(0)

    for (const m of ALL_APP_MODES) {
      expect(isValidAppMode(m)).toBe(true)
      expect(getCategoryForMode(m)).toBeTruthy()
    }

    expect(normalizeLanguageTag('sr_Cyrl_RS')).toBe('sr-Cyrl')
    expect(normalizeLanguageTag('de-AT')).toBe('de')
    expect(detectSystemLanguage({ userLanguages: ['bs-BA'] })).toBe('bs')
    expect(resolveEffectiveTheme('dark')).toBe('dark')

    const rootStore = getWebFallbackCertStore('Root', 'LocalMachine')
    expect(rootStore.length).toBeGreaterThan(0)

    const tlsGood = scanTlsClientSide('github.com', 443)
    expect(tlsGood.authorized).toBe(true)
    expect(tlsGood.chain.length).toBe(3)

    const tlsExpired = scanTlsClientSide('expired.badssl.com', 443)
    expect(tlsExpired.authorized).toBe(false)
    expect(tlsExpired.authorizationError).toBe('CERT_HAS_EXPIRED')

    const ocspRevoked = verifyOcspClientSide('', null, 'revoked-badssl')
    expect(ocspRevoked.status).toBe('revoked')

    const ctRes = await searchCtLogsClientSide('github.com')
    expect(ctRes.data.length).toBeGreaterThan(0)

    const kp = await generateRsaKeyPairAsync(2048)
    expect(kp.privateKey.n.bitLength()).toBe(2048)
  })
})
