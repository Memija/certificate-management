import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const pki = forge.pki;
const testCertsDir = path.resolve('test-certs');

if (!fs.existsSync(testCertsDir)) {
  fs.mkdirSync(testCertsDir, { recursive: true });
}

console.log('Generating Key Pair Matcher test suite in:', testCertsDir);

// ─── Helper to compute SHA-256 fingerprint of modulus hex string ────────────
function getModulusSha256(modulusHex) {
  const md = forge.md.sha256.create();
  // Forge md expects byte string, convert hex to bytes
  md.update(forge.util.hexToBytes(modulusHex));
  return md.digest().toHex();
}

// ─── Pair A (Standard RSA 2048) ─────────────────────────────────────────────
console.log('Generating Pair A (Standard RSA 2048)...');
const keysA = pki.rsa.generateKeyPair(2048);

// Certificate A
const certA = pki.createCertificate();
certA.publicKey = keysA.publicKey;
certA.serialNumber = '01a4b5c6d7e8f9';
certA.validity.notBefore = new Date();
certA.validity.notAfter = new Date();
certA.validity.notAfter.setFullYear(certA.validity.notBefore.getFullYear() + 2);
certA.setSubject([
  { name: 'commonName', value: 'matcher.example.com' },
  { name: 'organizationName', value: 'Key Matcher Corp' },
  { shortName: 'OU', value: 'Security Engineering' },
  { name: 'localityName', value: 'Austin' },
  { shortName: 'ST', value: 'Texas' },
  { name: 'countryName', value: 'US' },
]);
certA.setIssuer([
  { name: 'commonName', value: 'Key Matcher Root CA' },
  { name: 'organizationName', value: 'Key Matcher Corp' },
  { name: 'countryName', value: 'US' },
]);
certA.setExtensions([
  {
    name: 'basicConstraints',
    cA: false,
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
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'matcher.example.com' },
      { type: 2, value: 'www.matcher.example.com' },
    ],
  },
]);
certA.sign(keysA.privateKey, forge.md.sha256.create());

// CSR A
const csrA = pki.createCertificationRequest();
csrA.publicKey = keysA.publicKey;
csrA.setSubject([
  { name: 'commonName', value: 'matcher.example.com' },
  { name: 'organizationName', value: 'Key Matcher Corp' },
  { shortName: 'OU', value: 'Security Engineering' },
  { name: 'countryName', value: 'US' },
]);
csrA.setAttributes([
  {
    name: 'extensionRequest',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: 'matcher.example.com' }],
      },
    ],
  },
]);
csrA.sign(keysA.privateKey, forge.md.sha256.create());

const certAPem = pki.certificateToPem(certA);
const csrAPem = pki.certificationRequestToPem(csrA);
const keyAPem = pki.privateKeyToPem(keysA.privateKey);
// Convert to PKCS#8
const rsaPrivateKeyAsn1 = pki.privateKeyToAsn1(keysA.privateKey);
const pkcs8Asn1 = pki.wrapRsaPrivateKey(rsaPrivateKeyAsn1);
const pkcs8KeyAPem = pki.privateKeyInfoToPem(pkcs8Asn1);

fs.writeFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), certAPem, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'matcher-valid-csr.pem'), csrAPem, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'matcher-valid-key.pem'), keyAPem, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'matcher-pkcs8-key.pem'), pkcs8KeyAPem, 'utf8');

const modulusAHex = keysA.publicKey.n.toString(16);
const hashA = getModulusSha256(modulusAHex);
console.log('Pair A Modulus SHA-256:', hashA);

// ─── Pair B (Mismatch RSA 2048) ─────────────────────────────────────────────
console.log('Generating Pair B (Mismatch RSA 2048)...');
const keysB = pki.rsa.generateKeyPair(2048);

const certB = pki.createCertificate();
certB.publicKey = keysB.publicKey;
certB.serialNumber = '02b5c6d7e8f9a0';
certB.validity.notBefore = new Date();
certB.validity.notAfter = new Date();
certB.validity.notAfter.setFullYear(certB.validity.notBefore.getFullYear() + 1);
certB.setSubject([
  { name: 'commonName', value: 'different-domain.org' },
  { name: 'organizationName', value: 'Another Org Ltd' },
  { name: 'countryName', value: 'GB' },
]);
certB.setIssuer([
  { name: 'commonName', value: 'Different CA' },
]);
certB.sign(keysB.privateKey, forge.md.sha256.create());

const certBPem = pki.certificateToPem(certB);
const keyBPem = pki.privateKeyToPem(keysB.privateKey);

fs.writeFileSync(path.join(testCertsDir, 'matcher-mismatch-cert.pem'), certBPem, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'matcher-mismatch-key.pem'), keyBPem, 'utf8');

const modulusBHex = keysB.publicKey.n.toString(16);
const hashB = getModulusSha256(modulusBHex);
console.log('Pair B Modulus SHA-256:', hashB);

// ─── Pair C (High Security RSA 4096) ─────────────────────────────────────────
console.log('Generating Pair C (RSA 4096)...');
const keysC = pki.rsa.generateKeyPair(4096);

const certC = pki.createCertificate();
certC.publicKey = keysC.publicKey;
certC.serialNumber = '03c7d8e9f0a1b2';
certC.validity.notBefore = new Date();
certC.validity.notAfter = new Date();
certC.validity.notAfter.setFullYear(certC.validity.notBefore.getFullYear() + 3);
certC.setSubject([
  { name: 'commonName', value: 'vault.internal.sec' },
  { name: 'organizationName', value: 'High Assurance Vault' },
  { name: 'countryName', value: 'CH' },
]);
certC.setIssuer([
  { name: 'commonName', value: 'Swiss High Assurance CA' },
]);
certC.sign(keysC.privateKey, forge.md.sha384.create());

const certCPem = pki.certificateToPem(certC);
const keyCPem = pki.privateKeyToPem(keysC.privateKey);

fs.writeFileSync(path.join(testCertsDir, 'matcher-rsa4096-cert.pem'), certCPem, 'utf8');
fs.writeFileSync(path.join(testCertsDir, 'matcher-rsa4096-key.pem'), keyCPem, 'utf8');

const modulusCHex = keysC.publicKey.n.toString(16);
const hashC = getModulusSha256(modulusCHex);
console.log('Pair C Modulus SHA-256:', hashC);

// ─── Export JSON test samples for easy import/UI inclusion ──────────────────
const sampleData = {
  pairA: {
    name: 'Standard RSA 2048 (Matching)',
    modulusBitLength: 2048,
    modulusSha256: hashA,
    certificatePem: certAPem,
    csrPem: csrAPem,
    privateKeyPem: keyAPem,
    pkcs8PrivateKeyPem: pkcs8KeyAPem,
  },
  pairB: {
    name: 'Different RSA 2048 (Mismatch against Pair A)',
    modulusBitLength: 2048,
    modulusSha256: hashB,
    certificatePem: certBPem,
    privateKeyPem: keyBPem,
  },
  pairC: {
    name: 'High-Security RSA 4096 (Matching)',
    modulusBitLength: 4096,
    modulusSha256: hashC,
    certificatePem: certCPem,
    privateKeyPem: keyCPem,
  },
};

fs.writeFileSync(
  path.join(testCertsDir, 'matcher-samples.json'),
  JSON.stringify(sampleData, null, 2),
  'utf8'
);

console.log('Key Pair Matcher test files generated successfully!');
