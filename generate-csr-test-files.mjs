import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const pki = forge.pki;
const testCertsDir = path.resolve('test-certs');

if (!fs.existsSync(testCertsDir)) {
  fs.mkdirSync(testCertsDir, { recursive: true });
}

console.log('Generating CSR test suite in:', testCertsDir);

// ─── 1. Standard RSA 2048 CSR (test.csr) ─────────────────────────────────────
console.log('Generating 1: test.csr (Standard RSA 2048)...');
const keysStandard = pki.rsa.generateKeyPair(2048);
const csrStandard = pki.createCertificationRequest();
csrStandard.publicKey = keysStandard.publicKey;
csrStandard.setSubject([
  { name: 'commonName', value: 'example.com' },
  { name: 'organizationName', value: 'Acme Corporation' },
  { shortName: 'OU', value: 'IT Infrastructure' },
  { name: 'localityName', value: 'San Francisco' },
  { shortName: 'ST', value: 'California' },
  { name: 'countryName', value: 'US' },
  { name: 'emailAddress', value: 'admin@example.com' },
]);
csrStandard.setAttributes([
  {
    name: 'extensionRequest',
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
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
      },
    ],
  },
]);
csrStandard.sign(keysStandard.privateKey, forge.md.sha256.create());
const pemStandard = pki.certificationRequestToPem(csrStandard);
fs.writeFileSync(path.join(testCertsDir, 'test.csr'), pemStandard, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'test-standard-rsa2048.csr'), pemStandard, 'utf8');

// ─── 2. High-Security RSA 4096 CSR (test-rsa4096.csr) ────────────────────────
console.log('Generating 2: test-rsa4096.csr (RSA 4096 with SHA-384)...');
const keys4096 = pki.rsa.generateKeyPair(4096);
const csr4096 = pki.createCertificationRequest();
csr4096.publicKey = keys4096.publicKey;
csr4096.setSubject([
  { name: 'commonName', value: 'secure-vault.internal' },
  { name: 'organizationName', value: 'Enterprise Security Corp' },
  { shortName: 'OU', value: 'Cyber Defense' },
  { name: 'countryName', value: 'DE' },
]);
csr4096.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'secure-vault.internal' },
          { type: 2, value: 'cluster.vault.internal' },
        ],
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
    ],
  },
]);
csr4096.sign(keys4096.privateKey, forge.md.sha384.create());
const pem4096 = pki.certificationRequestToPem(csr4096);
fs.writeFileSync(path.join(testCertsDir, 'test-rsa4096.csr'), pem4096, 'utf8');

// ─── 3. Legacy RSA 1024 CSR without extensions (test-rsa1024-legacy.csr) ─────
console.log('Generating 3: test-rsa1024-legacy.csr (RSA 1024 with SHA-1, No extensions)...');
const keys1024 = pki.rsa.generateKeyPair(1024);
const csr1024 = pki.createCertificationRequest();
csr1024.publicKey = keys1024.publicKey;
csr1024.setSubject([
  { name: 'commonName', value: 'legacy-terminal.intranet' },
  { name: 'organizationName', value: 'Legacy Banking Network' },
  { name: 'countryName', value: 'GB' },
]);
// Intentionally no extensionRequest attribute
csr1024.sign(keys1024.privateKey, forge.md.sha1.create());
const pem1024 = pki.certificationRequestToPem(csr1024);
fs.writeFileSync(path.join(testCertsDir, 'test-rsa1024-legacy.csr'), pem1024, 'utf8');

// ─── 4. Wildcard & Multi-Type SAN CSR (test-san-multidomain.csr) ─────────────
console.log('Generating 4: test-san-multidomain.csr (Wildcard DNS, IP, Email, URI)...');
const keysMulti = pki.rsa.generateKeyPair(2048);
const csrMulti = pki.createCertificationRequest();
csrMulti.publicKey = keysMulti.publicKey;
csrMulti.setSubject([
  { name: 'commonName', value: '*.cloudservices.org' },
  { name: 'organizationName', value: 'Global Cloud Network' },
  { name: 'countryName', value: 'NL' },
]);
csrMulti.setAttributes([
  {
    name: 'extensionRequest',
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
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
      },
    ],
  },
]);
csrMulti.sign(keysMulti.privateKey, forge.md.sha256.create());
const pemMulti = pki.certificationRequestToPem(csrMulti);
fs.writeFileSync(path.join(testCertsDir, 'test-san-multidomain.csr'), pemMulti, 'utf8');

// ─── 5. Binary DER Encoded CSR (test-der.csr and test-csr.der) ───────────────
console.log('Generating 5: test-der.csr / test-csr.der (Binary DER encoded)...');
const keysDer = pki.rsa.generateKeyPair(2048);
const csrDer = pki.createCertificationRequest();
csrDer.publicKey = keysDer.publicKey;
csrDer.setSubject([
  { name: 'commonName', value: 'binary-der-service.local' },
  { name: 'organizationName', value: 'Binary Protocol Systems' },
  { name: 'countryName', value: 'CH' },
]);
csrDer.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: 'binary-der-service.local' }],
      },
    ],
  },
]);
csrDer.sign(keysDer.privateKey, forge.md.sha256.create());
const asn1Der = forge.pki.certificationRequestToAsn1(csrDer);
const derBytesStr = forge.asn1.toDer(asn1Der).getBytes();
const derBuffer = Buffer.from(derBytesStr, 'binary');
fs.writeFileSync(path.join(testCertsDir, 'test-der.csr'), derBuffer);
fs.writeFileSync(path.join(testCertsDir, 'test-csr.der'), derBuffer);

// ─── 6. Legacy Header CSR (test-new-header.csr and test-new-header.req) ──────
console.log('Generating 6: test-new-header.csr / .req (NEW CERTIFICATE REQUEST header)...');
const keysNew = pki.rsa.generateKeyPair(2048);
const csrNew = pki.createCertificationRequest();
csrNew.publicKey = keysNew.publicKey;
csrNew.setSubject([
  { name: 'commonName', value: 'iis-server01.corp.internal' },
  { name: 'organizationName', value: 'Enterprise Directory Services' },
  { shortName: 'OU', value: 'Domain Controllers' },
  { name: 'countryName', value: 'US' },
]);
csrNew.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: 'iis-server01.corp.internal' }],
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
    ],
  },
]);
csrNew.sign(keysNew.privateKey, forge.md.sha256.create());
const pemNewStandard = pki.certificationRequestToPem(csrNew);
const pemNewHeader = pemNewStandard.replace(/CERTIFICATE REQUEST/g, 'NEW CERTIFICATE REQUEST');
fs.writeFileSync(path.join(testCertsDir, 'test-new-header.csr'), pemNewHeader, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'test-new-header.req'), pemNewHeader, 'utf8');

// ─── 7. Tampered / Invalid Signature CSR (test-invalid-signature.csr) ─────────
console.log('Generating 7: test-invalid-signature.csr (Mismatched private key)...');
const keysTamperPublic = pki.rsa.generateKeyPair(2048);
const keysTamperSigner = pki.rsa.generateKeyPair(2048);
const csrTamper = pki.createCertificationRequest();
csrTamper.publicKey = keysTamperPublic.publicKey;
csrTamper.setSubject([
  { name: 'commonName', value: 'untrusted-signature.example.com' },
  { name: 'organizationName', value: 'Mismatched Signer Corp' },
  { name: 'countryName', value: 'US' },
]);
// Sign with keysTamperSigner.privateKey (not keysTamperPublic.privateKey)
csrTamper.sign(keysTamperSigner.privateKey, forge.md.sha256.create());
const pemTamper = pki.certificationRequestToPem(csrTamper);
fs.writeFileSync(path.join(testCertsDir, 'test-invalid-signature.csr'), pemTamper, 'utf8');

// ─── 8. Minimal CSR (test-minimal.csr) ───────────────────────────────────────
console.log('Generating 8: test-minimal.csr (Common Name only, no extensions)...');
const keysMin = pki.rsa.generateKeyPair(2048);
const csrMin = pki.createCertificationRequest();
csrMin.publicKey = keysMin.publicKey;
csrMin.setSubject([
  { name: 'commonName', value: 'minimal-device.local' },
]);
csrMin.sign(keysMin.privateKey, forge.md.sha256.create());
const pemMin = pki.certificationRequestToPem(csrMin);
fs.writeFileSync(path.join(testCertsDir, 'test-minimal.csr'), pemMin, 'utf8');

// ─── 9. Code Signing CSR (test-code-signing.csr) ─────────────────────────────
console.log('Generating 9: test-code-signing.csr (Code Signing & Time Stamping)...');
const keysCode = pki.rsa.generateKeyPair(2048);
const csrCode = pki.createCertificationRequest();
csrCode.publicKey = keysCode.publicKey;
csrCode.setSubject([
  { name: 'commonName', value: 'Acme Software Release Signing' },
  { name: 'organizationName', value: 'Acme Corporation' },
  { shortName: 'OU', value: 'Release Engineering' },
  { name: 'countryName', value: 'US' },
]);
csrCode.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'keyUsage',
        digitalSignature: true,
      },
      {
        name: 'extKeyUsage',
        codeSigning: true,
        timeStamping: true,
      },
    ],
  },
]);
csrCode.sign(keysCode.privateKey, forge.md.sha256.create());
const pemCode = pki.certificationRequestToPem(csrCode);
fs.writeFileSync(path.join(testCertsDir, 'test-code-signing.csr'), pemCode, 'utf8');

// ─── 10. Client Auth / mTLS CSR (test-client-auth.csr) ───────────────────────
console.log('Generating 10: test-client-auth.csr (Client Auth, Email Protection, Serial)...');
const keysClient = pki.rsa.generateKeyPair(2048);
const csrClient = pki.createCertificationRequest();
csrClient.publicKey = keysClient.publicKey;
csrClient.setSubject([
  { name: 'commonName', value: 'jane.doe@securecorp.com' },
  { name: 'organizationName', value: 'SecureCorp' },
  { shortName: 'OU', value: 'Identity Management' },
  { name: 'countryName', value: 'US' },
  { name: 'serialNumber', value: 'EMP-84920' },
]);
csrClient.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
        emailProtection: true,
      },
    ],
  },
]);
csrClient.sign(keysClient.privateKey, forge.md.sha256.create());
const pemClient = pki.certificationRequestToPem(csrClient);
fs.writeFileSync(path.join(testCertsDir, 'test-client-auth.csr'), pemClient, 'utf8');

// ─── 11. Malformed / Corrupted CSR (test-corrupt.csr) ────────────────────────
console.log('Generating 11: test-corrupt.csr (Malformed file)...');
const corruptContent = `-----BEGIN CERTIFICATE REQUEST-----
MIICbzCCAVcCAQAwKjEUMBIGA1UEAxMLZXhhbXBsZS5jb20xEjAQBgNVBAoTCUFj
bWUgQ29ycDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALupgyAYJAWv
*** CORRUPTED DATA TRUNCATED AND INVALID BASE64 ***
-----END CERTIFICATE REQUEST-----`;
fs.writeFileSync(path.join(testCertsDir, 'test-corrupt.csr'), corruptContent, 'utf8');

console.log('Done! All CSR test files generated successfully.');
