import { buildDerAndPemCert } from './cert-synth'

function writeGuidToView(view: DataView, offset: number, guid: string): void {
  const parts = guid.toLowerCase().split('-')
  view.setUint32(offset, parseInt(parts[0], 16), true)
  view.setUint16(offset + 4, parseInt(parts[1], 16), true)
  view.setUint16(offset + 6, parseInt(parts[2], 16), true)
  view.setUint16(offset + 8, parseInt(parts[3], 16), false)
  view.setUint32(offset + 10, parseInt(parts[4].slice(0, 8), 16), false)
  view.setUint16(offset + 14, parseInt(parts[4].slice(8, 12), 16), false)
}

function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function buildX509EfiSignatureList(ownerGuid: string, derCerts: Uint8Array[]): string {
  const x509TypeGuid = 'a5c059a1-94e4-4aa7-87b5-ab155c2bf072'
  const listChunks: Uint8Array[] = []
  let totalLength = 0

  for (const der of derCerts) {
    const signatureSize = 16 + der.byteLength
    const signatureListSize = 28 + signatureSize
    const buf = new ArrayBuffer(signatureListSize)
    const view = new DataView(buf)
    const bytes = new Uint8Array(buf)

    writeGuidToView(view, 0, x509TypeGuid)
    view.setUint32(16, signatureListSize, true)
    view.setUint32(20, 0, true)
    view.setUint32(24, signatureSize, true)
    writeGuidToView(view, 28, ownerGuid)
    bytes.set(der, 44)

    listChunks.push(bytes)
    totalLength += signatureListSize
  }

  const combined = new Uint8Array(totalLength)
  let pos = 0
  for (const chunk of listChunks) {
    combined.set(chunk, pos)
    pos += chunk.byteLength
  }

  return encodeBytesBase64(combined)
}

function buildSha256EfiSignatureList(ownerGuid: string, hashesHex: string[]): string {
  const sha256TypeGuid = 'c1c41626-504c-4092-aca9-41f936934328'
  const signatureSize = 16 + 32
  const signatureListSize = 28 + hashesHex.length * signatureSize
  const buf = new ArrayBuffer(signatureListSize)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)

  writeGuidToView(view, 0, sha256TypeGuid)
  view.setUint32(16, signatureListSize, true)
  view.setUint32(20, 0, true)
  view.setUint32(24, signatureSize, true)

  let offset = 28
  for (const hex of hashesHex) {
    writeGuidToView(view, offset, ownerGuid)
    const cleanHex = hex
      .replace(/[^0-9a-fA-F]/g, '')
      .padEnd(64, '0')
      .slice(0, 64)
    for (let i = 0; i < 32; i++) {
      bytes[offset + 16 + i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
    }
    offset += signatureSize
  }

  return encodeBytesBase64(bytes)
}

let cachedSecureBootVars: Record<string, string> | null = null

export function getWebFallbackSecureBootVars(): Record<string, string> {
  if (cachedSecureBootVars) {
    return cachedSecureBootVars
  }

  const msOwnerGuid = '77fa9abd-0359-4d32-bd60-28f4e78f784b'
  const oemOwnerGuid = '55555555-4444-3333-2222-111111111111'

  const msRootIssuer = [
    { shortName: 'C', value: 'US' },
    { shortName: 'ST', value: 'Washington' },
    { shortName: 'L', value: 'Redmond' },
    { shortName: 'O', value: 'Microsoft Corporation' },
    { shortName: 'CN', value: 'Microsoft Root Certificate Authority 2010' },
  ]

  const winUefi2023 = buildDerAndPemCert({
    serialHex: '3300000511a48f92d0118b6ef000000000511',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Windows UEFI CA 2023' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2023-09-14T19:21:29Z'),
    notAfter: new Date('2038-09-14T19:31:29Z'),
    isCA: true,
    extKeyUsage: { codeSigning: true },
  })

  const msUefi2023 = buildDerAndPemCert({
    serialHex: '3300000512b91c48a0118b6ef000000000512',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Microsoft UEFI CA 2023' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2023-09-14T19:25:00Z'),
    notAfter: new Date('2038-09-14T19:35:00Z'),
    isCA: true,
    extKeyUsage: { codeSigning: true },
  })

  const winPca2011 = buildDerAndPemCert({
    serialHex: '61077656000000000008',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'ST', value: 'Washington' },
      { shortName: 'L', value: 'Redmond' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Microsoft Windows Production PCA 2011' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2011-10-19T18:41:42Z'),
    notAfter: new Date('2026-10-19T18:51:42Z'),
    isCA: true,
    extKeyUsage: { codeSigning: true },
  })

  const msUefi2011 = buildDerAndPemCert({
    serialHex: '6108d3c4000000000004',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'ST', value: 'Washington' },
      { shortName: 'L', value: 'Redmond' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Microsoft Corporation UEFI CA 2011' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2011-06-27T20:22:33Z'),
    notAfter: new Date('2026-06-27T20:32:33Z'),
    isCA: true,
    extKeyUsage: { codeSigning: true },
  })

  const kek2023 = buildDerAndPemCert({
    serialHex: '3300000509e12b71c0118b6ef000000000509',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Microsoft Corporation KEK 2K CA 2023' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2023-06-20T18:00:00Z'),
    notAfter: new Date('2038-06-20T18:10:00Z'),
    isCA: true,
  })

  const kek2011 = buildDerAndPemCert({
    serialHex: '61066814000000000005',
    subject: [
      { shortName: 'C', value: 'US' },
      { shortName: 'ST', value: 'Washington' },
      { shortName: 'L', value: 'Redmond' },
      { shortName: 'O', value: 'Microsoft Corporation' },
      { shortName: 'CN', value: 'Microsoft Corporation KEK CA 2011' },
    ],
    issuer: msRootIssuer,
    notBefore: new Date('2011-06-24T20:41:29Z'),
    notAfter: new Date('2026-06-24T20:51:29Z'),
    isCA: true,
  })

  const pkSubj = [
    { shortName: 'C', value: 'US' },
    { shortName: 'O', value: 'UEFI Platform Firmware Authority' },
    { shortName: 'CN', value: 'OEM Platform Key (PK) Root Authority 2024' },
  ]
  const pkCert = buildDerAndPemCert({
    serialHex: '018f2049a80001',
    subject: pkSubj,
    issuer: pkSubj,
    notBefore: new Date('2024-01-01T00:00:00Z'),
    notAfter: new Date('2039-01-01T00:00:00Z'),
    isCA: true,
  })

  const dbxHashes = [
    '80b4d96931bf0d02fd91a61e19d14f1da452e66db2408ca8604d411f92659f0a',
    'f52f83a3fa9cfbd6920f722824dbe4034534d25b8507246b3b957dac6e1bce7a',
    'c5a72897f7c91068f6196215c25b19b2e07c92a492a6a69d0b1a4d3b8f28931a',
    '45c7c8ae750f5468b36345f839c70f1d8c6a746c72882e46f09e55f0b6d11e24',
    'b9799262639a7d2b539016a32a2c913b08e29f336f90112a9881c45608a72a19',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ]

  cachedSecureBootVars = {
    db: buildX509EfiSignatureList(msOwnerGuid, [
      winUefi2023.derBytes,
      msUefi2023.derBytes,
      winPca2011.derBytes,
      msUefi2011.derBytes,
    ]),
    KEK: buildX509EfiSignatureList(msOwnerGuid, [kek2023.derBytes, kek2011.derBytes]),
    PK: buildX509EfiSignatureList(oemOwnerGuid, [pkCert.derBytes]),
    dbx: buildSha256EfiSignatureList(msOwnerGuid, dbxHashes),
  }

  return cachedSecureBootVars
}
