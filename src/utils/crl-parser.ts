import forge from 'node-forge'

import type { CrlExtension, ParsedCRL, RevokedCertificate } from '@/types'

import { uint8ToBinaryString } from './x509-parser'

export type { CrlExtension, ParsedCRL, RevokedCertificate }

export const CRL_REASON_CODES: Record<number, string> = {
  0: 'Unspecified',
  1: 'Key Compromise',
  2: 'CA Compromise',
  3: 'Affiliation Changed',
  4: 'Superseded',
  5: 'Cessation Of Operation',
  6: 'Certificate Hold',
  8: 'Remove From CRL',
  9: 'Privilege Withdrawn',
  10: 'AA Compromise',
}

export const SAMPLE_CRL_PEM = `-----BEGIN X509 CRL-----
MIICEDCB+QIBATANBgkqhkiG9w0BAQsFADBMMQswCQYDVQQGEwJVUzELMAkGA1UE
CAwCQ0ExFjAUBgNVBAoMDVRlc3QgUEtJIENvcnAxGDAWBgNVBAMMD1Rlc3QgSXNz
dWluZyBDQRcNMjYwOTA5MDgyNTEzWhcNMjYxMDA5MDgyNTEzWjBpMCECAgEKFw0y
NjA5MDkwODAwMDBaMAwwCgYDVR0VBAMKAQEwIQICArwXDTI2MDkwOTA4MTUwMFow
DDAKBgNVHRUEAwoBBDAhAgID/xcNMjYwOTA5MDgzMDAwWjAMMAoGA1UdFQQDCgEF
oA4wDDAKBgNVHRQEAwIBAzANBgkqhkiG9w0BAQsFAAOCAQEAXzkICIzlwREHCzhh
OAST/Bn6EtClMDB/dl8BYHdly9C8IF1730BnG+O2RyWMo+yUAt26X7qevEO/imcS
T/hKRK8AJFHXR1wsPQPGfJS43yOwABR+kYEkD1YZP04bAH7RNpQLeEbI21XsVZiu
PJb2Gffoe5j1Dxyws0hsI5EOwN61dcQTbXYPi3wgSJvvsfu1znJusKlta8GioLjY
PWeBJ5coS3dNxrDuVW4FUdVWW1fneeEd03gFnLAJoIbt2cXJ5/uDPSjqRSHE/1vy
lNyMVF6GivjX1TTSlano5VTfNMgcJJYWkGrv6SacNI3uyYOUKlrxwSsPCTBTtIB6
Ou1uLg==
-----END X509 CRL-----`

export const EXTENSION_NAMES: Record<string, string> = {
  '2.5.29.20': 'crlNumber',
  '2.5.29.21': 'crlReason',
  '2.5.29.27': 'deltaCRLIndicator',
  '2.5.29.28': 'issuingDistributionPoint',
  '2.5.29.35': 'authorityKeyIdentifier',
}

interface ForgePkiWithRdn {
  RDNAttributesAsArray?: (rdn: forge.asn1.Asn1) => forge.pki.CertificateField[]
}

function getSha256Fingerprint(derBytes: string): string {
  const hex = forge.md.sha256.create().update(derBytes).digest().toHex()
  return (
    hex
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() || hex.toUpperCase()
  )
}

function toBytes(val: unknown): string {
  return typeof val === 'string' ? val : ''
}

function isAsn1Seq(
  node: forge.asn1.Asn1 | undefined,
  minLen = 0,
): node is forge.asn1.Asn1 & { value: forge.asn1.Asn1[] } {
  return Boolean(
    node &&
    node.type === forge.asn1.Type.SEQUENCE &&
    Array.isArray(node.value) &&
    node.value.length >= minLen,
  )
}

function isTimeNode(node: forge.asn1.Asn1 | undefined): node is forge.asn1.Asn1 {
  return Boolean(
    node &&
    (node.type === forge.asn1.Type.UTCTIME || node.type === forge.asn1.Type.GENERALIZEDTIME),
  )
}

function assertNotCertOrCsrAsn1(asn1: forge.asn1.Asn1): void {
  try {
    const cert = forge.pki.certificateFromAsn1(asn1)
    if (cert?.subject) {
      const subjectStr = cert.subject.attributes
        .map((a) => `${a.shortName || a.name || 'OID'}=${String(a.value)}`)
        .join(', ')
      throw new Error(subjectStr ? `ERR_CERT_DER_NOT_CRL:${subjectStr}` : 'ERR_CERT_DER_NOT_CRL')
    }
  } catch (certErr: unknown) {
    if (certErr instanceof Error && certErr.message.startsWith('ERR_CERT_DER_NOT_CRL')) {
      throw certErr
    }
  }

  try {
    const csr = forge.pki.certificationRequestFromAsn1(asn1)
    if (csr?.subject) {
      throw new Error('ERR_CSR_NOT_CRL')
    }
  } catch (csrErr: unknown) {
    if (csrErr instanceof Error && csrErr.message === 'ERR_CSR_NOT_CRL') {
      throw csrErr
    }
  }
}

function parseAsn1TimeNode(node: forge.asn1.Asn1): string {
  const dateObj =
    node.type === forge.asn1.Type.UTCTIME
      ? forge.asn1.utcTimeToDate(toBytes(node.value))
      : forge.asn1.generalizedTimeToDate(toBytes(node.value))
  return dateObj ? dateObj.toISOString() : ''
}

function parseEntryReason(entryExtsNode: forge.asn1.Asn1): string {
  if (!Array.isArray(entryExtsNode.value)) {
    return 'Unspecified'
  }
  for (const ext of entryExtsNode.value) {
    if (!Array.isArray(ext.value) || ext.value.length === 0) {
      continue
    }
    if (forge.asn1.derToOid(toBytes(ext.value[0].value)) !== '2.5.29.21') {
      continue
    }
    const octetVal = toBytes(ext.value[ext.value.length - 1].value)
    try {
      const innerAsn1 = forge.asn1.fromDer(octetVal)
      const codeHex = forge.util.bytesToHex(toBytes(innerAsn1.value))
      const code = codeHex.length > 0 ? parseInt(codeHex, 16) : 0
      return CRL_REASON_CODES[code] || `Unknown (${code})`
    } catch {
      return 'Unspecified'
    }
  }
  return 'Unspecified'
}

function parseRevokedCertificates(revokedSeq: forge.asn1.Asn1): RevokedCertificate[] {
  if (!Array.isArray(revokedSeq.value)) {
    return []
  }
  const revokedCertificates: RevokedCertificate[] = []
  for (const rc of revokedSeq.value) {
    if (!Array.isArray(rc.value) || rc.value.length < 2) {
      continue
    }
    revokedCertificates.push({
      serialNumber: forge.util.bytesToHex(toBytes(rc.value[0].value)).toUpperCase(),
      revocationDate: parseAsn1TimeNode(rc.value[1]),
      reason: rc.value.length > 2 ? parseEntryReason(rc.value[2]) : 'Unspecified',
    })
  }
  return revokedCertificates
}

function parseSingleCrlExtension(ext: forge.asn1.Asn1): CrlExtension | null {
  if (!Array.isArray(ext.value) || ext.value.length < 2) {
    return null
  }
  const extOid = forge.asn1.derToOid(toBytes(ext.value[0].value))
  const hasCriticalFlag = ext.value[1].type === forge.asn1.Type.BOOLEAN
  const critical =
    hasCriticalFlag &&
    typeof ext.value[1].value === 'string' &&
    ext.value[1].value.charCodeAt(0) !== 0
  const valBytes = toBytes(ext.value[hasCriticalFlag ? 2 : 1]?.value)

  let valStr = ''
  try {
    const inner = forge.asn1.fromDer(valBytes)
    if (extOid === '2.5.29.20') {
      const numHex = forge.util.bytesToHex(toBytes(inner.value))
      valStr = numHex.length > 0 ? parseInt(numHex, 16).toString() : '0'
    } else {
      valStr =
        forge.util
          .bytesToHex(valBytes)
          .match(/.{1,2}/g)
          ?.join(' ') || ''
    }
  } catch {
    valStr = 'Binary data'
  }

  return { name: EXTENSION_NAMES[extOid] || extOid, oid: extOid, critical, value: valStr }
}

function parseCrlExtensions(extContainer: forge.asn1.Asn1): CrlExtension[] {
  const extSeq = Array.isArray(extContainer.value) ? extContainer.value[0] : undefined
  if (!isAsn1Seq(extSeq)) {
    return []
  }
  const extensions: CrlExtension[] = []
  for (const ext of extSeq.value) {
    const parsed = parseSingleCrlExtension(ext)
    if (parsed) {
      extensions.push(parsed)
    }
  }
  return extensions
}

export function parseDerCrl(derBytes: string): ParsedCRL {
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(derBytes)
  } catch {
    throw new Error('ERR_INVALID_FORMAT')
  }

  if (!isAsn1Seq(asn1, 3)) {
    throw new Error('ERR_INVALID_FORMAT')
  }

  assertNotCertOrCsrAsn1(asn1)

  const tbs = asn1.value[0]
  if (!isAsn1Seq(tbs, 3)) {
    throw new Error('ERR_INVALID_FORMAT')
  }

  let idx = 0
  let version = 1
  if (tbs.value[idx]?.type === forge.asn1.Type.INTEGER) {
    const vHex = forge.util.bytesToHex(toBytes(tbs.value[idx].value))
    version = vHex.length > 0 ? parseInt(vHex, 16) + 1 : 1
    idx += 1
  }

  idx += 1 // Skip signature AlgorithmIdentifier
  const issuerAsn1 = tbs.value[idx]
  idx += 1

  let issuer = 'Unknown Issuer'
  try {
    const pkiExt = forge.pki as unknown as ForgePkiWithRdn
    const issuerAttrs = pkiExt.RDNAttributesAsArray?.(issuerAsn1) || []
    if (issuerAttrs.length > 0) {
      issuer = issuerAttrs
        .map((a) => `${a.shortName || a.name || 'OID'}=${String(a.value)}`)
        .join(', ')
    }
  } catch {
    issuer = 'Unknown Issuer'
  }

  const thisUpdateNode = tbs.value[idx]
  idx += 1
  if (!isTimeNode(thisUpdateNode)) {
    const hasPubKey = tbs.value.some(
      (v) =>
        isAsn1Seq(v, 2) && v.value.length === 2 && v.value[1]?.type === forge.asn1.Type.BITSTRING,
    )
    throw new Error(hasPubKey ? 'ERR_CERT_DER_NOT_CRL' : 'ERR_INVALID_FORMAT')
  }
  const thisUpdate = parseAsn1TimeNode(thisUpdateNode)

  let nextUpdate: string | null = null
  if (idx < tbs.value.length && isTimeNode(tbs.value[idx])) {
    nextUpdate = parseAsn1TimeNode(tbs.value[idx]) || null
    idx += 1
  }

  const isExpired = nextUpdate ? new Date(nextUpdate) < new Date() : false

  let revokedCertificates: RevokedCertificate[] = []
  if (
    idx < tbs.value.length &&
    tbs.value[idx].tagClass === forge.asn1.Class.UNIVERSAL &&
    tbs.value[idx].type === forge.asn1.Type.SEQUENCE
  ) {
    revokedCertificates = parseRevokedCertificates(tbs.value[idx])
    idx += 1
  }

  let extensions: CrlExtension[] = []
  if (
    idx < tbs.value.length &&
    tbs.value[idx].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
    (tbs.value[idx].type as number) === 0
  ) {
    extensions = parseCrlExtensions(tbs.value[idx])
  }

  const derBase64 = forge.util.encode64(derBytes)
  const pemLines = derBase64.match(/.{1,64}/g) || [derBase64]
  const pem = `-----BEGIN X509 CRL-----\r\n${pemLines.join('\r\n')}\r\n-----END X509 CRL-----\r\n`

  return {
    version,
    issuer,
    thisUpdate,
    nextUpdate,
    isExpired,
    revokedCertificates,
    extensions,
    pem,
    fingerprintSha256: getSha256Fingerprint(derBytes),
    derBase64,
  }
}

export function parseCrlText(text: string): ParsedCRL {
  if (/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/.test(text)) {
    throw new Error('ERR_CERT_NOT_CRL')
  }
  if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/.test(text)) {
    throw new Error('ERR_CSR_NOT_CRL')
  }
  if (text.includes('PRIVATE KEY-----')) {
    throw new Error('ERR_KEY_NOT_CRL')
  }
  if (/BEGIN PKCS(?:\s*#?\s*7|12)/.test(text)) {
    throw new Error('ERR_TRUST_STORE_NOT_CRL')
  }

  const match = text.match(/-----BEGIN [^-]*CRL[^-]*-----([\s\S]*?)-----END [^-]*CRL[^-]*-----/i)
  if (match) {
    return parseDerCrl(forge.util.decode64(match[1].replace(/\s+/g, '')))
  }

  throw new Error(text.includes('-----BEGIN ') ? 'ERR_PEM_NO_CRL' : 'ERR_INVALID_FORMAT')
}

export function isCrlPem(text: string): boolean {
  return /-----BEGIN [^-]*CRL[^-]*-----/i.test(text)
}

export function isDerCrl(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || bytes[0] !== 0x30) {
    return false
  }
  try {
    const asn1 = forge.asn1.fromDer(uint8ToBinaryString(bytes))
    if (!isAsn1Seq(asn1, 3) || asn1.value.length !== 3) {
      return false
    }
    const tbs = asn1.value[0]
    if (!isAsn1Seq(tbs, 3)) {
      return false
    }
    const idx = tbs.value[0]?.type === forge.asn1.Type.INTEGER ? 1 : 0
    if (!isAsn1Seq(tbs.value[idx]) || !isAsn1Seq(tbs.value[idx + 1])) {
      return false
    }
    return isTimeNode(tbs.value[idx + 2])
  } catch {
    return false
  }
}

export async function parseCrlFile(file: File): Promise<ParsedCRL> {
  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)

  if (uint8.length >= 4 && new DataView(buffer).getUint32(0, false) === 0xfeedfeed) {
    throw new Error('ERR_TRUST_STORE_NOT_CRL')
  }

  let startIdx =
    uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf ? 3 : 0
  while (
    startIdx < uint8.length &&
    (uint8[startIdx] === 0x20 ||
      uint8[startIdx] === 0x0a ||
      uint8[startIdx] === 0x0d ||
      uint8[startIdx] === 0x09)
  ) {
    startIdx += 1
  }

  if (startIdx < uint8.length && uint8[startIdx] === 0x2d) {
    return parseCrlText(new TextDecoder('utf-8').decode(uint8))
  }

  if (uint8.length < 4 || uint8[startIdx] !== 0x30) {
    const sample = new TextDecoder('utf-8').decode(uint8.slice(0, 120))
    if (sample.includes('-----BEGIN ')) {
      return parseCrlText(new TextDecoder('utf-8').decode(uint8))
    }
    throw new Error('ERR_INVALID_FORMAT')
  }

  return parseDerCrl(uint8ToBinaryString(uint8, startIdx))
}
