/**
 * Generates synthetic RSA key-pair matcher test fixtures (certificates, CSRs, PKCS#1/PKCS#8 keys) in `test-certs/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'

const { pki } = forge

/**
 * Computes the SHA-256 hex digest of an RSA modulus hex string.
 * @param {string} modulusHex
 * @returns {string}
 */
export function getModulusSha256(modulusHex) {
  const md = forge.md.sha256.create()
  md.update(forge.util.hexToBytes(modulusHex))
  return md.digest().toHex()
}

function createSelfSignedCert({
  keys,
  serialNumber,
  validityYears,
  subject,
  issuer,
  extensions = [],
  digest = 'sha256',
}) {
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = serialNumber
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + validityYears)
  cert.setSubject(subject)
  cert.setIssuer(issuer)

  if (extensions.length > 0) {
    cert.setExtensions(extensions)
  }

  const md = digest === 'sha384' ? forge.md.sha384.create() : forge.md.sha256.create()
  cert.sign(keys.privateKey, md)
  return cert
}

function toPkcs8PrivateKeyPem(privateKey) {
  const rsaPrivateKeyAsn1 = pki.privateKeyToAsn1(privateKey)
  const pkcs8Asn1 = pki.wrapRsaPrivateKey(rsaPrivateKeyAsn1)
  return pki.privateKeyInfoToPem(pkcs8Asn1)
}

function generatePairA(outputDir) {
  console.log('Generating Pair A (Standard RSA 2048)...')
  const keysA = pki.rsa.generateKeyPair(2048)

  const certA = createSelfSignedCert({
    keys: keysA,
    serialNumber: '01a4b5c6d7e8f9',
    validityYears: 2,
    subject: [
      { name: 'commonName', value: 'matcher.example.com' },
      { name: 'organizationName', value: 'Key Matcher Corp' },
      { shortName: 'OU', value: 'Security Engineering' },
      { name: 'localityName', value: 'Austin' },
      { shortName: 'ST', value: 'Texas' },
      { name: 'countryName', value: 'US' },
    ],
    issuer: [
      { name: 'commonName', value: 'Key Matcher Root CA' },
      { name: 'organizationName', value: 'Key Matcher Corp' },
      { name: 'countryName', value: 'US' },
    ],
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'matcher.example.com' },
          { type: 2, value: 'www.matcher.example.com' },
        ],
      },
    ],
  })

  const csrA = pki.createCertificationRequest()
  csrA.publicKey = keysA.publicKey
  csrA.setSubject([
    { name: 'commonName', value: 'matcher.example.com' },
    { name: 'organizationName', value: 'Key Matcher Corp' },
    { shortName: 'OU', value: 'Security Engineering' },
    { name: 'countryName', value: 'US' },
  ])
  csrA.setAttributes([
    {
      name: 'extensionRequest',
      extensions: [
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'matcher.example.com' }] },
      ],
    },
  ])
  csrA.sign(keysA.privateKey, forge.md.sha256.create())

  const certAPem = pki.certificateToPem(certA)
  const csrAPem = pki.certificationRequestToPem(csrA)
  const keyAPem = pki.privateKeyToPem(keysA.privateKey)
  const pkcs8KeyAPem = toPkcs8PrivateKeyPem(keysA.privateKey)

  fs.writeFileSync(path.join(outputDir, 'matcher-valid-cert.pem'), certAPem, 'utf8')
  fs.writeFileSync(path.join(outputDir, 'matcher-valid-csr.pem'), csrAPem, 'utf8')
  fs.writeFileSync(path.join(outputDir, 'matcher-valid-key.pem'), keyAPem, 'utf8')
  fs.writeFileSync(path.join(outputDir, 'matcher-pkcs8-key.pem'), pkcs8KeyAPem, 'utf8')

  const hashA = getModulusSha256(keysA.publicKey.n.toString(16))
  console.log('Pair A Modulus SHA-256:', hashA)

  return {
    name: 'Standard RSA 2048 (Matching)',
    modulusBitLength: 2048,
    modulusSha256: hashA,
    certificatePem: certAPem,
    csrPem: csrAPem,
    privateKeyPem: keyAPem,
    pkcs8PrivateKeyPem: pkcs8KeyAPem,
  }
}

function generatePairB(outputDir) {
  console.log('Generating Pair B (Mismatch RSA 2048)...')
  const keysB = pki.rsa.generateKeyPair(2048)

  const certB = createSelfSignedCert({
    keys: keysB,
    serialNumber: '02b5c6d7e8f9a0',
    validityYears: 1,
    subject: [
      { name: 'commonName', value: 'different-domain.org' },
      { name: 'organizationName', value: 'Another Org Ltd' },
      { name: 'countryName', value: 'GB' },
    ],
    issuer: [{ name: 'commonName', value: 'Different CA' }],
  })

  const certBPem = pki.certificateToPem(certB)
  const keyBPem = pki.privateKeyToPem(keysB.privateKey)

  fs.writeFileSync(path.join(outputDir, 'matcher-mismatch-cert.pem'), certBPem, 'utf8')
  fs.writeFileSync(path.join(outputDir, 'matcher-mismatch-key.pem'), keyBPem, 'utf8')

  const hashB = getModulusSha256(keysB.publicKey.n.toString(16))
  console.log('Pair B Modulus SHA-256:', hashB)

  return {
    name: 'Different RSA 2048 (Mismatch against Pair A)',
    modulusBitLength: 2048,
    modulusSha256: hashB,
    certificatePem: certBPem,
    privateKeyPem: keyBPem,
  }
}

function generatePairC(outputDir) {
  console.log('Generating Pair C (RSA 4096)...')
  const keysC = pki.rsa.generateKeyPair(4096)

  const certC = createSelfSignedCert({
    keys: keysC,
    serialNumber: '03c7d8e9f0a1b2',
    validityYears: 3,
    digest: 'sha384',
    subject: [
      { name: 'commonName', value: 'vault.internal.sec' },
      { name: 'organizationName', value: 'High Assurance Vault' },
      { name: 'countryName', value: 'CH' },
    ],
    issuer: [{ name: 'commonName', value: 'Swiss High Assurance CA' }],
  })

  const certCPem = pki.certificateToPem(certC)
  const keyCPem = pki.privateKeyToPem(keysC.privateKey)

  fs.writeFileSync(path.join(outputDir, 'matcher-rsa4096-cert.pem'), certCPem, 'utf8')
  fs.writeFileSync(path.join(outputDir, 'matcher-rsa4096-key.pem'), keyCPem, 'utf8')

  const hashC = getModulusSha256(keysC.publicKey.n.toString(16))
  console.log('Pair C Modulus SHA-256:', hashC)

  return {
    name: 'High-Security RSA 4096 (Matching)',
    modulusBitLength: 4096,
    modulusSha256: hashC,
    certificatePem: certCPem,
    privateKeyPem: keyCPem,
  }
}

/**
 * Generates all Key Pair Matcher test fixtures and `matcher-samples.json`.
 * @param {string} [outputDir]
 */
export function generateMatcherTestFiles(outputDir = path.resolve(process.cwd(), 'test-certs')) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Generating Key Pair Matcher test suite in:', outputDir)

  const sampleData = {
    pairA: generatePairA(outputDir),
    pairB: generatePairB(outputDir),
    pairC: generatePairC(outputDir),
  }

  fs.writeFileSync(
    path.join(outputDir, 'matcher-samples.json'),
    JSON.stringify(sampleData, null, 2),
    'utf8',
  )

  console.log('Key Pair Matcher test files generated successfully!')
  return sampleData
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()

if (isDirectRun) {
  generateMatcherTestFiles()
}
