import forge from 'node-forge'

import { SAMPLE_MATCHING_KEY_PEM } from '@/data/key-matcher-samples'
import type { ParsedCSR, SimpleTranslateFn, TranslateFn } from '@/types'
import { parseCSRFromBytes, parseCSRFromText, SAMPLE_CSR_PEM } from '@/utils/csr-parser'

export { SAMPLE_CSR_PEM }

export const SAMPLE_CSR_FILENAME = 'sample_request.csr'
export const SAMPLE_DER_CSR_FILENAME = 'sample_multisan_request.der'
export const SAMPLE_BAD_SIG_CSR_FILENAME = 'sample_invalid_sig.csr'

export type CsrSampleId = 'standard-pem' | 'multisan-der' | 'invalid-sig'

export interface CsrSamplePreset {
  id: CsrSampleId
  fileName: string
  labelKey: string
  defaultLabel: string
  badge: string
  badgeTone: 'info' | 'danger'
}

export const CSR_SAMPLE_PRESETS: readonly CsrSamplePreset[] = [
  {
    id: 'standard-pem',
    fileName: SAMPLE_CSR_FILENAME,
    labelKey: 'app.csr.trySampleCsr',
    defaultLabel: 'Try Sample CSR',
    badge: 'PEM',
    badgeTone: 'info',
  },
  {
    id: 'multisan-der',
    fileName: SAMPLE_DER_CSR_FILENAME,
    labelKey: 'app.csr.trySampleDerCsr',
    defaultLabel: 'Multi-SAN DER CSR',
    badge: 'DER',
    badgeTone: 'info',
  },
  {
    id: 'invalid-sig',
    fileName: SAMPLE_BAD_SIG_CSR_FILENAME,
    labelKey: 'app.csr.trySampleBadSigCsr',
    defaultLabel: 'Invalid Signature CSR',
    badge: 'PEM',
    badgeTone: 'danger',
  },
]

export const CSR_ACCEPT_EXTENSIONS = '.csr,.req,.pem,.der,.cer,.txt'

const ACCEPTED_CSR_FILE_PATTERN = /\.(csr|req|pem|der|cer|txt)$/i

let cachedMultiSanDerBytes: Uint8Array | null = null
let cachedInvalidSigPem: string | null = null

function buildMultiSanDerBytes(): Uint8Array {
  if (!cachedMultiSanDerBytes) {
    const privateKey = forge.pki.privateKeyFromPem(SAMPLE_MATCHING_KEY_PEM)
    const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = publicKey
    csr.setSubject([
      { name: 'commonName', value: '*.cloud-edge.io' },
      { name: 'organizationName', value: 'Cloud Edge Security Ltd' },
      { name: 'organizationalUnitName', value: 'Platform PKI' },
      { name: 'localityName', value: 'Zurich' },
      { name: 'stateOrProvinceName', value: 'Zurich' },
      { name: 'countryName', value: 'CH' },
    ])
    csr.setAttributes([
      {
        name: 'extensionRequest',
        extensions: [
          {
            name: 'keyUsage',
            digitalSignature: true,
            keyEncipherment: true,
            critical: true,
          },
          {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
          },
          {
            name: 'subjectAltName',
            altNames: [
              { type: 2, value: 'cloud-edge.io' },
              { type: 2, value: '*.cloud-edge.io' },
              { type: 2, value: 'api.cloud-edge.io' },
              { type: 7, ip: '10.42.0.10' },
            ],
          },
        ],
      },
    ])
    csr.sign(privateKey, forge.md.sha256.create())
    const derStr = forge.asn1.toDer(forge.pki.certificationRequestToAsn1(csr)).getBytes()
    cachedMultiSanDerBytes = Uint8Array.from(derStr, (ch) => ch.charCodeAt(0))
  }
  return cachedMultiSanDerBytes
}

function buildInvalidSigCsrPem(): string {
  if (!cachedInvalidSigPem) {
    const privateKey = forge.pki.privateKeyFromPem(SAMPLE_MATCHING_KEY_PEM)
    const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = publicKey
    csr.setSubject([
      { name: 'commonName', value: 'tampered-request.internal' },
      { name: 'organizationName', value: 'Security Audit Lab' },
      { name: 'countryName', value: 'US' },
    ])
    csr.sign(privateKey, forge.md.sha256.create())
    const asn1 = forge.pki.certificationRequestToAsn1(csr)
    const children = asn1.value as forge.asn1.Asn1[]
    const sigBitString = children[2]
    if (sigBitString && typeof sigBitString.value === 'string' && sigBitString.value.length > 4) {
      const idx = sigBitString.value.length - 1
      const flipped = String.fromCharCode(sigBitString.value.charCodeAt(idx) ^ 0xff)
      sigBitString.value = sigBitString.value.slice(0, idx) + flipped
    }
    const derStr = forge.asn1.toDer(asn1).getBytes()
    const b64 = forge.util.encode64(derStr, 64)
    cachedInvalidSigPem = `-----BEGIN CERTIFICATE REQUEST-----\n${b64}\n-----END CERTIFICATE REQUEST-----`
  }
  return cachedInvalidSigPem
}

export function createSampleParsedCsr(sampleId: CsrSampleId = 'standard-pem'): {
  fileName: string
  csr: ParsedCSR
} {
  if (sampleId === 'multisan-der') {
    return {
      fileName: SAMPLE_DER_CSR_FILENAME,
      csr: parseCSRFromBytes(buildMultiSanDerBytes()),
    }
  }
  if (sampleId === 'invalid-sig') {
    return {
      fileName: SAMPLE_BAD_SIG_CSR_FILENAME,
      csr: parseCSRFromText(buildInvalidSigCsrPem()),
    }
  }
  return {
    fileName: SAMPLE_CSR_FILENAME,
    csr: parseCSRFromText(SAMPLE_CSR_PEM),
  }
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
