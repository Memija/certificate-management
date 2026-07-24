import forge from 'node-forge';

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

export interface EfiSignatureData {
  signatureOwner: string;
  certificate?: ParsedCertificate;
  hashData?: string;
  rawData: Uint8Array;
}

export interface EfiSignatureList {
  signatureTypeGuid: string;
  signatureTypeName: string;
  signatureListSize: number;
  signatureHeaderSize: number;
  signatureSize: number;
  signatures: EfiSignatureData[];
}

const GUID_MAP: Record<string, string> = {
  'c1c41626-504c-4092-aca9-41f936934328': 'EFI_CERT_SHA256_GUID',
  '3c5766e8-269c-4e34-aa14-ed776e85b3b6': 'EFI_CERT_RSA2048_GUID',
  'e2b36190-879b-4a3d-ad8d-f2e7bbaf1327': 'EFI_CERT_RSA2048_SHA256_GUID',
  '826ca512-cf10-4ac9-b187-be01496631bd': 'EFI_CERT_SHA1_GUID',
  '67f8444f-8743-48f1-a328-1eaaab873603': 'EFI_CERT_RSA2048_SHA1_GUID',
  'a5c059a1-94e4-4aa7-87b5-ab155c2bf072': 'EFI_CERT_X509_GUID',
  '0b6e5233-a65c-44c9-9407-d9ab83bfd8bd': 'EFI_CERT_SHA224_GUID',
  'ff3e536c-9fd0-42c9-aba8-b197175f7e02': 'EFI_CERT_SHA384_GUID',
  '093e0fae-a6c4-4f50-9f1b-d41e2b89c19a': 'EFI_CERT_SHA512_GUID',
  '3bd2a492-96c0-4079-b420-bcefc98cb1b2': 'EFI_CERT_X509_SHA256_GUID',
  '7076876e-80c2-4ee6-aa3d-f68444a5e01c': 'EFI_CERT_X509_SHA384_GUID',
  '446dbf63-2502-4cda-bcfa-2465d2b0fe9d': 'EFI_CERT_X509_SHA512_GUID',
};

function readGuid(view: DataView, offset: number): string {
  const data1 = view.getUint32(offset, true).toString(16).padStart(8, '0');
  const data2 = view.getUint16(offset + 4, true).toString(16).padStart(4, '0');
  const data3 = view.getUint16(offset + 6, true).toString(16).padStart(4, '0');
  
  const data4_1 = view.getUint16(offset + 8, false).toString(16).padStart(4, '0');
  const data4_2 = view.getUint32(offset + 10, false).toString(16).padStart(8, '0');
  const data4_3 = view.getUint16(offset + 14, false).toString(16).padStart(4, '0');

  return `${data1}-${data2}-${data3}-${data4_1}-${data4_2}${data4_3}`;
}

function parseX509Certificate(derBuffer: ArrayBuffer): ParsedCertificate | undefined {
  try {
    const derStr = forge.util.createBuffer(new Uint8Array(derBuffer)).getBytes();
    const asn1 = forge.asn1.fromDer(derStr);
    const cert = forge.pki.certificateFromAsn1(asn1);

    const issuerStr = cert.issuer.attributes
      .map(a => `${a.shortName || a.name}=${a.value}`)
      .join(', ');
      
    const subjectStr = cert.subject.attributes
      .map(a => `${a.shortName || a.name}=${a.value}`)
      .join(', ');

    // Determine if it's a CA
    const basicConstraints = cert.getExtension('basicConstraints') as any;
    const isCA = basicConstraints ? basicConstraints.cA : false;

    // Determine Root vs Intermediate vs Leaf
    const isRoot = isCA && (issuerStr === subjectStr);
    const isIntermediate = isCA && !isRoot;
    const isLeaf = !isCA;

    // Check expiration
    const isExpired = new Date() > cert.validity.notAfter;

    const mdSha1 = forge.md.sha1.create();
    mdSha1.update(derStr);
    const fingerprintSha1 = mdSha1.digest().toHex().match(/.{1,2}/g)?.join(':').toUpperCase() || '';

    const mdSha256 = forge.md.sha256.create();
    mdSha256.update(derStr);
    const fingerprintSha256 = mdSha256.digest().toHex().match(/.{1,2}/g)?.join(':').toUpperCase() || '';

    const version = cert.version;
    const signatureOid = cert.signatureOid || 'Unknown';
    const signatureAlgorithm = (forge.pki.oids as any)[signatureOid] || signatureOid;
    
    let publicKeyAlgorithm = 'Unknown';
    let publicKeySize: number | null = null;
    if (cert.publicKey) {
        if ((cert.publicKey as any).n) {
            publicKeyAlgorithm = 'RSA';
            publicKeySize = (cert.publicKey as any).n.bitLength();
        } else {
            publicKeyAlgorithm = 'Other';
        }
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
           value: valueStr
        };
    });

    // Parse purposes from Extended Key Usage (EKU) and Key Usage
    const purposes: string[] = [];
    
    const keyUsage = cert.getExtension('keyUsage') as any;
    if (keyUsage && keyUsage.digitalSignature) purposes.push("Digital Signature");
    if (keyUsage && keyUsage.keyCertSign) purposes.push("Certificate Sign");
    if (keyUsage && keyUsage.cRLSign) purposes.push("CRL Sign");

    const eku = cert.getExtension('extKeyUsage') as any;
    if (eku && eku.codeSigning) purposes.push("Code Signing");
    if (eku && eku.serverAuth) purposes.push("Server Authentication");
    if (eku && eku.clientAuth) purposes.push("Client Authentication");
    if (eku && eku.emailProtection) purposes.push("Email Protection");
    if (eku && eku.timeStamping) purposes.push("Time Stamping");
    
    // Custom EFI/Microsoft purposes could be added here by checking OIDs, e.g.
    // 1.3.6.1.4.1.311.10.3.6 (Windows Hardware Driver Verification)
    
    if (purposes.length === 0) {
      purposes.push("General Purpose / Not Specified");
    }

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
      version,
      signatureOid,
      signatureAlgorithm,
      publicKeyAlgorithm,
      publicKeySize,
      fingerprintSha1,
      fingerprintSha256,
      extensions: parsedExtensions
    };
  } catch (e) {
    console.error("Failed to parse X509 certificate:", e);
    return undefined;
  }
}

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

export function parseEfiSignatureLists(buffer: ArrayBuffer): EfiSignatureList[] {
  const lists: EfiSignatureList[] = [];
  const view = new DataView(buffer);
  let offset = 0;

  while (offset + 28 <= buffer.byteLength) {
    const signatureTypeGuid = readGuid(view, offset);
    const signatureTypeName = GUID_MAP[signatureTypeGuid] || 'UNKNOWN_GUID';
    
    const signatureListSize = view.getUint32(offset + 16, true);
    const signatureHeaderSize = view.getUint32(offset + 20, true);
    const signatureSize = view.getUint32(offset + 24, true);

    if (signatureListSize === 0 || offset + signatureListSize > buffer.byteLength) {
      console.warn('Invalid signature list size or end of buffer reached.');
      break;
    }

    const signatures: EfiSignatureData[] = [];
    let sigOffset = offset + 28 + signatureHeaderSize;
    const endOffset = offset + signatureListSize;

    while (sigOffset + signatureSize <= endOffset) {
      const signatureOwner = readGuid(view, sigOffset);
      const dataSize = signatureSize - 16;
      const dataOffset = sigOffset + 16;
      const rawData = new Uint8Array(buffer.slice(dataOffset, dataOffset + dataSize));
      
      let certificate: ParsedCertificate | undefined;
      let hashData: string | undefined;

      if (signatureTypeName === 'EFI_CERT_X509_GUID') {
        certificate = parseX509Certificate(rawData.buffer);
      } else {
        hashData = toHexString(rawData);
      }

      signatures.push({
        signatureOwner,
        rawData,
        certificate,
        hashData
      });

      sigOffset += signatureSize;
    }

    lists.push({
      signatureTypeGuid,
      signatureTypeName,
      signatureListSize,
      signatureHeaderSize,
      signatureSize,
      signatures
    });

    offset += signatureListSize;
  }

  return lists;
}

export function parseRawX509(buffer: ArrayBuffer): ParsedCertificate | null {
    const cert = parseX509Certificate(buffer);
    if (cert) {
        return cert;
    }
    return null;
}
