import forge from 'node-forge'

import { getSampleCertDerBuffer, PFX_PRESETS } from '@/data/format-converter-samples'
import {
  SAMPLE_MATCHING_CERT_PEM,
  SAMPLE_MATCHING_KEY_PEM,
  SAMPLE_RSA4096_CERT_PEM,
} from '@/data/key-matcher-samples'
import { JKS_MAGIC } from '@/utils/jks-parser'

export interface TrustStoreSamplePreset {
  id: string
  nameKey: string
  defaultName: string
  badgeKey: string
  defaultBadge: string
  fileName: string
  passwordHint?: string
  createFile: () => File
}

const SAMPLE_JKS_PASSWORD = 'changeit'

let cachedSampleP12Buffer: ArrayBuffer | null = null
let cachedSamplePkcs7Pem: string | null = null
let cachedSampleJksBuffer: ArrayBuffer | null = null

export function getSamplePkcs12Buffer(): ArrayBuffer {
  if (!cachedSampleP12Buffer) {
    const preset = PFX_PRESETS[0]
    const cert = forge.pki.certificateFromPem(preset.certPem)
    const key = forge.pki.privateKeyFromPem(preset.keyPem)
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], preset.defaultPassword, {
      algorithm: '3des',
      friendlyName: preset.commonName,
    })
    const derStr = forge.asn1.toDer(p12Asn1).getBytes()
    const bytes = new Uint8Array(derStr.length)
    for (let i = 0; i < derStr.length; i += 1) {
      bytes[i] = derStr.charCodeAt(i)
    }
    cachedSampleP12Buffer = bytes.buffer
  }
  return cachedSampleP12Buffer.slice(0)
}

export function getSamplePkcs7Pem(): string {
  if (!cachedSamplePkcs7Pem) {
    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer('')
    p7.addCertificate(forge.pki.certificateFromPem(SAMPLE_MATCHING_CERT_PEM))
    p7.addCertificate(forge.pki.certificateFromPem(SAMPLE_RSA4096_CERT_PEM))
    cachedSamplePkcs7Pem = forge.pkcs7.messageToPem(p7)
  }
  return cachedSamplePkcs7Pem
}

function certPemToDerBytes(certPem: string): Uint8Array {
  const cert = forge.pki.certificateFromPem(certPem)
  const derStr = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  return Uint8Array.from(derStr, (ch) => ch.charCodeAt(0))
}

function buildJksEncryptedPrivateKeyDer(keyPem: string, password: string): Uint8Array {
  const key = forge.pki.privateKeyFromPem(keyPem)
  const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))
  const plainKeyDerStr = forge.asn1.toDer(pkcs8Asn1).getBytes()
  const plainKeyBytes = Uint8Array.from(plainKeyDerStr, (ch) => ch.charCodeAt(0))

  const salt = new Uint8Array(20)
  for (let i = 0; i < 20; i += 1) {
    salt[i] = (i * 13 + 7) & 0xff
  }

  const passwdBytes = new Uint8Array(password.length * 2)
  for (let i = 0; i < password.length; i += 1) {
    const code = password.charCodeAt(i)
    passwdBytes[i * 2] = code >> 8
    passwdBytes[i * 2 + 1] = code & 0xff
  }
  const passwdStr = Array.from(passwdBytes, (b) => String.fromCharCode(b)).join('')

  const numRounds = Math.ceil(plainKeyBytes.length / 20)
  const xorKey = new Uint8Array(numRounds * 20)
  let digest: Uint8Array = salt
  for (let r = 0; r < numRounds; r += 1) {
    const md = forge.md.sha1.create()
    md.update(passwdStr)
    md.update(Array.from(digest, (b) => String.fromCharCode(b)).join(''))
    digest = Uint8Array.from(md.digest().getBytes(), (ch) => ch.charCodeAt(0))
    xorKey.set(digest, r * 20)
  }

  const encrKey = new Uint8Array(plainKeyBytes.length)
  for (let i = 0; i < plainKeyBytes.length; i += 1) {
    encrKey[i] = plainKeyBytes[i] ^ xorKey[i]
  }

  const checkMd = forge.md.sha1.create()
  checkMd.update(passwdStr)
  checkMd.update(plainKeyDerStr)
  const checkBytes = Uint8Array.from(checkMd.digest().getBytes(), (ch) => ch.charCodeAt(0))

  const protectedPayload = new Uint8Array(20 + encrKey.length + 20)
  protectedPayload.set(salt, 0)
  protectedPayload.set(encrKey, 20)
  protectedPayload.set(checkBytes, 20 + encrKey.length)

  const protectedStr = Array.from(protectedPayload, (b) => String.fromCharCode(b)).join('')
  const epkiAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer('1.3.6.1.4.1.42.2.17.1.1').getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, protectedStr),
  ])

  const epkiDer = forge.asn1.toDer(epkiAsn1).getBytes()
  return Uint8Array.from(epkiDer, (ch) => ch.charCodeAt(0))
}

export function getSampleJksBuffer(): ArrayBuffer {
  if (!cachedSampleJksBuffer) {
    const encoder = new TextEncoder()
    const certTypeBytes = encoder.encode('X.509')
    const keyAliasBytes = encoder.encode('web-tls-key')
    const trustedAliasBytes = encoder.encode('enterprise-vault-ca')
    const leafCertDer = certPemToDerBytes(SAMPLE_MATCHING_CERT_PEM)
    const vaultCertDer = certPemToDerBytes(SAMPLE_RSA4096_CERT_PEM)
    const epkiBytes = buildJksEncryptedPrivateKeyDer(SAMPLE_MATCHING_KEY_PEM, SAMPLE_JKS_PASSWORD)

    const bodyLen =
      12 +
      (4 +
        2 +
        keyAliasBytes.length +
        8 +
        4 +
        epkiBytes.length +
        4 +
        2 +
        certTypeBytes.length +
        4 +
        leafCertDer.length) +
      (4 + 2 + trustedAliasBytes.length + 8 + 2 + certTypeBytes.length + 4 + vaultCertDer.length)

    const out = new Uint8Array(bodyLen + 20)
    const view = new DataView(out.buffer)
    let pos = 0

    // Header: magic, version=2, entryCount=2
    view.setUint32(pos, JKS_MAGIC, false)
    pos += 4
    view.setUint32(pos, 2, false)
    pos += 4
    view.setUint32(pos, 2, false)
    pos += 4

    // Entry 1: Tag 1 (PrivateKeyEntry)
    view.setUint32(pos, 1, false)
    pos += 4
    view.setUint16(pos, keyAliasBytes.length, false)
    pos += 2
    out.set(keyAliasBytes, pos)
    pos += keyAliasBytes.length + 8
    view.setUint32(pos, epkiBytes.length, false)
    pos += 4
    out.set(epkiBytes, pos)
    pos += epkiBytes.length
    view.setUint32(pos, 1, false)
    pos += 4
    view.setUint16(pos, certTypeBytes.length, false)
    pos += 2
    out.set(certTypeBytes, pos)
    pos += certTypeBytes.length
    view.setUint32(pos, leafCertDer.length, false)
    pos += 4
    out.set(leafCertDer, pos)
    pos += leafCertDer.length

    // Entry 2: Tag 2 (TrustedCertificateEntry)
    view.setUint32(pos, 2, false)
    pos += 4
    view.setUint16(pos, trustedAliasBytes.length, false)
    pos += 2
    out.set(trustedAliasBytes, pos)
    pos += trustedAliasBytes.length + 8
    view.setUint16(pos, certTypeBytes.length, false)
    pos += 2
    out.set(certTypeBytes, pos)
    pos += certTypeBytes.length
    view.setUint32(pos, vaultCertDer.length, false)
    pos += 4
    out.set(vaultCertDer, pos)
    pos += vaultCertDer.length

    // Trailing JKS SHA-1 integrity digest
    const digestMd = forge.md.sha1.create()
    for (let i = 0; i < SAMPLE_JKS_PASSWORD.length; i += 1) {
      const code = SAMPLE_JKS_PASSWORD.charCodeAt(i)
      digestMd.update(String.fromCharCode(code >> 8, code & 0xff))
    }
    digestMd.update('Mighty Aphrodite')
    let bodyStr = ''
    for (let i = 0; i < pos; i += 1) {
      bodyStr += String.fromCharCode(out[i])
    }
    digestMd.update(bodyStr)
    const macBytes = Uint8Array.from(digestMd.digest().getBytes(), (ch) => ch.charCodeAt(0))
    out.set(macBytes, pos)

    cachedSampleJksBuffer = out.buffer
  }
  return cachedSampleJksBuffer.slice(0)
}

export const TRUST_STORE_SAMPLE_PRESETS: readonly TrustStoreSamplePreset[] = [
  {
    id: 'sample-pem-bundle',
    nameKey: 'app.trustStore.format.pemBundle',
    defaultName: 'PEM Bundle',
    badgeKey: 'app.trustStore.inspector.pills.pemBundle',
    defaultBadge: 'PEM Bundles',
    fileName: 'sample_trust_bundle.pem',
    createFile: () =>
      new File(
        [`${SAMPLE_MATCHING_CERT_PEM}\n${SAMPLE_RSA4096_CERT_PEM}`],
        'sample_trust_bundle.pem',
        { type: 'application/x-pem-file' },
      ),
  },
  {
    id: 'sample-der-cert',
    nameKey: 'app.trustStore.format.x509Der',
    defaultName: 'DER Certificate',
    badgeKey: 'app.formatConverter.badgeDer',
    defaultBadge: 'DER (Binary)',
    fileName: 'sample_webserver_cert.der',
    createFile: () =>
      new File([getSampleCertDerBuffer()], 'sample_webserver_cert.der', {
        type: 'application/x-x509-ca-cert',
      }),
  },
  {
    id: 'sample-pkcs7-chain',
    nameKey: 'app.trustStore.format.pkcs7',
    defaultName: 'PKCS#7 Chain',
    badgeKey: 'app.trustStore.inspector.pills.pkcs7Badge',
    defaultBadge: 'PKCS#7 (.p7b)',
    fileName: 'sample_cert_chain.p7b',
    createFile: () =>
      new File([getSamplePkcs7Pem()], 'sample_cert_chain.p7b', {
        type: 'application/x-pkcs7-certificates',
      }),
  },
  {
    id: 'sample-encrypted-p12',
    nameKey: 'app.trustStore.format.pkcs12',
    defaultName: 'PKCS#12 / PFX',
    badgeKey: 'app.formatConverter.presetPfxRsa2048',
    defaultBadge: 'Web Server (RSA 2048)',
    fileName: 'sample_keystore.p12',
    passwordHint: PFX_PRESETS[0].defaultPassword,
    createFile: () =>
      new File([getSamplePkcs12Buffer()], 'sample_keystore.p12', {
        type: 'application/x-pkcs12',
      }),
  },
  {
    id: 'sample-jks-keystore',
    nameKey: 'app.trustStore.format.jks',
    defaultName: 'Java KeyStore',
    badgeKey: 'app.trustStore.inspector.pills.jksBadge',
    defaultBadge: 'JKS (.jks)',
    fileName: 'sample_keystore.jks',
    passwordHint: SAMPLE_JKS_PASSWORD,
    createFile: () =>
      new File([getSampleJksBuffer()], 'sample_keystore.jks', {
        type: 'application/octet-stream',
      }),
  },
]
