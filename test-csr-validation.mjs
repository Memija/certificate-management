import { validateCsr, validateSanItem, validatePrivateKeyPem, isValidIpv4, isValidIpv6 } from './src/utils/csrValidation.ts';
import forge from 'node-forge';

console.log('────────────────────────────────────────────────────────');
console.log('CSR Validation Test Suite Verification');
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

// 1. IP validation
assert(isValidIpv4('192.168.1.1') === true, '192.168.1.1 is valid IPv4');
assert(isValidIpv4('256.1.1.1') === false, '256.1.1.1 is invalid IPv4 (octet > 255)');
assert(isValidIpv4('192.168.1.01') === false, '192.168.1.01 is invalid IPv4 (leading zero)');
assert(isValidIpv4('192.168.1') === false, '192.168.1 is invalid IPv4 (3 octets)');
assert(isValidIpv6('::1') === true, '::1 is valid IPv6');
assert(isValidIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334') === true, 'Full IPv6 is valid');

// 2. SAN validation
assert(validateSanItem('example.com').valid === true, 'example.com is valid DNS');
assert(validateSanItem('*.example.com').valid === true, '*.example.com is valid wildcard');
assert(validateSanItem('*.*.example.com').valid === false, '*.*.example.com is rejected (multiple wildcards)');
assert(validateSanItem('sub.*.example.com').valid === false, 'sub.*.example.com is rejected (wildcard not first)');
assert(validateSanItem('invalid domain with spaces.com').valid === false, 'Spaces rejected in SAN');
assert(validateSanItem('admin@example.com').valid === true, 'admin@example.com is valid email SAN');
assert(validateSanItem('https://example.com/oauth').valid === true, 'https:// URI is valid SAN');

// 3. Subject validation
const emptyRes = validateCsr({ cn: '' }, { requireCn: true });
assert(!emptyRes.isValid && !!emptyRes.errors.cn, 'Empty CN is rejected when requireCn=true');

const emptyBothRes = validateCsr({ cn: '' }, { sans: '' });
assert(!emptyBothRes.isValid && !!emptyBothRes.errors.cn, 'Empty CN and SAN rejected when requireCn=false');

const sanOnlyRes = validateCsr({ cn: '' }, { sans: 'example.com' });
assert(sanOnlyRes.isValid, 'Empty CN allowed if SAN is present');

const badCountryRes = validateCsr({ cn: 'example.com', country: 'USA' });
assert(!badCountryRes.isValid && !!badCountryRes.errors.country, '3-letter country code USA rejected');

const goodCountryRes = validateCsr({ cn: 'example.com', country: 'us' });
assert(goodCountryRes.isValid, '2-letter country code US allowed');

const badEmailRes = validateCsr({ cn: 'example.com', email: 'not-an-email' });
assert(!badEmailRes.isValid && !!badEmailRes.errors.email, 'Invalid email rejected');

// 4. Key validation
const keys1024 = forge.pki.rsa.generateKeyPair(1024);
const pem1024 = forge.pki.privateKeyToPem(keys1024.privateKey);
const key1024Res = validatePrivateKeyPem(pem1024);
assert(!key1024Res.valid && key1024Res.bitLength === 1024, '1024-bit RSA key rejected for insecurity');

const keys2048 = forge.pki.rsa.generateKeyPair(2048);
const pem2048 = forge.pki.privateKeyToPem(keys2048.privateKey);
const key2048Res = validatePrivateKeyPem(pem2048);
assert(key2048Res.valid && key2048Res.bitLength === 2048, '2048-bit RSA key accepted');

// 5. Advisory warning check
const tlsNoSanRes = validateCsr({ cn: 'example.com' }, { serverAuthEnabled: true, sans: '' });
assert(tlsNoSanRes.warnings.length > 0, 'Missing SAN warning generated when serverAuth is active');

// 6. Placeholder checks
const gradRes = validateCsr({ cn: 'valid-domain.com', locality: 'grad' }, { checkPlaceholders: true });
assert(!gradRes.isValid && !!gradRes.errors.locality, 'City placeholder "grad" is rejected when checkPlaceholders=true');

const cityRes = validateCsr({ cn: 'valid-domain.com', locality: 'city' }, { checkPlaceholders: true });
assert(!cityRes.isValid && !!cityRes.errors.locality, 'City placeholder "city" is rejected when checkPlaceholders=true');

const orgRes = validateCsr({ cn: 'valid-domain.com', org: 'organization' }, { checkPlaceholders: true });
assert(!orgRes.isValid && !!orgRes.errors.org, 'Organization placeholder "organization" is rejected when checkPlaceholders=true');

const validSubjectRes = validateCsr({ cn: 'valid-domain.com', locality: 'Sarajevo', org: 'Acme Corp', country: 'BA' }, { checkPlaceholders: true });
assert(validSubjectRes.isValid, 'Real subject details (Sarajevo, Acme Corp, BA) pass validation');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
