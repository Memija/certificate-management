import type { SimpleTranslateFn, TranslateFn } from '@/types'
import { SAMPLE_CSR_PEM } from '@/utils/csr-parser'

export { SAMPLE_CSR_PEM }

export const SAMPLE_CSR_FILENAME = 'sample_request.csr'

export const CSR_ACCEPT_EXTENSIONS = '.csr,.req,.pem,.der,.cer,.txt'

const ACCEPTED_CSR_FILE_PATTERN = /\.(csr|req|pem|der|cer|txt)$/i

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

export function isAcceptedCsrFile(file: File): boolean {
  return ACCEPTED_CSR_FILE_PATTERN.test(file.name) || file.type === 'application/x-x509-ca-cert'
}

export function translateSubjectFieldLabel(
  shortName: string,
  name: string,
  t: TranslateFn,
): string {
  const byName = name ? invokeTranslate(t, `app.csr.fields.${name}`, name) : name
  if (shortName) {
    return invokeTranslate(t, `app.csr.fields.${shortName}`, byName)
  }
  return byName
}

export function translateCsrExtensionLabel(name: string, t: TranslateFn): string {
  const compactKey = `app.winCertStore.extensions.${name.replace(/\s+/g, '')}`
  const lowerKey = `app.winCertStore.extensions.${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
  const lowerTranslated = invokeTranslate(t, lowerKey, name)
  return invokeTranslate(t, compactKey, lowerTranslated)
}

export function formatCsrParseError(error: string, name: string, t: TranslateFn): string {
  if (error === 'ERR_CERT_NOT_CSR') {
    return invokeTranslate(
      t,
      'app.csr.certNotCsr',
      'This file contains an X.509 Certificate, not a Certificate Signing Request (CSR). Please inspect this file in the Trust Store Inspector.',
    )
  }
  if (error === 'ERR_CRL_NOT_CSR') {
    return invokeTranslate(
      t,
      'app.csr.crlNotCsr',
      'This file contains a Certificate Revocation List (CRL), not a Certificate Signing Request (CSR). Please inspect this file in the CRL Inspector.',
    )
  }
  if (error === 'ERR_KEY_NOT_CSR') {
    return invokeTranslate(
      t,
      'app.csr.keyNotCsr',
      'This file contains a Private Key, not a Certificate Signing Request (CSR).',
    )
  }
  if (error === 'ERR_INVALID_FORMAT' || error.startsWith('ERR_INVALID_FORMAT:')) {
    return invokeTranslate(
      t,
      'app.csr.invalidFormat',
      'File is not a valid PEM or DER Certificate Signing Request.',
    )
  }
  return invokeTranslate(t, 'app.csr.parseError', `Failed to parse "${name}": ${error}`, {
    name,
    error,
  })
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function triggerCsrDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
