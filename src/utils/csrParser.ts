import forge from 'node-forge';

// ─── Exported types ──────────────────────────────────────────────────────────

export interface CSRSubjectField {
  shortName: string;
  name: string;
  value: string;
}

export interface CSRExtension {
  name: string;
  oid: string;
  critical: boolean;
  value: string;
}

export interface ParsedCSR {
  /** Full subject DN string, e.g. "CN=example.com, O=Acme, C=US" */
  subject: string;
  /** Parsed subject fields for individual row display */
  subjectFields: CSRSubjectField[];
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  signatureAlgorithm: string;
  signatureOid: string;
  /** Whether the CSR's self-signature is cryptographically valid */
  signatureValid: boolean;
  requestedExtensions: CSRExtension[];
  requestedPurposes: string[];
  pem: string;
  /** SHA-256 fingerprint of the DER-encoded CSR */
  fingerprintSha256: string;
  /** Raw DER bytes as base64, for download */
  derBase64: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SHORT_NAME_LABELS: Record<string, string> = {
  CN: 'Common Name',
  O:  'Organization',
  OU: 'Organizational Unit',
  C:  'Country',
  ST: 'State / Province',
  L:  'Locality',
  E:  'Email',
  emailAddress: 'Email',
  serialNumber: 'Serial Number',
  DC: 'Domain Component',
};

function labelFor(shortName: string, name: string): string {
  return SHORT_NAME_LABELS[shortName] || SHORT_NAME_LABELS[name] || shortName || name;
}

function uint8ToForgeBytes(bytes: Uint8Array): string {
  return forge.util.createBuffer(bytes as any).getBytes();
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export async function parseCSRFile(file: File): Promise<ParsedCSR> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = '';
  try { text = new TextDecoder('utf-8').decode(bytes); } catch { /* binary */ }

  return parseCSRBytes(bytes, text);
}

export function parseCSRFromText(text: string): ParsedCSR {
  const bytes = new TextEncoder().encode(text);
  return parseCSRBytes(bytes, text);
}

function parseCSRBytes(bytes: Uint8Array, text: string): ParsedCSR {
  // ── Detect PEM vs DER ──────────────────────────────────────────────────
  const isPem = text.includes('-----BEGIN');

  let csr: any;
  let derBytes: Uint8Array;

  if (isPem) {
    // Normalize - accept both "CERTIFICATE REQUEST" and "NEW CERTIFICATE REQUEST"
    const pemNorm = text.replace('NEW CERTIFICATE REQUEST', 'CERTIFICATE REQUEST');
    try {
      csr = forge.pki.certificationRequestFromPem(pemNorm);
    } catch (e: any) {
      throw new Error(`Failed to parse PEM CSR: ${e?.message || e}`);
    }
    // Re-derive DER for fingerprint
    const derStr = forge.asn1.toDer(forge.pki.certificationRequestToAsn1(csr)).getBytes();
    derBytes = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) derBytes[i] = derStr.charCodeAt(i);
  } else {
    // DER
    try {
      const derStr = uint8ToForgeBytes(bytes);
      const asn1 = forge.asn1.fromDer(derStr);
      csr = forge.pki.certificationRequestFromAsn1(asn1);
    } catch (e: any) {
      throw new Error(`Failed to parse DER CSR: ${e?.message || e}`);
    }
    derBytes = bytes;
  }

  // ── Subject ─────────────────────────────────────────────────────────────
  const subjectFields: CSRSubjectField[] = (csr.subject?.attributes || []).map((a: any) => ({
    shortName: a.shortName || '',
    name: labelFor(a.shortName || '', a.name || ''),
    value: String(a.value),
  }));
  const subjectStr = subjectFields
    .map(f => `${f.shortName || f.name}=${f.value}`)
    .join(', ');

  // ── Public key ──────────────────────────────────────────────────────────
  let publicKeyAlgorithm = 'Unknown';
  let publicKeySize: number | null = null;
  if (csr.publicKey) {
    if ((csr.publicKey as any).n) {
      publicKeyAlgorithm = 'RSA';
      publicKeySize = (csr.publicKey as any).n.bitLength();
    } else if ((csr.publicKey as any).curve) {
      publicKeyAlgorithm = 'EC (Elliptic Curve)';
    } else {
      publicKeyAlgorithm = 'Unknown / Other';
    }
  }

  // ── Signature algorithm ─────────────────────────────────────────────────
  const signatureOid: string = (csr as any).signatureOid || (csr as any).md?.algorithm || 'Unknown';
  const signatureAlgorithm: string = (forge.pki.oids as any)[signatureOid] || signatureOid;

  // ── Signature validity ──────────────────────────────────────────────────
  let signatureValid = false;
  try {
    signatureValid = csr.verify();
  } catch { /* treat as invalid */ }

  // ── Requested extensions ─────────────────────────────────────────────────
  const requestedExtensions: CSRExtension[] = [];
  const requestedPurposes: string[] = [];

  try {
    // Extensions are inside a CertificationRequestInfo.attributes[0] (extensionRequest)
    const attrs: any[] = csr.getAttribute({ name: 'extensionRequest' })?.extensions || [];
    for (const ext of attrs) {
      let valueStr = '';
      if (ext.subjectAltName) {
        valueStr = (ext.altNames || [])
          .map((an: any) => {
            if (an.type === 2) return `DNS: ${an.value}`;
            if (an.type === 7) return `IP: ${an.ip}`;
            if (an.type === 1) return `Email: ${an.value}`;
            if (an.type === 6) return `URI: ${an.value}`;
            return `Type ${an.type}: ${an.value}`;
          })
          .join(', ');
      } else if (typeof ext.value === 'string') {
        valueStr = forge.util.bytesToHex(ext.value).match(/.{1,2}/g)?.join(' ').toUpperCase() || '';
      }

      requestedExtensions.push({
        name: ext.name || (forge.pki.oids as any)[ext.id] || 'Unknown',
        oid: ext.id || '',
        critical: ext.critical || false,
        value: valueStr,
      });

      // Collect purposes from EKU / Key Usage
      if (ext.name === 'keyUsage') {
        if (ext.digitalSignature) requestedPurposes.push('Digital Signature');
        if (ext.keyCertSign)      requestedPurposes.push('Certificate Sign');
        if (ext.cRLSign)          requestedPurposes.push('CRL Sign');
        if (ext.keyEncipherment)  requestedPurposes.push('Key Encipherment');
        if (ext.dataEncipherment) requestedPurposes.push('Data Encipherment');
      }
      if (ext.name === 'extKeyUsage') {
        if (ext.serverAuth)      requestedPurposes.push('Server Authentication');
        if (ext.clientAuth)      requestedPurposes.push('Client Authentication');
        if (ext.codeSigning)     requestedPurposes.push('Code Signing');
        if (ext.emailProtection) requestedPurposes.push('Email Protection');
        if (ext.timeStamping)    requestedPurposes.push('Time Stamping');
      }
    }
  } catch { /* no extensions in CSR */ }

  if (requestedPurposes.length === 0) requestedPurposes.push('Not specified');

  // ── SHA-256 fingerprint of DER ───────────────────────────────────────────
  const derForgeStr = uint8ToForgeBytes(derBytes);
  const md = forge.md.sha256.create();
  md.update(derForgeStr);
  const fingerprintSha256 = md.digest().toHex().match(/.{1,2}/g)?.join(':').toUpperCase() || '';

  // ── PEM output ───────────────────────────────────────────────────────────
  const pem: string = isPem
    ? text.trim()
    : forge.pki.certificationRequestToPem(csr);

  // ── DER base64 for download ──────────────────────────────────────────────
  const derBase64 = btoa(String.fromCharCode(...derBytes));

  return {
    subject: subjectStr,
    subjectFields,
    publicKeyAlgorithm,
    publicKeySize,
    signatureAlgorithm,
    signatureOid,
    signatureValid,
    requestedExtensions,
    requestedPurposes,
    pem,
    fingerprintSha256,
    derBase64,
  };
}
