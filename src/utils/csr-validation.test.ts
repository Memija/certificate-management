import forge from 'node-forge'
import { describe, expect, it } from 'vitest'

import {
  isValidIpv4,
  isValidIpv6,
  validateCsr,
  validatePrivateKeyPem,
  validateSanItem,
} from './csr-validation'

describe('csr-validation', () => {
  it('validates IPv4 and IPv6 addresses strictly', () => {
    expect(isValidIpv4('192.168.1.1')).toBe(true)
    expect(isValidIpv4('256.1.1.1')).toBe(false)
    expect(isValidIpv4('192.168.1.01')).toBe(false)
    expect(isValidIpv4('192.168.1')).toBe(false)
    expect(isValidIpv6('::1')).toBe(true)
    expect(isValidIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
    expect(isValidIpv6('not-an-ipv6')).toBe(false)
  })

  it('validates DNS, wildcard, email, URI, and IP SAN items', () => {
    expect(validateSanItem('example.com').valid).toBe(true)
    expect(validateSanItem('*.example.com').valid).toBe(true)
    expect(validateSanItem('*.*.example.com').valid).toBe(false)
    expect(validateSanItem('sub.*.example.com').valid).toBe(false)
    expect(validateSanItem('*.com').valid).toBe(false)
    expect(validateSanItem('invalid domain with spaces.com').valid).toBe(false)
    expect(validateSanItem('admin@example.com').valid).toBe(true)
    expect(validateSanItem('https://example.com/oauth').valid).toBe(true)
    expect(validateSanItem('192.168.1.50').valid).toBe(true)
    expect(validateSanItem('999.168.1.50').valid).toBe(false)
  })

  it('validates CSR subject attributes (CN, SAN fallback, ISO country code, email)', () => {
    const emptyRes = validateCsr({ cn: '' }, { requireCn: true })
    expect(emptyRes.isValid).toBe(false)
    expect(emptyRes.errors.cn).toBeTruthy()

    const emptyBothRes = validateCsr({ cn: '' }, { sans: '' })
    expect(emptyBothRes.isValid).toBe(false)
    expect(emptyBothRes.errors.cn).toBeTruthy()

    const sanOnlyRes = validateCsr({ cn: '' }, { sans: 'example.com' })
    expect(sanOnlyRes.isValid).toBe(true)

    const badCountryRes = validateCsr({ cn: 'example.com', country: 'USA' })
    expect(badCountryRes.isValid).toBe(false)
    expect(badCountryRes.errors.country).toBeTruthy()

    const goodCountryRes = validateCsr({ cn: 'example.com', country: 'us' })
    expect(goodCountryRes.isValid).toBe(true)

    const badEmailRes = validateCsr({ cn: 'example.com', email: 'not-an-email' })
    expect(badEmailRes.isValid).toBe(false)
    expect(badEmailRes.errors.email).toBeTruthy()
  })

  it('rejects weak 1024-bit RSA keys and accepts 2048-bit RSA keys', () => {
    const keys1024 = forge.pki.rsa.generateKeyPair(1024)
    const pem1024 = forge.pki.privateKeyToPem(keys1024.privateKey)
    const key1024Res = validatePrivateKeyPem(pem1024)
    expect(key1024Res.valid).toBe(false)
    expect(key1024Res.bitLength).toBe(1024)

    const keys2048 = forge.pki.rsa.generateKeyPair(2048)
    const pem2048 = forge.pki.privateKeyToPem(keys2048.privateKey)
    const key2048Res = validatePrivateKeyPem(pem2048)
    expect(key2048Res.valid).toBe(true)
    expect(key2048Res.bitLength).toBe(2048)
  })

  it('generates advisory warnings when serverAuth is enabled without SANs', () => {
    const tlsNoSanRes = validateCsr({ cn: 'example.com' }, { serverAuthEnabled: true, sans: '' })
    expect(tlsNoSanRes.warnings.length).toBeGreaterThan(0)
  })

  it('rejects generic placeholder values when checkPlaceholders is enabled and allows real values', () => {
    const gradRes = validateCsr(
      { cn: 'valid-domain.com', locality: 'grad' },
      { checkPlaceholders: true },
    )
    expect(gradRes.isValid).toBe(false)
    expect(gradRes.errors.locality).toBeTruthy()

    const cityRes = validateCsr(
      { cn: 'valid-domain.com', locality: 'city' },
      { checkPlaceholders: true },
    )
    expect(cityRes.isValid).toBe(false)
    expect(cityRes.errors.locality).toBeTruthy()

    const orgRes = validateCsr(
      { cn: 'valid-domain.com', org: 'organization' },
      { checkPlaceholders: true },
    )
    expect(orgRes.isValid).toBe(false)
    expect(orgRes.errors.org).toBeTruthy()

    const validSubjectRes = validateCsr(
      { cn: 'valid-domain.com', locality: 'Sarajevo', org: 'Acme Corp', country: 'BA' },
      { checkPlaceholders: true },
    )
    expect(validSubjectRes.isValid).toBe(true)
  })
})
