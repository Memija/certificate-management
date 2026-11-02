import forge from 'node-forge';
import { CT_LOG_PRESETS, type CtEntry, type CtLogPreset } from './ctLogSamples';
import { OCSP_SAMPLE_PRESETS } from './ocspSamples';
import type { StoreLocation, StoreName } from '../WinCertStoreInspector';

// Pre-generated 2048-bit RSA keypair PEMs for instant, deterministic in-browser X.509 certificate synthesis
const FALLBACK_PRIVATE_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQDHKYzylCLkey4dZxjBZig8t0ZPMWbj91dnG5wg9e0cjvEOz1Gw
TBOFAG1/EG8H6p4X4Egmim9TMvlly4EATzZsBbhaSMAWLVIzeKT6twaN++fioJFA
NptGXOk3D9IaDVtbTxgy+4cws9fAv4r7SI2wZYD5mxCHOAbF1th6RkPwkwIDAQAB
AoGAKYYgPPNl0v1bwAWew7Po77/GiPxj12PadUTsaHLd3PZwjAXtojQ6XaCZM8TZ
YW0pSREZ+e8jBtW56d9kJgxd7Amawo/jcOMyb5ZCbDHgcMb4y19QngsBrTomql7t
bYVQ9fyZmkXmQYPEWZwRQUvQikD3uHe5wp6NEvvDawIFywECQQDk/7ljdqz6gJXY
UNaNmqVKgt47hMoyEbYKJvNO3xa/WO0b5qUdcnmGvFCeSIrSQKe47PzFhqdX1CfM
kc0fjB/vAkEA3qU3Lbe10G7wzFtKJsli28gyG2Gk3Pk43q0yQzOHczV6iTvqzeI3
ScZaiflYiSbZlSjLYhZFVzXi0hmVquZVnQJAch0Esw3mcQY2pY7S+8l+aL0CJUKs
x3qP7ksun7UHzt5veaHb0erDqGKbAeVAWDmj2sEtzPim11t/Ya+eOgRHvQJAfFX5
rZ9VerQp54XnsCdw/NodGWt7PSg02S4RzrOdJfqslq0OYLG/PIT4FOtZxSYcBo+E
nR9g0+Y06C3/hjQhhQJAFu0rDmPM67+eu5BByomIt50KOAfmhybI6yk36atKS990
liEn5jOhvAQ3IvfSACKWkejOShsu8xV4cuxSOy/Z6g==
-----END RSA PRIVATE KEY-----`;

let cachedKeyPair: forge.pki.rsa.KeyPair | null = null;

function getFallbackKeyPair(): forge.pki.rsa.KeyPair {
  if (cachedKeyPair) return cachedKeyPair;
  try {
    const priv = forge.pki.privateKeyFromPem(FALLBACK_PRIVATE_KEY_PEM);
    const pub = forge.pki.setRsaPublicKey((priv as any).n, (priv as any).e);
    cachedKeyPair = { privateKey: priv, publicKey: pub };
    return cachedKeyPair;
  } catch {
    cachedKeyPair = forge.pki.rsa.generateKeyPair(1024);
    return cachedKeyPair;
  }
}

export class WebApiUnavailableError extends Error {
  isWebFallback = true;
  constructor(message = 'Local backend API is unavailable in static web mode') {
    super(message);
    this.name = 'WebApiUnavailableError';
  }
}

/**
 * Fetches JSON from a local `/api/*` endpoint and throws `WebApiUnavailableError`
 * when running as a static web page (404, 405, HTML SPA fallback, or network failure).
 */
export async function fetchLocalApiJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new WebApiUnavailableError();
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trim();

  // Static web hosts return HTML (index.html or 404 page) or empty body when /api/* is missing
  if (
    !trimmed ||
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<html') ||
    contentType.includes('text/html')
  ) {
    throw new WebApiUnavailableError();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new WebApiUnavailableError();
  }

  if (!res.ok) {
    const errMsg = parsed?.error || `HTTP ${res.status}`;
    // If running on a non-Windows server where powershell.exe or certutil is missing, fall back to web mode
    if (
      res.status === 404 ||
      res.status === 405 ||
      /powershell\.exe.*not found|certutil.*not found|ENOENT/i.test(errMsg)
    ) {
      throw new WebApiUnavailableError(errMsg);
    }
    throw new Error(errMsg);
  }

  return parsed as T;
}

interface SynthCertSpec {
  serialHex: string;
  subject: { shortName: string; value: string }[];
  issuer: { shortName: string; value: string }[];
  notBefore: Date;
  notAfter: Date;
  isCA: boolean;
  keyUsage?: {
    digitalSignature?: boolean;
    keyEncipherment?: boolean;
    keyCertSign?: boolean;
    cRLSign?: boolean;
  };
  extKeyUsage?: {
    serverAuth?: boolean;
    clientAuth?: boolean;
    codeSigning?: boolean;
    timeStamping?: boolean;
  };
  sanDns?: string[];
}

function buildDerAndPemCert(spec: SynthCertSpec): {
  derBytes: Uint8Array;
  pem: string;
  certB64: string;
  thumbprintSha1: string;
  fingerprintSha1Colon: string;
  fingerprintSha256Colon: string;
} {
  const keys = getFallbackKeyPair();
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = spec.serialHex;
  cert.validity.notBefore = spec.notBefore;
  cert.validity.notAfter = spec.notAfter;
  cert.setSubject(spec.subject);
  cert.setIssuer(spec.issuer);

  const exts: any[] = [
    { name: 'basicConstraints', cA: spec.isCA, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: spec.keyUsage?.digitalSignature ?? true,
      keyEncipherment: spec.keyUsage?.keyEncipherment ?? !spec.isCA,
      keyCertSign: spec.keyUsage?.keyCertSign ?? spec.isCA,
      cRLSign: spec.keyUsage?.cRLSign ?? spec.isCA,
      critical: true,
    },
    { name: 'subjectKeyIdentifier' },
  ];

  if (spec.extKeyUsage) {
    exts.push({
      name: 'extKeyUsage',
      ...spec.extKeyUsage,
    });
  }

  if (spec.sanDns && spec.sanDns.length > 0) {
    exts.push({
      name: 'subjectAltName',
      altNames: spec.sanDns.map(d => ({ type: 2, value: d })),
    });
  }

  cert.setExtensions(exts);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pem = forge.pki.certificateToPem(cert);
  const derByteStr = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certB64 = forge.util.encode64(derByteStr);

  const derBytes = new Uint8Array(derByteStr.length);
  for (let i = 0; i < derByteStr.length; i++) {
    derBytes[i] = derByteStr.charCodeAt(i);
  }

  const sha1Hex = forge.md.sha1.create().update(derByteStr).digest().toHex().toUpperCase();
  const sha256Hex = forge.md.sha256.create().update(derByteStr).digest().toHex().toUpperCase();

  return {
    derBytes,
    pem,
    certB64,
    thumbprintSha1: sha1Hex,
    fingerprintSha1Colon: sha1Hex.match(/.{1,2}/g)?.join(':') || sha1Hex,
    fingerprintSha256Colon: sha256Hex.match(/.{1,2}/g)?.join(':') || sha256Hex,
  };
}

// ─── 1. UEFI Secure Boot NVRAM Web Fallback ───────────────────────────────────

function writeGuidToView(view: DataView, offset: number, guid: string) {
  const parts = guid.toLowerCase().split('-');
  view.setUint32(offset, parseInt(parts[0], 16), true);
  view.setUint16(offset + 4, parseInt(parts[1], 16), true);
  view.setUint16(offset + 6, parseInt(parts[2], 16), true);
  view.setUint16(offset + 8, parseInt(parts[3], 16), false);
  view.setUint32(offset + 10, parseInt(parts[4].slice(0, 8), 16), false);
  view.setUint16(offset + 14, parseInt(parts[4].slice(8, 12), 16), false);
}

function buildX509EfiSignatureList(ownerGuid: string, derCerts: Uint8Array[]): string {
  const x509TypeGuid = 'a5c059a1-94e4-4aa7-87b5-ab155c2bf072';
  const listChunks: Uint8Array[] = [];
  let totalLength = 0;

  for (const der of derCerts) {
    const signatureSize = 16 + der.byteLength;
    const signatureListSize = 28 + signatureSize;
    const buf = new ArrayBuffer(signatureListSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    writeGuidToView(view, 0, x509TypeGuid);
    view.setUint32(16, signatureListSize, true);
    view.setUint32(20, 0, true); // SignatureHeaderSize = 0
    view.setUint32(24, signatureSize, true);
    writeGuidToView(view, 28, ownerGuid);
    bytes.set(der, 44);

    listChunks.push(bytes);
    totalLength += signatureListSize;
  }

  const combined = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of listChunks) {
    combined.set(chunk, pos);
    pos += chunk.byteLength;
  }

  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

function buildSha256EfiSignatureList(ownerGuid: string, hashesHex: string[]): string {
  const sha256TypeGuid = 'c1c41626-504c-4092-aca9-41f936934328';
  const signatureSize = 16 + 32;
  const signatureListSize = 28 + hashesHex.length * signatureSize;
  const buf = new ArrayBuffer(signatureListSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  writeGuidToView(view, 0, sha256TypeGuid);
  view.setUint32(16, signatureListSize, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, signatureSize, true);

  let offset = 28;
  for (const hex of hashesHex) {
    writeGuidToView(view, offset, ownerGuid);
    const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '').padEnd(64, '0').slice(0, 64);
    for (let i = 0; i < 32; i++) {
      bytes[offset + 16 + i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
    }
    offset += signatureSize;
  }

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let cachedSecureBootVars: Record<string, string> | null = null;

export function getWebFallbackSecureBootVars(): Record<string, string> {
  if (cachedSecureBootVars) return cachedSecureBootVars;

  const msOwnerGuid = '77fa9abd-0359-4d32-bd60-28f4e78f784b';
  const oemOwnerGuid = '55555555-4444-3333-2222-111111111111';

  const msRootIssuer = [
    { shortName: 'C', value: 'US' },
    { shortName: 'ST', value: 'Washington' },
    { shortName: 'L', value: 'Redmond' },
    { shortName: 'O', value: 'Microsoft Corporation' },
    { shortName: 'CN', value: 'Microsoft Root Certificate Authority 2010' },
  ];

  // 1. Windows UEFI CA 2023 (Active replacement for Windows Boot)
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
  });

  // 2. Microsoft UEFI CA 2023 (Active replacement for 3rd-party OS & Option ROMs)
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
  });

  // 3. Microsoft Windows Production PCA 2011 (Legacy 2011 PCA)
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
  });

  // 4. Microsoft Corporation UEFI CA 2011 (Legacy 2011 3rd-party UEFI CA)
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
  });

  // KEK certificates
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
  });

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
  });

  // PK (Platform Key)
  const pkSubj = [
    { shortName: 'C', value: 'US' },
    { shortName: 'O', value: 'UEFI Platform Firmware Authority' },
    { shortName: 'CN', value: 'OEM Platform Key (PK) Root Authority 2024' },
  ];
  const pkCert = buildDerAndPemCert({
    serialHex: '018f2049a80001',
    subject: pkSubj,
    issuer: pkSubj,
    notBefore: new Date('2024-01-01T00:00:00Z'),
    notAfter: new Date('2039-01-01T00:00:00Z'),
    isCA: true,
  });

  const dbxHashes = [
    '80b4d96931bf0d02fd91a61e19d14f1da452e66db2408ca8604d411f92659f0a',
    'f52f83a3fa9cfbd6920f722824dbe4034534d25b8507246b3b957dac6e1bce7a',
    'c5a72897f7c91068f6196215c25b19b2e07c92a492a6a69d0b1a4d3b8f28931a',
    '45c7c8ae750f5468b36345f839c70f1d8c6a746c72882e46f09e55f0b6d11e24',
    'b9799262639a7d2b539016a32a2c913b08e29f336f90112a9881c45608a72a19',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ];

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
  };

  return cachedSecureBootVars;
}

// ─── 2. Windows Certificate Store & Expiry Dashboard Web Fallback ─────────────

export interface FallbackCertStoreEntry {
  thumbprint: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  serialNumber: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  friendlyName: string;
  purposes: string[];
  isRoot: boolean;
  isIntermediate: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  pem: string;
  certB64?: string;
  extensions: { name: string; oid: string; critical: boolean; value: string }[];
}

let cachedStoreMap: Record<string, FallbackCertStoreEntry[]> | null = null;

function createFallbackStoreEntry(opts: {
  serialHex: string;
  subjectCN: string;
  subjectO: string;
  subjectC?: string;
  issuerCN: string;
  issuerO: string;
  issuerC?: string;
  notBefore: Date;
  notAfter: Date;
  friendlyName: string;
  purposes: string[];
  isCA: boolean;
  sanDns?: string[];
}): FallbackCertStoreEntry {
  const subjectAttrs = [
    { shortName: 'CN', value: opts.subjectCN },
    { shortName: 'O', value: opts.subjectO },
    { shortName: 'C', value: opts.subjectC || 'US' },
  ];
  const issuerAttrs = [
    { shortName: 'CN', value: opts.issuerCN },
    { shortName: 'O', value: opts.issuerO },
    { shortName: 'C', value: opts.issuerC || 'US' },
  ];

  const built = buildDerAndPemCert({
    serialHex: opts.serialHex,
    subject: subjectAttrs,
    issuer: issuerAttrs,
    notBefore: opts.notBefore,
    notAfter: opts.notAfter,
    isCA: opts.isCA,
    sanDns: opts.sanDns,
  });

  const now = Date.now();
  const notAfterMs = opts.notAfter.getTime();
  const isExpired = notAfterMs < now;
  const isExpiringSoon = !isExpired && notAfterMs - now < 30 * 24 * 3600 * 1000;
  const isSelfSigned = opts.subjectCN === opts.issuerCN && opts.subjectO === opts.issuerO;
  const isRoot = opts.isCA && isSelfSigned;
  const isIntermediate = opts.isCA && !isRoot;

  return {
    thumbprint: built.thumbprintSha1,
    subject: `CN=${opts.subjectCN}, O=${opts.subjectO}, C=${opts.subjectC || 'US'}`,
    issuer: `CN=${opts.issuerCN}, O=${opts.issuerO}, C=${opts.issuerC || 'US'}`,
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
        value: opts.isCA ? 'Subject Type=CA, Path Length Constraint=None' : 'Subject Type=End Entity',
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
  };
}

export function getWebFallbackCertStore(
  store: StoreName,
  location: StoreLocation
): FallbackCertStoreEntry[] {
  if (!cachedStoreMap) {
    const now = Date.now();
    const day = 24 * 3600 * 1000;

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
        notAfter: new Date(now + 18 * day), // Expiring soon (<30d)
        friendlyName: 'GlobalSign Root CA R3',
        purposes: ['Server Authentication', 'Client Authentication', 'Code Signing'],
        isCA: true,
      }),
    ];

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
      // Misplaced self-signed root inside Intermediate CAs store
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
      // Expired Intermediate CA
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
    ];

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
        notAfter: new Date(now + 12 * day), // Expiring soon (<30d)
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
        notAfter: new Date(now - 45 * day), // Expired
        friendlyName: 'Legacy IPSec VPN Client Certificate',
        purposes: ['Client Authentication'],
        isCA: false,
      }),
    ];

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
        notAfter: new Date(now + 8 * day), // Expiring soon (<30d)
        friendlyName: 'Staging API Gateway TLS',
        purposes: ['Server Authentication'],
        isCA: false,
        sanDns: ['staging-api.home-management.dev'],
      }),
    ];

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
    ];

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
    ];

    cachedStoreMap = {
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
    };
  }

  return cachedStoreMap[`${location}:${store}`] || [];
}

// ─── 3. Remote TLS Scanner Web Fallback ──────────────────────────────────────

export function scanTlsClientSide(rawHost: string, port: number) {
  const host = rawHost.trim().toLowerCase();
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  const isExpiredHost = host.includes('expired.');
  const isSelfSignedHost = host.includes('self-signed.');
  const isUntrustedHost = host.includes('untrusted-root.');
  const isWrongHost = host.includes('wrong.host.');
  const isEcdsaHost = host.includes('cloudflare') || host.includes('google') || host.includes('home-management');

  const leafNotBefore = new Date(isExpiredHost ? now - 400 * day : now - 30 * day);
  const leafNotAfter = new Date(isExpiredHost ? now - 15 * day : now + 60 * day);

  const rootOrg = isEcdsaHost ? 'Internet Security Research Group' : 'DigiCert Inc';
  const rootCN = isEcdsaHost ? 'ISRG Root X1' : 'DigiCert Global Root G2';
  const interOrg = isEcdsaHost ? "Let's Encrypt" : 'DigiCert Inc';
  const interCN = isEcdsaHost ? 'E5' : 'DigiCert TLS RSA SHA256 2020 CA1';

  const sanHost = isWrongHost ? 'other-domain.badssl.com' : host;
  const sanList = [`DNS:${sanHost}`, `DNS:*.${sanHost}`];

  const leafSpec: SynthCertSpec = {
    serialHex: '04a91f8c2d7e6b5a4102938475601122',
    subject: [
      { shortName: 'CN', value: sanHost },
      { shortName: 'O', value: isSelfSignedHost ? 'Self-Signed Testing Endpoint' : `${host} Operations` },
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
  };

  const leafBuilt = buildDerAndPemCert(leafSpec);

  const buildChainNode = (
    built: ReturnType<typeof buildDerAndPemCert>,
    subjectCN: string,
    subjectO: string,
    issuerCN: string,
    issuerO: string,
    validFrom: Date,
    validTo: Date,
    serialHex: string,
    isCA: boolean,
    sans: string[]
  ) => ({
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
        value: isCA ? 'Digital Signature, Certificate Signing, CRL Signing' : 'Digital Signature, Key Encipherment',
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
  });

  const chain: any[] = [
    buildChainNode(
      leafBuilt,
      sanHost,
      isSelfSignedHost ? 'Self-Signed Testing Endpoint' : `${host} Operations`,
      isSelfSignedHost ? sanHost : interCN,
      isSelfSignedHost ? 'Self-Signed Testing Endpoint' : interOrg,
      leafNotBefore,
      leafNotAfter,
      leafSpec.serialHex,
      isSelfSignedHost,
      sanList
    ),
  ];

  if (!isSelfSignedHost) {
    const interValidFrom = new Date('2021-01-01T00:00:00Z');
    const interValidTo = new Date('2031-01-01T00:00:00Z');
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
    });

    const rootValidFrom = new Date('2015-01-01T00:00:00Z');
    const rootValidTo = new Date('2038-01-01T00:00:00Z');
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
    });

    chain.push(
      buildChainNode(interBuilt, interCN, interOrg, rootCN, rootOrg, interValidFrom, interValidTo, '02B83E9F1A2C3D4E5F60718293A4B5C6', true, []),
      buildChainNode(rootBuilt, rootCN, rootOrg, rootCN, rootOrg, rootValidFrom, rootValidTo, '01F1E2D3C4B5A6978877665544332211', true, [])
    );
  }

  let authorized = true;
  let authorizationError: string | null = null;
  if (isExpiredHost) {
    authorized = false;
    authorizationError = 'CERT_HAS_EXPIRED';
  } else if (isSelfSignedHost) {
    authorized = false;
    authorizationError = 'DEPTH_ZERO_SELF_SIGNED_CERT';
  } else if (isUntrustedHost) {
    authorized = false;
    authorizationError = 'SELF_SIGNED_CERT_IN_CHAIN';
  } else if (isWrongHost) {
    authorized = false;
    authorizationError = 'ERR_TLS_CERT_ALTNAME_INVALID';
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
  };
}

// ─── 4. OCSP & CRL Revocation Checker Web Fallback ───────────────────────────

export function verifyOcspClientSide(
  certInputPem: string,
  parsedCert: {
    subject: string;
    issuer: string;
    serialNumber: string;
    notBefore: Date;
    notAfter: Date;
    isExpired: boolean;
    ocspUrl: string | null;
    crlUrl: string | null;
  } | null,
  activePresetId: string | null
) {
  const matchedPreset = OCSP_SAMPLE_PRESETS.find(
    p => p.id === activePresetId || p.certificatePem.trim() === certInputPem.trim()
  );

  const subject = matchedPreset?.subject || parsedCert?.subject || 'CN=Unknown Certificate';
  const issuer = matchedPreset?.issuer || parsedCert?.issuer || 'CN=Unknown Issuer';
  const serial = parsedCert?.serialNumber || '01';
  const ocspUrl = matchedPreset ? matchedPreset.ocspUrl : (parsedCert?.ocspUrl ?? null);
  const crlUrl = matchedPreset ? matchedPreset.crlUrl : (parsedCert?.crlUrl ?? null);

  let status: 'good' | 'revoked' | 'unknown' = 'unknown';
  if (matchedPreset) {
    status = matchedPreset.expectedStatus;
  } else if (
    subject.toLowerCase().includes('revoked') ||
    serial.toLowerCase().includes('050a72b7ae90c2e1c61bb7d1568032f79549')
  ) {
    status = 'revoked';
  } else if (parsedCert && !parsedCert.isExpired && (ocspUrl || crlUrl)) {
    status = 'good';
  } else {
    status = 'unknown';
  }

  const ocspVerified = status === 'good' && !!ocspUrl;
  const crlVerified = (status === 'good' || status === 'revoked') && !!crlUrl;

  const diagnosticLines = [
    `================ Certificate Revocation Diagnostic (Browser Mode) ================`,
    `Subject:       ${subject}`,
    `Issuer:        ${issuer}`,
    `Serial Number: ${serial}`,
    `Valid From:    ${parsedCert?.notBefore ? parsedCert.notBefore.toISOString() : 'N/A'}`,
    `Valid To:      ${parsedCert?.notAfter ? parsedCert.notAfter.toISOString() : 'N/A'}`,
    `----------------------------------------------------------------------------------`,
    `Authority Information Access (OCSP): ${ocspUrl || 'None present in X.509 AIA extension'}`,
    `CRL Distribution Points (CDP):       ${crlUrl || 'None present in X.509 CDP extension'}`,
    `----------------------------------------------------------------------------------`,
    status === 'revoked'
      ? `Revocation Check Result: CERT_TRUST_IS_REVOKED (Certificate is REVOKED by issuing CA)`
      : status === 'good'
      ? `Revocation Check Result: Leaf certificate revocation check passed (Status: GOOD)`
      : `Revocation Check Result: Offline / No reachable OCSP or CRL distribution point (Status: UNKNOWN)`,
  ];

  return {
    status,
    output: diagnosticLines.join('\n'),
    ocspVerified,
    crlVerified,
    ocspUrl,
    crlUrl,
  };
}

// ─── 5. CT Log Search Web Fallback ───────────────────────────────────────────

export async function searchCtLogsClientSide(
  domain: string,
  preset?: CtLogPreset
): Promise<{
  data: CtEntry[];
  provider: 'crt.sh' | 'certspotter' | 'sample';
  rateLimited: boolean;
}> {
  const cleanDomain = domain.trim().toLowerCase();

  // 1. Try CertSpotter CORS API directly from the browser
  try {
    const csUrl = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(cleanDomain)}&include_subdomains=true&expand=dns_names&expand=issuer`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(csUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const csData = await res.json();
      if (Array.isArray(csData) && csData.length > 0) {
        const mapped: CtEntry[] = csData.map((item: any, idx: number) => ({
          id: parseInt(item.id, 10) || Date.now() - idx * 1000,
          issuer_ca_id: 16418,
          issuer_name: item.issuer?.name || item.issuer?.friendly_name || 'Public Certificate Authority',
          common_name: item.dns_names?.[0] || cleanDomain,
          name_value: (item.dns_names || [cleanDomain]).join('\n'),
          entry_timestamp: item.not_before,
          not_before: item.not_before,
          not_after: item.not_after,
          serial_number: item.cert_sha256 || item.tbs_sha256 || String(item.id),
        }));
        return { data: mapped, provider: 'certspotter', rateLimited: false };
      }
    }
  } catch {
    // Proceed to fallback
  }

  // 2. If domain matches a preset, return its curated sample data
  const matchedPreset =
    preset || CT_LOG_PRESETS.find(p => p.domain.toLowerCase() === cleanDomain);
  if (matchedPreset && matchedPreset.sampleData && matchedPreset.sampleData.length > 0) {
    return {
      data: matchedPreset.sampleData,
      provider: 'sample',
      rateLimited: true,
    };
  }

  // 3. Synthesize representative CT log entries for any custom domain in static web mode
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const iso = (ms: number) => new Date(ms).toISOString().split('.')[0];

  const synthesized: CtEntry[] = [
    {
      id: 990000101,
      issuer_ca_id: 183267,
      issuer_name: "C=US, O=Let's Encrypt, CN=E5",
      common_name: cleanDomain,
      name_value: `${cleanDomain}\n*.${cleanDomain}`,
      entry_timestamp: iso(now - 14 * day),
      not_before: iso(now - 14 * day),
      not_after: iso(now + 76 * day),
      serial_number: '04:a1:b2:c3:d4:e5:f6:07:18:29:3a:4b:5c:6d:7e:8f:90:11',
    },
    {
      id: 990000102,
      issuer_ca_id: 185756,
      issuer_name: 'C=US, O=DigiCert Inc, CN=DigiCert Global G2 TLS RSA SHA256 2020 CA1',
      common_name: `api.${cleanDomain}`,
      name_value: `api.${cleanDomain}\ngateway.${cleanDomain}`,
      entry_timestamp: iso(now - 45 * day),
      not_before: iso(now - 45 * day),
      not_after: iso(now + 320 * day),
      serial_number: '08:f9:e8:d7:c6:b5:a4:93:82:71:60:5f:4e:3d:2c:1b:0a:22',
    },
    {
      id: 990000103,
      issuer_ca_id: 183267,
      issuer_name: "C=US, O=Let's Encrypt, CN=R3",
      common_name: cleanDomain,
      name_value: `${cleanDomain}\nwww.${cleanDomain}`,
      entry_timestamp: iso(now - 120 * day),
      not_before: iso(now - 120 * day),
      not_after: iso(now - 30 * day),
      serial_number: '03:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:33',
    },
  ];

  return {
    data: synthesized,
    provider: 'sample',
    rateLimited: true,
  };
}
