import forge from 'node-forge'

import type { OcspParsedCertInput, OcspSamplePreset, SimpleTranslateFn, TranslateFn } from '@/types'
import { uint8ToBinaryString } from '@/utils/x509-parser'

import {
  extractAiaOcspUrl,
  extractCdpCrlUrl,
  type ForgeCertExtension,
  isValidX509Der,
  parseForgeCertWithEccSupport,
  stripPemToCleanBase64,
} from './ocsp-asn1'

export { isValidX509Der }

export type NonCertInputType = 'csr' | 'key' | 'crl'

const PRESET_I18N_PREFIX: Record<string, string> = {
  'revoked-badssl': 'app.ocsp.presets.revokedBadssl',
  'valid-digicert': 'app.ocsp.presets.validDigicert',
  'valid-github-sectigo': 'app.ocsp.presets.validGithub',
  'valid-letsencrypt': 'app.ocsp.presets.validLetsencrypt',
  'offline-selfsigned': 'app.ocsp.presets.offlineSelfsigned',
}

const PRESET_SERIALS: Record<string, string> = {
  'revoked-badssl': '050a72b7ae90c2e1c61bb7d1568032f79549',
  'valid-digicert': '0aec2491f01c8c5a0d19f41f9ba3e4cd',
  'valid-github-sectigo': 'a59ebdb596751db7f5c095079613953c',
  'valid-letsencrypt': '0543933be386b3a2b3adb534f2103bc8b65f',
}

function tr(t: TranslateFn, key: string, fallback: string): string {
  return (t as SimpleTranslateFn)(key, fallback)
}

export function getLocalizedPresetMeta(
  preset: OcspSamplePreset,
  t: TranslateFn,
): { name: string; badge: string; category: string; description: string } {
  const p = PRESET_I18N_PREFIX[preset.id]
  if (!p) {
    return {
      name: preset.name,
      badge: preset.badge,
      category: preset.category,
      description: preset.description,
    }
  }
  return {
    name: tr(t, `${p}.name`, preset.name),
    badge: tr(t, `${p}.badge`, preset.badge),
    category: tr(t, `${p}.category`, preset.category),
    description: tr(t, `${p}.description`, preset.description),
  }
}

export function detectNonCertInputType(input: string): NonCertInputType | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/i.test(trimmed)) {
    return 'csr'
  }
  if (/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/i.test(trimmed)) {
    return 'key'
  }
  if (/-----BEGIN (?:X509 )?CRL-----/i.test(trimmed)) {
    return 'crl'
  }
  return null
}

export function parseOcspCertInput(
  certInput: string,
  activePreset: OcspSamplePreset | null,
  t: TranslateFn,
): OcspParsedCertInput | null {
  const trimmed = certInput.trim()
  if (
    !trimmed ||
    !/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(trimmed) ||
    detectNonCertInputType(trimmed)
  ) {
    return null
  }
  if (activePreset && activePreset.certificatePem.trim() === trimmed) {
    return {
      subject: activePreset.subject,
      issuer: activePreset.issuer,
      serialNumber: PRESET_SERIALS[activePreset.id] || '01a4b5c6d7e8f9',
      notBefore: new Date('2024-01-01'),
      notAfter: new Date('2026-12-31'),
      isExpired: false,
      isValidPeriod: true,
      ocspUrl: activePreset.ocspUrl,
      crlUrl: activePreset.crlUrl,
    }
  }

  const cert = parseForgeCertWithEccSupport(trimmed)
  if (!cert) {
    return null
  }

  const subAttrs = cert.subject.attributes
    .map((a) => `${a.shortName || a.name || 'attr'}=${String(a.value)}`)
    .join(', ')
  const issAttrs = cert.issuer.attributes
    .map((a) => `${a.shortName || a.name || 'attr'}=${String(a.value)}`)
    .join(', ')
  const now = new Date()
  const notBefore = cert.validity?.notBefore || now
  const notAfter = cert.validity?.notAfter || now

  let ocspUrl: string | null = null
  let crlUrl: string | null = null
  for (const ext of (cert.extensions || []) as ForgeCertExtension[]) {
    if (ext.id === '1.3.6.1.5.5.7.1.1' || ext.name === 'authorityInfoAccess') {
      ocspUrl = extractAiaOcspUrl(ext.value) ?? ocspUrl
    }
    if (ext.id === '2.5.29.31' || ext.name === 'cRLDistributionPoints') {
      crlUrl = crlUrl ?? extractCdpCrlUrl(ext.value)
    }
  }

  return {
    subject: subAttrs || tr(t, 'app.ocsp.unknownSubject', 'Unknown Subject'),
    issuer: issAttrs || tr(t, 'app.ocsp.unknownIssuer', 'Unknown Issuer'),
    serialNumber: cert.serialNumber || tr(t, 'app.ocsp.unknownSerial', 'Unknown'),
    notBefore,
    notAfter,
    isExpired: now > notAfter,
    isValidPeriod: now >= notBefore && now <= notAfter,
    ocspUrl,
    crlUrl,
  }
}

function getNonCertMessage(kind: NonCertInputType | 'json', t: TranslateFn): string {
  if (kind === 'json') {
    return tr(
      t,
      'app.ocsp.jsonNotCert',
      'The provided file or content is JSON, not an X.509 certificate.',
    )
  }
  if (kind === 'csr') {
    return tr(
      t,
      'app.ocsp.csrNotCert',
      'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate.',
    )
  }
  if (kind === 'key') {
    return tr(
      t,
      'app.ocsp.keyNotCert',
      'The provided data is a Private Key, not an X.509 certificate.',
    )
  }
  return tr(
    t,
    'app.ocsp.crlNotCert',
    'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate.',
  )
}

export function validateOcspFileExtension(fileName: string, t: TranslateFn): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext || ['pem', 'cer', 'crt', 'der'].includes(ext)) {
    return null
  }
  if (ext === 'json') {
    return getNonCertMessage('json', t)
  }
  if (ext === 'csr' || ext === 'req') {
    return getNonCertMessage('csr', t)
  }
  if (ext === 'key') {
    return getNonCertMessage('key', t)
  }
  if (ext === 'crl') {
    return getNonCertMessage('crl', t)
  }
  return tr(
    t,
    'app.ocsp.unsupportedFileType',
    'Unsupported file type. Please upload a certificate file (.pem, .cer, .crt, .der).',
  )
}

export function parseUploadedOcspFileBytes(
  bytes: Uint8Array,
  t: TranslateFn,
): { pem?: string; error?: string } {
  const text = new TextDecoder('utf-8').decode(bytes)
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { error: getNonCertMessage('json', t) }
  }
  const nonCert = detectNonCertInputType(trimmed)
  if (nonCert) {
    return { error: getNonCertMessage(nonCert, t) }
  }
  if (/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(text)) {
    try {
      stripPemToCleanBase64(text)
      return { pem: trimmed }
    } catch {
      return {
        error: tr(
          t,
          'app.ocsp.invalidPem',
          'Invalid PEM certificate provided. Please check the certificate formatting.',
        ),
      }
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0x30) {
    const binary = uint8ToBinaryString(bytes)
    if (isValidX509Der(binary)) {
      const b64 = forge.util.encode64(binary)
      return {
        pem: `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)?.join('\n') || b64}\n-----END CERTIFICATE-----`,
      }
    }
  }
  return {
    error: tr(
      t,
      'app.ocsp.invalidFile',
      'Could not parse uploaded file as PEM or DER X.509 certificate.',
    ),
  }
}

export function validateOcspPemBeforeCheck(
  input: string,
  t: TranslateFn,
): { certB64?: string; error?: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    return {
      error: tr(
        t,
        'app.ocsp.emptyError',
        'Please provide a PEM certificate or select a test example above.',
      ),
    }
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { error: getNonCertMessage('json', t) }
  }
  const nonCert = detectNonCertInputType(trimmed)
  if (nonCert) {
    return { error: getNonCertMessage(nonCert, t) }
  }
  if (!/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(trimmed)) {
    return {
      error: tr(
        t,
        'app.ocsp.missingPemHeaders',
        'Please provide a certificate in PEM format starting with -----BEGIN CERTIFICATE-----.',
      ),
    }
  }
  try {
    return { certB64: stripPemToCleanBase64(input) }
  } catch {
    return {
      error: tr(
        t,
        'app.ocsp.invalidPem',
        'Invalid PEM certificate provided. Please check the certificate formatting.',
      ),
    }
  }
}
