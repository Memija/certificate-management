import forge from 'node-forge'

import type { KeyMatchResult, PrivateKeyModulusInfo, PublicKeyModulusInfo } from '@/types'

export type { KeyMatchResult, PrivateKeyModulusInfo, PublicKeyModulusInfo }

interface ForgeRsaModulusKey {
  n?: {
    toString: (radix?: number) => string
    bitLength: () => number
  }
}

/**
 * Computes the SHA-256 hex digest of an RSA modulus hex string.
 */
export function computeModulusSha256(modulusHex: string): string {
  try {
    const paddedHex = modulusHex.length % 2 === 1 ? `0${modulusHex}` : modulusHex
    const md = forge.md.sha256.create()
    md.update(forge.util.hexToBytes(paddedHex))
    return md.digest().toHex()
  } catch {
    return ''
  }
}

/**
 * Extracts the RSA modulus and bit length from a PEM-encoded X.509 Certificate or PKCS#10 CSR.
 */
export function extractCertOrCsrModulus(input: string): PublicKeyModulusInfo {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Certificate or CSR input is empty.')
  }

  if (trimmed.includes('CERTIFICATE REQUEST')) {
    const normalizedPem = trimmed.replace(/NEW CERTIFICATE REQUEST/g, 'CERTIFICATE REQUEST')
    const csr = forge.pki.certificationRequestFromPem(normalizedPem)
    const pubKey = csr.publicKey as ForgeRsaModulusKey | null
    if (pubKey?.n) {
      const modulus = pubKey.n.toString(16)
      return {
        type: 'CSR',
        modulus,
        modulusHex: modulus,
        bits: pubKey.n.bitLength(),
        sha256: computeModulusSha256(modulus),
      }
    }
    throw new Error('No RSA public key found in CSR.')
  }

  const cert = forge.pki.certificateFromPem(trimmed)
  const pubKey = cert.publicKey as ForgeRsaModulusKey | null
  if (pubKey?.n) {
    const modulus = pubKey.n.toString(16)
    return {
      type: 'Certificate',
      modulus,
      modulusHex: modulus,
      bits: pubKey.n.bitLength(),
      sha256: computeModulusSha256(modulus),
    }
  }
  throw new Error('No RSA public key found in Certificate.')
}

/**
 * Extracts the RSA modulus and bit length from a PEM-encoded PKCS#1 or PKCS#8 Private Key.
 */
export function extractPrivateKeyModulus(input: string): PrivateKeyModulusInfo {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Private key input is empty.')
  }

  const privateKey = forge.pki.privateKeyFromPem(trimmed) as unknown as ForgeRsaModulusKey | null
  if (privateKey?.n) {
    const modulus = privateKey.n.toString(16)
    return {
      type: 'PrivateKey',
      modulus,
      modulusHex: modulus,
      bits: privateKey.n.bitLength(),
      sha256: computeModulusSha256(modulus),
    }
  }
  throw new Error('Only RSA keys are currently supported for matching.')
}

/**
 * Compares the RSA modulus of an X.509 Certificate or CSR against a Private Key.
 */
export function matchKeyPair(publicInput: string, privateKeyInput: string): KeyMatchResult {
  const publicInfo = extractCertOrCsrModulus(publicInput)
  const privateInfo = extractPrivateKeyModulus(privateKeyInput)

  return {
    matched: publicInfo.modulus === privateInfo.modulus,
    publicInfo,
    privateInfo,
  }
}
