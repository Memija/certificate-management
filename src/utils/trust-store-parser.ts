import forge from 'node-forge'

import type {
  ParsedCertificate,
  ParsedTrustStore,
  TrustStoreEntry,
  TrustStoreFormat,
} from '@/types'

import { isCrlPem, isDerCrl } from './crl-parser'
import { decryptJKSPrivateKey, JKS_MAGIC, parseJks } from './jks-parser'
import {
  extractSubjectCn,
  parseX509FromDer,
  parseX509FromForgeCert,
  parseX509FromPemBlock,
  uint8ToBinaryString,
} from './x509-parser'

export { decryptJKSPrivateKey, parseX509FromDer }
export type { ParsedCertificate, ParsedTrustStore, TrustStoreEntry, TrustStoreFormat }

const PKCS12_MAGIC_BYTE = 0x30

interface ForgePkcs7Message {
  certificates?: forge.pki.Certificate[]
}

function isPkcs12Bytes(bytes: Uint8Array): boolean {
  if (bytes.length < 10 || bytes[0] !== PKCS12_MAGIC_BYTE) {
    return false
  }
  let offset = 1
  if (bytes[offset] & 0x80) {
    const lenBytes = bytes[offset] & 0x7f
    offset += 1 + lenBytes
  } else {
    offset += 1
  }
  return (
    offset + 3 <= bytes.length &&
    bytes[offset] === 0x02 &&
    bytes[offset + 1] === 0x01 &&
    bytes[offset + 2] === 0x03
  )
}

function detectFormat(bytes: Uint8Array, textContent: string, fileName?: string): TrustStoreFormat {
  const lowerName = (fileName || '').toLowerCase()
  if (lowerName.endsWith('.pfx') || lowerName.endsWith('.p12')) {
    return 'PKCS12'
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length >= 4 && view.getUint32(0, false) === JKS_MAGIC) {
    return 'JKS'
  }

  if (isCrlPem(textContent)) {
    return 'CRL'
  }

  if (textContent.includes('-----BEGIN')) {
    if (textContent.includes('BEGIN PKCS7') || textContent.includes('BEGIN PKCS #7')) {
      return 'PKCS7'
    }
    const certCount = (textContent.match(/-----BEGIN CERTIFICATE-----/g) || []).length
    return certCount > 1 ? 'PEM-Bundle' : 'X509-PEM'
  }

  if (bytes.length >= 4 && bytes[0] === PKCS12_MAGIC_BYTE) {
    if (isDerCrl(bytes)) {
      return 'CRL'
    }
    if (isPkcs12Bytes(bytes)) {
      return 'PKCS12'
    }
    return 'X509-DER'
  }

  return 'Unknown'
}

export function parsePemToCerts(pem: string): ParsedCertificate[] {
  const certs: ParsedCertificate[] = []
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(pem)) !== null) {
    const parsed = parseX509FromPemBlock(match[0])
    if (parsed) {
      certs.push(parsed)
    }
  }
  return certs
}

function parsePemBundle(pem: string): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: TrustStoreEntry[] = []
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  let match: RegExpExecArray | null
  let idx = 1
  while ((match = regex.exec(pem)) !== null) {
    const parsed = parseX509FromPemBlock(match[0])
    if (parsed) {
      entries.push({
        alias: extractSubjectCn(parsed) || `Certificate ${idx}`,
        certificate: parsed,
      })
    } else {
      warnings.push(`Could not parse certificate block #${idx}.`)
    }
    idx += 1
  }
  return { entries, warnings }
}

function parsePkcs7(
  bytes: Uint8Array,
  isPem: boolean,
): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: TrustStoreEntry[] = []
  try {
    let msg: ForgePkcs7Message
    if (isPem) {
      const text = new TextDecoder().decode(bytes)
      msg = forge.pkcs7.messageFromPem(text) as unknown as ForgePkcs7Message
    } else {
      const derStr = uint8ToBinaryString(bytes)
      const asn1 = forge.asn1.fromDer(derStr)
      msg = forge.pkcs7.messageFromAsn1(asn1) as unknown as ForgePkcs7Message
    }
    const certs = msg.certificates || []
    certs.forEach((forgeCert, i) => {
      const parsed = parseX509FromForgeCert(forgeCert)
      if (parsed) {
        entries.push({
          alias: extractSubjectCn(parsed) || `Certificate ${i + 1}`,
          certificate: parsed,
        })
      } else {
        warnings.push(`Could not parse certificate #${i + 1} from PKCS#7.`)
      }
    })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    warnings.push(`PKCS#7 parse error: ${errMsg}`)
  }
  return { entries, warnings }
}

function readFriendlyName(attributes: Record<string, unknown> | undefined): string | undefined {
  const fn = attributes?.friendlyName
  if (Array.isArray(fn) && typeof fn[0] === 'string') {
    return fn[0]
  }
  return undefined
}

function extractCertificatesFromP12(
  p12: forge.pkcs12.Pkcs12Pfx,
): { cert: forge.pki.Certificate; alias?: string }[] {
  const result: { cert: forge.pki.Certificate; alias?: string }[] = []
  const seenSerials = new Set<string>()

  const addCert = (forgeCert: forge.pki.Certificate | undefined, alias?: string) => {
    if (!forgeCert) {
      return
    }
    try {
      const serial = forgeCert.serialNumber || ''
      const subject = forgeCert.subject
        ? forgeCert.subject.attributes
            .map((a) => `${a.shortName || a.name}=${String(a.value)}`)
            .join(', ')
        : ''
      const key = `${serial}::${subject}`
      if (!seenSerials.has(key)) {
        seenSerials.add(key)
        result.push({ cert: forgeCert, alias })
      }
    } catch {
      result.push({ cert: forgeCert, alias })
    }
  }

  try {
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const bags = certBags[forge.pki.oids.certBag] || []
    for (const b of bags) {
      addCert(b.cert, readFriendlyName(b.attributes))
    }
  } catch {
    // ignore
  }

  try {
    for (const sc of p12.safeContents || []) {
      for (const sb of sc.safeBags || []) {
        addCert(sb.cert, readFriendlyName(sb.attributes))
      }
    }
  } catch {
    // ignore
  }

  return result
}

function extractPrivateKeyIntoEntries(
  pkcs12Obj: forge.pkcs12.Pkcs12Pfx,
  entries: TrustStoreEntry[],
  warnings: string[],
): void {
  try {
    const pkBags = pkcs12Obj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const pks = pkBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []
    if (pks.length > 0) {
      warnings.push(
        `This file contains ${pks.length} private key(s). Private keys are never displayed.`,
      )
      const firstKey = pks[0]?.key
      if (firstKey && entries.length > 0) {
        entries[0].privateKeyPem = forge.pki.privateKeyToPem(firstKey)
      }
    }
  } catch {
    // ignore
  }
}

function parsePkcs12(
  bytes: Uint8Array,
  password: string,
): { entries: TrustStoreEntry[]; warnings: string[]; needsPassword?: boolean } {
  const warnings: string[] = []
  const entries: TrustStoreEntry[] = []

  let asn1: forge.asn1.Asn1
  try {
    const derStr = uint8ToBinaryString(bytes)
    asn1 = forge.asn1.fromDer(derStr)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { entries: [], warnings: [`Invalid PKCS#12 DER structure: ${msg}`] }
  }

  let p12Certs: { cert: forge.pki.Certificate; alias?: string }[] = []
  let pkcs12Obj: forge.pkcs12.Pkcs12Pfx | null = null

  try {
    pkcs12Obj = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
    p12Certs = extractCertificatesFromP12(pkcs12Obj)
  } catch {
    if (!password) {
      return {
        entries: [],
        warnings: ['This PKCS#12 file requires a password.'],
        needsPassword: true,
      }
    }

    if (Array.isArray(asn1.value) && asn1.value.length > 2) {
      try {
        const asn1NoMac = forge.asn1.create(asn1.tagClass, asn1.type, asn1.constructed, [
          asn1.value[0],
          asn1.value[1],
        ])
        pkcs12Obj = forge.pkcs12.pkcs12FromAsn1(asn1NoMac, false, password)
        p12Certs = extractCertificatesFromP12(pkcs12Obj)
      } catch {
        // Fallback decryption also failed -> wrong password
      }
    }
  }

  if (p12Certs.length === 0) {
    return {
      entries: [],
      warnings: [password ? 'Incorrect password.' : 'This PKCS#12 file requires a password.'],
      needsPassword: true,
    }
  }

  for (let i = 0; i < p12Certs.length; i++) {
    const item = p12Certs[i]
    const parsed = parseX509FromForgeCert(item.cert)
    if (parsed) {
      entries.push({
        alias: item.alias || extractSubjectCn(parsed) || `Certificate ${i + 1}`,
        certificate: parsed,
      })
    } else {
      warnings.push(`Could not parse certificate bag #${i + 1}.`)
    }
  }

  if (pkcs12Obj) {
    extractPrivateKeyIntoEntries(pkcs12Obj, entries, warnings)
  }

  if (entries.length > 0) {
    return { entries, warnings, needsPassword: false }
  }

  return {
    entries: [],
    warnings: [password ? 'Incorrect password.' : 'This PKCS#12 file requires a password.'],
    needsPassword: true,
  }
}

export async function parseTrustStoreFile(
  file: File,
  password = '',
): Promise<ParsedTrustStore & { needsPassword?: boolean }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let text = ''
  try {
    text = new TextDecoder('utf-8').decode(bytes)
  } catch {
    // binary file
  }

  const format = detectFormat(bytes, text, file.name)

  if (format === 'CRL') {
    return { format: 'CRL', entries: [], warnings: ['ERR_CRL_FILE'] }
  }

  if (format === 'JKS') {
    const { entries, warnings } = parseJks(bytes)
    return { format: 'JKS', entries, warnings }
  }

  if (format === 'PKCS7') {
    const { entries, warnings } = parsePkcs7(bytes, text.includes('-----BEGIN'))
    return { format: 'PKCS7', entries, warnings }
  }

  if (format === 'PKCS12') {
    const p12 = parsePkcs12(bytes, password)
    if (p12.entries.length > 0) {
      return { format: 'PKCS12', ...p12 }
    }
    return {
      format: 'PKCS12',
      entries: [],
      warnings:
        p12.warnings.length > 0
          ? p12.warnings
          : [password ? 'Incorrect password.' : 'This PKCS#12 file requires a password.'],
      needsPassword: true,
    }
  }

  if (format === 'PEM-Bundle') {
    const { entries, warnings } = parsePemBundle(text)
    return { format: 'PEM-Bundle', entries, warnings }
  }

  if (format === 'X509-PEM') {
    const { entries, warnings } = parsePemBundle(text)
    if (entries.length > 0) {
      return { format: 'X509-PEM', entries, warnings }
    }
    if (text.includes('BEGIN PKCS')) {
      const r = parsePkcs7(bytes, true)
      return { format: 'PKCS7', ...r }
    }
    if (
      text.includes('BEGIN CERTIFICATE REQUEST') ||
      text.includes('BEGIN NEW CERTIFICATE REQUEST')
    ) {
      return { format: 'Unknown', entries: [], warnings: ['ERR_CSR_FILE'] }
    }
    if (text.includes('PRIVATE KEY')) {
      return { format: 'Unknown', entries: [], warnings: ['ERR_PRIVATE_KEY_FILE'] }
    }
    return { format: 'Unknown', entries: [], warnings: ['ERR_COULD_NOT_PARSE_PEM'] }
  }

  if (format === 'X509-DER') {
    if (isDerCrl(bytes)) {
      return { format: 'CRL', entries: [], warnings: ['ERR_CRL_FILE'] }
    }

    const cert = parseX509FromDer(buffer)
    if (cert) {
      return {
        format: 'X509-DER',
        entries: [{ alias: extractSubjectCn(cert), certificate: cert }],
        warnings: [],
      }
    }

    const p7 = parsePkcs7(bytes, false)
    if (p7.entries.length > 0) {
      return { format: 'PKCS7', ...p7 }
    }

    const p12 = parsePkcs12(bytes, password)
    if (p12.entries.length > 0) {
      return { format: 'PKCS12', ...p12 }
    }
    if (p12.needsPassword) {
      return { format: 'PKCS12', entries: [], warnings: p12.warnings, needsPassword: true }
    }

    return { format: 'Unknown', entries: [], warnings: ['ERR_COULD_NOT_PARSE_DER'] }
  }

  return {
    format: 'Unknown',
    entries: [],
    warnings: ['ERR_UNRECOGNIZED_FORMAT'],
  }
}
