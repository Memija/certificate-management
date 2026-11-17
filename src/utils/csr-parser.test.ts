import fs from 'node:fs'
import path from 'node:path'
import forge from 'node-forge'
import { describe, expect, it } from 'vitest'

import { parseCSRFile, parseCSRFromBytes, parseCSRFromText, SAMPLE_CSR_PEM } from './csr-parser'

const testCertsDir = path.resolve(process.cwd(), 'test-certs')

interface ForgeRsaPublicKey {
  n: { bitLength: () => number }
}

describe('csr-parser', () => {
  it('[1/11] parses test.csr (Standard RSA 2048) with SANs and EKU', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.publicKeyAlgorithm).toBe('RSA')
    expect(res.publicKeySize).toBe(2048)
    expect(res.subject).toContain('CN=example.com')
    expect(res.subject).toContain('O=Acme Corporation')
    expect(res.requestedExtensions).toHaveLength(3)

    const san = res.requestedExtensions.find((e) => e.name === 'subjectAltName')
    expect(san).toBeDefined()
    expect(san?.value).toContain('DNS: example.com')
    expect(san?.value).toContain('IP: 192.168.1.50')
    expect(res.requestedPurposes).toContain('Server Authentication')
  })

  it('[2/11] parses test-rsa4096.csr (RSA 4096, SHA-384)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-rsa4096.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.publicKeySize).toBe(4096)
    expect(
      res.signatureAlgorithm.includes('sha384') ||
        res.signatureOid.includes('sha384') ||
        res.signatureOid === '1.2.840.113549.1.1.12',
    ).toBe(true)
    expect(res.subject).toContain('CN=secure-vault.internal')
  })

  it('[3/11] parses test-rsa1024-legacy.csr (RSA 1024, SHA-1, no extensions)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-rsa1024-legacy.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.publicKeySize).toBe(1024)
    expect(
      res.signatureAlgorithm.includes('sha1') || res.signatureOid === '1.2.840.113549.1.1.5',
    ).toBe(true)
    expect(res.requestedExtensions).toHaveLength(0)
    expect(res.requestedPurposes).toContain('Not specified')
  })

  it('[4/11] parses test-san-multidomain.csr (Wildcard DNS, IP, Email, URI)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-san-multidomain.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.subject).toContain('CN=*.cloudservices.org')

    const san = res.requestedExtensions.find((e) => e.name === 'subjectAltName')
    expect(san?.value).toContain('DNS: *.cloudservices.org')
    expect(san?.value).toContain('IP: 10.200.1.1')
    expect(san?.value).toContain('Email: security@cloudservices.org')
    expect(san?.value).toContain('URI: https://cloudservices.org/api/v1')
    expect(res.requestedPurposes).toContain('Code Signing')
  })

  it('[5/11] parses test-der.csr (Binary ASN.1 DER) via bytes and File', async () => {
    const derBuf = fs.readFileSync(path.join(testCertsDir, 'test-der.csr'))
    const uint8 = new Uint8Array(derBuf)

    const derStr = forge.util.binary.raw.encode(uint8)
    const asn1 = forge.asn1.fromDer(derStr)
    const forgeCsr = forge.pki.certificationRequestFromAsn1(asn1)
    expect(forgeCsr.verify()).toBe(true)
    expect(forgeCsr.subject.getField('CN').value).toBe('binary-der-service.local')
    expect((forgeCsr.publicKey as unknown as ForgeRsaPublicKey).n.bitLength()).toBe(2048)

    const parsedBytes = parseCSRFromBytes(uint8)
    expect(parsedBytes.signatureValid).toBe(true)
    expect(parsedBytes.subject).toContain('CN=binary-der-service.local')
    expect(parsedBytes.publicKeySize).toBe(2048)

    const file = new File([uint8], 'test-der.csr', { type: 'application/pkcs10' })
    const parsedFile = await parseCSRFile(file)
    expect(parsedFile.signatureValid).toBe(true)
    expect(parsedFile.subject).toContain('CN=binary-der-service.local')
  })

  it('[6/11] normalizes and parses test-new-header.csr (BEGIN NEW CERTIFICATE REQUEST)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-new-header.csr'), 'utf8')
    expect(pem).toContain('BEGIN NEW CERTIFICATE REQUEST')

    const res = parseCSRFromText(pem)
    expect(res.signatureValid).toBe(true)
    expect(res.subject).toContain('CN=iis-server01.corp.internal')
  })

  it('[7/11] detects invalid cryptographic self-signature on test-invalid-signature.csr', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-invalid-signature.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(false)
    expect(res.subject).toContain('CN=untrusted-signature.example.com')
  })

  it('[8/11] parses test-minimal.csr (Common Name only)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-minimal.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.subjectFields).toHaveLength(1)
    expect(res.subjectFields[0].value).toBe('minimal-device.local')
    expect(res.requestedExtensions).toHaveLength(0)
  })

  it('[9/11] parses test-code-signing.csr (Code Signing & Time Stamping)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-code-signing.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    expect(res.requestedPurposes).toContain('Code Signing')
    expect(res.requestedPurposes).toContain('Time Stamping')
  })

  it('[10/11] parses test-client-auth.csr (Client Auth & serialNumber)', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-client-auth.csr'), 'utf8')
    const res = parseCSRFromText(pem)

    expect(res.signatureValid).toBe(true)
    const serial = res.subjectFields.find(
      (f) => f.name.toLowerCase().includes('serial') || f.shortName === 'serialNumber',
    )
    expect(serial?.value).toBe('EMP-84920')
    expect(res.requestedPurposes).toContain('Client Authentication')
    expect(res.requestedPurposes).toContain('Email Protection')
  })

  it('[11/11] throws descriptive format error for test-corrupt.csr and wrong PEM types', () => {
    const pem = fs.readFileSync(path.join(testCertsDir, 'test-corrupt.csr'), 'utf8')
    expect(() => parseCSRFromText(pem)).toThrow(/Failed to parse PEM CSR/)

    const sampleRes = parseCSRFromText(SAMPLE_CSR_PEM)
    expect(sampleRes.signatureValid).toBe(true)

    expect(() =>
      parseCSRFromText('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'),
    ).toThrow('ERR_CERT_NOT_CSR')
    expect(() =>
      parseCSRFromText('-----BEGIN X509 CRL-----\nAAAA\n-----END X509 CRL-----'),
    ).toThrow('ERR_CRL_NOT_CSR')
  })
})
