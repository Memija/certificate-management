import forge from 'node-forge'

import type { TrustStoreEntry } from '@/types'

import { parseX509FromDer, uint8ToBinaryString } from './x509-parser'

export const JKS_MAGIC = 0xfeedfeed

interface JksPrivateKeyChainResult {
  nextOffset: number
  firstCertBytes: Uint8Array | null
}

function readJksCertChain(
  bytes: Uint8Array,
  view: DataView,
  startOffset: number,
  chainCount: number,
): JksPrivateKeyChainResult {
  let offset = startOffset
  let firstCertBytes: Uint8Array | null = null

  for (let c = 0; c < chainCount; c++) {
    if (offset + 2 > bytes.length) {
      break
    }
    const typeLen = view.getUint16(offset, false)
    offset += 2 + typeLen
    if (offset + 4 > bytes.length) {
      break
    }
    const certLen = view.getUint32(offset, false)
    offset += 4
    const certBytes = bytes.slice(offset, offset + certLen)
    offset += certLen

    if (c === 0) {
      firstCertBytes = certBytes
    }
  }

  return { nextOffset: offset, firstCertBytes }
}

/**
 * Parses a Sun/Oracle Java KeyStore (JKS) binary buffer.
 */
export function parseJks(bytes: Uint8Array): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: TrustStoreEntry[] = []

  if (bytes.byteLength < 12) {
    return { entries: [], warnings: ['Not a valid JKS file (file too short).'] }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  const magic = view.getUint32(offset, false)
  offset += 4
  if (magic !== JKS_MAGIC) {
    return { entries: [], warnings: ['Not a valid JKS file (bad magic number).'] }
  }

  const version = view.getUint32(offset, false)
  offset += 4
  if (version !== 1 && version !== 2) {
    warnings.push(`Unexpected JKS version ${version}. Attempting to parse anyway.`)
  }

  const count = view.getUint32(offset, false)
  offset += 4

  for (let i = 0; i < count; i++) {
    if (offset + 6 > bytes.length) {
      break
    }
    const tag = view.getUint32(offset, false)
    offset += 4

    const aliasLen = view.getUint16(offset, false)
    offset += 2
    const aliasBytes = bytes.slice(offset, offset + aliasLen)
    const alias = new TextDecoder('utf-8').decode(aliasBytes)
    offset += aliasLen + 8 // skip 8-byte timestamp

    if (tag === 1) {
      if (offset + 4 > bytes.length) {
        break
      }
      const keyLen = view.getUint32(offset, false)
      offset += 4
      const encryptedKeyData = bytes.slice(offset, offset + keyLen)
      offset += keyLen

      if (offset + 4 > bytes.length) {
        break
      }
      const chainCount = view.getUint32(offset, false)
      offset += 4

      const chainRes = readJksCertChain(bytes, view, offset, chainCount)
      offset = chainRes.nextOffset
      warnings.push(`Alias "${alias}": private key is encrypted.`)

      if (chainRes.firstCertBytes) {
        const fc = chainRes.firstCertBytes
        const buffer = fc.buffer.slice(fc.byteOffset, fc.byteOffset + fc.byteLength) as ArrayBuffer
        const parsed = parseX509FromDer(buffer)
        if (parsed) {
          entries.push({
            alias,
            certificate: parsed,
            isEncryptedJksKey: true,
            encryptedJksKeyData: encryptedKeyData,
          })
        } else {
          warnings.push(`Alias "${alias}": failed to parse private key's certificate.`)
        }
      }
    } else if (tag === 2) {
      if (offset + 2 > bytes.length) {
        break
      }
      const typeLen = view.getUint16(offset, false)
      offset += 2 + typeLen

      if (offset + 4 > bytes.length) {
        break
      }
      const certLen = view.getUint32(offset, false)
      offset += 4
      const certDer = bytes.slice(offset, offset + certLen)
      offset += certLen

      const derSlice = certDer.buffer.slice(
        certDer.byteOffset,
        certDer.byteOffset + certDer.byteLength,
      ) as ArrayBuffer
      const parsed = parseX509FromDer(derSlice)
      if (parsed) {
        entries.push({ alias, certificate: parsed })
      } else {
        warnings.push(`Alias "${alias}": could not parse certificate DER.`)
      }
    } else {
      warnings.push(`Unknown JKS entry tag ${tag} at offset ${offset - 14}. Stopping parse.`)
      break
    }
  }

  if (entries.some((e) => e.isEncryptedJksKey)) {
    warnings.unshift(
      'JKS MAC verification skipped. Private keys are encrypted and require a password.',
    )
  }

  return { entries, warnings }
}

/**
 * Decrypts a SunJCE-protected private key entry from a Java KeyStore (JKS).
 */
export function decryptJKSPrivateKey(encryptedKeyData: Uint8Array, passwordStr: string): string {
  const keyStr = uint8ToBinaryString(encryptedKeyData)
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(keyStr))
  if (
    !Array.isArray(asn1.value) ||
    asn1.value.length < 2 ||
    typeof asn1.value[1].value !== 'string'
  ) {
    throw new Error('Invalid EncryptedPrivateKeyInfo ASN.1 structure')
  }
  const protectedKeyStr = asn1.value[1].value
  const protectedKey = Uint8Array.from(protectedKeyStr, (c) => c.charCodeAt(0))

  const saltLen = 20
  const digestLen = 20

  if (protectedKey.length < saltLen + digestLen) {
    throw new Error('Invalid protected key block length')
  }

  const salt = protectedKey.slice(0, saltLen)
  const encrKeyLen = protectedKey.length - saltLen - digestLen
  const encrKey = protectedKey.slice(saltLen, saltLen + encrKeyLen)

  const numRounds = Math.ceil(encrKeyLen / digestLen)
  const xorKey = new Uint8Array(numRounds * digestLen)

  const passwdBytes = new Uint8Array(passwordStr.length * 2)
  for (let i = 0, j = 0; i < passwordStr.length; i++) {
    const code = passwordStr.charCodeAt(i)
    passwdBytes[j] = code >> 8
    passwdBytes[j + 1] = code & 0xff
    j += 2
  }
  const passwdByteStr = uint8ToBinaryString(passwdBytes)

  let digest = salt
  let xorOffset = 0

  for (let i = 0; i < numRounds; i++) {
    const md = forge.md.sha1.create()
    md.update(passwdByteStr)
    md.update(uint8ToBinaryString(digest))

    const digestStr = md.digest().getBytes()
    digest = Uint8Array.from(digestStr, (c) => c.charCodeAt(0))

    xorKey.set(digest, xorOffset)
    xorOffset += digestLen
  }

  const plainKey = new Uint8Array(encrKey.length)
  for (let i = 0; i < plainKey.length; i++) {
    plainKey[i] = encrKey[i] ^ xorKey[i]
  }

  const md = forge.md.sha1.create()
  md.update(passwdByteStr)
  md.update(uint8ToBinaryString(plainKey))
  const finalDigestStr = md.digest().getBytes()
  const finalDigest = Uint8Array.from(finalDigestStr, (c) => c.charCodeAt(0))

  const expectedDigest = protectedKey.slice(saltLen + encrKeyLen)
  for (let i = 0; i < digestLen; i++) {
    if (finalDigest[i] !== expectedDigest[i]) {
      throw new Error('Cannot recover key: Incorrect password')
    }
  }

  const plainAsn1 = forge.asn1.fromDer(forge.util.createBuffer(uint8ToBinaryString(plainKey)))
  const privateKey = forge.pki.privateKeyFromAsn1(plainAsn1)
  return forge.pki.privateKeyToPem(privateKey)
}
