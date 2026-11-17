import type { CtEntry, CtLogPreset, CtLogProvider } from '@/types'
import { WebApiUnavailableError } from '@/utils/api-client'

export const CT_PAGE_SIZE = 60

export type CtFilterStatus = 'all' | 'valid' | 'expired'

export interface CtProviderInfo {
  provider: CtLogProvider
  rateLimited: boolean
}

export function isWebFallbackError(err: unknown): boolean {
  if (err instanceof WebApiUnavailableError) {
    return true
  }
  if (typeof err === 'object' && err !== null && 'isWebFallback' in err) {
    return (err as { isWebFallback?: unknown }).isWebFallback === true
  }
  return false
}

export function deduplicateAndSortCtEntries(
  liveItems: CtEntry[],
  sampleItems?: CtEntry[],
): CtEntry[] {
  const seenSerials = new Set<string>()
  const seenIds = new Set<string>()
  const uniqueWithTs: { entry: CtEntry; notBeforeMs: number }[] = []

  const pushIfUnique = (item: CtEntry): void => {
    const serialKey = (item.serial_number || '').toLowerCase()
    const idKey = String(item.id)
    if ((serialKey && seenSerials.has(serialKey)) || seenIds.has(idKey)) {
      return
    }
    if (serialKey) {
      seenSerials.add(serialKey)
    }
    seenIds.add(idKey)
    uniqueWithTs.push({
      entry: item,
      notBeforeMs: new Date(item.not_before).getTime() || 0,
    })
  }

  for (const item of liveItems) {
    pushIfUnique(item)
  }

  if (sampleItems) {
    for (const sampleItem of sampleItems) {
      pushIfUnique(sampleItem)
    }
  }

  uniqueWithTs.sort((a, b) => b.notBeforeMs - a.notBeforeMs)
  return uniqueWithTs.map((item) => item.entry)
}

export function formatCtIssuer(issuer: string): string {
  const cnMatch = issuer.match(/CN=([^,]+)/)
  const oMatch = issuer.match(/O=([^,]+)/)
  if (oMatch?.[1] && cnMatch?.[1]) {
    return `${oMatch[1]} - ${cnMatch[1]}`
  }
  if (cnMatch?.[1]) {
    return cnMatch[1]
  }
  if (oMatch?.[1]) {
    return oMatch[1]
  }
  return issuer
}

export function isCtEntryExpired(notAfter: string, nowMs: number): boolean {
  return new Date(notAfter).getTime() < nowMs
}

export function getPresetBadgeClass(badgeType?: CtLogPreset['badgeType']): string {
  switch (badgeType) {
    case 'success':
      return 'badge-success'
    case 'warning':
      return 'badge-warning'
    case 'purple':
      return 'badge-purple'
    case 'danger':
      return 'badge-danger'
    case 'info':
    default:
      return 'badge-info'
  }
}
