import type {
  EfiSignatureList,
  ParsedCertificate,
  SecureBootVarName,
  SimpleTranslateFn,
  TranslateFn,
} from '@/types'
import { WebApiUnavailableError } from '@/utils/api-client'

export const SECURE_BOOT_VARS: readonly SecureBootVarName[] = ['db', 'dbx', 'KEK', 'PK'] as const

export interface ParsedVarEntry {
  signatureLists: EfiSignatureList[]
  rawCert: ParsedCertificate | null
  error: string
}

export interface BootHealthAssessment {
  criticals: string[]
  warnings: string[]
  hasMsWindowsCert: boolean
  hasMsUefiCert: boolean
  latestWindowsDate: Date
  latestWindowsSubject: string
  latestUefiDate: Date
  latestUefiSubject: string
}

interface BootHealthAccumulator {
  hasValidCert: boolean
  hasMsWindowsCert: boolean
  hasMsUefiCert: boolean
  expiredMsWindows: boolean
  expiredMsUefi: boolean
  latestWindowsDate: Date
  latestWindowsSubject: string
  latestUefiDate: Date
  latestUefiSubject: string
  warnings: string[]
}

function invokeTranslate(t: TranslateFn, key: string, options?: Record<string, unknown>): string {
  const fn = t as SimpleTranslateFn
  return options ? fn(key, options) : fn(key)
}

export function extractSubjectCn(subject: string): string {
  const cnMatch = subject.match(/CN=([^,]+)/)
  if (cnMatch?.[1]) {
    return cnMatch[1].trim()
  }
  const orgMatch = subject.match(/O=([^,]+)/)
  if (orgMatch?.[1]) {
    return orgMatch[1].trim()
  }
  return subject
}

export function decodeBase64ToArrayBuffer(base64Data: string): ArrayBuffer {
  const binaryString = atob(base64Data)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export async function parseSecureBootVariablePayload(
  varName: string,
  base64Data: string | undefined,
): Promise<ParsedVarEntry> {
  if (!base64Data) {
    return { signatureLists: [], rawCert: null, error: '' }
  }

  try {
    const { parseEfiSignatureLists, parseRawX509 } = await import('@/utils/efi-parser')
    const buffer = decodeBase64ToArrayBuffer(base64Data)
    const lists = parseEfiSignatureLists(buffer)
    if (lists.length > 0) {
      return { signatureLists: lists, rawCert: null, error: '' }
    }

    const raw = parseRawX509(buffer)
    if (raw) {
      return { signatureLists: [], rawCert: raw, error: '' }
    }

    return {
      signatureLists: [],
      rawCert: null,
      error: `Could not parse ${varName} as an EFI Signature List or X.509 certificate.`,
    }
  } catch (err: unknown) {
    console.error(`Failed to parse Secure Boot variable ${varName}:`, err)
    const detail = err instanceof Error ? err.message : String(err)
    return {
      signatureLists: [],
      rawCert: null,
      error: `Error parsing ${varName}: ${detail}`,
    }
  }
}

export function isWebFallbackError(err: unknown): boolean {
  if (err instanceof WebApiUnavailableError) {
    return true
  }
  if (typeof err === 'object' && err !== null && 'isWebFallback' in err) {
    return Boolean((err as { isWebFallback?: unknown }).isWebFallback)
  }
  return false
}

export function isUserCanceledError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('canceled by the user') || normalized.includes('cancelled by the user')
}

function evaluateCertificateHealth(
  cert: ParsedCertificate,
  acc: BootHealthAccumulator,
  now: Date,
  thirtyDaysFromNow: Date,
  t: TranslateFn,
): void {
  const validTo = new Date(cert.validTo)
  const subject = cert.subject
  const isUnexpired = validTo > now

  if (isUnexpired) {
    acc.hasValidCert = true
  }

  const isMsWindows =
    subject.includes('Windows Production PCA') || subject.includes('Windows UEFI CA 2023')
  const isMsUefi =
    subject.includes('UEFI CA') &&
    subject.includes('Microsoft') &&
    !subject.includes('Windows UEFI CA 2023')

  if (isMsWindows) {
    if (isUnexpired) {
      acc.hasMsWindowsCert = true
      if (validTo > acc.latestWindowsDate) {
        acc.latestWindowsDate = validTo
        acc.latestWindowsSubject = subject
      }
    } else {
      acc.expiredMsWindows = true
    }
  }

  if (isMsUefi) {
    if (isUnexpired) {
      acc.hasMsUefiCert = true
      if (validTo > acc.latestUefiDate) {
        acc.latestUefiDate = validTo
        acc.latestUefiSubject = subject
      }
    } else {
      acc.expiredMsUefi = true
    }
  }

  if (validTo >= now && validTo < thirtyDaysFromNow) {
    acc.warnings.push(invokeTranslate(t, 'app.secureBoot.warnExpiringSoon', { subject }))
  }
}

export function assessBootHealth(
  lists: EfiSignatureList[],
  t: TranslateFn,
  now: Date = new Date(),
): BootHealthAssessment {
  const thirtyDaysFromNow = new Date(now)
  thirtyDaysFromNow.setDate(now.getDate() + 30)

  const acc: BootHealthAccumulator = {
    hasValidCert: false,
    hasMsWindowsCert: false,
    hasMsUefiCert: false,
    expiredMsWindows: false,
    expiredMsUefi: false,
    latestWindowsDate: new Date(0),
    latestWindowsSubject: '',
    latestUefiDate: new Date(0),
    latestUefiSubject: '',
    warnings: [],
  }

  for (const list of lists) {
    for (const sig of list.signatures) {
      if (sig.certificate) {
        evaluateCertificateHealth(sig.certificate, acc, now, thirtyDaysFromNow, t)
      }
    }
  }

  const criticals: string[] = []

  if (!acc.hasValidCert) {
    criticals.push(invokeTranslate(t, 'app.secureBoot.critNoValidDb'))
  }

  if (acc.expiredMsWindows && !acc.hasMsWindowsCert) {
    criticals.push(invokeTranslate(t, 'app.secureBoot.critExpiredWindowsPca'))
  } else if (!acc.hasMsWindowsCert && criticals.length === 0) {
    acc.warnings.push(invokeTranslate(t, 'app.secureBoot.warnMissingWindowsPca'))
  }

  if (acc.expiredMsUefi && !acc.hasMsUefiCert) {
    criticals.push(invokeTranslate(t, 'app.secureBoot.critExpiredUefiCa'))
  }

  return {
    criticals,
    warnings: acc.warnings,
    hasMsWindowsCert: acc.hasMsWindowsCert,
    hasMsUefiCert: acc.hasMsUefiCert,
    latestWindowsDate: acc.latestWindowsDate,
    latestWindowsSubject: acc.latestWindowsSubject,
    latestUefiDate: acc.latestUefiDate,
    latestUefiSubject: acc.latestUefiSubject,
  }
}
