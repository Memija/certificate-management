/**
 * Generates synthetic X.509 Certificate Signing Request (CSR) test fixtures in `test-certs/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'

const { pki } = forge

const DIGEST_CREATORS = {
  sha1: () => forge.md.sha1.create(),
  sha256: () => forge.md.sha256.create(),
  sha384: () => forge.md.sha384.create(),
}

/**
 * Generates an RSA key pair and creates a signed PKCS#10 CSR.
 * @param {object} options
 * @returns {forge.pki.CertificateSigningRequest}
 */
export function createSignedCsr({
  bits = 2048,
  subject,
  extensions = null,
  digest = 'sha256',
  signerPrivateKey = null,
}) {
  const keys = pki.rsa.generateKeyPair(bits)
  const csr = pki.createCertificationRequest()
  csr.publicKey = keys.publicKey
  csr.setSubject(subject)

  if (extensions && extensions.length > 0) {
    csr.setAttributes([
      {
        name: 'extensionRequest',
        extensions,
      },
    ])
  }

  const createMd = DIGEST_CREATORS[digest] ?? DIGEST_CREATORS.sha256
  csr.sign(signerPrivateKey ?? keys.privateKey, createMd())
  return csr
}

function writeUtf8Files(outputDir, filenames, content) {
  for (const filename of filenames) {
    fs.writeFileSync(path.join(outputDir, filename), content, 'utf8')
  }
}

function generateStandardAndRsaVariants(outputDir) {
  console.log('Generating 1: test.csr (Standard RSA 2048)...')
  const csrStandard = createSignedCsr({
    bits: 2048,
    subject: [
      { name: 'commonName', value: 'example.com' },
      { name: 'organizationName', value: 'Acme Corporation' },
      { shortName: 'OU', value: 'IT Infrastructure' },
      { name: 'localityName', value: 'San Francisco' },
      { shortName: 'ST', value: 'California' },
      { name: 'countryName', value: 'US' },
      { name: 'emailAddress', value: 'admin@example.com' },
    ],
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'example.com' },
          { type: 2, value: 'www.example.com' },
          { type: 2, value: 'api.example.com' },
          { type: 7, ip: '192.168.1.50' },
        ],
      },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    ],
  })
  const pemStandard = pki.certificationRequestToPem(csrStandard)
  writeUtf8Files(outputDir, ['test.csr', 'test-standard-rsa2048.csr'], pemStandard)

  console.log('Generating 2: test-rsa4096.csr (RSA 4096 with SHA-384)...')
  const csr4096 = createSignedCsr({
    bits: 4096,
    digest: 'sha384',
    subject: [
      { name: 'commonName', value: 'secure-vault.internal' },
      { name: 'organizationName', value: 'Enterprise Security Corp' },
      { shortName: 'OU', value: 'Cyber Defense' },
      { name: 'countryName', value: 'DE' },
    ],
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'secure-vault.internal' },
          { type: 2, value: 'cluster.vault.internal' },
        ],
      },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, dataEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
    ],
  })
  writeUtf8Files(outputDir, ['test-rsa4096.csr'], pki.certificationRequestToPem(csr4096))

  console.log('Generating 3: test-rsa1024-legacy.csr (RSA 1024 with SHA-1, No extensions)...')
  const csr1024 = createSignedCsr({
    bits: 1024,
    digest: 'sha1',
    subject: [
      { name: 'commonName', value: 'legacy-terminal.intranet' },
      { name: 'organizationName', value: 'Legacy Banking Network' },
      { name: 'countryName', value: 'GB' },
    ],
  })
  writeUtf8Files(outputDir, ['test-rsa1024-legacy.csr'], pki.certificationRequestToPem(csr1024))
}

function generateSanAndEncodingVariants(outputDir) {
  console.log('Generating 4: test-san-multidomain.csr (Wildcard DNS, IP, Email, URI)...')
  const csrMulti = createSignedCsr({
    subject: [
      { name: 'commonName', value: '*.cloudservices.org' },
      { name: 'organizationName', value: 'Global Cloud Network' },
      { name: 'countryName', value: 'NL' },
    ],
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: '*.cloudservices.org' },
          { type: 2, value: 'cloudservices.org' },
          { type: 2, value: 'auth.cloudservices.org' },
          { type: 7, ip: '10.200.1.1' },
          { type: 1, value: 'security@cloudservices.org' },
          { type: 6, value: 'https://cloudservices.org/api/v1' },
        ],
      },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true },
    ],
  })
  writeUtf8Files(outputDir, ['test-san-multidomain.csr'], pki.certificationRequestToPem(csrMulti))

  console.log('Generating 5: test-der.csr / test-csr.der (Binary DER encoded)...')
  const csrDer = createSignedCsr({
    subject: [
      { name: 'commonName', value: 'binary-der-service.local' },
      { name: 'organizationName', value: 'Binary Protocol Systems' },
      { name: 'countryName', value: 'CH' },
    ],
    extensions: [
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'binary-der-service.local' }] },
    ],
  })
  const asn1Der = pki.certificationRequestToAsn1(csrDer)
  const derBuffer = Buffer.from(forge.asn1.toDer(asn1Der).getBytes(), 'binary')
  fs.writeFileSync(path.join(outputDir, 'test-der.csr'), derBuffer)
  fs.writeFileSync(path.join(outputDir, 'test-csr.der'), derBuffer)

  console.log('Generating 6: test-new-header.csr / .req (NEW CERTIFICATE REQUEST header)...')
  const csrNew = createSignedCsr({
    subject: [
      { name: 'commonName', value: 'iis-server01.corp.internal' },
      { name: 'organizationName', value: 'Enterprise Directory Services' },
      { shortName: 'OU', value: 'Domain Controllers' },
      { name: 'countryName', value: 'US' },
    ],
    extensions: [
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'iis-server01.corp.internal' }] },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
    ],
  })
  const pemNewHeader = pki
    .certificationRequestToPem(csrNew)
    .replace(/CERTIFICATE REQUEST/g, 'NEW CERTIFICATE REQUEST')
  writeUtf8Files(outputDir, ['test-new-header.csr', 'test-new-header.req'], pemNewHeader)
}

function generateSecurityAndEdgeVariants(outputDir) {
  console.log('Generating 7: test-invalid-signature.csr (Mismatched private key)...')
  const mismatchedSigner = pki.rsa.generateKeyPair(2048)
  const csrTamper = createSignedCsr({
    signerPrivateKey: mismatchedSigner.privateKey,
    subject: [
      { name: 'commonName', value: 'untrusted-signature.example.com' },
      { name: 'organizationName', value: 'Mismatched Signer Corp' },
      { name: 'countryName', value: 'US' },
    ],
  })
  writeUtf8Files(
    outputDir,
    ['test-invalid-signature.csr'],
    pki.certificationRequestToPem(csrTamper),
  )

  console.log('Generating 8: test-minimal.csr (Common Name only, no extensions)...')
  const csrMin = createSignedCsr({
    subject: [{ name: 'commonName', value: 'minimal-device.local' }],
  })
  writeUtf8Files(outputDir, ['test-minimal.csr'], pki.certificationRequestToPem(csrMin))

  console.log('Generating 9: test-code-signing.csr (Code Signing & Time Stamping)...')
  const csrCode = createSignedCsr({
    subject: [
      { name: 'commonName', value: 'Acme Software Release Signing' },
      { name: 'organizationName', value: 'Acme Corporation' },
      { shortName: 'OU', value: 'Release Engineering' },
      { name: 'countryName', value: 'US' },
    ],
    extensions: [
      { name: 'keyUsage', digitalSignature: true },
      { name: 'extKeyUsage', codeSigning: true, timeStamping: true },
    ],
  })
  writeUtf8Files(outputDir, ['test-code-signing.csr'], pki.certificationRequestToPem(csrCode))
}

function generateClientAndCorruptVariants(outputDir) {
  console.log('Generating 10: test-client-auth.csr (Client Auth, Email Protection, Serial)...')
  const csrClient = createSignedCsr({
    subject: [
      { name: 'commonName', value: 'jane.doe@securecorp.com' },
      { name: 'organizationName', value: 'SecureCorp' },
      { shortName: 'OU', value: 'Identity Management' },
      { name: 'countryName', value: 'US' },
      { name: 'serialNumber', value: 'EMP-84920' },
    ],
    extensions: [
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true, emailProtection: true },
    ],
  })
  writeUtf8Files(outputDir, ['test-client-auth.csr'], pki.certificationRequestToPem(csrClient))

  console.log('Generating 11: test-corrupt.csr (Malformed file)...')
  const corruptContent = [
    '-----BEGIN CERTIFICATE REQUEST-----',
    'MIICbzCCAVcCAQAwKjEUMBIGA1UEAxMLZXhhbXBsZS5jb20xEjAQBgNVBAoTCUFj',
    'bWUgQ29ycDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALupgyAYJAWv',
    '*** CORRUPTED DATA TRUNCATED AND INVALID BASE64 ***',
    '-----END CERTIFICATE REQUEST-----',
  ].join('\n')
  writeUtf8Files(outputDir, ['test-corrupt.csr'], corruptContent)
}

/**
 * Generates the complete CSR test fixture suite in the target directory.
 * @param {string} [outputDir]
 */
export function generateCsrTestFiles(outputDir = path.resolve(process.cwd(), 'test-certs')) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Generating CSR test suite in:', outputDir)
  generateStandardAndRsaVariants(outputDir)
  generateSanAndEncodingVariants(outputDir)
  generateSecurityAndEdgeVariants(outputDir)
  generateClientAndCorruptVariants(outputDir)
  console.log('Done! All CSR test files generated successfully.')
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()

if (isDirectRun) {
  generateCsrTestFiles()
}
