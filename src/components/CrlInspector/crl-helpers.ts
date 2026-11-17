import type { LucideIcon } from 'lucide-react'
import {
  Ban,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  ShieldOff,
  UserX,
} from 'lucide-react'

import type { AppMode, SimpleTranslateFn, TranslateFn } from '@/types'

export type ReasonTone = 'danger' | 'info' | 'warning' | 'purple' | 'success' | 'neutral'

export interface ReasonMeta {
  tone: ReasonTone
  Icon: LucideIcon
}

export interface CrlErrorAction {
  labelKey: string
  defaultLabel: string
  targetMode: AppMode
}

export interface CrlErrorInfo {
  fileName: string
  code: string
  subject?: string
  action?: CrlErrorAction | null
}

const REASON_KEY_MAP: Record<string, string> = {
  Unspecified: 'unspecified',
  'Key Compromise': 'keyCompromise',
  'CA Compromise': 'caCompromise',
  'Affiliation Changed': 'affiliationChanged',
  Superseded: 'superseded',
  'Cessation Of Operation': 'cessationOfOperation',
  'Certificate Hold': 'certificateHold',
  'Remove From CRL': 'removeFromCRL',
  'Privilege Withdrawn': 'privilegeWithdrawn',
  'AA Compromise': 'aaCompromise',
}

export const EXTENSION_DISPLAY_NAMES: Record<string, string> = {
  crlNumber: 'CRL Number',
  crlReason: 'CRL Reason',
  deltaCRLIndicator: 'Delta CRL Indicator',
  issuingDistributionPoint: 'Issuing Distribution Point',
  authorityKeyIdentifier: 'Authority Key Identifier',
}

export const REASON_CONFIGS: Record<string, ReasonMeta> = {
  keyCompromise: { tone: 'danger', Icon: KeyRound },
  caCompromise: { tone: 'danger', Icon: ShieldAlert },
  aaCompromise: { tone: 'danger', Icon: ShieldAlert },
  superseded: { tone: 'info', Icon: RefreshCw },
  cessationOfOperation: { tone: 'warning', Icon: Ban },
  affiliationChanged: { tone: 'purple', Icon: UserX },
  certificateHold: { tone: 'warning', Icon: PauseCircle },
  privilegeWithdrawn: { tone: 'warning', Icon: ShieldOff },
  removeFromCRL: { tone: 'success', Icon: CheckCircle2 },
  unspecified: { tone: 'neutral', Icon: HelpCircle },
}

export function getReasonKey(reason: string): string {
  if (REASON_KEY_MAP[reason]) {
    return REASON_KEY_MAP[reason]
  }
  const normalized = reason.toLowerCase().replace(/[\s_-]+/g, '')
  if (normalized.includes('keycompromise')) {
    return 'keyCompromise'
  }
  if (normalized.includes('cacompromise')) {
    return 'caCompromise'
  }
  if (normalized.includes('aacompromise')) {
    return 'aaCompromise'
  }
  if (normalized.includes('compromise')) {
    return 'keyCompromise'
  }
  if (normalized.includes('superseded')) {
    return 'superseded'
  }
  if (normalized.includes('cessation')) {
    return 'cessationOfOperation'
  }
  if (normalized.includes('affiliation')) {
    return 'affiliationChanged'
  }
  if (normalized.includes('hold')) {
    return 'certificateHold'
  }
  if (normalized.includes('removefromcrl') || normalized.includes('remove')) {
    return 'removeFromCRL'
  }
  if (normalized.includes('privilege')) {
    return 'privilegeWithdrawn'
  }
  return 'unspecified'
}

const crlDateFormatCache = new Map<string, Intl.DateTimeFormat>()

export function formatCrlDate(dateStr: string | null, locale?: string): string {
  if (!dateStr) {
    return 'N/A'
  }
  const parsedDate = new Date(dateStr)
  if (Number.isNaN(parsedDate.getTime())) {
    return dateStr
  }
  const key = locale || 'default'
  let dtf = crlDateFormatCache.get(key)
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })
      crlDateFormatCache.set(key, dtf)
    } catch {
      return parsedDate.toLocaleString()
    }
  }
  return dtf.format(parsedDate)
}

export function getIssuerCN(issuer: string): string {
  if (!issuer) {
    return ''
  }
  return issuer.match(/CN=([^,]+)/)?.[1]?.trim() || issuer.match(/O=([^,]+)/)?.[1]?.trim() || issuer
}

export function buildCrlErrorInfo(fileName: string, err: unknown): CrlErrorInfo {
  const rawMessage = err instanceof Error ? err.message : 'Unknown structure'
  let code = rawMessage || 'Unknown structure'
  let subject: string | undefined
  let action: CrlErrorAction | null = null

  if (rawMessage.startsWith('ERR_CERT_DER_NOT_CRL')) {
    code = 'ERR_CERT_DER_NOT_CRL'
    subject = rawMessage.includes(':') ? rawMessage.split(':').slice(1).join(':').trim() : undefined
    action = {
      labelKey: 'app.crl.goToTrustStore',
      defaultLabel: 'Open in Trust Store Inspector',
      targetMode: 'trust-store',
    }
  } else if (rawMessage === 'ERR_CERT_NOT_CRL' || rawMessage === 'ERR_TRUST_STORE_NOT_CRL') {
    action = {
      labelKey: 'app.crl.goToTrustStore',
      defaultLabel: 'Open in Trust Store Inspector',
      targetMode: 'trust-store',
    }
  } else if (rawMessage === 'ERR_CSR_NOT_CRL') {
    action = {
      labelKey: 'app.crl.goToCsrInspector',
      defaultLabel: 'Open in CSR Inspector',
      targetMode: 'csr-inspector',
    }
  }

  return { fileName, code, subject, action }
}

function invokeTranslate(
  t: TranslateFn,
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
): string {
  const fn = t as SimpleTranslateFn
  if (options) {
    return fn(key, defaultValue, options)
  }
  return fn(key, defaultValue)
}

export function formatLocalizedCrlError(errorInfo: CrlErrorInfo, t: TranslateFn): string {
  let errorDetail = errorInfo.code

  if (errorInfo.code === 'ERR_CERT_DER_NOT_CRL') {
    errorDetail = errorInfo.subject
      ? invokeTranslate(
          t,
          'app.crl.certDerNotCrl',
          `This file is an X.509 Certificate in DER format (Subject: ${errorInfo.subject}), not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.`,
          { subject: errorInfo.subject },
        )
      : invokeTranslate(
          t,
          'app.crl.certDerNotCrlSimple',
          'This file is an X.509 Certificate in DER format, not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.',
        )
  } else if (errorInfo.code === 'ERR_CERT_NOT_CRL') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.certNotCrl',
      'This file contains an X.509 Certificate, not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.',
    )
  } else if (errorInfo.code === 'ERR_CSR_NOT_CRL') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.csrNotCrl',
      'This file contains a Certificate Signing Request (CSR), not a Certificate Revocation List (CRL). Please inspect this file in the CSR Inspector.',
    )
  } else if (errorInfo.code === 'ERR_TRUST_STORE_NOT_CRL') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.trustStoreNotCrl',
      'This file is a KeyStore / Trust Store, not a Certificate Revocation List (CRL). Please inspect this file in the Trust Store Inspector.',
    )
  } else if (errorInfo.code === 'ERR_KEY_NOT_CRL') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.keyNotCrl',
      'This file contains a Private Key, not a Certificate Revocation List (CRL).',
    )
  } else if (errorInfo.code === 'ERR_PEM_NO_CRL') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.pemNoCrl',
      "The PEM file does not contain a Certificate Revocation List (CRL). Expected 'BEGIN X509 CRL' or 'BEGIN CRL'.",
    )
  } else if (errorInfo.code === 'ERR_INVALID_FORMAT') {
    errorDetail = invokeTranslate(
      t,
      'app.crl.invalidFormat',
      'File is not a valid PEM or DER Certificate Revocation List.',
    )
  }

  return invokeTranslate(
    t,
    'app.crl.parseError',
    `Failed to parse "${errorInfo.fileName}": ${errorDetail}`,
    { name: errorInfo.fileName, error: errorDetail },
  )
}

export function downloadCrlPem(pem: string): void {
  const blob = new Blob([pem], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = 'revocation_list.pem'
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadCrlDer(derBase64: string): void {
  const binary = atob(derBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'application/pkix-crl' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = 'revocation_list.crl'
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
