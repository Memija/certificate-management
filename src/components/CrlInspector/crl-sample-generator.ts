import forge from 'node-forge'

import type { ParsedCRL } from '@/types'
import { parseCrlText, parseDerCrl, SAMPLE_CRL_PEM } from '@/utils/crl-parser'

export const SAMPLE_CRL_FILENAME = 'sample_revocation_list.crl'
export const SAMPLE_DER_CRL_FILENAME = 'sample_revocation_list.der'
export const SAMPLE_EXPIRED_CRL_FILENAME = 'sample_expired_list.crl'

export type CrlSampleId = 'active-pem' | 'active-der' | 'expired-pem'

export interface LoadedCRL {
  id: string
  name: string
  crl: ParsedCRL
  isSample?: boolean
  sampleId?: CrlSampleId
}

export interface CrlSamplePreset {
  id: CrlSampleId
  fileName: string
  labelKey: string
  defaultLabel: string
}

export const CRL_SAMPLE_PRESETS: readonly CrlSamplePreset[] = [
  {
    id: 'active-pem',
    fileName: SAMPLE_CRL_FILENAME,
    labelKey: 'app.crl.trySampleCrl',
    defaultLabel: 'Try Sample CRL',
  },
  {
    id: 'active-der',
    fileName: SAMPLE_DER_CRL_FILENAME,
    labelKey: 'app.crl.trySampleDerCrl',
    defaultLabel: 'Sample DER CRL',
  },
  {
    id: 'expired-pem',
    fileName: SAMPLE_EXPIRED_CRL_FILENAME,
    labelKey: 'app.crl.trySampleExpiredCrl',
    defaultLabel: 'Expired CRL',
  },
]

function formatUtcTimeAsn1(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const yy = String(date.getUTCFullYear()).slice(-2)
  return `${yy}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function encodeRdn(oid: string, value: string): forge.asn1.Asn1 {
  return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(oid).getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, value),
    ]),
  ])
}

interface SyntheticRevokedEntry {
  serialHex: string
  revokedAt: Date
  reasonCode: number
}

function buildSyntheticCrlDer(options: {
  issuerCn: string
  issuerOrg: string
  thisUpdate: Date
  nextUpdate: Date
  crlNumber: number
  revoked: readonly SyntheticRevokedEntry[]
}): string {
  const sha256RsaAlg = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer('1.2.840.113549.1.1.11').getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ],
  )

  const issuerSeq = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    encodeRdn('2.5.4.6', 'US'),
    encodeRdn('2.5.4.10', options.issuerOrg),
    encodeRdn('2.5.4.3', options.issuerCn),
  ])

  const revokedNodes = options.revoked.map((entry) => {
    const serialBytes = forge.util.hexToBytes(entry.serialHex)
    const reasonOctets = forge.asn1
      .toDer(
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.ENUMERATED,
          false,
          String.fromCharCode(entry.reasonCode),
        ),
      )
      .getBytes()

    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, serialBytes),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.UTCTIME,
        false,
        formatUtcTimeAsn1(entry.revokedAt),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer('2.5.29.21').getBytes(),
          ),
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OCTETSTRING,
            false,
            reasonOctets,
          ),
        ]),
      ]),
    ])
  })

  const crlNumberOctets = forge.asn1
    .toDer(
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.INTEGER,
        false,
        String.fromCharCode(options.crlNumber),
      ),
    )
    .getBytes()

  const crlExtensions = forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer('2.5.29.20').getBytes(),
        ),
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OCTETSTRING,
          false,
          crlNumberOctets,
        ),
      ]),
    ]),
  ])

  const tbsCertList = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.INTEGER,
        false,
        String.fromCharCode(1),
      ),
      sha256RsaAlg,
      issuerSeq,
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.UTCTIME,
        false,
        formatUtcTimeAsn1(options.thisUpdate),
      ),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.UTCTIME,
        false,
        formatUtcTimeAsn1(options.nextUpdate),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, revokedNodes),
      crlExtensions,
    ],
  )

  const tbsDer = forge.asn1.toDer(tbsCertList).getBytes()
  const sigDigest = forge.md.sha256.create().update(tbsDer).digest().getBytes()
  const certList = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    tbsCertList,
    sha256RsaAlg,
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.BITSTRING,
      false,
      `\x00${sigDigest}`,
    ),
  ])

  return forge.asn1.toDer(certList).getBytes()
}

export function createSampleLoadedCrl(sampleId: CrlSampleId = 'active-pem'): LoadedCRL {
  if (sampleId === 'active-der') {
    const now = Date.now()
    const day = 86_400_000
    const derStr = buildSyntheticCrlDer({
      issuerCn: 'Contoso Binary DER Issuing CA',
      issuerOrg: 'Contoso Enterprise PKI',
      thisUpdate: new Date(now - 5 * day),
      nextUpdate: new Date(now + 90 * day),
      crlNumber: 17,
      revoked: [
        { serialHex: '01A4F201', revokedAt: new Date(now - 30 * day), reasonCode: 1 },
        { serialHex: '01A4F202', revokedAt: new Date(now - 20 * day), reasonCode: 2 },
        { serialHex: '01A4F203', revokedAt: new Date(now - 10 * day), reasonCode: 6 },
        { serialHex: '01A4F204', revokedAt: new Date(now - 6 * day), reasonCode: 9 },
      ],
    })
    return {
      id: `sample-crl-der-${Date.now()}`,
      name: SAMPLE_DER_CRL_FILENAME,
      crl: parseDerCrl(derStr),
      isSample: true,
      sampleId,
    }
  }

  if (sampleId === 'expired-pem') {
    const derStr = buildSyntheticCrlDer({
      issuerCn: 'Legacy Root Revocation Authority',
      issuerOrg: 'Legacy Trust Corp',
      thisUpdate: new Date('2024-01-15T00:00:00Z'),
      nextUpdate: new Date('2024-07-15T00:00:00Z'),
      crlNumber: 9,
      revoked: [
        { serialHex: '04B10001', revokedAt: new Date('2023-11-10T09:00:00Z'), reasonCode: 4 },
        { serialHex: '04B10002', revokedAt: new Date('2024-01-02T14:30:00Z'), reasonCode: 5 },
        { serialHex: '04B10003', revokedAt: new Date('2024-01-12T18:15:00Z'), reasonCode: 3 },
      ],
    })
    return {
      id: `sample-crl-expired-${Date.now()}`,
      name: SAMPLE_EXPIRED_CRL_FILENAME,
      crl: parseDerCrl(derStr),
      isSample: true,
      sampleId,
    }
  }

  const parsed = parseCrlText(SAMPLE_CRL_PEM)
  return {
    id: `sample-crl-${Date.now()}`,
    name: SAMPLE_CRL_FILENAME,
    crl: parsed,
    isSample: true,
    sampleId: 'active-pem',
  }
}
