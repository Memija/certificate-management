import forge from 'node-forge'

import type { CsrTranslateFn, SimpleTranslateFn } from '@/types'

const IPV6_REGEX =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/

interface ForgeRsaPrivateKey {
  n?: { bitLength: () => number }
}

export function translateWithFallback(
  t: CsrTranslateFn | undefined,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  if (t) {
    const fn = t as SimpleTranslateFn
    return fn(key, { defaultValue: fallback, ...params })
  }
  let msg = fallback
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
    }
  }
  return msg
}

/**
 * Validate an IPv4 address string (e.g. 192.168.1.1)
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) {
    return false
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return false
    }
    const n = parseInt(part, 10)
    if (n < 0 || n > 255) {
      return false
    }
    if (part.length > 1 && part.startsWith('0')) {
      return false
    }
  }
  return true
}

/**
 * Validate an IPv6 address string
 */
export function isValidIpv6(ip: string): boolean {
  if (!ip.includes(':')) {
    return false
  }
  return IPV6_REGEX.test(ip.trim())
}

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function validateDnsSan(trimmed: string, t?: CsrTranslateFn): { valid: boolean; error?: string } {
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      error: translateWithFallback(
        t,
        'app.csr.validation.sanDnsSpaces',
        `DNS name cannot contain spaces: "${trimmed}".`,
        { san: trimmed },
      ),
    }
  }

  if (trimmed.length > 253) {
    return {
      valid: false,
      error: translateWithFallback(
        t,
        'app.csr.validation.sanDnsTooLong',
        `DNS name exceeds maximum length of 253 characters: "${trimmed}".`,
        { san: trimmed },
      ),
    }
  }

  if (trimmed.includes('*')) {
    if (!trimmed.startsWith('*.')) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanWildcardNotFirst',
          `Invalid wildcard in "${trimmed}". Wildcards must only appear as the first label (e.g. *.example.com).`,
          { san: trimmed },
        ),
      }
    }
    const afterWildcard = trimmed.substring(2)
    if (afterWildcard.includes('*')) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanMultipleWildcards',
          `Multiple wildcards are not permitted: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
    if (!afterWildcard.includes('.')) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanWildcardTld',
          `Wildcards directly on TLDs are not permitted: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
  }

  const labels = trimmed.split('.')
  for (const label of labels) {
    if (!label) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanConsecutiveDots',
          `DNS name contains empty label or consecutive dots: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
    if (label === '*') {
      continue
    }
    if (label.length > 63) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanLabelTooLong',
          `DNS label "${label}" exceeds maximum length of 63 characters.`,
          { label },
        ),
      }
    }
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanInvalidLabelChars',
          `Invalid DNS label "${label}". Labels must contain only letters, numbers, and hyphens (cannot start or end with a hyphen).`,
          { label },
        ),
      }
    }
  }

  return { valid: true }
}

/**
 * Validate individual SAN items
 */
export function validateSanItem(
  item: string,
  t?: CsrTranslateFn,
): { valid: boolean; error?: string } {
  const trimmed = item.trim()
  if (!trimmed) {
    return { valid: true }
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    if (!isValidIpv4(trimmed)) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanInvalidIpv4',
          `Invalid IPv4 address: "${trimmed}" (octets must be 0-255 with no leading zeros).`,
          { san: trimmed },
        ),
      }
    }
    return { valid: true }
  }

  if (
    trimmed.includes(':') &&
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('urn:')
  ) {
    if (!isValidIpv6(trimmed)) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanInvalidIpv6',
          `Invalid IPv6 address: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
    return { valid: true }
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('urn:')
  ) {
    try {
      new URL(trimmed)
      return { valid: true }
    } catch {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanInvalidUri',
          `Invalid URI: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
  }

  if (trimmed.includes('@') && !trimmed.includes('/')) {
    if (!isValidEmail(trimmed)) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.sanInvalidEmail',
          `Invalid email address in SAN: "${trimmed}".`,
          { san: trimmed },
        ),
      }
    }
    return { valid: true }
  }

  return validateDnsSan(trimmed, t)
}

/**
 * Validate an existing RSA private key PEM
 */
export function validatePrivateKeyPem(
  pem: string,
  t?: CsrTranslateFn,
): { valid: boolean; bitLength?: number; error?: string } {
  const trimmed = pem.trim()
  if (!trimmed) {
    return {
      valid: false,
      error: translateWithFallback(t, 'app.csr.validation.keyRequired', 'Private key is required.'),
    }
  }

  try {
    const privKey = forge.pki.privateKeyFromPem(trimmed) as unknown as ForgeRsaPrivateKey | null
    if (!privKey || !privKey.n) {
      return {
        valid: false,
        error: translateWithFallback(
          t,
          'app.csr.validation.keyNotRsa',
          'The provided key is not a recognized RSA private key.',
        ),
      }
    }
    const bitLength = privKey.n.bitLength()
    if (bitLength < 2048) {
      return {
        valid: false,
        bitLength,
        error: translateWithFallback(
          t,
          'app.csr.validation.keyTooSmall',
          `RSA key size (${bitLength} bits) is insecure. Modern PKI and Certificate Authorities require at least 2048 bits.`,
          { bits: bitLength },
        ),
      }
    }
    return { valid: true, bitLength }
  } catch (err: unknown) {
    const rawMsg =
      err instanceof Error && err.message
        ? err.message
        : 'Invalid private key PEM format or corrupted key data.'
    return {
      valid: false,
      error: translateWithFallback(t, 'app.csr.validation.keyInvalid', rawMsg),
    }
  }
}
