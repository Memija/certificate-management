import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

const testCertsDir = path.resolve('test-certs');

console.log('────────────────────────────────────────────────────────');
console.log('Key Pair Modulus Matcher - Automated Test Suite');
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

function extractCertOrCsrModulus(input) {
  if (input.includes('CERTIFICATE REQUEST')) {
    const csr = forge.pki.certificationRequestFromPem(input);
    if (csr.publicKey && csr.publicKey.n) {
      return {
        type: 'CSR',
        modulus: csr.publicKey.n.toString(16),
        bits: csr.publicKey.n.bitLength(),
      };
    }
    throw new Error('No RSA public key found in CSR.');
  } else {
    const cert = forge.pki.certificateFromPem(input);
    if (cert.publicKey && cert.publicKey.n) {
      return {
        type: 'Certificate',
        modulus: cert.publicKey.n.toString(16),
        bits: cert.publicKey.n.bitLength(),
      };
    }
    throw new Error('No RSA public key found in Certificate.');
  }
}

function extractPrivateKeyModulus(input) {
  const privateKey = forge.pki.privateKeyFromPem(input);
  if (privateKey && privateKey.n) {
    return {
      type: 'PrivateKey',
      modulus: privateKey.n.toString(16),
      bits: privateKey.n.bitLength(),
    };
  }
  throw new Error('Only RSA keys are currently supported for matching.');
}

// ─── Test 1: Standard Matching Pair A (Cert + Private Key) ──────────────────
console.log('[1/6] Testing Pair A: Certificate + Matching RSA 2048 Private Key...');
try {
  const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8');
  const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-key.pem'), 'utf8');

  const certInfo = extractCertOrCsrModulus(certPem);
  const keyInfo = extractPrivateKeyModulus(keyPem);

  assert(certInfo.type === 'Certificate', 'Parsed as Certificate');
  assert(certInfo.bits === 2048, 'Certificate key length is 2048 bits');
  assert(keyInfo.bits === 2048, 'Private key length is 2048 bits');
  assert(certInfo.modulus === keyInfo.modulus, 'Modulus match: SUCCESS');
} catch (e) {
  assert(false, `Error in Test 1: ${e.message}`);
}

// ─── Test 2: Standard Matching Pair A (CSR + Private Key) ───────────────────
console.log('\n[2/6] Testing Pair A: CSR + Matching RSA 2048 Private Key...');
try {
  const csrPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-csr.pem'), 'utf8');
  const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-key.pem'), 'utf8');

  const csrInfo = extractCertOrCsrModulus(csrPem);
  const keyInfo = extractPrivateKeyModulus(keyPem);

  assert(csrInfo.type === 'CSR', 'Parsed as CSR');
  assert(csrInfo.bits === 2048, 'CSR key length is 2048 bits');
  assert(csrInfo.modulus === keyInfo.modulus, 'CSR Modulus match: SUCCESS');
} catch (e) {
  assert(false, `Error in Test 2: ${e.message}`);
}

// ─── Test 3: PKCS#8 Private Key Matching (Cert + PKCS#8 Private Key) ─────────
console.log('\n[3/6] Testing PKCS#8 format: Certificate + PKCS#8 Key (BEGIN PRIVATE KEY)...');
try {
  const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8');
  const pkcs8KeyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-pkcs8-key.pem'), 'utf8');

  assert(pkcs8KeyPem.includes('-----BEGIN PRIVATE KEY-----'), 'Key is PKCS#8 format');
  const certInfo = extractCertOrCsrModulus(certPem);
  const keyInfo = extractPrivateKeyModulus(pkcs8KeyPem);

  assert(certInfo.modulus === keyInfo.modulus, 'PKCS#8 Modulus match: SUCCESS');
} catch (e) {
  assert(false, `Error in Test 3: ${e.message}`);
}

// ─── Test 4: Mismatch Case (Cert A + Private Key B) ─────────────────────────
console.log('\n[4/6] Testing Mismatch: Cert Pair A + Private Key Pair B...');
try {
  const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8');
  const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-mismatch-key.pem'), 'utf8');

  const certInfo = extractCertOrCsrModulus(certPem);
  const keyInfo = extractPrivateKeyModulus(keyPem);

  assert(certInfo.modulus !== keyInfo.modulus, 'Moduli differ as expected: MISMATCH CONFIRMED');
} catch (e) {
  assert(false, `Error in Test 4: ${e.message}`);
}

// ─── Test 5: High-Security RSA 4096 Matching Pair ───────────────────────────
console.log('\n[5/6] Testing High-Security Pair C: RSA 4096 Cert + Private Key...');
try {
  const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-rsa4096-cert.pem'), 'utf8');
  const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-rsa4096-key.pem'), 'utf8');

  const certInfo = extractCertOrCsrModulus(certPem);
  const keyInfo = extractPrivateKeyModulus(keyPem);

  assert(certInfo.bits === 4096, 'Certificate key size is 4096 bits');
  assert(keyInfo.bits === 4096, 'Private key size is 4096 bits');
  assert(certInfo.modulus === keyInfo.modulus, 'RSA 4096 Modulus match: SUCCESS');
} catch (e) {
  assert(false, `Error in Test 5: ${e.message}`);
}

// ─── Test 6: Error Handling (Corrupt PEM) ───────────────────────────────────
console.log('\n[6/6] Testing Error Handling: Malformed PEM inputs...');
try {
  let certThrew = false;
  try {
    extractCertOrCsrModulus('-----BEGIN CERTIFICATE-----\nINVALID_BASE64_DATA\n-----END CERTIFICATE-----');
  } catch (e) {
    certThrew = true;
  }
  assert(certThrew, 'Corrupted certificate PEM correctly throws error');

  let keyThrew = false;
  try {
    extractPrivateKeyModulus('-----BEGIN RSA PRIVATE KEY-----\nINVALID_KEY_DATA\n-----END RSA PRIVATE KEY-----');
  } catch (e) {
    keyThrew = true;
  }
  assert(keyThrew, 'Corrupted private key PEM correctly throws error');
} catch (e) {
  assert(false, `Error in Test 6: ${e.message}`);
}

console.log('\n────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log('────────────────────────────────────────────────────────');

if (failed > 0) {
  process.exit(1);
}
