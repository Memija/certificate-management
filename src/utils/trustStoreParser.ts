import forge from 'node-forge';

// ─── Re-export the shared ParsedCertificate type ───────────────────────────
export interface ParsedCertificate {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  signatureType: string;
  pem: string;
  isRoot: boolean;
  isIntermediate: boolean;
  isLeaf: boolean;
  isExpired: boolean;
  purposes: string[];
  version: number;
  signatureOid: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  fingerprintSha1: string;
  fingerprintSha256: string;
  extensions: {
    name: string;
    oid: string;
    critical: boolean;
    value: string;
  }[];
}

export interface TrustStoreEntry {
  alias: string;
  certificate: ParsedCertificate;
  privateKeyPem?: string;
  isEncryptedJksKey?: boolean;
  encryptedJksKeyData?: Uint8Array;
}

export interface ParsedTrustStore {
  format: 'X509-DER' | 'X509-PEM' | 'PEM-Bundle' | 'PKCS7' | 'PKCS12' | 'JKS' | 'Unknown';
  entries: TrustStoreEntry[];
  warnings: string[];
}

// ─── Core X.509 parser (shared logic, duplicated to avoid cross-file deps) ──
export function parseX509FromDer(derBuffer: ArrayBuffer): ParsedCertificate | null {
  try {
    const derStr = forge.util.createBuffer(new Uint8Array(derBuffer)).getBytes();
    const asn1 = forge.asn1.fromDer(derStr);
    const cert = forge.pki.certificateFromAsn1(asn1);

    const issuerStr = cert.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
    const subjectStr = cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');

    const isSelfSigned = issuerStr === subjectStr;
    const basicConstraints = cert.getExtension('basicConstraints') as any;
    const isCA = basicConstraints ? basicConstraints.cA : isSelfSigned;
    const isRoot = isCA && isSelfSigned;
    const isIntermediate = isCA && !isRoot;
    const isLeaf = !isCA;
    const isExpired = new Date() > cert.validity.notAfter;

    const mdSha1 = forge.md.sha1.create();
    mdSha1.update(derStr);
    const fingerprintSha1 = mdSha1.digest().toHex().match(/.{1,2}/g)?.join(':').toUpperCase() || '';

    const mdSha256 = forge.md.sha256.create();
    mdSha256.update(derStr);
    const fingerprintSha256 = mdSha256.digest().toHex().match(/.{1,2}/g)?.join(':').toUpperCase() || '';

    const signatureOid = cert.signatureOid || 'Unknown';
    const signatureAlgorithm = (forge.pki.oids as any)[signatureOid] || signatureOid;

    let publicKeyAlgorithm = 'Unknown';
    let publicKeySize: number | null = null;
    if (cert.publicKey && (cert.publicKey as any).n) {
      publicKeyAlgorithm = 'RSA';
      publicKeySize = (cert.publicKey as any).n.bitLength();
    } else if (cert.publicKey) {
      publicKeyAlgorithm = 'EC / Other';
    }

    const parsedExtensions = (cert.extensions || []).map(ext => {
      let valueStr = '';
      if (typeof ext.value === 'string') {
        valueStr = forge.util.bytesToHex(ext.value).match(/.{1,2}/g)?.join(' ').toUpperCase() || '';
      }
      return {
        name: ext.name || (forge.pki.oids as any)[ext.id] || 'Unknown',
        oid: ext.id,
        critical: ext.critical || false,
        value: valueStr,
      };
    });

    const purposes: string[] = [];
    const keyUsage = cert.getExtension('keyUsage') as any;
    if (keyUsage?.digitalSignature) purposes.push('Digital Signature');
    if (keyUsage?.keyCertSign) purposes.push('Certificate Sign');
    if (keyUsage?.cRLSign) purposes.push('CRL Sign');
    const eku = cert.getExtension('extKeyUsage') as any;
    if (eku?.codeSigning) purposes.push('Code Signing');
    if (eku?.serverAuth) purposes.push('Server Authentication');
    if (eku?.clientAuth) purposes.push('Client Authentication');
    if (eku?.emailProtection) purposes.push('Email Protection');
    if (eku?.timeStamping) purposes.push('Time Stamping');
    if (purposes.length === 0) purposes.push('General Purpose / Not Specified');

    return {
      issuer: issuerStr,
      subject: subjectStr,
      validFrom: cert.validity.notBefore.toISOString(),
      validTo: cert.validity.notAfter.toISOString(),
      serialNumber: cert.serialNumber,
      signatureType: 'X.509',
      pem: forge.pki.certificateToPem(cert),
      isRoot,
      isIntermediate,
      isLeaf,
      isExpired,
      purposes,
      version: cert.version,
      signatureOid,
      signatureAlgorithm,
      publicKeyAlgorithm,
      publicKeySize,
      fingerprintSha1,
      fingerprintSha256,
      extensions: parsedExtensions,
    };
  } catch {
    return null;
  }
}

function subjectCN(cert: ParsedCertificate): string {
  const match = cert.subject.match(/CN=([^,]+)/);
  return match ? match[1].trim() : cert.subject;
}

// ─── Format detection ────────────────────────────────────────────────────────
const JKS_MAGIC = 0xfeedfeed;
const PKCS12_MAGIC_BYTE = 0x30; // ASN.1 SEQUENCE

function detectFormat(bytes: Uint8Array, textContent: string): ParsedTrustStore['format'] {
  // JKS magic: 0xFEEDFEED
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 4 && view.getUint32(0, false) === JKS_MAGIC) return 'JKS';

  // PEM
  if (textContent.includes('-----BEGIN')) {
    if (textContent.includes('BEGIN PKCS7') || textContent.includes('BEGIN PKCS #7')) return 'PKCS7';
    const certCount = (textContent.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
    return certCount > 1 ? 'PEM-Bundle' : 'X509-PEM';
  }

  // DER: first byte 0x30 (ASN.1 SEQUENCE)
  if (bytes.length >= 4 && bytes[0] === PKCS12_MAGIC_BYTE) {
    // Distinguish PKCS12 (OID 1.2.840.113549.1.12) vs plain DER X.509
    // PKCS12 starts with SEQUENCE { INTEGER 3, ... contentInfo ... }
    // We try X.509 first, if it fails try PKCS12
    return 'X509-DER'; // will be refined during parsing
  }

  return 'Unknown';
}

export function parsePemToCerts(pem: string): ParsedCertificate[] {
  const certs: ParsedCertificate[] = [];
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pem)) !== null) {
    try {
      const cert = forge.pki.certificateFromPem(match[0]);
      const derStr = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      const derBuffer = new Uint8Array(derStr.length);
      for (let i = 0; i < derStr.length; i++) derBuffer[i] = derStr.charCodeAt(i);
      const parsed = parseX509FromDer(derBuffer.buffer);
      if (parsed) {
        certs.push(parsed);
      }
    } catch {
      // ignore individual malformed block
    }
  }
  return certs;
}

function parsePemBundle(pem: string): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const entries: TrustStoreEntry[] = [];
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let match: RegExpExecArray | null;
  let idx = 1;
  while ((match = regex.exec(pem)) !== null) {
    try {
      const cert = forge.pki.certificateFromPem(match[0]);
      const derStr = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      const derBuffer = new Uint8Array(derStr.length);
      for (let i = 0; i < derStr.length; i++) derBuffer[i] = derStr.charCodeAt(i);
      const parsed = parseX509FromDer(derBuffer.buffer);
      if (parsed) {
        entries.push({ alias: subjectCN(parsed) || `Certificate ${idx}`, certificate: parsed });
        idx++;
      }
    } catch {
      warnings.push(`Could not parse certificate block #${idx}.`);
      idx++;
    }
  }
  return { entries, warnings };
}

// ─── PKCS#7 parser ───────────────────────────────────────────────────────────
function parsePkcs7(bytes: Uint8Array, isPem: boolean): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const entries: TrustStoreEntry[] = [];
  try {
    let msg: any;
    if (isPem) {
      const text = new TextDecoder().decode(bytes);
      msg = forge.pkcs7.messageFromPem(text);
    } else {
      const derStr = forge.util.createBuffer(bytes as any).getBytes();
      const asn1 = forge.asn1.fromDer(derStr);
      msg = forge.pkcs7.messageFromAsn1(asn1);
    }
    const certs: any[] = msg.certificates || [];
    certs.forEach((forgeCert: any, i: number) => {
      try {
        const derStr2 = forge.asn1.toDer(forge.pki.certificateToAsn1(forgeCert)).getBytes();
        const buf = new Uint8Array(derStr2.length);
        for (let j = 0; j < derStr2.length; j++) buf[j] = derStr2.charCodeAt(j);
        const parsed = parseX509FromDer(buf.buffer);
        if (parsed) entries.push({ alias: subjectCN(parsed) || `Certificate ${i + 1}`, certificate: parsed });
      } catch {
        warnings.push(`Could not parse certificate #${i + 1} from PKCS#7.`);
      }
    });
  } catch (e: any) {
    warnings.push(`PKCS#7 parse error: ${e?.message || e}`);
  }
  return { entries, warnings };
}

// ─── PKCS#12 parser ──────────────────────────────────────────────────────────
function parsePkcs12(bytes: Uint8Array, password: string): { entries: TrustStoreEntry[]; warnings: string[]; needsPassword?: boolean } {
  const warnings: string[] = [];
  const entries: TrustStoreEntry[] = [];
  try {
    const derStr = forge.util.createBuffer(bytes as any).getBytes();
    const asn1 = forge.asn1.fromDer(derStr);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bags: any[] = certBags[forge.pki.oids.certBag] || [];
    bags.forEach((bag: any, i: number) => {
      try {
        const forgeCert = bag.cert;
        if (!forgeCert) return;
        const alias = (bag.attributes?.friendlyName?.[0]) || null;
        const derStr2 = forge.asn1.toDer(forge.pki.certificateToAsn1(forgeCert)).getBytes();
        const buf = new Uint8Array(derStr2.length);
        for (let j = 0; j < derStr2.length; j++) buf[j] = derStr2.charCodeAt(j);
        const parsed = parseX509FromDer(buf.buffer);
        if (parsed) entries.push({ alias: alias || subjectCN(parsed) || `Certificate ${i + 1}`, certificate: parsed });
      } catch {
        warnings.push(`Could not parse certificate bag #${i + 1}.`);
      }
    });

    // Count private key bags - warn but never expose
    const pkBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const pks = pkBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    if (pks.length > 0) {
      warnings.push(`This file contains ${pks.length} private key(s). Private keys are never displayed.`);
      try {
        const pkPem = pks[0].key ? forge.pki.privateKeyToPem(pks[0].key) : undefined;
        if (pkPem && entries.length > 0) entries[0].privateKeyPem = pkPem;
      } catch (e) {
        // ignore
      }
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('Invalid password') || msg.includes('PKCS#12 MAC could not be verified')) {
      return { entries: [], warnings: ['Incorrect password.'], needsPassword: true };
    }
    // May be a DER X.509, not PKCS12 - signal to caller
    return { entries: [], warnings: [`PKCS#12 parse error: ${msg}`] };
  }
  return { entries, warnings };
}

// ─── JKS parser ──────────────────────────────────────────────────────────────
// JKS format (Sun/Oracle Java KeyStore):
//   magic (4) | version (4) | count (4) | entries...
//   Each entry: tag (4) | alias_len (2) | alias (UTF-8) | timestamp (8) | ...
//   tag=1 → private key entry  (skip cert chain, report warning)
//   tag=2 → trusted cert entry → cert_type_len(2) + cert_type + cert_len(4) + cert_der
function parseJks(bytes: Uint8Array): { entries: TrustStoreEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const entries: TrustStoreEntry[] = [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  const magic = view.getUint32(offset, false); offset += 4;
  if (magic !== JKS_MAGIC) {
    return { entries: [], warnings: ['Not a valid JKS file (bad magic number).'] };
  }

  const version = view.getUint32(offset, false); offset += 4;
  if (version !== 1 && version !== 2) {
    warnings.push(`Unexpected JKS version ${version}. Attempting to parse anyway.`);
  }

  const count = view.getUint32(offset, false); offset += 4;

  for (let i = 0; i < count; i++) {
    if (offset + 4 > bytes.length) break;
    const tag = view.getUint32(offset, false); offset += 4;

    // Read alias (2-byte length-prefixed UTF-8)
    const aliasLen = view.getUint16(offset, false); offset += 2;
    const aliasBytes = bytes.slice(offset, offset + aliasLen);
    const alias = new TextDecoder('utf-8').decode(aliasBytes);
    offset += aliasLen;

    // Skip 8-byte timestamp
    offset += 8;

    if (tag === 1) {
      // Private key entry
      // Key: 4-byte encoded key length + data
      if (offset + 4 > bytes.length) break;
      const keyLen = view.getUint32(offset, false); offset += 4;
      const encryptedKeyData = bytes.slice(offset, offset + keyLen);
      offset += keyLen;

      // Cert chain: 4-byte count, then each cert is 2-byte type len + type + 4-byte cert len + cert
      if (offset + 4 > bytes.length) break;
      const chainCount = view.getUint32(offset, false); offset += 4;
      
      let firstCertBytes: Uint8Array | null = null;

      for (let c = 0; c < chainCount; c++) {
        const typeLen = view.getUint16(offset, false); offset += 2;
        offset += typeLen;
        if (offset + 4 > bytes.length) break;
        const certLen = view.getUint32(offset, false); offset += 4;
        const certBytes = bytes.slice(offset, offset + certLen);
        offset += certLen;
        
        if (c === 0) {
          firstCertBytes = certBytes;
        }
      }
      
      warnings.push(`Alias "${alias}": private key is encrypted.`);
      
      if (firstCertBytes) {
        try {
          const buffer = firstCertBytes.buffer.slice(firstCertBytes.byteOffset, firstCertBytes.byteOffset + firstCertBytes.byteLength) as ArrayBuffer;
          const parsed = parseX509FromDer(buffer);
          if (parsed) {
            entries.push({
              alias,
              certificate: parsed,
              isEncryptedJksKey: true,
              encryptedJksKeyData: encryptedKeyData
            });
          }
        } catch(e) {
          warnings.push(`Alias "${alias}": failed to parse private key's certificate.`);
        }
      }

    } else if (tag === 2) {
      // Trusted certificate entry
      const typeLen = view.getUint16(offset, false); offset += 2;
      offset += typeLen; // skip cert type string ("X.509")

      if (offset + 4 > bytes.length) break;
      const certLen = view.getUint32(offset, false); offset += 4;
      const certDer = bytes.slice(offset, offset + certLen);
      offset += certLen;

      const parsed = parseX509FromDer(certDer.buffer.slice(certDer.byteOffset, certDer.byteOffset + certDer.byteLength));
      if (parsed) {
        entries.push({ alias, certificate: parsed });
      } else {
        warnings.push(`Alias "${alias}": could not parse certificate DER.`);
      }
    } else {
      warnings.push(`Unknown JKS entry tag ${tag} at offset ${offset - 14}. Stopping parse.`);
      break;
    }
  }

  if (entries.some(e => e.isEncryptedJksKey)) {
    warnings.unshift('JKS MAC verification skipped. Private keys are encrypted and require a password.');
  }

  return { entries, warnings };
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function parseTrustStoreFile(
  file: File,
  password = ''
): Promise<ParsedTrustStore & { needsPassword?: boolean }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = '';
  try { text = new TextDecoder('utf-8').decode(bytes); } catch { /* binary file */ }

  const format = detectFormat(bytes, text);

  if (format === 'JKS') {
    const { entries, warnings } = parseJks(bytes);
    return { format: 'JKS', entries, warnings };
  }

  if (format === 'PKCS7') {
    const { entries, warnings } = parsePkcs7(bytes, text.includes('-----BEGIN'));
    return { format: 'PKCS7', entries, warnings };
  }

  if (format === 'PEM-Bundle') {
    const { entries, warnings } = parsePemBundle(text);
    return { format: 'PEM-Bundle', entries, warnings };
  }

  if (format === 'X509-PEM') {
    const { entries, warnings } = parsePemBundle(text);
    if (entries.length > 0) return { format: 'X509-PEM', entries, warnings };
    // Maybe it's a PEM-encoded PKCS7
    if (text.includes('BEGIN PKCS')) {
      const r = parsePkcs7(bytes, true);
      return { format: 'PKCS7', ...r };
    }
    return { format: 'Unknown', entries: [], warnings: ['Could not parse PEM file.'] };
  }

  if (format === 'X509-DER') {
    // Try plain DER X.509 first
    const cert = parseX509FromDer(buffer);
    if (cert) {
      return { format: 'X509-DER', entries: [{ alias: subjectCN(cert), certificate: cert }], warnings: [] };
    }

    // Try DER PKCS#7
    const p7 = parsePkcs7(bytes, false);
    if (p7.entries.length > 0) {
      return { format: 'PKCS7', ...p7 };
    }

    // Try DER PKCS#12
    const p12 = parsePkcs12(bytes, password);
    if (p12.needsPassword) {
      return { format: 'PKCS12', entries: [], warnings: p12.warnings, needsPassword: true };
    }
    if (p12.entries.length > 0) {
      return { format: 'PKCS12', ...p12 };
    }

    // If password was supplied and p12 failed, it might need a password
    if (!password) {
      // Try PKCS12 with empty password to check if it needs one
      const p12Check = parsePkcs12(bytes, '');
      if (p12Check.needsPassword) {
        return { format: 'PKCS12', entries: [], warnings: ['This PKCS#12 file requires a password.'], needsPassword: true };
      }
      if (p12Check.entries.length > 0) {
        return { format: 'PKCS12', ...p12Check };
      }
    }

    return { format: 'Unknown', entries: [], warnings: ['Could not parse this DER file as X.509, PKCS#7, or PKCS#12.'] };
  }

  return {
    format: 'Unknown',
    entries: [],
    warnings: [
      'Unrecognized file format. Supported formats: PEM, DER, PKCS#7 (.p7b), PKCS#12 (.p12/.pfx), JKS.',
    ],
  };
}

// -----------------------------------------------------------------------------
// JKS SunJCE Private Key Decryption
// -----------------------------------------------------------------------------
export function decryptJKSPrivateKey(encryptedKeyData: Uint8Array, passwordStr: string): string {
  // Parse EncryptedPrivateKeyInfo ASN.1
  // createBuffer takes binary string or byte array
  const keyStr = String.fromCharCode.apply(null, Array.from(encryptedKeyData));
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(keyStr));
  // obj.value[1].value is the OctetString containing the protected key block
  const protectedKeyStr = (asn1.value as any)[1].value;
  const protectedKey = Uint8Array.from(protectedKeyStr as string, c => c.charCodeAt(0));

  const SALT_LEN = 20;
  const DIGEST_LEN = 20;
  
  if (protectedKey.length < SALT_LEN + DIGEST_LEN) {
    throw new Error('Invalid protected key block length');
  }

  const salt = protectedKey.slice(0, SALT_LEN);
  const encrKeyLen = protectedKey.length - SALT_LEN - DIGEST_LEN;
  const encrKey = protectedKey.slice(SALT_LEN, SALT_LEN + encrKeyLen);

  const numRounds = Math.ceil(encrKeyLen / DIGEST_LEN);
  let xorKey = new Uint8Array(numRounds * DIGEST_LEN);

  // Convert password to UTF-16BE bytes
  const passwdBytes = new Uint8Array(passwordStr.length * 2);
  for (let i = 0, j = 0; i < passwordStr.length; i++) {
    const code = passwordStr.charCodeAt(i);
    passwdBytes[j++] = code >> 8;
    passwdBytes[j++] = code & 0xff;
  }

  let digest = salt;
  let xorOffset = 0;

  for (let i = 0; i < numRounds; i++) {
    const md = forge.md.sha1.create();
    md.update(forge.util.createBuffer(passwdBytes).getBytes());
    md.update(forge.util.createBuffer(digest).getBytes());
    
    const digestStr = md.digest().getBytes();
    digest = Uint8Array.from(digestStr, c => c.charCodeAt(0));
    
    xorKey.set(digest, xorOffset);
    xorOffset += DIGEST_LEN;
  }

  // XOR to get plain key
  const plainKey = new Uint8Array(encrKey.length);
  for (let i = 0; i < plainKey.length; i++) {
    plainKey[i] = encrKey[i] ^ xorKey[i];
  }

  // Verify MAC
  const md = forge.md.sha1.create();
  md.update(forge.util.createBuffer(passwdBytes).getBytes());
  md.update(forge.util.createBuffer(plainKey).getBytes());
  const finalDigestStr = md.digest().getBytes();
  const finalDigest = Uint8Array.from(finalDigestStr, c => c.charCodeAt(0));

  const expectedDigest = protectedKey.slice(SALT_LEN + encrKeyLen);
  for (let i = 0; i < DIGEST_LEN; i++) {
    if (finalDigest[i] !== expectedDigest[i]) {
      throw new Error('Cannot recover key: Incorrect password');
    }
  }

  // Parse plainKey as PKCS#8
  const plainAsn1 = forge.asn1.fromDer(forge.util.createBuffer(plainKey));
  const privateKey = forge.pki.privateKeyFromAsn1(plainAsn1);
  return forge.pki.privateKeyToPem(privateKey);
}
