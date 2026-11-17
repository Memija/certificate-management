import type { CertExtension, SimpleTranslateFn, TlsChainCertificate, TranslateFn } from '@/types'

import { derB64ToPem, enrichTlsChain, formatDn } from './tls-chain-enricher'

export { derB64ToPem, enrichTlsChain, formatDn }

export type TlsPresetBadgeType = 'info' | 'purple' | 'success' | 'warning' | 'danger'

export interface TlsQuickPreset {
  label: string
  host: string
  port: number
  isSpecial?: boolean
  badge?: string
  badgeType?: TlsPresetBadgeType
}

export interface DnEntry {
  key: string
  label: string
  value: string
}

export interface ValidityProgress {
  percent: number
  isExpired: boolean
  isExpiringSoon: boolean
  daysRemaining: number
  daysExpired: number
}

export type CertChainRole = 'leaf' | 'intermediate' | 'root'

export const TLS_QUICK_PRESETS: readonly TlsQuickPreset[] = [
  { label: 'home-management.dev', host: 'home-management.dev', port: 443, isSpecial: true },
  { label: 'google.com', host: 'google.com', port: 443, badge: 'TLS 1.3', badgeType: 'info' },
  {
    label: 'cloudflare.com',
    host: 'cloudflare.com',
    port: 443,
    badge: 'ECDSA',
    badgeType: 'purple',
  },
  { label: 'github.com', host: 'github.com', port: 443, badge: 'RSA 2048', badgeType: 'success' },
  {
    label: 'expired.badssl.com',
    host: 'expired.badssl.com',
    port: 443,
    badge: 'Expired',
    badgeType: 'warning',
  },
  {
    label: 'self-signed.badssl.com',
    host: 'self-signed.badssl.com',
    port: 443,
    badge: 'Untrusted',
    badgeType: 'danger',
  },
]

const DN_META: Record<string, readonly [string, string]> = {
  CN: ['Common Name', 'cn'],
  O: ['Organization', 'o'],
  OU: ['Organizational Unit', 'ou'],
  C: ['Country', 'c'],
  ST: ['State / Province', 'st'],
  L: ['Locality', 'l'],
  STREET: ['Street Address', 'street'],
  POSTALCODE: ['Postal Code', 'postalCode'],
  SERIALNUMBER: ['Serial Number', 'serialNumber'],
  E: ['Email', 'email'],
  EMAILADDRESS: ['Email', 'email'],
}

function invokeTranslate(t: TranslateFn, key: string, defaultValue: string): string {
  const fn = t as SimpleTranslateFn
  return fn(key, defaultValue)
}

function getDnFieldLabel(rawKey: string, t?: TranslateFn): string {
  const upper = rawKey.toUpperCase()
  const meta = DN_META[upper]
  const fallback = meta ? meta[0] : upper
  if (!t || !meta) {
    return fallback
  }
  return invokeTranslate(t, `app.tlsScanner.dnFields.${meta[1]}`, fallback)
}

export function parseDnEntries(
  dn: string | Record<string, string> | null | undefined,
  t?: TranslateFn,
): DnEntry[] {
  if (!dn) {
    return []
  }
  if (typeof dn === 'object') {
    return Object.entries(dn)
      .filter(([, val]) => Boolean(val))
      .map(([key, val]) => {
        const upperKey = key.toUpperCase()
        return { key: upperKey, label: getDnFieldLabel(upperKey, t), value: String(val) }
      })
  }

  const rawLabel = t ? invokeTranslate(t, 'app.tlsScanner.rawDn', 'Raw') : 'Raw'
  return dn
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) {
        return { key: 'RAW', label: rawLabel, value: part }
      }
      const key = part.slice(0, eqIdx).trim().toUpperCase()
      return { key, label: getDnFieldLabel(key, t), value: part.slice(eqIdx + 1).trim() }
    })
}

export function calculateValidityProgress(
  validFromStr: string,
  validToStr: string,
  nowMs: number = Date.now(),
): ValidityProgress {
  const from = new Date(validFromStr).getTime()
  const to = new Date(validToStr).getTime()

  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return {
      percent: 100,
      isExpired: !Number.isNaN(to) && nowMs > to,
      isExpiringSoon: false,
      daysRemaining: 0,
      daysExpired: 0,
    }
  }

  const elapsed = Math.max(0, nowMs - from)
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / (to - from)) * 100)))
  const dayMs = 86_400_000
  const daysRemaining = Math.max(0, Math.ceil((to - nowMs) / dayMs))
  const isExpired = nowMs > to
  const daysExpired = isExpired ? Math.max(1, Math.ceil((nowMs - to) / dayMs)) : 0
  return {
    percent,
    isExpired,
    isExpiringSoon: !isExpired && daysRemaining <= 30,
    daysRemaining,
    daysExpired,
  }
}

const AUTH_ERROR_KEYS: Record<string, readonly [string, string]> = {
  DEPTH_ZERO_SELF_SIGNED_CERT: [
    'app.tlsScanner.authErrors.depthZero',
    'Self-Signed Leaf Certificate',
  ],
  SELF_SIGNED_CERT_IN_CHAIN: [
    'app.tlsScanner.authErrors.selfSignedInChain',
    'Self-Signed CA in Chain',
  ],
  CERT_HAS_EXPIRED: ['app.tlsScanner.authErrors.expired', 'Certificate Expired'],
  CERT_NOT_YET_VALID: ['app.tlsScanner.authErrors.notYetValid', 'Certificate Not Yet Valid'],
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: [
    'app.tlsScanner.authErrors.leafSig',
    'Unable to Verify Signature',
  ],
  UNABLE_TO_GET_ISSUER_CERT: [
    'app.tlsScanner.authErrors.missingIssuer',
    'Untrusted / Missing Issuer CA',
  ],
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: [
    'app.tlsScanner.authErrors.missingIssuer',
    'Untrusted / Missing Issuer CA',
  ],
  HOSTNAME_MISMATCH: ['app.tlsScanner.authErrors.hostnameMismatch', 'Hostname Mismatch'],
  ERR_TLS_CERT_ALTNAME_INVALID: ['app.tlsScanner.authErrors.hostnameMismatch', 'Hostname Mismatch'],
}

export function formatAuthError(
  err: string | null | undefined,
  t: TranslateFn,
): { title: string; detail?: string } {
  if (!err || !err.trim()) {
    return { title: invokeTranslate(t, 'app.tlsScanner.metrics.untrusted', 'Validation Issue') }
  }
  const code = err.trim()
  const mapped = AUTH_ERROR_KEYS[code]
  if (mapped) {
    return { title: invokeTranslate(t, mapped[0], mapped[1]), detail: code }
  }
  return { title: code.replace(/_/g, ' '), detail: code }
}

export function parseHostInput(input: string): { host: string; port?: number } {
  let cleaned = input.trim()
  if (cleaned.includes('://')) {
    try {
      const parsed = new URL(cleaned)
      const port = parsed.port ? Number.parseInt(parsed.port, 10) : undefined
      return { host: parsed.hostname, port: port && !Number.isNaN(port) ? port : undefined }
    } catch {
      cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, '')
    }
  }

  const slashIdx = cleaned.indexOf('/')
  if (slashIdx !== -1) {
    cleaned = cleaned.slice(0, slashIdx)
  }

  if (cleaned.startsWith('[')) {
    const endBracket = cleaned.indexOf(']')
    if (endBracket !== -1) {
      const host = cleaned.slice(1, endBracket)
      const portPart = cleaned.slice(endBracket + 1)
      if (portPart.startsWith(':')) {
        const port = Number.parseInt(portPart.slice(1), 10)
        return { host, port: !Number.isNaN(port) ? port : undefined }
      }
      return { host }
    }
  } else if (cleaned.includes(':')) {
    const parts = cleaned.split(':')
    if (parts.length === 2 && parts[1] !== '' && !Number.isNaN(Number(parts[1]))) {
      return { host: parts[0], port: Number.parseInt(parts[1], 10) }
    }
  }

  return { host: cleaned }
}

export function formatKeyDescription(
  cert: Pick<TlsChainCertificate, 'keyType' | 'keyDetails' | 'bits'>,
  t?: TranslateFn,
): string {
  if (cert.keyType === 'ec') {
    return `ECDSA (${cert.keyDetails?.namedCurve || 'ECC'})`
  }
  if (cert.keyType === 'rsa') {
    return `RSA (${cert.keyDetails?.modulusLength || cert.bits || 2048}-bit)`
  }
  if (cert.keyType) {
    return cert.keyType.toUpperCase()
  }
  return t
    ? invokeTranslate(t, 'app.tlsScanner.unknownKey', 'Unknown Public Key')
    : 'Unknown Public Key'
}

export function resolveChainRole(
  cert: TlsChainCertificate,
  idx: number,
  chainLength: number,
): { role: CertChainRole; isSelfSigned: boolean } {
  const isLeaf = idx === 0
  const isSelfSigned = Boolean(
    (cert.issuerCN && cert.issuerCN === cert.subjectCN) ||
    (cert.issuer && formatDn(cert.issuer) === formatDn(cert.subject)),
  )
  const isRoot = (idx === chainLength - 1 && idx > 0) || (isSelfSigned && idx > 0)
  return { role: isLeaf ? 'leaf' : isRoot ? 'root' : 'intermediate', isSelfSigned }
}

export function translateExtensionLabel(ext: CertExtension, t: TranslateFn): string {
  const rawName = ext.name || ''
  const rawOid = ext.oid || ''
  const fallback = rawName || rawOid
  const oidFb = invokeTranslate(
    t,
    `app.winCertStore.extensions.${rawOid.replace(/\./g, '_')}`,
    fallback,
  )
  const lowerFb = invokeTranslate(
    t,
    `app.winCertStore.extensions.${rawName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
    oidFb,
  )
  return invokeTranslate(t, `app.winCertStore.extensions.${rawName.replace(/\s+/g, '')}`, lowerFb)
}

export function triggerPemDownload(pem: string, baseFilename: string): void {
  const safeBase = (baseFilename || 'certificate').replace(/[^a-zA-Z0-9.-]/g, '_')
  const blob = new Blob([pem], { type: 'application/x-pem-file' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeBase}.pem`
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
