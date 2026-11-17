import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Award, Clock, Server } from 'lucide-react'

import type { ExpiryDashboardCertEntry, StoreLocation, StoreName } from '@/types'
import { WebApiUnavailableError } from '@/utils/api-client'

export type SortColumn = 'subject' | 'store' | 'expiry' | 'status'

export interface SortColumnConfig {
  col: SortColumn
  labelKey: string
  defaultLabel: string
  icon: LucideIcon
}

export interface IndexedCertItem {
  cert: ExpiryDashboardCertEntry
  cn: string
  storeKey: string
  notAfterMs: number
}

export interface CertSortability {
  subject: boolean
  store: boolean
  expiry: boolean
  status: boolean
}

export interface IndexedCertSummary {
  expiredCount: number
  expiringSoonCount: number
  indexedCerts: IndexedCertItem[]
  isSortable: CertSortability
}

export const SORT_COLUMNS: readonly SortColumnConfig[] = [
  {
    col: 'expiry',
    labelKey: 'app.dashboard.colExpiryDate',
    defaultLabel: 'Expiry Date',
    icon: Clock,
  },
  {
    col: 'subject',
    labelKey: 'app.dashboard.colCertificate',
    defaultLabel: 'Certificate',
    icon: Award,
  },
  {
    col: 'store',
    labelKey: 'app.dashboard.colStore',
    defaultLabel: 'Store',
    icon: Server,
  },
  {
    col: 'status',
    labelKey: 'app.dashboard.colStatus',
    defaultLabel: 'Status',
    icon: AlertCircle,
  },
]

export const FALLBACK_LOCATIONS: readonly StoreLocation[] = ['CurrentUser', 'LocalMachine']
export const FALLBACK_STORES: readonly StoreName[] = ['My', 'Root', 'CA']

export function extractCertCommonName(subject: string): string {
  return (
    subject.match(/CN=([^,]+)/)?.[1]?.trim() || subject.match(/O=([^,]+)/)?.[1]?.trim() || subject
  )
}

export function getDaysDiff(dateStr: string, nowMs = Date.now()): number {
  const targetMs = new Date(dateStr).getTime()
  if (Number.isNaN(targetMs)) {
    return 0
  }
  return Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24))
}

export function summarizeAndIndexCerts(
  certs: readonly ExpiryDashboardCertEntry[],
): IndexedCertSummary {
  let expiredCount = 0
  let expiringSoonCount = 0
  const subjects = new Set<string>()
  const stores = new Set<string>()
  const expiries = new Set<string>()
  const statuses = new Set<boolean>()

  const indexedCerts = certs.map((cert) => {
    if (cert.isExpired) {
      expiredCount += 1
    } else if (cert.isExpiringSoon) {
      expiringSoonCount += 1
    }

    const cn = extractCertCommonName(cert.subject)
    const storeKey = `${cert.location}\\${cert.storeName}`
    const notAfterMs = new Date(cert.notAfter).getTime()

    subjects.add(cn)
    stores.add(storeKey)
    expiries.add(cert.notAfter)
    statuses.add(cert.isExpired)

    return { cert, cn, storeKey, notAfterMs }
  })

  return {
    expiredCount,
    expiringSoonCount,
    indexedCerts,
    isSortable: {
      subject: subjects.size > 1,
      store: stores.size > 1,
      expiry: expiries.size > 1,
      status: statuses.size > 1,
    },
  }
}

export function sortIndexedCerts(
  indexedCerts: readonly IndexedCertItem[],
  sortCol: SortColumn,
  sortAsc: boolean,
): ExpiryDashboardCertEntry[] {
  const copy = [...indexedCerts]
  copy.sort((a, b) => {
    let diff = 0
    if (sortCol === 'subject') {
      diff = a.cn.localeCompare(b.cn)
    } else if (sortCol === 'store') {
      diff = a.storeKey.localeCompare(b.storeKey)
    } else if (sortCol === 'status') {
      diff = a.cert.isExpired === b.cert.isExpired ? 0 : a.cert.isExpired ? -1 : 1
    } else {
      diff = a.notAfterMs - b.notAfterMs
    }
    return sortAsc ? diff : -diff
  })
  return copy.map((item) => item.cert)
}

export function isWebFallbackError(err: unknown): boolean {
  if (err instanceof WebApiUnavailableError) {
    return true
  }
  if (err !== null && typeof err === 'object' && 'isWebFallback' in err) {
    return Boolean((err as { isWebFallback?: unknown }).isWebFallback)
  }
  return false
}

export interface MinimalFallbackCert {
  thumbprint: string
  subject: string
  issuer: string
  notBefore: string
  notAfter: string
  isExpired: boolean
  isExpiringSoon: boolean
}

export function collectFallbackExpiryCerts(
  getStore: (store: StoreName, location: StoreLocation) => readonly MinimalFallbackCert[],
): ExpiryDashboardCertEntry[] {
  const allCerts: ExpiryDashboardCertEntry[] = []
  for (const location of FALLBACK_LOCATIONS) {
    for (const storeName of FALLBACK_STORES) {
      const storeCerts = getStore(storeName, location)
      for (const cert of storeCerts) {
        if (cert.isExpired || cert.isExpiringSoon) {
          allCerts.push({
            thumbprint: cert.thumbprint,
            subject: cert.subject,
            issuer: cert.issuer,
            notBefore: cert.notBefore,
            notAfter: cert.notAfter,
            isExpired: cert.isExpired,
            isExpiringSoon: cert.isExpiringSoon,
            storeName,
            location,
          })
        }
      }
    }
  }
  return allCerts
}
