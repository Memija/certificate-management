import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Archive, FileKey, FileText, Lock, Shield, ShieldCheck } from 'lucide-react'
import forge from 'node-forge'

import {
  getSampleCertDerBuffer,
  PFX_PRESETS,
  SAMPLE_MATCHING_CERT_PEM,
  SAMPLE_RSA4096_CERT_PEM,
} from '@/data'
import type {
  AppMode,
  ParsedTrustStore,
  SimpleTranslateFn,
  TranslateFn,
  TrustStoreEntry,
  TrustStoreFormat,
} from '@/types'

export type FormatTone = 'cyan' | 'info' | 'purple' | 'warning' | 'success' | 'danger'

export interface FormatMeta {
  key: string
  label: string
  tone: FormatTone
  Icon: LucideIcon
}

export interface LoadedTrustStoreFile {
  id: string
  name: string
  store: ParsedTrustStore
  needsPassword?: boolean
  pendingFile?: File
  passwordInput?: string
  loading?: boolean
  isSample?: boolean
  samplePasswordHint?: string
}

export interface TrustStoreSamplePreset {
  id: string
  nameKey: string
  defaultName: string
  badgeKey: string
  defaultBadge: string
  fileName: string
  passwordHint?: string
  createFile: () => File
}

export interface LocalizedWarningInfo {
  text: string
  targetMode?: AppMode
  actionKey?: string
  actionDefault?: string
}

export const SUPPORTED_EXTENSIONS = [
  '.cer',
  '.crt',
  '.pem',
  '.der',
  '.p7b / .p7c',
  '.p12 / .pfx',
  '.jks',
  '.keystore',
] as const

export const FORMAT_METADATA: Record<TrustStoreFormat, FormatMeta> = {
  'X509-DER': {
    key: 'app.trustStore.format.x509Der',
    label: 'DER Certificate',
    tone: 'cyan',
    Icon: Shield,
  },
  'X509-PEM': {
    key: 'app.trustStore.format.x509Pem',
    label: 'PEM Certificate',
    tone: 'info',
    Icon: FileText,
  },
  'PEM-Bundle': {
    key: 'app.trustStore.format.pemBundle',
    label: 'PEM Bundle',
    tone: 'purple',
    Icon: Archive,
  },
  PKCS7: {
    key: 'app.trustStore.format.pkcs7',
    label: 'PKCS#7 Chain',
    tone: 'warning',
    Icon: ShieldCheck,
  },
  PKCS12: {
    key: 'app.trustStore.format.pkcs12',
    label: 'PKCS#12 / PFX',
    tone: 'warning',
    Icon: Lock,
  },
  JKS: {
    key: 'app.trustStore.format.jks',
    label: 'Java KeyStore',
    tone: 'success',
    Icon: FileKey,
  },
  CRL: {
    key: 'app.trustStore.format.crl',
    label: 'Certificate Revocation List',
    tone: 'danger',
    Icon: AlertTriangle,
  },
  Unknown: {
    key: 'app.trustStore.format.unknown',
    label: 'Unknown Format',
    tone: 'danger',
    Icon: AlertTriangle,
  },
}

export function getFormatMeta(format: TrustStoreFormat): FormatMeta {
  return FORMAT_METADATA[format] ?? FORMAT_METADATA.Unknown
}

export function getEntryKey(entry: TrustStoreEntry): string {
  return `${entry.alias}::${entry.certificate.serialNumber}::${entry.certificate.fingerprintSha256}`
}

export function isSameEntry(a: TrustStoreEntry | null, b: TrustStoreEntry | null): boolean {
  if (!a || !b) {
    return false
  }
  return getEntryKey(a) === getEntryKey(b)
}

let cachedSampleP12Buffer: ArrayBuffer | null = null

export function getSamplePkcs12Buffer(): ArrayBuffer {
  if (!cachedSampleP12Buffer) {
    const preset = PFX_PRESETS[0]
    const cert = forge.pki.certificateFromPem(preset.certPem)
    const key = forge.pki.privateKeyFromPem(preset.keyPem)
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], preset.defaultPassword, {
      algorithm: '3des',
      friendlyName: preset.commonName,
    })
    const derStr = forge.asn1.toDer(p12Asn1).getBytes()
    const bytes = new Uint8Array(derStr.length)
    for (let i = 0; i < derStr.length; i += 1) {
      bytes[i] = derStr.charCodeAt(i)
    }
    cachedSampleP12Buffer = bytes.buffer
  }
  return cachedSampleP12Buffer.slice(0)
}

export const TRUST_STORE_SAMPLE_PRESETS: readonly TrustStoreSamplePreset[] = [
  {
    id: 'sample-pem-bundle',
    nameKey: 'app.trustStore.format.pemBundle',
    defaultName: 'PEM Bundle',
    badgeKey: 'app.trustStore.inspector.pills.pemBundle',
    defaultBadge: 'PEM Bundles',
    fileName: 'sample_trust_bundle.pem',
    createFile: () =>
      new File(
        [`${SAMPLE_MATCHING_CERT_PEM}\n${SAMPLE_RSA4096_CERT_PEM}`],
        'sample_trust_bundle.pem',
        { type: 'application/x-pem-file' },
      ),
  },
  {
    id: 'sample-der-cert',
    nameKey: 'app.trustStore.format.x509Der',
    defaultName: 'DER Certificate',
    badgeKey: 'app.formatConverter.badgeDer',
    defaultBadge: 'DER (Binary)',
    fileName: 'sample_webserver_cert.der',
    createFile: () =>
      new File([getSampleCertDerBuffer()], 'sample_webserver_cert.der', {
        type: 'application/x-x509-ca-cert',
      }),
  },
  {
    id: 'sample-encrypted-p12',
    nameKey: 'app.trustStore.format.pkcs12',
    defaultName: 'PKCS#12 / PFX',
    badgeKey: 'app.formatConverter.presetPfxRsa2048',
    defaultBadge: 'Web Server (RSA 2048)',
    fileName: 'sample_keystore.p12',
    passwordHint: PFX_PRESETS[0].defaultPassword,
    createFile: () =>
      new File([getSamplePkcs12Buffer()], 'sample_keystore.p12', {
        type: 'application/x-pkcs12',
      }),
  },
]

const STATIC_WARNINGS: Record<string, [string, string]> = {
  ERR_PRIVATE_KEY_FILE: [
    'app.trustStore.warnings.privateKeyFile',
    'This file contains a Private Key, not a certificate trust store.',
  ],
  ERR_COULD_NOT_PARSE_PEM: [
    'app.trustStore.warnings.couldNotParsePem',
    'Could not parse PEM file. Ensure it contains valid X.509 certificates or PKCS#7 data.',
  ],
  'Could not parse PEM file.': [
    'app.trustStore.warnings.couldNotParsePem',
    'Could not parse PEM file. Ensure it contains valid X.509 certificates or PKCS#7 data.',
  ],
  ERR_COULD_NOT_PARSE_DER: [
    'app.trustStore.warnings.couldNotParseDer',
    'Could not parse this DER file as X.509, PKCS#7, or PKCS#12.',
  ],
  ERR_UNRECOGNIZED_FORMAT: [
    'app.trustStore.warnings.unrecognizedFormat',
    'Unrecognized file format. Supported formats: PEM, DER, PKCS#7 (.p7b), PKCS#12 (.p12/.pfx), JKS.',
  ],
  'This PKCS#12 file requires a password.': [
    'app.trustStore.warnings.pkcs12RequiresPassword',
    'This PKCS#12 file requires a password.',
  ],
  'Incorrect password.': ['app.trustStore.inspector.incorrectPassword', 'Incorrect password.'],
}

function invokeTranslate(
  t: TranslateFn,
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
): string {
  const fn = t as SimpleTranslateFn
  return options ? fn(key, defaultValue, options) : fn(key, defaultValue)
}

export function localizeTrustStoreWarning(
  warning: string,
  format: TrustStoreFormat,
  t: TranslateFn,
): LocalizedWarningInfo {
  if (warning.includes('Private keys are never displayed')) {
    const match = warning.match(/contains (\d+) private key/)
    return match
      ? {
          text: invokeTranslate(
            t,
            'app.trustStore.warnings.privateKeyCount',
            'This file contains {{count}} private key(s).',
            { count: parseInt(match[1], 10) },
          ),
        }
      : {
          text: invokeTranslate(
            t,
            'app.trustStore.warnings.privateKey',
            'This file contains a private key entry.',
          ),
        }
  }

  if (warning.includes('JKS MAC verification skipped')) {
    return {
      text: invokeTranslate(
        t,
        'app.trustStore.warnings.jksMacSkipped',
        'JKS MAC verification skipped. Private keys are encrypted and require a password.',
      ),
    }
  }

  if (warning.includes('private key is encrypted')) {
    const aliasMatch = warning.match(/Alias "([^"]+)"/)
    if (aliasMatch) {
      return {
        text: invokeTranslate(
          t,
          'app.trustStore.warnings.jksPrivKeySkipped',
          'Alias "{{alias}}": private key is encrypted.',
          { alias: aliasMatch[1] },
        ),
      }
    }
  }

  if (
    warning === 'ERR_CRL_FILE' ||
    format === 'CRL' ||
    warning.includes('Certificate Revocation List')
  ) {
    return {
      text: invokeTranslate(
        t,
        'app.trustStore.warnings.crlFile',
        'This file is a Certificate Revocation List (CRL), not a certificate trust store. Please inspect this file in the CRL Inspector.',
      ),
      targetMode: 'crl-inspector',
      actionKey: 'app.trustStore.warnings.goToCrlInspector',
      actionDefault: 'Open in CRL Inspector',
    }
  }

  if (warning === 'ERR_CSR_FILE' || warning.includes('Certificate Signing Request')) {
    return {
      text: invokeTranslate(
        t,
        'app.trustStore.warnings.csrFile',
        'This file contains a Certificate Signing Request (CSR), not a certificate trust store. Please inspect this file in the CSR Inspector.',
      ),
      targetMode: 'csr-inspector',
      actionKey: 'app.trustStore.warnings.goToCsrInspector',
      actionDefault: 'Open in CSR Inspector',
    }
  }

  const mapped = STATIC_WARNINGS[warning]
  if (mapped) {
    return { text: invokeTranslate(t, mapped[0], mapped[1]) }
  }
  if (warning.includes('Could not parse this DER file as X.509')) {
    return { text: invokeTranslate(t, ...STATIC_WARNINGS.ERR_COULD_NOT_PARSE_DER) }
  }
  if (warning.includes('Unrecognized file format')) {
    return { text: invokeTranslate(t, ...STATIC_WARNINGS.ERR_UNRECOGNIZED_FORMAT) }
  }
  return { text: warning }
}

export function downloadPrivateKeyFile(privateKeyPem: string, alias: string): string {
  const safeBase = alias.replace(/[^a-zA-Z0-9_-]/g, '_') || 'private_key'
  const filename = `${safeBase}.key`
  const blob = new Blob([privateKeyPem], { type: 'application/x-pem-file' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
  return filename
}
