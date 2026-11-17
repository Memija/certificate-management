import type { ParsedCertificate, SimpleTranslateFn, TranslateFn } from '@/types'

function invokeTranslate(t: TranslateFn, key: string, defaultValue: string): string {
  const fn = t as SimpleTranslateFn
  return fn(key, defaultValue)
}

export function sanitizeCertFilename(cert: ParsedCertificate): string {
  const cnMatch = cert.subject.match(/CN=([^,]+)/)
  const rawBase = cnMatch?.[1]?.trim() || cert.serialNumber || 'certificate'
  const cleaned = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned || 'certificate'
}

export function pemToDerBytes(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '')
  if (!b64) {
    throw new Error('Empty PEM payload')
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
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

export function translateExtensionName(name: string, t: TranslateFn): string {
  const compactKey = `app.winCertStore.extensions.${name.replace(/\s+/g, '')}`
  const lowerKey = `app.winCertStore.extensions.${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
  const lowerTranslated = invokeTranslate(t, lowerKey, name)
  return invokeTranslate(t, compactKey, lowerTranslated)
}
