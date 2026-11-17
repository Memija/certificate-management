import forge from 'node-forge'

import type { CSRExtension, CSRSubjectField, ParsedCSR } from '@/types'

import { uint8ToBinaryString } from './x509-parser'

export type { CSRExtension, CSRSubjectField, ParsedCSR }

const forgeOids = forge.pki.oids as Record<string, string>

const SHORT_NAME_LABELS: Record<string, string> = {
  CN: 'Common Name',
  O: 'Organization',
  OU: 'Organizational Unit',
  C: 'Country',
  ST: 'State / Province',
  L: 'Locality',
  E: 'Email',
  emailAddress: 'Email',
  serialNumber: 'Serial Number',
  DC: 'Domain Component',
}

function labelFor(shortName: string, name: string): string {
  return SHORT_NAME_LABELS[shortName] || SHORT_NAME_LABELS[name] || shortName || name
}

export const SAMPLE_CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIICbzCCAVcCAQAwKjEUMBIGA1UEAxMLZXhhbXBsZS5jb20xEjAQBgNVBAoTCUFj
bWUgQ29ycDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALupgyAYJAWv
6aDRoJaf9ZDdmuavKNzK9AhkN97AjLb8XAQa9eXioqUm3kmMPDcKUESoQYoq8Oye
Wl2Vlvb0NjDiSNSfjBqnkIQOPABNtAoTCJhhICFwlr4Bm1tnrEwn5BvC+dfhIgsv
1Pcv3Qq539xkyGtKwvyiSyjBX48Jdy4vJ27mxAHClzkZgABIUTQFfnb51P+TRsON
kAwIzSxmV+ysIZnR+qUQCE6h5jPekhdH2vawRGBig0JjdTicxIDMdcL9EkMR/CT1
vYkFLcEjAtFDLmSGZIIsuuXM89uJci+Uy3AWvhA0qcTsXfAebZaIy3xe4lsFuyPj
mLDiqYZQSH8CAwEAAaAAMA0GCSqGSIb3DQEBBQUAA4IBAQCKqGGgUy4+vn17sNcm
pAjRmpiPujza0RvchxgNHJkbfv8gyumy7xmaj1oSsAay64wIIFmcn7u1tKGPJWpq
H9yYgP8SS35uRQ3vn0Vuu/7CeifPyKwPR96zWlAUwxPsXkTlNUDM6PRv20+Qfl9Q
y0rjshzi0AQr90WHqQZW9gQQDqVwRGtdC1jFkeObY4F1zWx/yu7QV3S9FJ90fPmq
KLIs7h/kueT7ohvb2scjU4rdoq/531EW/dIPG14xDXwaDFqMO+cE6R1ur74OJM+N
PUHpqh5kiCeJPn4T2tU896RcYd7uG4O0FfNWbMRtA8JPIKhe9xVzTwdWqq6c8/oV
rS0T
-----END CERTIFICATE REQUEST-----`

interface ForgeAltName {
  type: number
  value?: string
  ip?: string
}

interface ForgeCsrExtension {
  id?: string
  name?: string
  critical?: boolean
  value?: unknown
  altNames?: ForgeAltName[]
  subjectAltName?: unknown
  digitalSignature?: boolean
  nonRepudiation?: boolean
  keyEncipherment?: boolean
  dataEncipherment?: boolean
  keyAgreement?: boolean
  keyCertSign?: boolean
  cRLSign?: boolean
  encipherOnly?: boolean
  decipherOnly?: boolean
  serverAuth?: boolean
  clientAuth?: boolean
  codeSigning?: boolean
  emailProtection?: boolean
  timeStamping?: boolean
}

interface ForgeCsrAttribute {
  extensions?: ForgeCsrExtension[]
}

interface ForgeCsrKey {
  n?: { bitLength: () => number }
  curve?: unknown
}

interface ForgeCsrExtended {
  subject?: { attributes?: forge.pki.CertificateField[] }
  publicKey?: ForgeCsrKey | null
  signatureOid?: string
  md?: { algorithm?: string }
  verify: () => boolean
  getAttribute: (opts: { name: string }) => ForgeCsrAttribute | null
}

function formatSanExtensionValue(altNames: ForgeAltName[] = []): string {
  return altNames
    .map((an) => {
      if (an.type === 2) {
        return `DNS: ${an.value ?? ''}`
      }
      if (an.type === 7) {
        return `IP: ${an.ip || an.value || ''}`
      }
      if (an.type === 1) {
        return `Email: ${an.value ?? ''}`
      }
      if (an.type === 6) {
        return `URI: ${an.value ?? ''}`
      }
      return `Type ${an.type}: ${an.value ?? ''}`
    })
    .join(', ')
}

function formatKeyUsageExtension(ext: ForgeCsrExtension): string {
  const usages: string[] = []
  if (ext.digitalSignature) {
    usages.push('Digital Signature')
  }
  if (ext.nonRepudiation) {
    usages.push('Non-Repudiation')
  }
  if (ext.keyEncipherment) {
    usages.push('Key Encipherment')
  }
  if (ext.dataEncipherment) {
    usages.push('Data Encipherment')
  }
  if (ext.keyAgreement) {
    usages.push('Key Agreement')
  }
  if (ext.keyCertSign) {
    usages.push('Certificate Sign')
  }
  if (ext.cRLSign) {
    usages.push('CRL Sign')
  }
  if (ext.encipherOnly) {
    usages.push('Encipher Only')
  }
  if (ext.decipherOnly) {
    usages.push('Decipher Only')
  }
  return usages.join(', ')
}

function formatExtKeyUsageExtension(ext: ForgeCsrExtension): string {
  const eku: string[] = []
  if (ext.serverAuth) {
    eku.push('Server Authentication')
  }
  if (ext.clientAuth) {
    eku.push('Client Authentication')
  }
  if (ext.codeSigning) {
    eku.push('Code Signing')
  }
  if (ext.emailProtection) {
    eku.push('Email Protection')
  }
  if (ext.timeStamping) {
    eku.push('Time Stamping')
  }
  return eku.join(', ')
}

function collectPurposesFromExtension(ext: ForgeCsrExtension, purposes: string[]): void {
  if (ext.name === 'keyUsage') {
    if (ext.digitalSignature) {
      purposes.push('Digital Signature')
    }
    if (ext.keyCertSign) {
      purposes.push('Certificate Sign')
    }
    if (ext.cRLSign) {
      purposes.push('CRL Sign')
    }
    if (ext.keyEncipherment) {
      purposes.push('Key Encipherment')
    }
    if (ext.dataEncipherment) {
      purposes.push('Data Encipherment')
    }
  }
  if (ext.name === 'extKeyUsage') {
    if (ext.serverAuth) {
      purposes.push('Server Authentication')
    }
    if (ext.clientAuth) {
      purposes.push('Client Authentication')
    }
    if (ext.codeSigning) {
      purposes.push('Code Signing')
    }
    if (ext.emailProtection) {
      purposes.push('Email Protection')
    }
    if (ext.timeStamping) {
      purposes.push('Time Stamping')
    }
  }
}

function extractRequestedExtensions(csr: ForgeCsrExtended): {
  requestedExtensions: CSRExtension[]
  requestedPurposes: string[]
} {
  const requestedExtensions: CSRExtension[] = []
  const requestedPurposes: string[] = []

  try {
    const attrs = csr.getAttribute({ name: 'extensionRequest' })?.extensions || []
    for (const ext of attrs) {
      let valueStr = ''
      if (
        ext.name === 'subjectAltName' ||
        ext.altNames ||
        ext.subjectAltName ||
        ext.id === '2.5.29.17'
      ) {
        valueStr = formatSanExtensionValue(ext.altNames)
      } else if (ext.name === 'keyUsage') {
        valueStr = formatKeyUsageExtension(ext)
      } else if (ext.name === 'extKeyUsage') {
        valueStr = formatExtKeyUsageExtension(ext)
      } else if (typeof ext.value === 'string') {
        valueStr =
          forge.util
            .bytesToHex(ext.value)
            .match(/.{1,2}/g)
            ?.join(' ')
            .toUpperCase() || ''
      }

      const oid = ext.id || ''
      requestedExtensions.push({
        name: ext.name || forgeOids[oid] || 'Unknown',
        oid,
        critical: Boolean(ext.critical),
        value: valueStr,
      })

      collectPurposesFromExtension(ext, requestedPurposes)
    }
  } catch {
    // no extensions in CSR
  }

  if (requestedPurposes.length === 0) {
    requestedPurposes.push('Not specified')
  }

  return { requestedExtensions, requestedPurposes }
}

export async function parseCSRFile(file: File): Promise<ParsedCSR> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return parseCSRFromBytes(bytes)
}

export function parseCSRFromBytes(bytes: Uint8Array): ParsedCSR {
  let text = ''
  try {
    text = new TextDecoder('utf-8').decode(bytes)
  } catch {
    // binary DER
  }
  return parseCSRBytes(bytes, text)
}

export function parseCSRFromText(text: string): ParsedCSR {
  const bytes = new TextEncoder().encode(text)
  return parseCSRBytes(bytes, text)
}

function parseCSRBytes(bytes: Uint8Array, text: string): ParsedCSR {
  const isPem = text.includes('-----BEGIN')

  let rawCsr: ReturnType<typeof forge.pki.certificationRequestFromPem>
  let derStr: string

  if (isPem) {
    if (text.includes('BEGIN CERTIFICATE') && !text.includes('CERTIFICATE REQUEST')) {
      throw new Error('ERR_CERT_NOT_CSR')
    }
    if (text.includes('BEGIN X509 CRL') || text.includes('BEGIN CRL')) {
      throw new Error('ERR_CRL_NOT_CSR')
    }
    if (text.includes('PRIVATE KEY') && !text.includes('CERTIFICATE REQUEST')) {
      throw new Error('ERR_KEY_NOT_CSR')
    }

    const pemNorm = text.replace(/NEW CERTIFICATE REQUEST/g, 'CERTIFICATE REQUEST')
    try {
      rawCsr = forge.pki.certificationRequestFromPem(pemNorm)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`ERR_INVALID_FORMAT: Failed to parse PEM CSR (${msg})`)
    }
    derStr = forge.asn1.toDer(forge.pki.certificationRequestToAsn1(rawCsr)).getBytes()
  } else {
    derStr = uint8ToBinaryString(bytes)
    try {
      const asn1 = forge.asn1.fromDer(derStr)
      rawCsr = forge.pki.certificationRequestFromAsn1(asn1)
    } catch (e: unknown) {
      try {
        const asn1 = forge.asn1.fromDer(derStr)
        forge.pki.certificateFromAsn1(asn1)
        throw new Error('ERR_CERT_NOT_CSR')
      } catch (e2: unknown) {
        if (e2 instanceof Error && e2.message === 'ERR_CERT_NOT_CSR') {
          throw e2
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`ERR_INVALID_FORMAT: Failed to parse DER CSR (${msg})`)
    }
  }

  const csr = rawCsr as unknown as ForgeCsrExtended

  const subjectFields: CSRSubjectField[] = (csr.subject?.attributes || []).map((a) => ({
    shortName: a.shortName || '',
    name: labelFor(a.shortName || '', a.name || ''),
    value: String(a.value),
  }))
  const subjectStr = subjectFields.map((f) => `${f.shortName || f.name}=${f.value}`).join(', ')

  let publicKeyAlgorithm = 'Unknown'
  let publicKeySize: number | null = null
  if (csr.publicKey) {
    if (csr.publicKey.n) {
      publicKeyAlgorithm = 'RSA'
      publicKeySize = csr.publicKey.n.bitLength()
    } else if (csr.publicKey.curve) {
      publicKeyAlgorithm = 'EC (Elliptic Curve)'
    } else {
      publicKeyAlgorithm = 'Unknown / Other'
    }
  }

  const signatureOid = csr.signatureOid || csr.md?.algorithm || 'Unknown'
  const signatureAlgorithm = forgeOids[signatureOid] || signatureOid

  let signatureValid = false
  try {
    signatureValid = csr.verify()
  } catch {
    // treat as invalid
  }

  const { requestedExtensions, requestedPurposes } = extractRequestedExtensions(csr)

  const md = forge.md.sha256.create()
  md.update(derStr)
  const fingerprintSha256 =
    md
      .digest()
      .toHex()
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() || ''

  const pem = isPem ? text.trim() : forge.pki.certificationRequestToPem(rawCsr)
  const derBase64 = forge.util.encode64(derStr)

  return {
    subject: subjectStr,
    subjectFields,
    publicKeyAlgorithm,
    publicKeySize,
    signatureAlgorithm,
    signatureOid,
    signatureValid,
    requestedExtensions,
    requestedPurposes,
    pem,
    fingerprintSha256,
    derBase64,
  }
}
