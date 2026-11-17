import forge from 'node-forge'

import type { ChainPreset, ParsedCertificate } from '@/types'

import { parsePemToCerts } from './trust-store-parser'

export type { ChainPreset }

interface ForgeSkiExtension {
  value?: string
}

const cachedKeyPool: forge.pki.rsa.KeyPair[] = []

function getPooledKeyPair(index: number): forge.pki.rsa.KeyPair {
  while (cachedKeyPool.length <= index) {
    cachedKeyPool.push(forge.pki.rsa.generateKeyPair(1024))
  }
  return cachedKeyPool[index]
}

const chainCache = new Map<string, ParsedCertificate[]>()

export function createCryptographicChain(preset: ChainPreset): ParsedCertificate[] {
  const dayKey = new Date().toISOString().slice(0, 10)
  const cacheKey = `${preset}:${dayKey}`
  const cached = chainCache.get(cacheKey)
  if (cached) {
    return cached.map((c) => ({ ...c, purposes: [...c.purposes], extensions: [...c.extensions] }))
  }

  const built = buildChainUncached(preset)
  chainCache.set(cacheKey, built)
  return built.map((c) => ({ ...c, purposes: [...c.purposes], extensions: [...c.extensions] }))
}

function buildChainUncached(preset: ChainPreset): ParsedCertificate[] {
  const rootKeys = getPooledKeyPair(0)
  const now = new Date()
  const rootNotBefore = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
  const rootNotAfter = new Date(now.getTime() + 10 * 365 * 24 * 3600 * 1000)

  const rootCert = forge.pki.createCertificate()
  rootCert.publicKey = rootKeys.publicKey
  rootCert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8))
  rootCert.validity.notBefore = rootNotBefore
  rootCert.validity.notAfter = rootNotAfter

  const rootAttrs = [
    { name: 'commonName', value: 'CyberTrust Global Root CA R1' },
    { name: 'organizationName', value: 'CyberTrust Global Authority' },
    { name: 'countryName', value: 'US' },
  ]
  rootCert.setSubject(rootAttrs)
  rootCert.setIssuer(rootAttrs)
  rootCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ])
  rootCert.sign(rootKeys.privateKey, forge.md.sha256.create())

  const rootPem = forge.pki.certificateToPem(rootCert)

  if (preset === '3-tier-web' || preset === 'broken-intermediate') {
    const interKeys = getPooledKeyPair(1)
    const interCert = forge.pki.createCertificate()
    interCert.publicKey = interKeys.publicKey
    interCert.serialNumber = '02' + forge.util.bytesToHex(forge.random.getBytesSync(8))
    interCert.validity.notBefore = new Date(now.getTime() - 60 * 24 * 3600 * 1000)
    interCert.validity.notAfter = new Date(now.getTime() + 5 * 365 * 24 * 3600 * 1000)

    const interAttrs = [
      { name: 'commonName', value: 'CyberTrust TLS Issuing CA 1A' },
      { name: 'organizationName', value: 'CyberTrust Global Authority' },
      { name: 'countryName', value: 'US' },
    ]
    interCert.setSubject(interAttrs)
    interCert.setIssuer(rootAttrs)
    const rootSki = rootCert.getExtension('subjectKeyIdentifier') as ForgeSkiExtension | null
    interCert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
      { name: 'authorityKeyIdentifier', keyIdentifier: rootSki?.value },
    ])
    interCert.sign(rootKeys.privateKey, forge.md.sha256.create())
    const interPem = forge.pki.certificateToPem(interCert)

    const leafKeys = getPooledKeyPair(2)
    const leafCert = forge.pki.createCertificate()
    leafCert.publicKey = leafKeys.publicKey
    leafCert.serialNumber = '03' + forge.util.bytesToHex(forge.random.getBytesSync(8))
    leafCert.validity.notBefore = new Date(now.getTime() - 10 * 24 * 3600 * 1000)
    leafCert.validity.notAfter = new Date(now.getTime() + 355 * 24 * 3600 * 1000)

    const leafAttrs = [
      { name: 'commonName', value: '*.cloudsecurity.io' },
      { name: 'organizationName', value: 'Cloud Security Systems Corp' },
      { name: 'countryName', value: 'US' },
    ]
    leafCert.setSubject(leafAttrs)
    leafCert.setIssuer(interAttrs)
    leafCert.setExtensions([
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'cloudsecurity.io' },
          { type: 2, value: '*.cloudsecurity.io' },
          { type: 2, value: 'api.cloudsecurity.io' },
        ],
      },
      { name: 'subjectKeyIdentifier' },
    ])
    leafCert.sign(interKeys.privateKey, forge.md.sha256.create())
    const leafPem = forge.pki.certificateToPem(leafCert)

    if (preset === 'broken-intermediate') {
      return parsePemToCerts(`${rootPem}\n${leafPem}`)
    }

    return parsePemToCerts(`${rootPem}\n${interPem}\n${leafPem}`)
  }

  if (preset === '4-tier-enterprise') {
    const policyKeys = getPooledKeyPair(1)
    const policyCert = forge.pki.createCertificate()
    policyCert.publicKey = policyKeys.publicKey
    policyCert.serialNumber = '02' + forge.util.bytesToHex(forge.random.getBytesSync(8))
    policyCert.validity.notBefore = new Date(now.getTime() - 120 * 24 * 3600 * 1000)
    policyCert.validity.notAfter = new Date(now.getTime() + 8 * 365 * 24 * 3600 * 1000)

    const policyAttrs = [
      { name: 'commonName', value: 'CyberTrust Enterprise Policy CA' },
      { name: 'organizationName', value: 'CyberTrust Global Authority' },
      { name: 'countryName', value: 'US' },
    ]
    policyCert.setSubject(policyAttrs)
    policyCert.setIssuer(rootAttrs)
    policyCert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
    ])
    policyCert.sign(rootKeys.privateKey, forge.md.sha256.create())
    const policyPem = forge.pki.certificateToPem(policyCert)

    const issueKeys = getPooledKeyPair(2)
    const issueCert = forge.pki.createCertificate()
    issueCert.publicKey = issueKeys.publicKey
    issueCert.serialNumber = '03' + forge.util.bytesToHex(forge.random.getBytesSync(8))
    issueCert.validity.notBefore = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    issueCert.validity.notAfter = new Date(now.getTime() + 3 * 365 * 24 * 3600 * 1000)

    const issueAttrs = [
      { name: 'commonName', value: 'CyberTrust North America Issuing CA 2' },
      { name: 'organizationName', value: 'CyberTrust Global Authority' },
      { name: 'countryName', value: 'US' },
    ]
    issueCert.setSubject(issueAttrs)
    issueCert.setIssuer(policyAttrs)
    issueCert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
    ])
    issueCert.sign(policyKeys.privateKey, forge.md.sha256.create())
    const issuePem = forge.pki.certificateToPem(issueCert)

    const serverKeys = getPooledKeyPair(3)
    const serverCert = forge.pki.createCertificate()
    serverCert.publicKey = serverKeys.publicKey
    serverCert.serialNumber = '04' + forge.util.bytesToHex(forge.random.getBytesSync(8))
    serverCert.validity.notBefore = new Date(now.getTime() - 5 * 24 * 3600 * 1000)
    serverCert.validity.notAfter = new Date(now.getTime() + 360 * 24 * 3600 * 1000)

    const serverAttrs = [
      { name: 'commonName', value: 'identity.secure-enterprise.net' },
      { name: 'organizationName', value: 'Secure Enterprise Identity Ltd' },
      { name: 'countryName', value: 'US' },
    ]
    serverCert.setSubject(serverAttrs)
    serverCert.setIssuer(issueAttrs)
    serverCert.setExtensions([
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'identity.secure-enterprise.net' },
          { type: 2, value: 'auth.secure-enterprise.net' },
        ],
      },
    ])
    serverCert.sign(issueKeys.privateKey, forge.md.sha256.create())
    const serverPem = forge.pki.certificateToPem(serverCert)

    return parsePemToCerts(`${rootPem}\n${policyPem}\n${issuePem}\n${serverPem}`)
  }

  // Multi-leaf branch
  const interKeys = getPooledKeyPair(1)
  const interCert = forge.pki.createCertificate()
  interCert.publicKey = interKeys.publicKey
  interCert.serialNumber = '02' + forge.util.bytesToHex(forge.random.getBytesSync(8))
  interCert.validity.notBefore = new Date(now.getTime() - 40 * 24 * 3600 * 1000)
  interCert.validity.notAfter = new Date(now.getTime() + 4 * 365 * 24 * 3600 * 1000)

  const interAttrs = [
    { name: 'commonName', value: 'CyberTrust Multi-Service CA' },
    { name: 'organizationName', value: 'CyberTrust Global Authority' },
    { name: 'countryName', value: 'US' },
  ]
  interCert.setSubject(interAttrs)
  interCert.setIssuer(rootAttrs)
  interCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ])
  interCert.sign(rootKeys.privateKey, forge.md.sha256.create())
  const interPem = forge.pki.certificateToPem(interCert)

  const leaf1Keys = getPooledKeyPair(2)
  const leaf1Cert = forge.pki.createCertificate()
  leaf1Cert.publicKey = leaf1Keys.publicKey
  leaf1Cert.serialNumber = '03' + forge.util.bytesToHex(forge.random.getBytesSync(8))
  leaf1Cert.validity.notBefore = new Date(now.getTime() - 2 * 24 * 3600 * 1000)
  leaf1Cert.validity.notAfter = new Date(now.getTime() + 363 * 24 * 3600 * 1000)

  const leaf1Attrs = [
    { name: 'commonName', value: 'app.cybercloud.io' },
    { name: 'organizationName', value: 'CyberCloud SaaS' },
    { name: 'countryName', value: 'US' },
  ]
  leaf1Cert.setSubject(leaf1Attrs)
  leaf1Cert.setIssuer(interAttrs)
  leaf1Cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'app.cybercloud.io' }] },
  ])
  leaf1Cert.sign(interKeys.privateKey, forge.md.sha256.create())
  const leaf1Pem = forge.pki.certificateToPem(leaf1Cert)

  const leaf2Keys = getPooledKeyPair(3)
  const leaf2Cert = forge.pki.createCertificate()
  leaf2Cert.publicKey = leaf2Keys.publicKey
  leaf2Cert.serialNumber = '04' + forge.util.bytesToHex(forge.random.getBytesSync(8))
  leaf2Cert.validity.notBefore = new Date(now.getTime() - 3 * 24 * 3600 * 1000)
  leaf2Cert.validity.notAfter = new Date(now.getTime() + 362 * 24 * 3600 * 1000)

  const leaf2Attrs = [
    { name: 'commonName', value: 'api.cybercloud.io' },
    { name: 'organizationName', value: 'CyberCloud SaaS' },
    { name: 'countryName', value: 'US' },
  ]
  leaf2Cert.setSubject(leaf2Attrs)
  leaf2Cert.setIssuer(interAttrs)
  leaf2Cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'api.cybercloud.io' }] },
  ])
  leaf2Cert.sign(interKeys.privateKey, forge.md.sha256.create())
  const leaf2Pem = forge.pki.certificateToPem(leaf2Cert)

  return parsePemToCerts(`${rootPem}\n${interPem}\n${leaf1Pem}\n${leaf2Pem}`)
}
