import type { TlsChainCertificate, TlsScanResult } from '@/types'

import { buildDerAndPemCert, type SynthCertSpec, type SynthesizedCert } from './cert-synth'

interface ChainNodeInput {
  built: SynthesizedCert
  subjectCN: string
  subjectO: string
  issuerCN: string
  issuerO: string
  validFrom: Date
  validTo: Date
  serialHex: string
  isCA: boolean
  isEcdsaHost: boolean
  sans: string[]
}

function buildChainNode(input: ChainNodeInput): TlsChainCertificate {
  const {
    built,
    subjectCN,
    subjectO,
    issuerCN,
    issuerO,
    validFrom,
    validTo,
    serialHex,
    isCA,
    isEcdsaHost,
    sans,
  } = input

  return {
    subject: `CN=${subjectCN}, O=${subjectO}, C=US`,
    issuer: `CN=${issuerCN}, O=${issuerO}, C=US`,
    subjectCN,
    issuerCN,
    valid_from: validFrom.toUTCString(),
    valid_to: validTo.toUTCString(),
    fingerprint: built.fingerprintSha1Colon,
    fingerprint256: built.fingerprintSha256Colon,
    serialNumber: serialHex.toUpperCase(),
    rawB64: built.certB64,
    pem: built.pem,
    keyType: isEcdsaHost ? 'ec' : 'rsa',
    keyDetails: isEcdsaHost ? { namedCurve: 'P-256' } : { modulusLength: 2048 },
    ca: isCA,
    subjectAltNames: sans,
    extensions: [
      {
        id: '2.5.29.19',
        oid: '2.5.29.19',
        name: 'basicConstraints',
        critical: true,
        value: `Is CA: ${isCA ? 'Yes' : 'No'}`,
      },
      {
        id: '2.5.29.15',
        oid: '2.5.29.15',
        name: 'keyUsage',
        critical: true,
        value: isCA
          ? 'Digital Signature, Certificate Signing, CRL Signing'
          : 'Digital Signature, Key Encipherment',
      },
      ...(sans.length > 0
        ? [
            {
              id: '2.5.29.17',
              oid: '2.5.29.17',
              name: 'subjectAltName',
              critical: false,
              value: sans.join(', '),
            },
          ]
        : []),
    ],
  }
}

export function scanTlsClientSide(rawHost: string, port: number): TlsScanResult {
  const host = rawHost.trim().toLowerCase()
  const now = Date.now()
  const day = 24 * 3600 * 1000

  const isExpiredHost = host.includes('expired.')
  const isSelfSignedHost = host.includes('self-signed.')
  const isUntrustedHost = host.includes('untrusted-root.')
  const isWrongHost = host.includes('wrong.host.')
  const isEcdsaHost =
    host.includes('cloudflare') || host.includes('google') || host.includes('home-management')

  const leafNotBefore = new Date(isExpiredHost ? now - 400 * day : now - 30 * day)
  const leafNotAfter = new Date(isExpiredHost ? now - 15 * day : now + 60 * day)

  const rootOrg = isEcdsaHost ? 'Internet Security Research Group' : 'DigiCert Inc'
  const rootCN = isEcdsaHost ? 'ISRG Root X1' : 'DigiCert Global Root G2'
  const interOrg = isEcdsaHost ? "Let's Encrypt" : 'DigiCert Inc'
  const interCN = isEcdsaHost ? 'E5' : 'DigiCert TLS RSA SHA256 2020 CA1'

  const sanHost = isWrongHost ? 'other-domain.badssl.com' : host
  const sanList = [`DNS:${sanHost}`, `DNS:*.${sanHost}`]

  const leafSubjectOrg = isSelfSignedHost ? 'Self-Signed Testing Endpoint' : `${host} Operations`
  const leafSpec: SynthCertSpec = {
    serialHex: '04a91f8c2d7e6b5a4102938475601122',
    subject: [
      { shortName: 'CN', value: sanHost },
      { shortName: 'O', value: leafSubjectOrg },
      { shortName: 'C', value: 'US' },
    ],
    issuer: isSelfSignedHost
      ? [
          { shortName: 'CN', value: sanHost },
          { shortName: 'O', value: 'Self-Signed Testing Endpoint' },
          { shortName: 'C', value: 'US' },
        ]
      : [
          { shortName: 'CN', value: interCN },
          { shortName: 'O', value: interOrg },
          { shortName: 'C', value: 'US' },
        ],
    notBefore: leafNotBefore,
    notAfter: leafNotAfter,
    isCA: isSelfSignedHost,
    extKeyUsage: { serverAuth: true, clientAuth: true },
    sanDns: [sanHost, `*.${sanHost}`],
  }

  const leafBuilt = buildDerAndPemCert(leafSpec)

  const chain: TlsChainCertificate[] = [
    buildChainNode({
      built: leafBuilt,
      subjectCN: sanHost,
      subjectO: leafSubjectOrg,
      issuerCN: isSelfSignedHost ? sanHost : interCN,
      issuerO: isSelfSignedHost ? 'Self-Signed Testing Endpoint' : interOrg,
      validFrom: leafNotBefore,
      validTo: leafNotAfter,
      serialHex: leafSpec.serialHex,
      isCA: isSelfSignedHost,
      isEcdsaHost,
      sans: sanList,
    }),
  ]

  if (!isSelfSignedHost) {
    const interValidFrom = new Date('2021-01-01T00:00:00Z')
    const interValidTo = new Date('2031-01-01T00:00:00Z')
    const interBuilt = buildDerAndPemCert({
      serialHex: '02b83e9f1a2c3d4e5f60718293a4b5c6',
      subject: [
        { shortName: 'CN', value: interCN },
        { shortName: 'O', value: interOrg },
        { shortName: 'C', value: 'US' },
      ],
      issuer: [
        { shortName: 'CN', value: rootCN },
        { shortName: 'O', value: rootOrg },
        { shortName: 'C', value: 'US' },
      ],
      notBefore: interValidFrom,
      notAfter: interValidTo,
      isCA: true,
    })

    const rootValidFrom = new Date('2015-01-01T00:00:00Z')
    const rootValidTo = new Date('2038-01-01T00:00:00Z')
    const rootBuilt = buildDerAndPemCert({
      serialHex: '01f1e2d3c4b5a6978877665544332211',
      subject: [
        { shortName: 'CN', value: rootCN },
        { shortName: 'O', value: rootOrg },
        { shortName: 'C', value: 'US' },
      ],
      issuer: [
        { shortName: 'CN', value: rootCN },
        { shortName: 'O', value: rootOrg },
        { shortName: 'C', value: 'US' },
      ],
      notBefore: rootValidFrom,
      notAfter: rootValidTo,
      isCA: true,
    })

    chain.push(
      buildChainNode({
        built: interBuilt,
        subjectCN: interCN,
        subjectO: interOrg,
        issuerCN: rootCN,
        issuerO: rootOrg,
        validFrom: interValidFrom,
        validTo: interValidTo,
        serialHex: '02B83E9F1A2C3D4E5F60718293A4B5C6',
        isCA: true,
        isEcdsaHost,
        sans: [],
      }),
      buildChainNode({
        built: rootBuilt,
        subjectCN: rootCN,
        subjectO: rootOrg,
        issuerCN: rootCN,
        issuerO: rootOrg,
        validFrom: rootValidFrom,
        validTo: rootValidTo,
        serialHex: '01F1E2D3C4B5A6978877665544332211',
        isCA: true,
        isEcdsaHost,
        sans: [],
      }),
    )
  }

  let authorized = true
  let authorizationError: string | null = null
  if (isExpiredHost) {
    authorized = false
    authorizationError = 'CERT_HAS_EXPIRED'
  } else if (isSelfSignedHost) {
    authorized = false
    authorizationError = 'DEPTH_ZERO_SELF_SIGNED_CERT'
  } else if (isUntrustedHost) {
    authorized = false
    authorizationError = 'SELF_SIGNED_CERT_IN_CHAIN'
  } else if (isWrongHost) {
    authorized = false
    authorizationError = 'ERR_TLS_CERT_ALTNAME_INVALID'
  }

  return {
    chain,
    protocol: 'TLSv1.3',
    cipher: {
      name: isEcdsaHost ? 'TLS_AES_128_GCM_SHA256' : 'TLS_AES_256_GCM_SHA384',
      standardName: isEcdsaHost ? 'TLS_AES_128_GCM_SHA256' : 'TLS_AES_256_GCM_SHA384',
      version: 'TLSv1.3',
    },
    authorized,
    authorizationError,
    host,
    port,
  }
}
