import forge from 'node-forge'

import type { CertExtension, ParsedCertificate } from '@/types'

const forgeOids = forge.pki.oids as Record<string, string>

// Inject custom Microsoft OIDs so they aren't labeled as "Unknown"
if (!forgeOids['1.3.6.1.4.1.311.21.1']) {
  forgeOids['1.3.6.1.4.1.311.21.1'] = 'msCAVersion'
}
if (!forgeOids['1.3.6.1.4.1.311.20.2']) {
  forgeOids['1.3.6.1.4.1.311.20.2'] = 'msCertificateTemplateName'
}

interface ForgeRsaPublicKey {
  n?: {
    bitLength: () => number
    toString: (radix?: number) => string
  }
  curve?: unknown
}

interface ForgeCertificateExtension {
  id?: string
  name?: string
  critical?: boolean
  value?: unknown
  cA?: boolean
  digitalSignature?: boolean
  keyCertSign?: boolean
  cRLSign?: boolean
  codeSigning?: boolean
  serverAuth?: boolean
  clientAuth?: boolean
  emailProtection?: boolean
  timeStamping?: boolean
}

export function uint8ToBinaryString(bytes: Uint8Array, startOffset = 0): string {
  const chunkSize = 0x8000
  const parts: string[] = []
  for (let i = startOffset; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))))
  }
  return parts.join('')
}

function formatColonFingerprint(hex: string): string {
  return (
    hex
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() || hex.toUpperCase()
  )
}

function extractPurposes(cert: forge.pki.Certificate): string[] {
  const purposes: string[] = []
  const keyUsage = cert.getExtension('keyUsage') as ForgeCertificateExtension | null
  if (keyUsage?.digitalSignature) {
    purposes.push('Digital Signature')
  }
  if (keyUsage?.keyCertSign) {
    purposes.push('Certificate Sign')
  }
  if (keyUsage?.cRLSign) {
    purposes.push('CRL Sign')
  }

  const eku = cert.getExtension('extKeyUsage') as ForgeCertificateExtension | null
  if (eku?.codeSigning) {
    purposes.push('Code Signing')
  }
  if (eku?.serverAuth) {
    purposes.push('Server Authentication')
  }
  if (eku?.clientAuth) {
    purposes.push('Client Authentication')
  }
  if (eku?.emailProtection) {
    purposes.push('Email Protection')
  }
  if (eku?.timeStamping) {
    purposes.push('Time Stamping')
  }

  if (purposes.length === 0) {
    purposes.push('General Purpose / Not Specified')
  }
  return purposes
}

function extractExtensions(cert: forge.pki.Certificate): CertExtension[] {
  const rawExts = (cert.extensions || []) as ForgeCertificateExtension[]
  return rawExts.map((ext) => {
    let valueStr = ''
    if (typeof ext.value === 'string') {
      valueStr =
        forge.util
          .bytesToHex(ext.value)
          .match(/.{1,2}/g)
          ?.join(' ')
          .toUpperCase() || ''
    }
    const oid = ext.id || ''
    return {
      name: ext.name || forgeOids[oid] || 'Unknown',
      oid,
      critical: Boolean(ext.critical),
      value: valueStr,
    }
  })
}

export function extractParsedCertificate(
  cert: forge.pki.Certificate,
  derStr: string,
): ParsedCertificate {
  const issuerStr = cert.issuer.attributes
    .map((a) => `${a.shortName || a.name}=${String(a.value)}`)
    .join(', ')

  const subjectStr = cert.subject.attributes
    .map((a) => `${a.shortName || a.name}=${String(a.value)}`)
    .join(', ')

  const isSelfSigned = issuerStr === subjectStr
  const basicConstraints = cert.getExtension('basicConstraints') as ForgeCertificateExtension | null
  const isCA = basicConstraints ? Boolean(basicConstraints.cA) : isSelfSigned
  const isRoot = isCA && isSelfSigned
  const isIntermediate = isCA && !isRoot
  const isLeaf = !isCA
  const isExpired = new Date() > cert.validity.notAfter

  const mdSha1 = forge.md.sha1.create()
  mdSha1.update(derStr)
  const fingerprintSha1 = formatColonFingerprint(mdSha1.digest().toHex())

  const mdSha256 = forge.md.sha256.create()
  mdSha256.update(derStr)
  const fingerprintSha256 = formatColonFingerprint(mdSha256.digest().toHex())

  const signatureOid = cert.signatureOid || 'Unknown'
  const signatureAlgorithm = forgeOids[signatureOid] || signatureOid

  let publicKeyAlgorithm = 'Unknown'
  let publicKeySize: number | null = null
  const pubKey = cert.publicKey as ForgeRsaPublicKey | null
  if (pubKey?.n) {
    publicKeyAlgorithm = 'RSA'
    publicKeySize = pubKey.n.bitLength()
  } else if (pubKey) {
    publicKeyAlgorithm = 'EC / Other'
  }

  const b64 = forge.util.encode64(derStr)
  const pemLines: string[] = []
  for (let i = 0; i < b64.length; i += 64) {
    pemLines.push(b64.slice(i, i + 64))
  }
  const pem = `-----BEGIN CERTIFICATE-----\r\n${pemLines.join('\r\n')}\r\n-----END CERTIFICATE-----\r\n`

  return {
    issuer: issuerStr,
    subject: subjectStr,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    serialNumber: cert.serialNumber,
    signatureType: 'X.509',
    pem,
    isRoot,
    isIntermediate,
    isLeaf,
    isExpired,
    purposes: extractPurposes(cert),
    version: cert.version,
    signatureOid,
    signatureAlgorithm,
    publicKeyAlgorithm,
    publicKeySize,
    fingerprintSha1,
    fingerprintSha256,
    extensions: extractExtensions(cert),
  }
}

export function parseX509FromDer(derBuffer: ArrayBuffer): ParsedCertificate | null {
  try {
    const derStr = uint8ToBinaryString(new Uint8Array(derBuffer))
    const asn1 = forge.asn1.fromDer(derStr)
    const cert = forge.pki.certificateFromAsn1(asn1)
    return extractParsedCertificate(cert, derStr)
  } catch {
    return null
  }
}

export function parseX509FromPemBlock(pemBlock: string): ParsedCertificate | null {
  try {
    const b64 = pemBlock
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '')
    const derStr = forge.util.decode64(b64)
    const asn1 = forge.asn1.fromDer(derStr)
    const cert = forge.pki.certificateFromAsn1(asn1)
    return extractParsedCertificate(cert, derStr)
  } catch {
    return null
  }
}

export function parseX509FromForgeCert(forgeCert: forge.pki.Certificate): ParsedCertificate | null {
  try {
    const derStr = forge.asn1.toDer(forge.pki.certificateToAsn1(forgeCert)).getBytes()
    return extractParsedCertificate(forgeCert, derStr)
  } catch {
    return null
  }
}

export function extractSubjectCn(cert: ParsedCertificate): string {
  const match = cert.subject.match(/CN=([^,]+)/)
  return match ? match[1].trim() : cert.subject
}
