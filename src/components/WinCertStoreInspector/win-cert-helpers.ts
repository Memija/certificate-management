import type {
  SimpleTranslateFn,
  StoreLocation,
  StoreName,
  TranslateFn,
  WinCertEntry,
} from '@/types'
import { WebApiUnavailableError } from '@/utils/api-client'
import { matchesPreparedSearch, prepareSearchQuery } from '@/utils/text-search'

export type TimelineFilterType = 'all' | 'valid' | '30days' | 'expired'

export type SortOption = 'default' | 'expiry' | 'name'

export type StoreTone = 'success' | 'cyan' | 'purple' | 'warning' | 'danger'

export interface StoreMeta {
  name: StoreName
  defaultLabel: string
  defaultDesc: string
  tone: StoreTone
}

export const STORE_LOCATIONS: readonly StoreLocation[] = ['CurrentUser', 'LocalMachine'] as const

export const STORES: readonly StoreMeta[] = [
  {
    name: 'Root',
    defaultLabel: 'Trusted Root CAs',
    defaultDesc: 'Self-signed root certificate authorities',
    tone: 'success',
  },
  {
    name: 'CA',
    defaultLabel: 'Intermediate CAs',
    defaultDesc: 'Intermediate certificate authorities',
    tone: 'cyan',
  },
  {
    name: 'My',
    defaultLabel: 'Personal',
    defaultDesc: 'Your personal certificates with private keys',
    tone: 'purple',
  },
  {
    name: 'TrustedPublisher',
    defaultLabel: 'Trusted Publishers',
    defaultDesc: 'Trusted code-signing publishers',
    tone: 'warning',
  },
  {
    name: 'Disallowed',
    defaultLabel: 'Untrusted',
    defaultDesc: 'Explicitly distrusted / revoked certificates',
    tone: 'danger',
  },
] as const

export interface IndexedWinCert {
  cert: WinCertEntry
  origIdx: number
  notAfterMs: number
  searchTarget: string
}

export interface WinCertStats {
  total: number
  valid: number
  expiringSoon: number
  expired: number
}

export interface ClassifiedStoreError {
  isFallback: boolean
  needsElevation: boolean
  errorKeyOrMessage: string
}

function invokeTranslate(t: TranslateFn, key: string, defaultValue: string): string {
  const fn = t as SimpleTranslateFn
  return fn(key, defaultValue)
}

export function extractDnDisplayName(dn: string): string {
  const cnMatch = dn.match(/CN=([^,]+)/)
  if (cnMatch?.[1]) {
    return cnMatch[1].trim()
  }
  const orgMatch = dn.match(/O=([^,]+)/)
  if (orgMatch?.[1]) {
    return orgMatch[1].trim()
  }
  return dn
}

export function sanitizeWinCertFilename(entry: WinCertEntry): string {
  const cnMatch = entry.subject.match(/CN=([^,]+)/)
  const rawBase =
    cnMatch?.[1]?.trim() || entry.serialNumber || entry.thumbprint.slice(0, 10) || 'certificate'
  const cleaned = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned || 'certificate'
}

export function decodeWinCertDerBytes(entry: WinCertEntry): Uint8Array<ArrayBuffer> {
  const b64 = entry.certB64 || entry.pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '')
  if (!b64) {
    throw new Error('Empty certificate payload')
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function triggerWinCertDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function translateWinExtensionName(name: string, t: TranslateFn): string {
  const compactKey = `app.winCertStore.extensions.${name.replace(/\s+/g, '')}`
  const lowerKey = `app.winCertStore.extensions.${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
  const lowerTranslated = invokeTranslate(t, lowerKey, name)
  return invokeTranslate(t, compactKey, lowerTranslated)
}

export function computeCertStoreStats(certs: readonly WinCertEntry[]): WinCertStats {
  let expired = 0
  let expiringSoon = 0
  for (const cert of certs) {
    if (cert.isExpired) {
      expired += 1
    } else if (cert.isExpiringSoon) {
      expiringSoon += 1
    }
  }
  return {
    total: certs.length,
    valid: certs.length - expired,
    expiringSoon,
    expired,
  }
}

export function indexWinCerts(certs: readonly WinCertEntry[]): IndexedWinCert[] {
  return certs.map((cert, origIdx) => ({
    cert,
    origIdx,
    notAfterMs: new Date(cert.notAfter).getTime(),
    searchTarget: [cert.subject, cert.issuer, cert.thumbprint, cert.friendlyName]
      .filter(Boolean)
      .join(' '),
  }))
}

export function filterAndSortWinCerts(
  indexed: readonly IndexedWinCert[],
  searchQuery: string,
  timelineFilter: TimelineFilterType,
  sortBy: SortOption,
  sortAsc: boolean,
): WinCertEntry[] {
  const preparedQuery = prepareSearchQuery(searchQuery)

  const matching = indexed.filter(({ cert, searchTarget }) => {
    if (timelineFilter === 'expired' && !cert.isExpired) {
      return false
    }
    if (timelineFilter === 'valid' && cert.isExpired) {
      return false
    }
    if (timelineFilter === '30days' && (!cert.isExpiringSoon || cert.isExpired)) {
      return false
    }
    if (preparedQuery.empty) {
      return true
    }
    return matchesPreparedSearch(searchTarget, preparedQuery)
  })

  matching.sort((a, b) => {
    if (sortBy === 'expiry') {
      const diff = a.notAfterMs - b.notAfterMs
      return sortAsc ? diff : -diff
    }
    if (sortBy === 'name') {
      const diff = a.cert.subject.localeCompare(b.cert.subject)
      return sortAsc ? diff : -diff
    }
    return sortAsc ? a.origIdx - b.origIdx : b.origIdx - a.origIdx
  })

  return matching.map((item) => item.cert)
}

export function classifyWinStoreError(err: unknown, elevate: boolean): ClassifiedStoreError {
  if (
    err instanceof WebApiUnavailableError ||
    (typeof err === 'object' &&
      err !== null &&
      'isWebFallback' in err &&
      Boolean((err as { isWebFallback?: unknown }).isWebFallback))
  ) {
    return { isFallback: true, needsElevation: false, errorKeyOrMessage: '' }
  }

  const errorMsg = err instanceof Error ? err.message : String(err)
  const lower = errorMsg.toLowerCase()

  if (lower.includes('canceled by the user') || lower.includes('cancelled by the user')) {
    return { isFallback: false, needsElevation: false, errorKeyOrMessage: 'userCanceled' }
  }

  if (
    !elevate &&
    (lower.includes('access') || lower.includes('denied') || lower.includes('privilege'))
  ) {
    return { isFallback: false, needsElevation: true, errorKeyOrMessage: '' }
  }

  return { isFallback: false, needsElevation: false, errorKeyOrMessage: errorMsg }
}
