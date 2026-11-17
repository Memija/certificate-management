import forge from 'node-forge'

import { generateRsaKeyPairAsync } from '@/utils/rsa-key-generator'

export type KeyGeneratorOutputType = 'csr' | 'self-signed'

export interface KeyGeneratorSubjectInput {
  cn: string
  org: string
  ou: string
  locality: string
  state: string
  country: string
}

export interface GeneratedKeyPairBundle {
  privateKeyPem: string
  outputPem: string
}

function buildSubjectAttributes(subject: KeyGeneratorSubjectInput): forge.pki.CertificateField[] {
  const attrs: forge.pki.CertificateField[] = []
  const trimmedCn = subject.cn.trim()
  const trimmedCountry = subject.country.trim().toUpperCase()
  const trimmedState = subject.state.trim()
  const trimmedLocality = subject.locality.trim()
  const trimmedOrg = subject.org.trim()
  const trimmedOu = subject.ou.trim()

  if (trimmedCn) {
    attrs.push({ name: 'commonName', value: trimmedCn })
  }
  if (trimmedCountry) {
    attrs.push({ name: 'countryName', value: trimmedCountry })
  }
  if (trimmedState) {
    attrs.push({ name: 'stateOrProvinceName', value: trimmedState })
  }
  if (trimmedLocality) {
    attrs.push({ name: 'localityName', value: trimmedLocality })
  }
  if (trimmedOrg) {
    attrs.push({ name: 'organizationName', value: trimmedOrg })
  }
  if (trimmedOu) {
    attrs.push({ name: 'organizationalUnitName', value: trimmedOu })
  }
  return attrs
}

export async function generateKeyPairAndOutput(
  subject: KeyGeneratorSubjectInput,
  keySize: number,
  outputType: KeyGeneratorOutputType,
): Promise<GeneratedKeyPairBundle> {
  const keys = await generateRsaKeyPairAsync(keySize)
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey)
  const attrs = buildSubjectAttributes(subject)
  const trimmedCn = subject.cn.trim()

  if (outputType === 'csr') {
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = keys.publicKey
    csr.setSubject(attrs)
    csr.sign(keys.privateKey, forge.md.sha256.create())
    return {
      privateKeyPem,
      outputPem: forge.pki.certificationRequestToPem(csr),
    }
  }

  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = `01${forge.util.bytesToHex(forge.random.getBytesSync(8))}`
  const notBefore = new Date()
  const notAfter = new Date(notBefore.getTime())
  notAfter.setFullYear(notBefore.getFullYear() + 1)
  cert.validity.notBefore = notBefore
  cert.validity.notAfter = notAfter
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true,
    },
    { name: 'subjectAltName', altNames: [{ type: 2, value: trimmedCn }] },
    { name: 'subjectKeyIdentifier' },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  return {
    privateKeyPem,
    outputPem: forge.pki.certificateToPem(cert),
  }
}

export function triggerTextDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
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
