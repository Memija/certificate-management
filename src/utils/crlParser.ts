import forge from 'node-forge';

export interface RevokedCertificate {
  serialNumber: string;
  revocationDate: string;
  reason: string;
}

export interface CrlExtension {
  name: string;
  oid: string;
  critical: boolean;
  value: string;
}

export interface ParsedCRL {
  version: number;
  issuer: string;
  thisUpdate: string;
  nextUpdate: string | null;
  isExpired: boolean;
  revokedCertificates: RevokedCertificate[];
  extensions: CrlExtension[];
  pem: string;
  fingerprintSha256: string;
  derBase64: string;
}

export const CRL_REASON_CODES: Record<number, string> = {
  0: 'Unspecified',
  1: 'Key Compromise',
  2: 'CA Compromise',
  3: 'Affiliation Changed',
  4: 'Superseded',
  5: 'Cessation Of Operation',
  6: 'Certificate Hold',
  8: 'Remove From CRL',
  9: 'Privilege Withdrawn',
  10: 'AA Compromise',
};

export const SAMPLE_CRL_PEM = `-----BEGIN X509 CRL-----
MIICEDCB+QIBATANBgkqhkiG9w0BAQsFADBMMQswCQYDVQQGEwJVUzELMAkGA1UE
CAwCQ0ExFjAUBgNVBAoMDVRlc3QgUEtJIENvcnAxGDAWBgNVBAMMD1Rlc3QgSXNz
dWluZyBDQRcNMjYwOTA5MDgyNTEzWhcNMjYxMDA5MDgyNTEzWjBpMCECAgEKFw0y
NjA5MDkwODAwMDBaMAwwCgYDVR0VBAMKAQEwIQICArwXDTI2MDkwOTA4MTUwMFow
DDAKBgNVHRUEAwoBBDAhAgID/xcNMjYwOTA5MDgzMDAwWjAMMAoGA1UdFQQDCgEF
oA4wDDAKBgNVHRQEAwIBAzANBgkqhkiG9w0BAQsFAAOCAQEAXzkICIzlwREHCzhh
OAST/Bn6EtClMDB/dl8BYHdly9C8IF1730BnG+O2RyWMo+yUAt26X7qevEO/imcS
T/hKRK8AJFHXR1wsPQPGfJS43yOwABR+kYEkD1YZP04bAH7RNpQLeEbI21XsVZiu
PJb2Gffoe5j1Dxyws0hsI5EOwN61dcQTbXYPi3wgSJvvsfu1znJusKlta8GioLjY
PWeBJ5coS3dNxrDuVW4FUdVWW1fneeEd03gFnLAJoIbt2cXJ5/uDPSjqRSHE/1vy
lNyMVF6GivjX1TTSlano5VTfNMgcJJYWkGrv6SacNI3uyYOUKlrxwSsPCTBTtIB6
Ou1uLg==
-----END X509 CRL-----`;

export const EXTENSION_NAMES: Record<string, string> = {
  '2.5.29.20': 'crlNumber',
  '2.5.29.21': 'crlReason',
  '2.5.29.27': 'deltaCRLIndicator',
  '2.5.29.28': 'issuingDistributionPoint',
  '2.5.29.35': 'authorityKeyIdentifier',
};

function getSha256Fingerprint(derBytes: string): string {
  const md = forge.md.sha256.create();
  md.update(derBytes);
  const hex = md.digest().toHex();
  return hex.match(/.{1,2}/g)?.join(':').toUpperCase() || hex.toUpperCase();
}

const toBytes = (val: unknown): string => (typeof val === 'string' ? val : '');

export function parseDerCrl(derBytes: string): ParsedCRL {
  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(derBytes);
  } catch {
    throw new Error('ERR_INVALID_FORMAT');
  }

  if (asn1.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(asn1.value) || asn1.value.length < 3) {
    throw new Error('ERR_INVALID_FORMAT');
  }

  // 1. Detect if this DER file is an X.509 Certificate
  try {
    const cert = forge.pki.certificateFromAsn1(asn1);
    if (cert && cert.subject) {
      let subjectStr = '';
      try {
        subjectStr = cert.subject.attributes.map((a: any) => `${a.shortName || a.name || 'OID'}=${a.value}`).join(', ');
      } catch {
        subjectStr = '';
      }
      throw new Error(subjectStr ? `ERR_CERT_DER_NOT_CRL:${subjectStr}` : 'ERR_CERT_DER_NOT_CRL');
    }
  } catch (certErr: any) {
    if (certErr.message?.startsWith('ERR_CERT_DER_NOT_CRL')) {
      throw certErr;
    }
  }

  // 2. Detect if this DER file is a PKCS#10 Certificate Signing Request (CSR)
  try {
    const csr = forge.pki.certificationRequestFromAsn1(asn1);
    if (csr && csr.subject) {
      throw new Error('ERR_CSR_NOT_CRL');
    }
  } catch (csrErr: any) {
    if (csrErr.message === 'ERR_CSR_NOT_CRL') {
      throw csrErr;
    }
  }

  const tbs = asn1.value[0];
  if (tbs.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(tbs.value) || tbs.value.length < 3) {
    throw new Error('ERR_INVALID_FORMAT');
  }

  let idx = 0;
  let version = 1;
  if (tbs.value[idx]?.type === forge.asn1.Type.INTEGER) {
    const vHex = forge.util.bytesToHex(toBytes(tbs.value[idx].value));
    version = vHex.length > 0 ? parseInt(vHex, 16) + 1 : 1;
    idx++;
  }

  // Signature algorithm Identifier (skip index)
  idx++;

  // Issuer Name
  const issuerAsn1 = tbs.value[idx++];
  let issuer = 'Unknown Issuer';
  try {
    const issuerAttrs = (forge.pki as any).RDNAttributesAsArray(issuerAsn1) as any[];
    issuer = issuerAttrs.map((a: any) => `${a.shortName || a.name || 'OID'}=${a.value}`).join(', ');
  } catch {
    issuer = 'Unknown Issuer';
  }

  // thisUpdate Time
  const thisUpdateNode = tbs.value[idx++];
  if (!thisUpdateNode || (thisUpdateNode.type !== forge.asn1.Type.UTCTIME && thisUpdateNode.type !== forge.asn1.Type.GENERALIZEDTIME)) {
    // Check if TBS sequence contains subjectPublicKeyInfo (indicator of X.509 cert structure)
    const hasPubKey = tbs.value.some((v: any) => v && v.type === forge.asn1.Type.SEQUENCE && Array.isArray(v.value) && v.value.length === 2 && v.value[1]?.type === forge.asn1.Type.BITSTRING);
    if (hasPubKey) {
      throw new Error('ERR_CERT_DER_NOT_CRL');
    }
    throw new Error('ERR_INVALID_FORMAT');
  }
  const thisUpdateDate = thisUpdateNode.type === forge.asn1.Type.UTCTIME
    ? forge.asn1.utcTimeToDate(toBytes(thisUpdateNode.value))
    : forge.asn1.generalizedTimeToDate(toBytes(thisUpdateNode.value));
  const thisUpdate = thisUpdateDate ? thisUpdateDate.toISOString() : '';

  // nextUpdate Time (optional)
  let nextUpdate: string | null = null;
  if (
    idx < tbs.value.length &&
    (tbs.value[idx].type === forge.asn1.Type.UTCTIME || tbs.value[idx].type === forge.asn1.Type.GENERALIZEDTIME)
  ) {
    const nextUpdateNode = tbs.value[idx++];
    const nextUpdateDate = nextUpdateNode.type === forge.asn1.Type.UTCTIME
      ? forge.asn1.utcTimeToDate(toBytes(nextUpdateNode.value))
      : forge.asn1.generalizedTimeToDate(toBytes(nextUpdateNode.value));
    nextUpdate = nextUpdateDate ? nextUpdateDate.toISOString() : null;
  }

  const now = new Date();
  const isExpired = nextUpdate ? new Date(nextUpdate) < now : false;

  // revokedCertificates (optional)
  const revokedCertificates: RevokedCertificate[] = [];
  if (
    idx < tbs.value.length &&
    tbs.value[idx].tagClass === forge.asn1.Class.UNIVERSAL &&
    tbs.value[idx].type === forge.asn1.Type.SEQUENCE
  ) {
    const revokedSeq = tbs.value[idx++];
    if (Array.isArray(revokedSeq.value)) {
      for (const rc of revokedSeq.value) {
        if (!Array.isArray(rc.value) || rc.value.length < 2) continue;
        const serialHex = forge.util.bytesToHex(toBytes(rc.value[0].value)).toUpperCase();
        const revDateNode = rc.value[1];
        const revDate = revDateNode.type === forge.asn1.Type.UTCTIME
          ? forge.asn1.utcTimeToDate(toBytes(revDateNode.value))
          : forge.asn1.generalizedTimeToDate(toBytes(revDateNode.value));

        let reason = 'Unspecified';
        if (rc.value.length > 2 && Array.isArray(rc.value[2].value)) {
          const entryExts = rc.value[2].value;
          for (const ext of entryExts) {
            if (!Array.isArray(ext.value)) continue;
            const extOid = forge.asn1.derToOid(toBytes(ext.value[0].value));
            if (extOid === '2.5.29.21') {
              const octetVal = toBytes(ext.value[ext.value.length - 1].value);
              try {
                const innerAsn1 = forge.asn1.fromDer(octetVal);
                const codeHex = forge.util.bytesToHex(toBytes(innerAsn1.value));
                const code = codeHex.length > 0 ? parseInt(codeHex, 16) : 0;
                reason = CRL_REASON_CODES[code] || `Unknown (${code})`;
              } catch {
                reason = 'Unspecified';
              }
            }
          }
        }

        revokedCertificates.push({
          serialNumber: serialHex,
          revocationDate: revDate ? revDate.toISOString() : '',
          reason,
        });
      }
    }
  }

  // crlExtensions (optional, tagged [0])
  const extensions: CrlExtension[] = [];
  if (
    idx < tbs.value.length &&
    (tbs.value[idx].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC || tbs.value[idx].tagClass === 128) &&
    tbs.value[idx].type === 0
  ) {
    const extContainer = tbs.value[idx];
    const extSeq = Array.isArray(extContainer.value) ? extContainer.value[0] : null;
    if (extSeq && Array.isArray(extSeq.value)) {
      for (const ext of extSeq.value) {
        if (!Array.isArray(ext.value) || ext.value.length < 2) continue;
        const extOid = forge.asn1.derToOid(toBytes(ext.value[0].value));
        let critical = false;
        let valBytes = '';
        if (ext.value[1].type === forge.asn1.Type.BOOLEAN) {
          critical = typeof ext.value[1].value === 'string' && ext.value[1].value.charCodeAt(0) !== 0;
          valBytes = toBytes(ext.value[2]?.value);
        } else {
          valBytes = toBytes(ext.value[1]?.value);
        }

        let valStr = '';
        try {
          const inner = forge.asn1.fromDer(valBytes);
          if (extOid === '2.5.29.20') { // crlNumber
            const numHex = forge.util.bytesToHex(toBytes(inner.value));
            valStr = numHex.length > 0 ? parseInt(numHex, 16).toString() : '0';
          } else {
            valStr = forge.util.bytesToHex(valBytes).match(/.{1,2}/g)?.join(' ') || '';
          }
        } catch {
          valStr = 'Binary data';
        }

        extensions.push({
          name: EXTENSION_NAMES[extOid] || extOid,
          oid: extOid,
          critical,
          value: valStr,
        });
      }
    }
  }

  const pem = '-----BEGIN X509 CRL-----\r\n' +
    (forge.util.encode64(derBytes).match(/.{1,64}/g)?.join('\r\n') || '') +
    '\r\n-----END X509 CRL-----\r\n';
  const fingerprintSha256 = getSha256Fingerprint(derBytes);
  const derBase64 = forge.util.encode64(derBytes);

  return {
    version,
    issuer,
    thisUpdate,
    nextUpdate,
    isExpired,
    revokedCertificates,
    extensions,
    pem,
    fingerprintSha256,
    derBase64,
  };
}

export function parseCrlText(text: string): ParsedCRL {
  if (
    text.includes('-----BEGIN CERTIFICATE-----') ||
    text.includes('-----BEGIN X509 CERTIFICATE-----') ||
    text.includes('-----BEGIN TRUSTED CERTIFICATE-----')
  ) {
    throw new Error('ERR_CERT_NOT_CRL');
  }
  if (
    text.includes('-----BEGIN CERTIFICATE REQUEST-----') ||
    text.includes('-----BEGIN NEW CERTIFICATE REQUEST-----')
  ) {
    throw new Error('ERR_CSR_NOT_CRL');
  }
  if (text.includes('PRIVATE KEY-----')) {
    throw new Error('ERR_KEY_NOT_CRL');
  }
  if (text.includes('BEGIN PKCS7') || text.includes('BEGIN PKCS #7') || text.includes('BEGIN PKCS12')) {
    throw new Error('ERR_TRUST_STORE_NOT_CRL');
  }

  const match = text.match(/-----BEGIN [^-]*CRL[^-]*-----([\s\S]*?)-----END [^-]*CRL[^-]*-----/i);
  if (match) {
    const b64 = match[1].replace(/\s+/g, '');
    const derBytes = forge.util.decode64(b64);
    return parseDerCrl(derBytes);
  }

  if (text.includes('-----BEGIN ')) {
    throw new Error('ERR_PEM_NO_CRL');
  }

  throw new Error('ERR_INVALID_FORMAT');
}

export function isCrlPem(text: string): boolean {
  return /-----BEGIN [^-]*CRL[^-]*-----/i.test(text);
}

export function isDerCrl(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x30) return false;
  try {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    parseDerCrl(binary);
    return true;
  } catch {
    return false;
  }
}

export async function parseCrlFile(file: File): Promise<ParsedCRL> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // Check for JKS magic (0xFEEDFEED)
  if (uint8.length >= 4) {
    const view = new DataView(buffer);
    if (view.getUint32(0, false) === 0xfeedfeed) {
      throw new Error('ERR_TRUST_STORE_NOT_CRL');
    }
  }

  // Check if PEM text by scanning for '-' (0x2D) after optional UTF-8 BOM and whitespace
  let startIdx = 0;
  if (uint8.length >= 3 && uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    startIdx = 3;
  }
  while (startIdx < uint8.length && (uint8[startIdx] === 0x20 || uint8[startIdx] === 0x0A || uint8[startIdx] === 0x0D || uint8[startIdx] === 0x09)) {
    startIdx++;
  }

  if (startIdx < uint8.length && uint8[startIdx] === 0x2D) {
    const text = new TextDecoder('utf-8').decode(uint8);
    return parseCrlText(text);
  }

  // Check if ASN.1 SEQUENCE (0x30)
  if (uint8.length < 4 || uint8[startIdx] !== 0x30) {
    const sample = new TextDecoder('utf-8').decode(uint8.slice(0, 120));
    if (sample.includes('-----BEGIN ')) {
      const fullText = new TextDecoder('utf-8').decode(uint8);
      return parseCrlText(fullText);
    }
    throw new Error('ERR_INVALID_FORMAT');
  }

  let binary = '';
  for (let i = startIdx; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return parseDerCrl(binary);
}

