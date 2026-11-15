/**
 * Sample Presets for Certificate Format Converter (PEM <-> DER) and PFX Builder.
 */

import * as forge from 'node-forge';
import {
  SAMPLE_MATCHING_CERT_PEM,
  SAMPLE_MATCHING_KEY_PEM,
  SAMPLE_RSA4096_CERT_PEM,
  SAMPLE_RSA4096_KEY_PEM,
} from './keyMatcherSamples';

export interface PemDerSamplePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  filename: string;
  contentType: 'cert' | 'key';
  outputFormat: 'pem' | 'der';
  isBinary: boolean;
  createFile: () => File;
  getContent: () => string | ArrayBuffer;
}

export interface PfxSamplePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  certPem: string;
  keyPem: string;
  defaultPassword: string;
  keyBits: number;
  commonName: string;
}

// ─── Lazy Cached DER Buffers ─────────────────────────────────────────────────
let cachedCertDer: ArrayBuffer | null = null;
export function getSampleCertDerBuffer(): ArrayBuffer {
  if (!cachedCertDer) {
    const cert = forge.pki.certificateFromPem(SAMPLE_MATCHING_CERT_PEM);
    const asn1 = forge.pki.certificateToAsn1(cert);
    const derStr = forge.asn1.toDer(asn1).getBytes();
    const bytes = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) {
      bytes[i] = derStr.charCodeAt(i);
    }
    cachedCertDer = bytes.buffer;
  }
  return cachedCertDer.slice(0);
}

let cachedKeyDer: ArrayBuffer | null = null;
export function getSampleKeyDerBuffer(): ArrayBuffer {
  if (!cachedKeyDer) {
    const key = forge.pki.privateKeyFromPem(SAMPLE_MATCHING_KEY_PEM);
    const asn1 = forge.pki.privateKeyToAsn1(key);
    const derStr = forge.asn1.toDer(asn1).getBytes();
    const bytes = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) {
      bytes[i] = derStr.charCodeAt(i);
    }
    cachedKeyDer = bytes.buffer;
  }
  return cachedKeyDer.slice(0);
}

// ─── PEM <-> DER Presets ─────────────────────────────────────────────────────
export const PEM_DER_PRESETS: PemDerSamplePreset[] = [
  {
    id: 'cert-pem-to-der',
    name: 'Cert (PEM → DER)',
    badge: 'PEM → DER',
    description: 'Sample X.509 Certificate in Base64 PEM text to convert into raw binary DER',
    filename: 'sample_webserver_cert.pem',
    contentType: 'cert',
    outputFormat: 'der',
    isBinary: false,
    createFile: () => new File([SAMPLE_MATCHING_CERT_PEM], 'sample_webserver_cert.pem', { type: 'application/x-pem-file' }),
    getContent: () => SAMPLE_MATCHING_CERT_PEM,
  },
  {
    id: 'cert-der-to-pem',
    name: 'Cert (DER → PEM)',
    badge: 'DER → PEM',
    description: 'Sample X.509 Certificate in binary DER format to convert into Base64 PEM text',
    filename: 'sample_webserver_cert.der',
    contentType: 'cert',
    outputFormat: 'pem',
    isBinary: true,
    createFile: () => {
      const buf = getSampleCertDerBuffer();
      return new File([buf], 'sample_webserver_cert.der', { type: 'application/x-x509-ca-cert' });
    },
    getContent: () => getSampleCertDerBuffer(),
  },
  {
    id: 'key-pem-to-der',
    name: 'Key (PEM → DER)',
    badge: 'PEM → DER',
    description: 'Sample RSA Private Key in Base64 PEM text to convert into raw binary DER',
    filename: 'sample_rsa_key.pem',
    contentType: 'key',
    outputFormat: 'der',
    isBinary: false,
    createFile: () => new File([SAMPLE_MATCHING_KEY_PEM], 'sample_rsa_key.pem', { type: 'application/x-pem-file' }),
    getContent: () => SAMPLE_MATCHING_KEY_PEM,
  },
  {
    id: 'key-der-to-pem',
    name: 'Key (DER → PEM)',
    badge: 'DER → PEM',
    description: 'Sample RSA Private Key in binary DER format to convert into Base64 PEM text',
    filename: 'sample_rsa_key.der',
    contentType: 'key',
    outputFormat: 'pem',
    isBinary: true,
    createFile: () => {
      const buf = getSampleKeyDerBuffer();
      return new File([buf], 'sample_rsa_key.der', { type: 'application/octet-stream' });
    },
    getContent: () => getSampleKeyDerBuffer(),
  },
];

// ─── PFX Builder Presets ─────────────────────────────────────────────────────
export const PFX_PRESETS: PfxSamplePreset[] = [
  {
    id: 'pfx-rsa2048',
    name: 'Web Server (RSA 2048)',
    badge: '2048-bit',
    description: 'Matching Web Server certificate (CN=matcher.example.com) & 2048-bit RSA key with sample password "export123"',
    certPem: SAMPLE_MATCHING_CERT_PEM,
    keyPem: SAMPLE_MATCHING_KEY_PEM,
    defaultPassword: 'export123',
    keyBits: 2048,
    commonName: 'matcher.example.com',
  },
  {
    id: 'pfx-rsa4096',
    name: 'Enterprise Vault (RSA 4096)',
    badge: '4096-bit',
    description: 'High-security 4096-bit Enterprise Vault certificate & matching key with sample password "vault2026"',
    certPem: SAMPLE_RSA4096_CERT_PEM,
    keyPem: SAMPLE_RSA4096_KEY_PEM,
    defaultPassword: 'vault2026',
    keyBits: 4096,
    commonName: 'enterprise-vault.example.com',
  },
];
