import forge from 'node-forge'

import type { PemDerSamplePreset, PfxSamplePreset, SimpleTranslateFn, TranslateFn } from '@/types'

export type ConvertMode = 'pem-der' | 'pfx'
export type ContentType = 'cert' | 'key'
export type OutputFormat = 'pem' | 'der'

export type StatusFeedbackCode =
  | 'INVALID_FILE_TYPE'
  | 'EMPTY_FILE'
  | 'INVALID_FORMAT'
  | 'CONVERSION_FAILED'
  | 'PFX_FAILED'
  | 'CERT_AND_KEY_REQUIRED'
  | 'PASSWORD_REQUIRED'
  | 'DER_DOWNLOADED'
  | 'PEM_DOWNLOADED'
  | 'PFX_DOWNLOADED'
  | 'CUSTOM'

export interface StatusFeedback {
  code: StatusFeedbackCode
  details?: string
  customMessage?: string
}

export type ValidatedSourceFileResult =
  | {
      ok: true
      content: string | ArrayBuffer
      contentType: ContentType
      outputFormat: OutputFormat
    }
  | { ok: false; error: StatusFeedback }

export interface ConversionOutput {
  blob: Blob
  filename: string
  feedbackCode: 'DER_DOWNLOADED' | 'PEM_DOWNLOADED' | 'PFX_DOWNLOADED'
}

export type PfxBuildOutput = ConversionOutput

export const ALLOWED_SOURCE_EXTENSIONS = ['.pem', '.der', '.crt', '.cer', '.key', '.p8'] as const

const PRESET_I18N_KEYS: Record<string, string> = {
  'cert-pem-to-der': 'app.formatConverter.presetCertPemToDer',
  'cert-der-to-pem': 'app.formatConverter.presetCertDerToPem',
  'key-pem-to-der': 'app.formatConverter.presetKeyPemToDer',
  'key-der-to-pem': 'app.formatConverter.presetKeyDerToPem',
  'pfx-rsa2048': 'app.formatConverter.presetPfxRsa2048',
  'pfx-rsa4096': 'app.formatConverter.presetPfxRsa4096',
}

const STATIC_ERROR_MESSAGES: Partial<Record<StatusFeedbackCode, [string, string]>> = {
  INVALID_FILE_TYPE: [
    'app.formatConverter.invalidFileType',
    'Unsupported file type. Please select a valid PEM or DER certificate or private key file (.pem, .der, .crt, .cer, .key).',
  ],
  EMPTY_FILE: ['app.formatConverter.emptyFile', 'The selected file is empty.'],
  INVALID_FORMAT: [
    'app.formatConverter.invalidFormat',
    'File is not a valid PEM or DER certificate or private key.',
  ],
  CERT_AND_KEY_REQUIRED: [
    'app.formatConverter.certAndKeyRequired',
    'Certificate and Private Key are required.',
  ],
  PASSWORD_REQUIRED: ['app.formatConverter.passwordRequired', 'PFX export password is required.'],
}

const STATIC_SUCCESS_MESSAGES: Partial<Record<StatusFeedbackCode, [string, string]>> = {
  DER_DOWNLOADED: ['app.formatConverter.derDownloaded', 'DER file downloaded!'],
  PEM_DOWNLOADED: ['app.formatConverter.pemDownloaded', 'PEM file downloaded!'],
  PFX_DOWNLOADED: ['app.formatConverter.pfxDownloaded', 'PFX file downloaded!'],
}

function tr(
  t: TranslateFn,
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
): string {
  const fn = t as SimpleTranslateFn
  return options ? fn(key, defaultValue, options) : fn(key, defaultValue)
}

export function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ALLOWED_SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function formatFileSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let binaryStr = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binaryStr += String.fromCharCode(bytes[i] ?? 0)
  }
  return binaryStr
}

function binaryStringToBytes(derStr: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(derStr.length)
  for (let i = 0; i < derStr.length; i += 1) {
    bytes[i] = derStr.charCodeAt(i)
  }
  return bytes
}

function isValidPrivateKeyPem(text: string): boolean {
  try {
    const key = forge.pki.privateKeyFromPem(text)
    if (key.n) {
      return true
    }
  } catch {
    try {
      const pemMsg = forge.pem.decode(text)[0]
      if (pemMsg && pemMsg.body && pemMsg.type.includes('PRIVATE KEY')) {
        return true
      }
    } catch {
      return false
    }
  }
  return false
}

function validatePemSourceText(text: string): ValidatedSourceFileResult {
  const isCertHeader = text.includes('CERTIFICATE')
  const isKeyHeader = text.includes('PRIVATE KEY')

  if (isCertHeader) {
    try {
      const cert = forge.pki.certificateFromPem(text)
      if (cert.subject) {
        return { ok: true, content: text, contentType: 'cert', outputFormat: 'der' }
      }
    } catch {
      return { ok: false, error: { code: 'INVALID_FORMAT' } }
    }
  }

  if (isKeyHeader && isValidPrivateKeyPem(text)) {
    return { ok: true, content: text, contentType: 'key', outputFormat: 'der' }
  }

  return { ok: false, error: { code: 'INVALID_FORMAT' } }
}

function detectDerContentType(fileName: string, asn1Obj: forge.asn1.Asn1): ContentType | null {
  try {
    if (forge.pki.certificateFromAsn1(asn1Obj).subject) {
      return 'cert'
    }
  } catch {
    // Not an X.509 certificate ASN.1 object
  }

  try {
    if (forge.pki.privateKeyFromAsn1(asn1Obj).n) {
      return 'key'
    }
  } catch {
    // Not an RSA private key ASN.1 object
  }

  if (asn1Obj.type === forge.asn1.Type.SEQUENCE && Array.isArray(asn1Obj.value)) {
    return fileName.toLowerCase().includes('key') ? 'key' : 'cert'
  }
  return null
}

export function validateSourceFileBytes(
  fileName: string,
  buffer: ArrayBuffer,
): ValidatedSourceFileResult {
  const bytes = new Uint8Array(buffer)
  if (bytes.length === 0) {
    return { ok: false, error: { code: 'EMPTY_FILE' } }
  }

  let text = ''
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Binary non-UTF-8 content
  }

  if (text && text.includes('-----BEGIN')) {
    return validatePemSourceText(text)
  }

  if (bytes[0] === 0x30) {
    try {
      const asn1Obj = forge.asn1.fromDer(bytesToBinaryString(bytes))
      const detectedType = detectDerContentType(fileName, asn1Obj)
      if (detectedType) {
        return { ok: true, content: buffer, contentType: detectedType, outputFormat: 'pem' }
      }
    } catch {
      // Invalid DER structure
    }
  }

  return { ok: false, error: { code: 'INVALID_FORMAT' } }
}

export function convertPemDerContent(
  fileName: string,
  content: string | ArrayBuffer,
  convertType: ContentType,
): ConversionOutput {
  const isInputBinary = content instanceof ArrayBuffer
  let effectiveType: ContentType = convertType

  if (!isInputBinary) {
    if (content.includes('CERTIFICATE')) {
      effectiveType = 'cert'
    } else if (content.includes('PRIVATE KEY')) {
      effectiveType = 'key'
    }
  }

  let asn1Obj: forge.asn1.Asn1
  if (isInputBinary) {
    asn1Obj = forge.asn1.fromDer(bytesToBinaryString(new Uint8Array(content)))
  } else if (content.includes('BEGIN')) {
    asn1Obj =
      effectiveType === 'cert'
        ? forge.pki.certificateToAsn1(forge.pki.certificateFromPem(content))
        : forge.pki.privateKeyToAsn1(forge.pki.privateKeyFromPem(content))
  } else {
    asn1Obj = forge.asn1.fromDer(forge.util.decode64(content))
  }

  const baseName = fileName.replace(/\.[^/.]+$/, '') || 'converted_file'
  if (!isInputBinary) {
    const bytes = binaryStringToBytes(forge.asn1.toDer(asn1Obj).getBytes())
    return {
      blob: new Blob([bytes], { type: 'application/octet-stream' }),
      filename: `converted_${baseName}.der`,
      feedbackCode: 'DER_DOWNLOADED',
    }
  }

  const pem =
    effectiveType === 'cert'
      ? forge.pki.certificateToPem(forge.pki.certificateFromAsn1(asn1Obj))
      : forge.pki.privateKeyToPem(forge.pki.privateKeyFromAsn1(asn1Obj))

  return {
    blob: new Blob([pem], { type: 'text/plain' }),
    filename: `converted_${baseName}.pem`,
    feedbackCode: 'PEM_DOWNLOADED',
  }
}

export function buildPfxArchive(
  certInput: string,
  keyInput: string,
  password: string,
): PfxBuildOutput {
  const cert = forge.pki.certificateFromPem(certInput)
  const key = forge.pki.privateKeyFromPem(keyInput)
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, {
    generateLocalKeyId: true,
    algorithm: '3des',
  })
  const bytes = binaryStringToBytes(forge.asn1.toDer(p12Asn1).getBytes())

  let filename = 'certificate.pfx'
  try {
    const cnField = cert.subject.getField('CN')
    if (cnField && typeof cnField.value === 'string' && cnField.value.trim()) {
      filename = `${cnField.value.replace(/[^a-zA-Z0-9_.-]/g, '_')}.pfx`
    }
  } catch {
    // Fallback to certificate.pfx
  }

  return {
    blob: new Blob([bytes], { type: 'application/x-pkcs12' }),
    filename,
    feedbackCode: 'PFX_DOWNLOADED',
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function getLocalizedError(err: StatusFeedback | null, t: TranslateFn): string {
  if (!err) {
    return ''
  }
  const staticEntry = STATIC_ERROR_MESSAGES[err.code]
  if (staticEntry) {
    return tr(t, staticEntry[0], staticEntry[1])
  }
  if (err.code === 'CONVERSION_FAILED') {
    const detail = err.details ?? ''
    return tr(t, 'app.formatConverter.conversionFailed', `Conversion failed: ${detail}`, {
      error: detail,
    })
  }
  if (err.code === 'PFX_FAILED') {
    const detail = err.details ?? ''
    return tr(t, 'app.formatConverter.pfxFailed', `PFX generation failed: ${detail}`, {
      error: detail,
    })
  }
  return err.code === 'CUSTOM' ? (err.customMessage ?? '') : ''
}

export function getLocalizedMessage(msg: StatusFeedback | null, t: TranslateFn): string {
  if (!msg) {
    return ''
  }
  const staticEntry = STATIC_SUCCESS_MESSAGES[msg.code]
  if (staticEntry) {
    return tr(t, staticEntry[0], staticEntry[1])
  }
  return msg.code === 'CUSTOM' ? (msg.customMessage ?? '') : ''
}

export function getLocalizedPemDerPresetName(preset: PemDerSamplePreset, t: TranslateFn): string {
  const key = PRESET_I18N_KEYS[preset.id]
  return key ? tr(t, key, preset.name) : preset.name
}

export function getLocalizedPfxPresetName(preset: PfxSamplePreset, t: TranslateFn): string {
  const key = PRESET_I18N_KEYS[preset.id]
  return key ? tr(t, key, preset.name) : preset.name
}
