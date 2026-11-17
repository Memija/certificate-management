import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { KEY_MATCHER_PRESETS } from '@/data/key-matcher-samples'

import { extractCertOrCsrModulus, extractPrivateKeyModulus, matchKeyPair } from './key-matcher'

const testCertsDir = path.resolve(process.cwd(), 'test-certs')

describe('key-matcher', () => {
  it('[1/6] matches Pair A: X.509 Certificate + RSA 2048 Private Key', () => {
    const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8')
    const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-key.pem'), 'utf8')

    const certInfo = extractCertOrCsrModulus(certPem)
    const keyInfo = extractPrivateKeyModulus(keyPem)

    expect(certInfo.type).toBe('Certificate')
    expect(certInfo.bits).toBe(2048)
    expect(keyInfo.bits).toBe(2048)
    expect(certInfo.modulus).toBe(keyInfo.modulus)
    expect(certInfo.sha256).toBe(keyInfo.sha256)
    expect(matchKeyPair(certPem, keyPem).matched).toBe(true)
  })

  it('[2/6] matches Pair A: PKCS#10 CSR + RSA 2048 Private Key', () => {
    const csrPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-csr.pem'), 'utf8')
    const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-key.pem'), 'utf8')

    const csrInfo = extractCertOrCsrModulus(csrPem)
    const keyInfo = extractPrivateKeyModulus(keyPem)

    expect(csrInfo.type).toBe('CSR')
    expect(csrInfo.bits).toBe(2048)
    expect(csrInfo.modulus).toBe(keyInfo.modulus)
    expect(matchKeyPair(csrPem, keyPem).matched).toBe(true)
  })

  it('[3/6] matches Certificate + PKCS#8 Private Key (BEGIN PRIVATE KEY)', () => {
    const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8')
    const pkcs8KeyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-pkcs8-key.pem'), 'utf8')

    expect(pkcs8KeyPem).toContain('-----BEGIN PRIVATE KEY-----')
    const certInfo = extractCertOrCsrModulus(certPem)
    const keyInfo = extractPrivateKeyModulus(pkcs8KeyPem)

    expect(certInfo.modulus).toBe(keyInfo.modulus)
    expect(matchKeyPair(certPem, pkcs8KeyPem).matched).toBe(true)
  })

  it('[4/6] detects mismatch between Cert Pair A and Private Key Pair B', () => {
    const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-valid-cert.pem'), 'utf8')
    const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-mismatch-key.pem'), 'utf8')

    const certInfo = extractCertOrCsrModulus(certPem)
    const keyInfo = extractPrivateKeyModulus(keyPem)

    expect(certInfo.modulus).not.toBe(keyInfo.modulus)
    expect(matchKeyPair(certPem, keyPem).matched).toBe(false)
  })

  it('[5/6] matches High-Security RSA 4096 Certificate + Private Key', () => {
    const certPem = fs.readFileSync(path.join(testCertsDir, 'matcher-rsa4096-cert.pem'), 'utf8')
    const keyPem = fs.readFileSync(path.join(testCertsDir, 'matcher-rsa4096-key.pem'), 'utf8')

    const certInfo = extractCertOrCsrModulus(certPem)
    const keyInfo = extractPrivateKeyModulus(keyPem)

    expect(certInfo.bits).toBe(4096)
    expect(keyInfo.bits).toBe(4096)
    expect(certInfo.modulus).toBe(keyInfo.modulus)
    expect(matchKeyPair(certPem, keyPem).matched).toBe(true)
  })

  it('[6/6] throws errors on malformed/corrupt PEM inputs and validates all presets', () => {
    expect(() =>
      extractCertOrCsrModulus(
        ['-----BEGIN CERTIFICATE-----', 'INVALID_BASE64_DATA', '-----END CERTIFICATE-----'].join(
          '\n',
        ),
      ),
    ).toThrow()

    expect(() =>
      extractPrivateKeyModulus(
        [
          '-----BEGIN RSA PRIVATE KEY-----',
          'INVALID_KEY_DATA',
          '-----END RSA PRIVATE KEY-----',
        ].join('\n'),
      ),
    ).toThrow()

    for (const preset of KEY_MATCHER_PRESETS) {
      expect(matchKeyPair(preset.certOrCsr, preset.privateKey).matched).toBe(preset.expectedMatch)
    }
  })
})
