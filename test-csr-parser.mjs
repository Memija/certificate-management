import fs from 'fs';
import path from 'path';
import { parseCSRFromText } from './src/utils/csrParser.ts';
import forge from 'node-forge';

const testCertsDir = path.resolve('test-certs');

console.log('────────────────────────────────────────────────────────');
console.log('CSR Inspector Test Suite Verification');
console.log('────────────────────────────────────────────────────────\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

// 1. test.csr (Standard RSA 2048)
console.log('[1/11] Testing test.csr (Standard RSA 2048)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.publicKeyAlgorithm === 'RSA', 'Algorithm is RSA');
  assert(res.publicKeySize === 2048, 'Public key size is 2048');
  assert(res.subject.includes('CN=example.com'), 'Subject contains CN=example.com');
  assert(res.subject.includes('O=Acme Corporation'), 'Subject contains O=Acme Corporation');
  assert(res.requestedExtensions.length === 3, `Has 3 requested extensions (found: ${res.requestedExtensions.length})`);
  const san = res.requestedExtensions.find(e => e.name === 'subjectAltName');
  assert(san && san.value.includes('DNS: example.com') && san.value.includes('IP: 192.168.1.50'), 'SAN includes DNS and IP');
  assert(res.requestedPurposes.includes('Server Authentication'), 'Purposes include Server Authentication');
} catch (e) {
  console.error('Error testing test.csr:', e);
  failed++;
}

// 2. test-rsa4096.csr (RSA 4096 with SHA-384)
console.log('\n[2/11] Testing test-rsa4096.csr (RSA 4096, SHA-384)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-rsa4096.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.publicKeySize === 4096, 'Public key size is 4096 bits');
  assert(res.signatureAlgorithm.includes('sha384') || res.signatureOid.includes('sha384') || res.signatureOid === '1.2.840.113549.1.1.12', 'Signature algorithm is SHA-384 with RSA');
  assert(res.subject.includes('CN=secure-vault.internal'), 'Subject matches secure-vault.internal');
} catch (e) {
  console.error('Error testing test-rsa4096.csr:', e);
  failed++;
}

// 3. test-rsa1024-legacy.csr (RSA 1024 with SHA-1, No extensions)
console.log('\n[3/11] Testing test-rsa1024-legacy.csr (RSA 1024, SHA-1, No extensions)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-rsa1024-legacy.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.publicKeySize === 1024, 'Public key size is 1024 bits');
  assert(res.signatureAlgorithm.includes('sha1') || res.signatureOid === '1.2.840.113549.1.1.5', 'Signature algorithm is SHA-1 with RSA');
  assert(res.requestedExtensions.length === 0, 'No requested extensions');
  assert(res.requestedPurposes.includes('Not specified'), 'Purposes fallback to Not specified');
} catch (e) {
  console.error('Error testing test-rsa1024-legacy.csr:', e);
  failed++;
}

// 4. test-san-multidomain.csr (Wildcard DNS, IP, Email, URI)
console.log('\n[4/11] Testing test-san-multidomain.csr (Wildcard, Multi-Type SAN)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-san-multidomain.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.subject.includes('CN=*.cloudservices.org'), 'Subject contains wildcard CN');
  const san = res.requestedExtensions.find(e => e.name === 'subjectAltName');
  assert(san && san.value.includes('DNS: *.cloudservices.org'), 'SAN includes wildcard DNS');
  assert(san && san.value.includes('IP: 10.200.1.1'), 'SAN includes IP');
  assert(san && san.value.includes('Email: security@cloudservices.org'), 'SAN includes Email');
  assert(san && san.value.includes('URI: https://cloudservices.org/api/v1'), 'SAN includes URI');
  assert(res.requestedPurposes.includes('Code Signing'), 'Purposes include Code Signing');
} catch (e) {
  console.error('Error testing test-san-multidomain.csr:', e);
  failed++;
}

// 5. Binary DER encoded CSR (test-der.csr / test-csr.der)
console.log('\n[5/11] Testing test-der.csr (Binary ASN.1 DER)...');
try {
  const derBuf = fs.readFileSync(path.join(testCertsDir, 'test-der.csr'));
  const derStr = forge.util.createBuffer(derBuf).getBytes();
  const asn1 = forge.asn1.fromDer(derStr);
  const csr = forge.pki.certificationRequestFromAsn1(asn1);
  assert(csr.verify() === true, 'DER CSR self-signature verifies');
  assert(csr.subject.getField('CN').value === 'binary-der-service.local', 'CN is binary-der-service.local');
  assert(csr.publicKey.n.bitLength() === 2048, 'Public key is RSA 2048');
} catch (e) {
  console.error('Error testing test-der.csr:', e);
  failed++;
}

// 6. test-new-header.csr / .req (NEW CERTIFICATE REQUEST header)
console.log('\n[6/11] Testing test-new-header.csr (BEGIN NEW CERTIFICATE REQUEST)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-new-header.csr'), 'utf8');
  assert(pem.includes('BEGIN NEW CERTIFICATE REQUEST'), 'Contains legacy header format');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid after normalization');
  assert(res.subject.includes('CN=iis-server01.corp.internal'), 'Subject CN is iis-server01.corp.internal');
} catch (e) {
  console.error('Error testing test-new-header.csr:', e);
  failed++;
}

// 7. test-invalid-signature.csr (Mismatched private key)
console.log('\n[7/11] Testing test-invalid-signature.csr (Tampered / Invalid signature)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-invalid-signature.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === false, 'Cryptographic self-signature is INVALID (badge displays Self-Signature Invalid)');
  assert(res.subject.includes('CN=untrusted-signature.example.com'), 'Subject correctly parsed despite invalid signature');
} catch (e) {
  console.error('Error testing test-invalid-signature.csr:', e);
  failed++;
}

// 8. test-minimal.csr (Common Name only)
console.log('\n[8/11] Testing test-minimal.csr (Minimal CN only)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-minimal.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.subjectFields.length === 1 && res.subjectFields[0].value === 'minimal-device.local', 'Only single CN attribute in subject');
  assert(res.requestedExtensions.length === 0, 'No requested extensions');
} catch (e) {
  console.error('Error testing test-minimal.csr:', e);
  failed++;
}

// 9. test-code-signing.csr (Code Signing & Time Stamping)
console.log('\n[9/11] Testing test-code-signing.csr (Code Signing & Time Stamping)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-code-signing.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  assert(res.requestedPurposes.includes('Code Signing'), 'Requested purposes include Code Signing');
  assert(res.requestedPurposes.includes('Time Stamping'), 'Requested purposes include Time Stamping');
} catch (e) {
  console.error('Error testing test-code-signing.csr:', e);
  failed++;
}

// 10. test-client-auth.csr (Client Auth & serialNumber)
console.log('\n[10/11] Testing test-client-auth.csr (Client Auth & serialNumber)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-client-auth.csr'), 'utf8');
  const res = parseCSRFromText(pem);
  assert(res.signatureValid === true, 'Self-signature is valid');
  const serial = res.subjectFields.find(f => f.name.toLowerCase().includes('serial') || f.shortName === 'serialNumber');
  assert(serial && serial.value === 'EMP-84920', 'Subject serialNumber EMP-84920 extracted');
  assert(res.requestedPurposes.includes('Client Authentication'), 'Requested purposes include Client Authentication');
  assert(res.requestedPurposes.includes('Email Protection'), 'Requested purposes include Email Protection');
} catch (e) {
  console.error('Error testing test-client-auth.csr:', e);
  failed++;
}

// 11. test-corrupt.csr (Malformed file handling)
console.log('\n[11/11] Testing test-corrupt.csr (Error handling)...');
try {
  const pem = fs.readFileSync(path.join(testCertsDir, 'test-corrupt.csr'), 'utf8');
  let threw = false;
  try {
    parseCSRFromText(pem);
  } catch (err) {
    threw = true;
    assert(err.message.includes('Failed to parse PEM CSR'), 'Proper error thrown: ' + err.message);
  }
  assert(threw === true, 'Corrupt file threw parse error as expected (displays ErrorCard in UI)');
} catch (e) {
  console.error('Error testing test-corrupt.csr:', e);
  failed++;
}

console.log('\n────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('────────────────────────────────────────────────────────');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All CSR Inspector test files verified successfully!');
}
