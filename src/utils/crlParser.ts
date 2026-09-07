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

const CRL_REASON_CODES: Record<number, string> = {
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

function formatAttributes(attributes: any[] = []): string {
  return attributes
    .map((attr) => {
      const name = attr.shortName || attr.name || attr.type || 'OID';
      return `${name}=${attr.value}`;
    })
    .join(', ');
}

function parseExtensions(extensions: any[] = []): CrlExtension[] {
  return extensions.map((ext) => {
    let valStr = '';
    try {
      if (typeof ext.value === 'string' && (/^[\x20-\x7E]*$/.test(ext.value) && ext.value.length > 0)) {
        valStr = ext.value;
      } else if (ext.name === 'crlNumber') {
        valStr = ext.value ? ext.value.toString() : '';
      } else {
        valStr = 'Binary data / ASN.1 structure';
      }
    } catch {
      valStr = 'Unable to parse value';
    }
    return {
      name: ext.name || ext.oid || 'Unknown Extension',
      oid: ext.oid || '',
      critical: !!ext.critical,
      value: valStr,
    };
  });
}

function getSha256Fingerprint(derBytes: string): string {
  const md = forge.md.sha256.create();
  md.update(derBytes);
  const hex = md.digest().toHex();
  return hex.match(/.{1,2}/g)?.join(':').toUpperCase() || hex.toUpperCase();
}

function parseDerCrl(derBytes: string): ParsedCRL {
  const asn1 = forge.asn1.fromDer(derBytes);
  const crl = (forge.pki as any).certificateRevocationListFromAsn1(asn1);

  const issuer = formatAttributes(crl.issuer?.attributes || []);
  const version = (crl.version ?? 0) + 1;
  const thisUpdate = crl.thisUpdate ? new Date(crl.thisUpdate).toISOString() : '';
  const nextUpdateObj = crl.nextUpdate ? new Date(crl.nextUpdate) : null;
  const nextUpdate = nextUpdateObj ? nextUpdateObj.toISOString() : null;

  const now = new Date();
  const isExpired = nextUpdateObj ? nextUpdateObj < now : false;

  const revokedCertificates: RevokedCertificate[] = (crl.revokedCertificates || []).map((rc: any) => {
    let reason = 'Unspecified';
    if (rc.extensions) {
      const reasonExt = rc.extensions.find((e: any) => e.name === 'crlReason' || e.oid === '2.5.29.21');
      if (reasonExt && typeof reasonExt.value === 'number') {
        reason = CRL_REASON_CODES[reasonExt.value] || `Unknown (${reasonExt.value})`;
      }
    }
    const serial = rc.serialNumber ? rc.serialNumber.replace(/^0x/i, '').toUpperCase() : 'UNKNOWN';
    return {
      serialNumber: serial,
      revocationDate: rc.revocationDate ? new Date(rc.revocationDate).toISOString() : '',
      reason,
    };
  });

  const extensions = parseExtensions(crl.extensions || []);
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

export async function parseCrlFile(file: File): Promise<ParsedCRL> {
  const text = await file.text().catch(() => '');
  if (text.includes('-----BEGIN X509 CRL-----') || text.includes('-----BEGIN CERTIFICATE REVOCATION LIST-----') || text.includes('-----BEGIN CRL-----')) {
    // PEM format
    const b64 = text.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
    const derBytes = forge.util.decode64(b64);
    return parseDerCrl(derBytes);
  } else {
    // DER format
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return parseDerCrl(binary);
  }
}
