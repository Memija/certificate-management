import type { FallbackCertStoreEntry, StoreLocation, StoreName } from '@/types'

import { buildDerAndPemCert } from './cert-synth'

export type { FallbackCertStoreEntry }

interface FallbackEntryOptions {
  serialHex: string
  subjectCN: string
  subjectO: string
  subjectC?: string
  issuerCN: string
  issuerO: string
  issuerC?: string
  notBefore: Date
  notAfter: Date
  friendlyName: string
  purposes: string[]
  isCA: boolean
  sanDns?: string[]
}

let cachedStoreMap: Record<string, FallbackCertStoreEntry[]> | null = null

function createFallbackStoreEntry(opts: FallbackEntryOptions): FallbackCertStoreEntry {
  const subjectC = opts.subjectC || 'US'
  const issuerC = opts.issuerC || 'US'
  const built = buildDerAndPemCert({
    serialHex: opts.serialHex,
    subject: [
      { shortName: 'CN', value: opts.subjectCN },
      { shortName: 'O', value: opts.subjectO },
      { shortName: 'C', value: subjectC },
    ],
    issuer: [
      { shortName: 'CN', value: opts.issuerCN },
      { shortName: 'O', value: opts.issuerO },
      { shortName: 'C', value: issuerC },
    ],
    notBefore: opts.notBefore,
    notAfter: opts.notAfter,
    isCA: opts.isCA,
    sanDns: opts.sanDns,
  })

  const now = Date.now()
  const notAfterMs = opts.notAfter.getTime()
  const isExpired = notAfterMs < now
  const isExpiringSoon = !isExpired && notAfterMs - now < 30 * 24 * 3600 * 1000
  const isSelfSigned = opts.subjectCN === opts.issuerCN && opts.subjectO === opts.issuerO
  const isRoot = opts.isCA && isSelfSigned
  const isIntermediate = opts.isCA && !isRoot

  return {
    thumbprint: built.thumbprintSha1,
    subject: `CN=${opts.subjectCN}, O=${opts.subjectO}, C=${subjectC}`,
    issuer: `CN=${opts.issuerCN}, O=${opts.issuerO}, C=${issuerC}`,
    notBefore: opts.notBefore.toISOString(),
    notAfter: opts.notAfter.toISOString(),
    serialNumber: opts.serialHex.toUpperCase(),
    signatureAlgorithm: 'sha256RSA',
    publicKeyAlgorithm: 'RSA',
    publicKeySize: 2048,
    friendlyName: opts.friendlyName,
    purposes: opts.purposes,
    isRoot,
    isIntermediate,
    isExpired,
    isExpiringSoon,
    pem: built.pem,
    certB64: built.certB64,
    extensions: [
      {
        name: 'Basic Constraints',
        oid: '2.5.29.19',
        critical: true,
        value: opts.isCA
          ? 'Subject Type=CA, Path Length Constraint=None'
          : 'Subject Type=End Entity',
      },
      {
        name: 'Key Usage',
        oid: '2.5.29.15',
        critical: true,
        value: opts.isCA
          ? 'Digital Signature, Certificate Signing, Off-line CRL Signing, CRL Signing (86)'
          : 'Digital Signature, Key Encipherment (a0)',
      },
      {
        name: 'Subject Key Identifier',
        oid: '2.5.29.14',
        critical: false,
        value: built.thumbprintSha1.slice(0, 40),
      },
    ],
  }
}

function buildFallbackStoreMap(): Record<string, FallbackCertStoreEntry[]> {
  const now = Date.now()
  const day = 24 * 3600 * 1000

  const rootCerts: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '033af1e6a711a9a0bb2864b11d09fae5',
      subjectCN: 'DigiCert Global Root G2',
      subjectO: 'DigiCert Inc',
      issuerCN: 'DigiCert Global Root G2',
      issuerO: 'DigiCert Inc',
      notBefore: new Date('2013-08-01T12:00:00Z'),
      notAfter: new Date('2038-01-15T12:00:00Z'),
      friendlyName: 'DigiCert Global Root G2',
      purposes: ['Server Authentication', 'Client Authentication', 'Code Signing', 'Secure Email'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '8210cfb0d240e3594463e0bb63828b00',
      subjectCN: 'ISRG Root X1',
      subjectO: 'Internet Security Research Group',
      issuerCN: 'ISRG Root X1',
      issuerO: 'Internet Security Research Group',
      notBefore: new Date('2015-06-04T11:04:38Z'),
      notAfter: new Date('2035-06-04T11:04:38Z'),
      friendlyName: "Let's Encrypt ISRG Root X1",
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '1a0297542399c8014b88719081726301',
      subjectCN: 'Microsoft RSA Root Certificate Authority 2017',
      subjectO: 'Microsoft Corporation',
      issuerCN: 'Microsoft RSA Root Certificate Authority 2017',
      issuerO: 'Microsoft Corporation',
      notBefore: new Date('2019-12-18T22:51:22Z'),
      notAfter: new Date('2042-07-18T23:00:23Z'),
      friendlyName: 'Microsoft RSA Root CA 2017',
      purposes: ['Server Authentication', 'Client Authentication', 'Code Signing', 'Time Stamping'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '040000000001154b5ac394',
      subjectCN: 'GlobalSign Root CA - R3',
      subjectO: 'GlobalSign',
      subjectC: 'BE',
      issuerCN: 'GlobalSign Root CA - R3',
      issuerO: 'GlobalSign',
      issuerC: 'BE',
      notBefore: new Date('2009-03-18T10:00:00Z'),
      notAfter: new Date(now + 18 * day),
      friendlyName: 'GlobalSign Root CA R3',
      purposes: ['Server Authentication', 'Client Authentication', 'Code Signing'],
      isCA: true,
    }),
  ]

  const caCerts: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '0a1b2c3d4e5f60718293a4b5c6d7e8f9',
      subjectCN: 'DigiCert TLS RSA SHA256 2020 CA1',
      subjectO: 'DigiCert Inc',
      issuerCN: 'DigiCert Global Root G2',
      issuerO: 'DigiCert Inc',
      notBefore: new Date('2021-04-14T00:00:00Z'),
      notAfter: new Date('2031-04-13T23:59:59Z'),
      friendlyName: 'DigiCert TLS RSA SHA256 2020 CA1',
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '05f29811a08412b38c90112233445566',
      subjectCN: 'WR2',
      subjectO: 'Google Trust Services',
      issuerCN: 'GTS Root R1',
      issuerO: 'Google Trust Services LLC',
      notBefore: new Date('2023-12-13T09:00:00Z'),
      notAfter: new Date('2029-02-20T14:00:00Z'),
      friendlyName: 'Google Trust Services WR2',
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '099887766554433221100ffeeddccbbaa',
      subjectCN: 'Contoso Legacy Internal Root CA',
      subjectO: 'Contoso Enterprise IT',
      issuerCN: 'Contoso Legacy Internal Root CA',
      issuerO: 'Contoso Enterprise IT',
      notBefore: new Date(now - 900 * day),
      notAfter: new Date(now + 1200 * day),
      friendlyName: 'Contoso Legacy Root (Misplaced in Intermediate Store)',
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: true,
    }),
    createFallbackStoreEntry({
      serialHex: '077112233445566778899aabbccddeeff',
      subjectCN: 'DST Root CA X3 Cross-Signed Intermediate',
      subjectO: 'Digital Signature Trust Co.',
      issuerCN: 'DST Root CA X3',
      issuerO: 'Digital Signature Trust Co.',
      notBefore: new Date('2016-03-17T16:40:46Z'),
      notAfter: new Date(now - 140 * day),
      friendlyName: 'DST Root CA X3 (Expired)',
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: true,
    }),
  ]

  const myCertsCurrentUser: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '4401a8b9c2d3e4f500112233',
      subjectCN: 'workstation-dev.corp.local',
      subjectO: 'Enterprise Engineering',
      issuerCN: 'DigiCert TLS RSA SHA256 2020 CA1',
      issuerO: 'DigiCert Inc',
      notBefore: new Date(now - 180 * day),
      notAfter: new Date(now + 185 * day),
      friendlyName: 'Corporate Zero-Trust Client Auth',
      purposes: ['Client Authentication', 'Secure Email'],
      isCA: false,
      sanDns: ['workstation-dev.corp.local'],
    }),
    createFallbackStoreEntry({
      serialHex: '4402f9e8d7c6b5a400998877',
      subjectCN: 'dev-signing@home-management.dev',
      subjectO: 'Home Management DevOps',
      issuerCN: 'ISRG Root X1',
      issuerO: 'Internet Security Research Group',
      notBefore: new Date(now - 350 * day),
      notAfter: new Date(now + 12 * day),
      friendlyName: 'Artifact Code Signing Certificate',
      purposes: ['Code Signing', 'Digital Signature'],
      isCA: false,
    }),
    createFallbackStoreEntry({
      serialHex: '4403deadbeef000011223344',
      subjectCN: 'legacy-vpn-gateway.internal',
      subjectO: 'Enterprise Networking',
      issuerCN: 'Contoso Legacy Internal Root CA',
      issuerO: 'Contoso Enterprise IT',
      notBefore: new Date(now - 420 * day),
      notAfter: new Date(now - 45 * day),
      friendlyName: 'Legacy IPSec VPN Client Certificate',
      purposes: ['Client Authentication'],
      isCA: false,
    }),
  ]

  const myCertsLocalMachine: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '5501a8b9c2d3e4f500112233',
      subjectCN: 'home-management.dev',
      subjectO: 'Home Management Platform',
      issuerCN: 'ISRG Root X1',
      issuerO: 'Internet Security Research Group',
      notBefore: new Date(now - 40 * day),
      notAfter: new Date(now + 50 * day),
      friendlyName: 'Local HTTPS Ingress TLS Certificate',
      purposes: ['Server Authentication', 'Client Authentication'],
      isCA: false,
      sanDns: ['home-management.dev', '*.home-management.dev'],
    }),
    createFallbackStoreEntry({
      serialHex: '5502a8b9c2d3e4f500998877',
      subjectCN: 'staging-api.home-management.dev',
      subjectO: 'Home Management Platform',
      issuerCN: 'ISRG Root X1',
      issuerO: 'Internet Security Research Group',
      notBefore: new Date(now - 82 * day),
      notAfter: new Date(now + 8 * day),
      friendlyName: 'Staging API Gateway TLS',
      purposes: ['Server Authentication'],
      isCA: false,
      sanDns: ['staging-api.home-management.dev'],
    }),
  ]

  const trustedPublisherCerts: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '6601a8b9c2d3e4f500112233',
      subjectCN: 'Microsoft Windows Hardware Compatibility Publisher',
      subjectO: 'Microsoft Corporation',
      issuerCN: 'Microsoft RSA Root Certificate Authority 2017',
      issuerO: 'Microsoft Corporation',
      notBefore: new Date('2021-01-01T00:00:00Z'),
      notAfter: new Date('2031-01-01T00:00:00Z'),
      friendlyName: 'Microsoft WHQL Driver Publisher',
      purposes: ['Code Signing', 'Digital Signature'],
      isCA: false,
    }),
  ]

  const disallowedCerts: FallbackCertStoreEntry[] = [
    createFallbackStoreEntry({
      serialHex: '7701bad0bad0bad000112233',
      subjectCN: 'Superfish VisualDiscovery Untrusted Root CA',
      subjectO: 'Superfish Inc.',
      issuerCN: 'Superfish VisualDiscovery Untrusted Root CA',
      issuerO: 'Superfish Inc.',
      notBefore: new Date('2014-05-01T00:00:00Z'),
      notAfter: new Date('2019-05-01T00:00:00Z'),
      friendlyName: 'Revoked / Untrusted Intercepting Root CA',
      purposes: ['Server Authentication'],
      isCA: true,
    }),
  ]

  return {
    'CurrentUser:Root': rootCerts,
    'LocalMachine:Root': rootCerts,
    'CurrentUser:CA': caCerts,
    'LocalMachine:CA': caCerts,
    'CurrentUser:My': myCertsCurrentUser,
    'LocalMachine:My': myCertsLocalMachine,
    'CurrentUser:TrustedPublisher': trustedPublisherCerts,
    'LocalMachine:TrustedPublisher': trustedPublisherCerts,
    'CurrentUser:Disallowed': disallowedCerts,
    'LocalMachine:Disallowed': disallowedCerts,
  }
}

export function getWebFallbackCertStore(
  store: StoreName,
  location: StoreLocation,
): FallbackCertStoreEntry[] {
  if (!cachedStoreMap) {
    cachedStoreMap = buildFallbackStoreMap()
  }
  return cachedStoreMap[`${location}:${store}`] || []
}
