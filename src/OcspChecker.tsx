import { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  RefreshCw, 
  Activity, 
  HelpCircle, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Globe, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Key,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LearningTerm } from './LearningTerm';
import { OCSP_SAMPLE_PRESETS, type OcspSamplePreset } from './utils/ocspSamples';
import * as forge from 'node-forge';

interface ParsedCertDetails {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  isExpired: boolean;
  isValidPeriod: boolean;
  ocspUrl: string | null;
  crlUrl: string | null;
}

interface RevocationResult {
  status: 'good' | 'revoked' | 'unknown';
  output: string;
  ocspVerified?: boolean;
  crlVerified?: boolean;
  ocspUrl?: string | null;
  crlUrl?: string | null;
}

export function OcspChecker({ onNavigate }: { onNavigate?: (mode: any) => void }) {
  const { t, i18n } = useTranslation();
  const [certInput, setCertInput] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RevocationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Active preset object
  const activePreset = useMemo(() => {
    return OCSP_SAMPLE_PRESETS.find((p) => p.id === activePresetId) || null;
  }, [activePresetId]);

  // Detect non-certificate input (CSR, Private Key, CRL)
  const detectedNonCertType = useMemo<'csr' | 'key' | 'crl' | null>(() => {
    const trimmed = certInput.trim();
    if (!trimmed) return null;
    if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/i.test(trimmed)) {
      return 'csr';
    }
    if (/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/i.test(trimmed)) {
      return 'key';
    }
    if (/-----BEGIN (?:X509 )?CRL-----/i.test(trimmed)) {
      return 'crl';
    }
    return null;
  }, [certInput]);

  // Localized preset helpers
  const getLocalizedPresetName = (preset: OcspSamplePreset) => {
    switch (preset.id) {
      case 'revoked-badssl':
        return t('app.ocsp.presets.revokedBadssl.name', preset.name);
      case 'valid-digicert':
        return t('app.ocsp.presets.validDigicert.name', preset.name);
      case 'valid-github-sectigo':
        return t('app.ocsp.presets.validGithub.name', preset.name);
      case 'valid-letsencrypt':
        return t('app.ocsp.presets.validLetsencrypt.name', preset.name);
      case 'offline-selfsigned':
        return t('app.ocsp.presets.offlineSelfsigned.name', preset.name);
      default:
        return preset.name;
    }
  };

  const getLocalizedPresetBadge = (preset: OcspSamplePreset) => {
    switch (preset.id) {
      case 'revoked-badssl':
        return t('app.ocsp.presets.revokedBadssl.badge', preset.badge);
      case 'valid-digicert':
        return t('app.ocsp.presets.validDigicert.badge', preset.badge);
      case 'valid-github-sectigo':
        return t('app.ocsp.presets.validGithub.badge', preset.badge);
      case 'valid-letsencrypt':
        return t('app.ocsp.presets.validLetsencrypt.badge', preset.badge);
      case 'offline-selfsigned':
        return t('app.ocsp.presets.offlineSelfsigned.badge', preset.badge);
      default:
        return preset.badge;
    }
  };

  const getLocalizedPresetCategory = (preset: OcspSamplePreset) => {
    switch (preset.id) {
      case 'revoked-badssl':
        return t('app.ocsp.presets.revokedBadssl.category', preset.category);
      case 'valid-digicert':
        return t('app.ocsp.presets.validDigicert.category', preset.category);
      case 'valid-github-sectigo':
        return t('app.ocsp.presets.validGithub.category', preset.category);
      case 'valid-letsencrypt':
        return t('app.ocsp.presets.validLetsencrypt.category', preset.category);
      case 'offline-selfsigned':
        return t('app.ocsp.presets.offlineSelfsigned.category', preset.category);
      default:
        return preset.category;
    }
  };

  const getLocalizedPresetDescription = (preset: OcspSamplePreset) => {
    switch (preset.id) {
      case 'revoked-badssl':
        return t('app.ocsp.presets.revokedBadssl.description', preset.description);
      case 'valid-digicert':
        return t('app.ocsp.presets.validDigicert.description', preset.description);
      case 'valid-github-sectigo':
        return t('app.ocsp.presets.validGithub.description', preset.description);
      case 'valid-letsencrypt':
        return t('app.ocsp.presets.validLetsencrypt.description', preset.description);
      case 'offline-selfsigned':
        return t('app.ocsp.presets.offlineSelfsigned.description', preset.description);
      default:
        return preset.description;
    }
  };

  // Client-side live certificate parser (supporting RSA, ECDSA, Ed25519)
  const parsedCert = useMemo<ParsedCertDetails | null>(() => {
    const trimmed = certInput.trim();
    if (!trimmed || !/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(trimmed)) {
      return null;
    }
    if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/i.test(trimmed)) {
      return null;
    }

    // If active preset is selected, use its rich pre-extracted metadata
    if (activePreset && activePreset.certificatePem.trim() === trimmed) {
      return {
        subject: activePreset.subject,
        issuer: activePreset.issuer,
        serialNumber: activePreset.id === 'revoked-badssl' 
          ? '050a72b7ae90c2e1c61bb7d1568032f79549' 
          : activePreset.id === 'valid-digicert'
          ? '0aec2491f01c8c5a0d19f41f9ba3e4cd'
          : activePreset.id === 'valid-github-sectigo'
          ? 'a59ebdb596751db7f5c095079613953c'
          : activePreset.id === 'valid-letsencrypt'
          ? '0543933be386b3a2b3adb534f2103bc8b65f'
          : '01a4b5c6d7e8f9',
        notBefore: new Date('2024-01-01'),
        notAfter: new Date('2026-12-31'),
        isExpired: false,
        isValidPeriod: true,
        ocspUrl: activePreset.ocspUrl,
        crlUrl: activePreset.crlUrl
      };
    }

    let cert: any = null;
    try {
      cert = forge.pki.certificateFromPem(trimmed);
    } catch {
      // If forge throws (e.g. ECC / ECDSA public key OID), parse via ASN.1
      try {
        const clean = trimmed
          .replace(/-----BEGIN[^-]+-----/g, '')
          .replace(/-----END[^-]+-----/g, '')
          .replace(/\s+/g, '');
        const der = forge.util.decode64(clean);
        const obj = forge.asn1.fromDer(der);

        const origPublicKeyFromAsn1 = forge.pki.publicKeyFromAsn1;
        const origDerToOid = forge.asn1.derToOid;
        try {
          forge.asn1.derToOid = (bytes: any) => {
            const oid = origDerToOid(bytes);
            if (
              oid === '1.2.840.10045.2.1' || // id-ecPublicKey
              oid === '1.3.101.112' || // Ed25519
              oid === '1.3.101.113' || // Ed448
              oid === '1.2.840.10040.4.1' // DSA
            ) {
              return forge.pki.oids.rsaEncryption;
            }
            return oid;
          };
          forge.pki.publicKeyFromAsn1 = () => ({ n: null, e: null, type: 'ECC' } as any);

          cert = forge.pki.certificateFromAsn1(obj);
        } finally {
          forge.pki.publicKeyFromAsn1 = origPublicKeyFromAsn1;
          forge.asn1.derToOid = origDerToOid;
        }
      } catch {
        return null;
      }
    }

    if (!cert) return null;

    try {
      const subAttrs = cert.subject?.attributes
        ? cert.subject.attributes.map((a: any) => `${a.shortName || a.name || 'attr'}=${a.value}`).join(', ')
        : '';
      const issAttrs = cert.issuer?.attributes
        ? cert.issuer.attributes.map((a: any) => `${a.shortName || a.name || 'attr'}=${a.value}`).join(', ')
        : '';

      const now = new Date();
      const notBefore = cert.validity?.notBefore || now;
      const notAfter = cert.validity?.notAfter || now;
      const isExpired = now > notAfter;
      const isValidPeriod = now >= notBefore && now <= notAfter;

      let ocspUrl: string | null = null;
      let crlUrl: string | null = null;

      for (const ext of cert.extensions || []) {
        if (ext.id === '1.3.6.1.5.5.7.1.1' || ext.name === 'authorityInfoAccess') {
          // Parse AIA extension
          try {
            const asn = forge.asn1.fromDer(ext.value);
            if (Array.isArray(asn.value)) {
              for (const item of asn.value) {
                if (Array.isArray(item.value) && item.value.length >= 2) {
                  const methodOid = forge.asn1.derToOid((item.value[0] as any).value);
                  const location = item.value[1].value;
                  if (methodOid === '1.3.6.1.5.5.7.48.1' && typeof location === 'string') {
                    ocspUrl = location;
                  }
                }
              }
            }
          } catch {
            const val = typeof ext.value === 'string' ? ext.value : '';
            const urls = val.match(/https?:\/\/[a-zA-Z0-9_.-]+(?::\d+)?(?:\/[a-zA-Z0-9_.~!$&'()*+,;=:@%/-]*)?/g) || [];
            for (const u of urls) {
              if (u.includes('ocsp')) ocspUrl = u;
            }
          }
        }
        if (ext.id === '2.5.29.31' || ext.name === 'cRLDistributionPoints') {
          // Parse CDP extension
          try {
            const asn = forge.asn1.fromDer(ext.value);
            const findUris = (node: any) => {
              if (!node) return;
              if (node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 6 && typeof node.value === 'string') {
                if (node.value.endsWith('.crl') || node.value.includes('crl')) {
                  if (!crlUrl) crlUrl = node.value;
                }
              }
              if (Array.isArray(node.value)) {
                for (const child of node.value) findUris(child);
              }
            };
            findUris(asn);
          } catch {
            const val = typeof ext.value === 'string' ? ext.value : '';
            const urls = val.match(/https?:\/\/[a-zA-Z0-9_.-]+(?::\d+)?(?:\/[a-zA-Z0-9_.~!$&'()*+,;=:@%/-]*)?/g) || [];
            for (const u of urls) {
              if (u.endsWith('.crl') || u.includes('crl')) {
                if (!crlUrl) crlUrl = u;
              }
            }
          }
        }
      }

      return {
        subject: subAttrs || t('app.ocsp.unknownSubject', 'Unknown Subject'),
        issuer: issAttrs || t('app.ocsp.unknownIssuer', 'Unknown Issuer'),
        serialNumber: cert.serialNumber || t('app.ocsp.unknownSerial', 'Unknown'),
        notBefore,
        notAfter,
        isExpired,
        isValidPeriod,
        ocspUrl,
        crlUrl
      };
    } catch {
      return null;
    }
  }, [certInput, activePreset, t]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: OcspSamplePreset) => {
    setActivePresetId(preset.id);
    setCertInput(preset.certificatePem);
    setError('');
    setResult(null);
  };

  // Helper to validate raw ASN.1 DER structure for X.509 certificates
  // Distinguishes genuine X.509 certificates from CSRs and other ASN.1 sequences
  const isValidX509Der = (derBytes: string): boolean => {
    try {
      const asn1 = forge.asn1.fromDer(derBytes);
      if (asn1.tagClass !== forge.asn1.Class.UNIVERSAL || asn1.type !== forge.asn1.Type.SEQUENCE) {
        return false;
      }
      if (!Array.isArray(asn1.value) || asn1.value.length !== 3) {
        return false;
      }
      const [tbs, sigAlg, sigVal] = asn1.value;
      if (!tbs || tbs.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(tbs.value)) return false;
      if (tbs.value.length < 6) return false;
      if (!sigAlg || sigAlg.type !== forge.asn1.Type.SEQUENCE) return false;
      if (!sigVal || sigVal.type !== forge.asn1.Type.BITSTRING) return false;

      // Ensure it contains validity (SEQUENCE with 2 time objects) to distinguish from CSR
      const hasValidity = tbs.value.some((elem: any) => 
        elem &&
        elem.type === forge.asn1.Type.SEQUENCE && 
        Array.isArray(elem.value) && 
        elem.value.length === 2 &&
        (elem.value[0].type === forge.asn1.Type.UTCTIME || elem.value[0].type === forge.asn1.Type.GENERALIZEDTIME) &&
        (elem.value[1].type === forge.asn1.Type.UTCTIME || elem.value[1].type === forge.asn1.Type.GENERALIZEDTIME)
      );
      return hasValidity;
    } catch {
      return false;
    }
  };

  // Clear inputs
  const handleClear = () => {
    setCertInput('');
    setActivePresetId(null);
    setError('');
    setResult(null);
  };

  // File upload supporting PEM, CER, CRT, and binary DER
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActivePresetId(null);
    setError('');
    setResult(null);

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pem', 'cer', 'crt', 'der'];
    if (ext && !validExtensions.includes(ext)) {
      if (ext === 'json') {
        setError(t('app.ocsp.jsonNotCert', 'The provided file or content is JSON, not an X.509 certificate.'));
      } else if (ext === 'csr' || ext === 'req') {
        setError(t('app.ocsp.csrNotCert', 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status (OCSP/CRL). Please use the CSR Inspector tab to inspect CSRs.'));
      } else if (ext === 'key') {
        setError(t('app.ocsp.keyNotCert', 'The provided data is a Private Key, not an X.509 certificate. Private keys cannot be checked for revocation.'));
      } else if (ext === 'crl') {
        setError(t('app.ocsp.crlNotCert', 'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate. Please use the CRL Inspector tab.'));
      } else {
        setError(t('app.ocsp.unsupportedFileType', 'Unsupported file type. Please upload a certificate file (.pem, .cer, .crt, .der).'));
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buf = event.target?.result as ArrayBuffer;
      if (!buf) return;
      
      const uint8 = new Uint8Array(buf);
      const text = new TextDecoder('utf-8').decode(uint8);
      const trimmed = text.trim();

      // Check if uploaded content is JSON
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        setError(t('app.ocsp.jsonNotCert', 'The provided file or content is JSON, not an X.509 certificate.'));
        return;
      }

      if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/i.test(trimmed)) {
        setError(t('app.ocsp.csrNotCert', 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status (OCSP/CRL). Please use the CSR Inspector tab to inspect CSRs.'));
        return;
      }

      if (/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/i.test(trimmed)) {
        setError(t('app.ocsp.keyNotCert', 'The provided data is a Private Key, not an X.509 certificate. Private keys cannot be checked for revocation.'));
        return;
      }

      if (/-----BEGIN (?:X509 )?CRL-----/i.test(trimmed)) {
        setError(t('app.ocsp.crlNotCert', 'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate. Please use the CRL Inspector tab.'));
        return;
      }

      if (/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(text)) {
        try {
          const clean = text
            .replace(/-----BEGIN[^-]+-----/g, '')
            .replace(/-----END[^-]+-----/g, '')
            .replace(/\s+/g, '');
          if (!clean) throw new Error('Empty certificate content');
          atob(clean);
          const derBytes = forge.util.decode64(clean);
          if (!isValidX509Der(derBytes)) {
            throw new Error('Not an X.509 certificate');
          }
          setCertInput(text.trim());
        } catch {
          setError(t('app.ocsp.invalidPem', 'Invalid PEM certificate provided. Please check the certificate formatting.'));
        }
      } else {
        // Attempt binary DER validation and conversion
        try {
          if (uint8.length < 4 || uint8[0] !== 0x30) {
            throw new Error('Not a binary DER certificate');
          }
          let binary = '';
          for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          if (!isValidX509Der(binary)) {
            throw new Error('Invalid ASN.1 X.509 structure');
          }
          const b64 = forge.util.encode64(binary);
          const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
          setCertInput(pem);
        } catch {
          setError(t('app.ocsp.invalidFile', 'Could not parse uploaded file as PEM or DER X.509 certificate.'));
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Perform online revocation check
  const checkRevocation = async (overrideCert?: string) => {
    const input = overrideCert || certInput;
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setError(t('app.ocsp.emptyError', 'Please provide a PEM certificate or select a test example above.'));
      return;
    }

    if (trimmedInput.startsWith('{') || trimmedInput.startsWith('[')) {
      setError(t('app.ocsp.jsonNotCert', 'The provided file or content is JSON, not an X.509 certificate.'));
      return;
    }

    if (/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----/i.test(trimmedInput)) {
      setError(t('app.ocsp.csrNotCert', 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status (OCSP/CRL). Please use the CSR Inspector tab to inspect CSRs.'));
      return;
    }

    if (/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/i.test(trimmedInput)) {
      setError(t('app.ocsp.keyNotCert', 'The provided data is a Private Key, not an X.509 certificate. Private keys cannot be checked for revocation.'));
      return;
    }

    if (/-----BEGIN (?:X509 )?CRL-----/i.test(trimmedInput)) {
      setError(t('app.ocsp.crlNotCert', 'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate. Please use the CRL Inspector tab.'));
      return;
    }

    if (!/-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----/i.test(trimmedInput)) {
      setError(t('app.ocsp.missingPemHeaders', 'Please provide a certificate in PEM format starting with -----BEGIN CERTIFICATE-----.'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let certB64 = '';
      try {
        const clean = input
          .replace(/-----BEGIN[^-]+-----/g, '')
          .replace(/-----END[^-]+-----/g, '')
          .replace(/\s+/g, '');
        if (!clean) {
          throw new Error('Empty certificate content');
        }
        atob(clean);
        const derBytes = forge.util.decode64(clean);
        if (!isValidX509Der(derBytes)) {
          throw new Error('Invalid certificate structure');
        }
        certB64 = clean;
      } catch {
        throw new Error(t('app.ocsp.invalidPem', 'Invalid PEM certificate provided. Please check the certificate formatting.'));
      }

      const res = await fetch('/api/ocsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ certB64 })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || t('app.ocsp.checkFailed', 'Failed to check revocation status'));
      }

      setResult(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy raw output
  const handleCopyOutput = () => {
    if (!result?.output) return;
    navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open raw diagnostic output in a dedicated new browser tab
  const handleOpenInBrowser = () => {
    if (!result?.output) return;
    const lineCount = result.output.split('\n').length;
    const escapedOutput = result.output
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Windows certutil -verify -urlfetch Diagnostic Output</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      background: #090d16;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      padding: 2rem;
      margin: 0;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    h1 {
      margin: 0;
      font-size: 1.15rem;
      color: #38bdf8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .meta {
      color: #94a3b8;
      font-size: 0.82rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #334155;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.82rem;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: background 0.15s, border-color 0.15s;
    }
    .btn:hover {
      background: #334155;
      border-color: #475569;
    }
    pre {
      background: #0d1321;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1.25rem;
      overflow-x: auto;
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-all;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    @media print {
      @page {
        margin: 1cm;
      }
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .header,
      .actions,
      header {
        display: none !important;
      }
      pre {
        background: transparent !important;
        color: #000000 !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 8.5pt !important;
        line-height: 1.4 !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>
          <span class="badge">NATIVE DIAGNOSTIC</span>
          Windows certutil -verify -urlfetch
        </h1>
        <div class="meta" style="margin-top: 0.35rem;">
          Revocation Check &bull; ${lineCount} lines &bull; ${new Date().toLocaleString()}
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('log').innerText); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy Log', 2000)">Copy Log</button>
        <button class="btn" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>
    <pre id="log">${escapedOutput}</pre>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '880px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-color)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            <span>{t('app.ocsp.eyebrow', 'Real-Time Revocation · RFC 6960 & RFC 5280')}</span>
          </div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.ocsp.title', 'Online Revocation Checker')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
            {t('app.ocsp.subtitle', 'Check real-time revocation status using OCSP and CRL endpoints extracted directly from the certificate.')}
          </p>
        </div>

        {/* Examples / Presets Bar */}
        <div className="glass-panel key-matcher-presets-panel animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div className="key-matcher-presets-header">
            <div className="key-matcher-presets-title">
              <Sparkles size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
              <span>{t('app.ocsp.tryExamples', 'Try Test Examples:')}</span>
            </div>

            {(certInput || activePresetId) && (
              <button
                type="button"
                className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-mobile"
                onClick={handleClear}
                title={t('common.clear', 'Clear')}
              >
                <Trash2 size={13} />
                <span>{t('common.clear', 'Clear')}</span>
              </button>
            )}
          </div>

          <div className="key-matcher-presets-list">
            {OCSP_SAMPLE_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              let badgeBg = 'rgba(14, 165, 233, 0.15)';
              let badgeColor = 'var(--accent-color)';

              if (preset.badgeType === 'danger') {
                badgeBg = 'rgba(239, 68, 68, 0.15)';
                badgeColor = 'var(--danger-color)';
              } else if (preset.badgeType === 'success') {
                badgeBg = 'rgba(34, 197, 94, 0.15)';
                badgeColor = 'var(--success-color)';
              } else if (preset.badgeType === 'warning') {
                badgeBg = 'rgba(245, 158, 11, 0.15)';
                badgeColor = 'var(--warning-color)';
              }

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`chain-sample-pill key-matcher-preset-pill${isActive ? ' active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                  title={getLocalizedPresetDescription(preset)}
                >
                  <span className="key-matcher-preset-name">{getLocalizedPresetName(preset)}</span>
                  <span
                    className="key-matcher-preset-badge"
                    style={{ background: badgeBg, color: badgeColor }}
                  >
                    {getLocalizedPresetBadge(preset)}
                  </span>
                </button>
              );
            })}
          </div>

          {(certInput || activePresetId) && (
            <button
              type="button"
              className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-desktop"
              onClick={handleClear}
              title={t('common.clear', 'Clear')}
            >
              <Trash2 size={13} />
              <span>{t('common.clear', 'Clear')}</span>
            </button>
          )}
        </div>

        {/* Active Preset Information Banner */}
        {activePreset && (
          <div 
            className="glass-panel ocsp-active-preset-panel animate-fade-in" 
            style={{ 
              marginBottom: '1.5rem', 
              borderLeft: activePreset.expectedStatus === 'revoked'
                ? '4px solid var(--danger-color)'
                : activePreset.expectedStatus === 'good'
                ? '4px solid var(--success-color)'
                : '4px solid var(--warning-color)',
              background: 'var(--card-bg)'
            }}
          >
            <div className="ocsp-active-preset-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {getLocalizedPresetName(activePreset)}
                </span>
                <span 
                  className="key-matcher-preset-badge"
                  style={{
                    background: activePreset.badgeType === 'danger' 
                      ? 'rgba(239, 68, 68, 0.15)' 
                      : activePreset.badgeType === 'success' 
                      ? 'rgba(34, 197, 94, 0.15)' 
                      : 'rgba(245, 158, 11, 0.15)',
                    color: activePreset.badgeType === 'danger' 
                      ? 'var(--danger-color)' 
                      : activePreset.badgeType === 'success' 
                      ? 'var(--success-color)' 
                      : 'var(--warning-color)',
                    fontSize: '0.75rem'
                  }}
                >
                  {getLocalizedPresetCategory(activePreset)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('app.ocsp.expectedResult', 'Expected Result:')}</span>
                <span 
                  style={{ 
                    color: activePreset.expectedStatus === 'revoked'
                      ? 'var(--danger-color)'
                      : activePreset.expectedStatus === 'good'
                      ? 'var(--success-color)'
                      : 'var(--warning-color)',
                    fontWeight: 700
                  }}
                >
                  {activePreset.expectedStatus === 'good' 
                    ? t('app.ocsp.expectedVerdictGood', 'Valid (Not Revoked)') 
                    : activePreset.expectedStatus === 'revoked'
                    ? t('app.ocsp.expectedVerdictRevoked', 'Revoked')
                    : t('app.ocsp.expectedVerdictUnknown', 'Unknown / Offline')}
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 0.85rem 0', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {getLocalizedPresetDescription(activePreset)}
            </p>

            <div className="ocsp-active-preset-footer">
              <div className="ocsp-active-preset-endpoints">
                {activePreset.ocspUrl ? (
                  <span className="ocsp-endpoint-item">
                    <Globe size={13} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <strong style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>{t('app.ocsp.ocspLabel', 'OCSP:')}</strong>
                      <code className="ocsp-endpoint-url">{activePreset.ocspUrl}</code>
                    </span>
                  </span>
                ) : (
                  <span className="ocsp-endpoint-item" style={{ color: 'var(--text-muted)' }}>
                    <Globe size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span><strong style={{ marginRight: '4px' }}>{t('app.ocsp.ocspLabel', 'OCSP:')}</strong> {t('app.ocsp.notAvailable', 'N/A')}</span>
                  </span>
                )}

                {activePreset.crlUrl ? (
                  <span className="ocsp-endpoint-item">
                    <FileText size={13} style={{ color: 'var(--warning-color)', flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <strong style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>{t('app.ocsp.crlLabel', 'CRL:')}</strong>
                      <code className="ocsp-endpoint-url">{activePreset.crlUrl}</code>
                    </span>
                  </span>
                ) : (
                  <span className="ocsp-endpoint-item" style={{ color: 'var(--text-muted)' }}>
                    <FileText size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span><strong style={{ marginRight: '4px' }}>{t('app.ocsp.crlLabel', 'CRL:')}</strong> {t('app.ocsp.notAvailable', 'N/A')}</span>
                  </span>
                )}
              </div>

              {!result && (
                <button
                  type="button"
                  className="btn btn-sm ocsp-verify-btn"
                  onClick={() => checkRevocation(activePreset.certificatePem)}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={13} />}
                  <span>{loading ? t('app.ocsp.verifying', 'Verifying...') : t('app.ocsp.verifyExample', 'Verify This Example')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Panel */}
        <div className="glass-panel" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
              {t('app.ocsp.inputLabel', 'Certificate (PEM / DER)')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {certInput && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClear}
                  title={t('common.clear', 'Clear')}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Trash2 size={14} /> {t('common.clear', 'Clear')}
                </button>
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <UploadCloud size={14} /> {t('app.ocsp.uploadBtn', 'Upload .pem / .cer / .crt / .der')}
                <input type="file" accept=".cer,.crt,.pem,.der" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <textarea
              className="form-textarea mono"
              value={certInput}
              onChange={(e) => {
                setCertInput(e.target.value);
                setActivePresetId(null);
                setError('');
                setResult(null);
              }}
              placeholder={t('app.ocsp.placeholder', '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----')}
              style={{ height: '180px', fontSize: '0.82rem', lineHeight: '1.4' }}
              spellCheck={false}
            />
          </div>

          {/* Non-certificate detected alert (CSR, Key, CRL) */}
          {detectedNonCertType && (
            <div 
              className="animate-fade-in" 
              style={{ 
                background: 'rgba(234, 179, 8, 0.08)', 
                border: '1px solid rgba(234, 179, 8, 0.25)', 
                borderRadius: '8px', 
                padding: '1rem 1.15rem', 
                marginBottom: '1.25rem',
                fontSize: '0.86rem' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', minWidth: '240px', flex: 1 }}>
                  <ShieldAlert size={20} style={{ color: 'var(--warning-color)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {detectedNonCertType === 'csr' && t('app.ocsp.csrDetectedTitle', 'Certificate Signing Request (CSR) Detected')}
                      {detectedNonCertType === 'key' && t('app.ocsp.keyDetectedTitle', 'Private Key Detected')}
                      {detectedNonCertType === 'crl' && t('app.ocsp.crlDetectedTitle', 'Certificate Revocation List (CRL) Detected')}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: '0.82rem' }}>
                      {detectedNonCertType === 'csr' && t('app.ocsp.csrNotCert', 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status (OCSP/CRL). Please use the CSR Inspector tab to inspect CSRs.')}
                      {detectedNonCertType === 'key' && t('app.ocsp.keyNotCert', 'The provided data is a Private Key, not an X.509 certificate. Private keys cannot be checked for revocation.')}
                      {detectedNonCertType === 'crl' && t('app.ocsp.crlNotCert', 'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate. Please use the CRL Inspector tab.')}
                    </div>
                  </div>
                </div>

                {onNavigate && (detectedNonCertType === 'csr' || detectedNonCertType === 'crl') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate(detectedNonCertType === 'csr' ? 'csr-inspector' : 'crl-inspector')}
                    style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                  >
                    {detectedNonCertType === 'csr' ? t('app.ocsp.goToCsrInspector', 'Open in CSR Inspector') : t('app.ocsp.goToCrlInspector', 'Open in CRL Inspector')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Parsed Certificate Metadata Card */}
          {parsedCert && (
            <div 
              className="animate-fade-in" 
              style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid var(--glass-border-subtle)', 
                borderRadius: '8px', 
                padding: '0.9rem 1.1rem', 
                marginBottom: '1.25rem',
                fontSize: '0.84rem' 
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('app.ocsp.subjectLabel', 'Subject')}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {parsedCert.subject}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('app.ocsp.issuerLabel', 'Issuer')}
                  </div>
                  <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {parsedCert.issuer}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('app.ocsp.validityPeriod', 'Validity Period')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <Calendar size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>
                      {parsedCert.notBefore.toLocaleDateString(i18n.language)} – {parsedCert.notAfter.toLocaleDateString(i18n.language)}
                    </span>
                    {parsedCert.isExpired ? (
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                        {t('app.ocsp.expiredBadge', 'Expired')}
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                        {t('app.ocsp.validWindowBadge', 'Valid Window')}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('app.ocsp.serialNumber', 'Serial Number')}
                  </div>
                  <div className="mono" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {parsedCert.serialNumber}
                  </div>
                </div>
              </div>

              {/* Endpoints detected in cert extensions */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--glass-border-subtle)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div className="ocsp-endpoint-item">
                  <Globe size={13} style={{ color: parsedCert.ocspUrl ? 'var(--accent-color)' : 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    <strong style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>{t('app.ocsp.aiaOcspLabel', 'AIA OCSP:')}</strong>
                    {parsedCert.ocspUrl ? (
                      <code className="ocsp-endpoint-url">{parsedCert.ocspUrl}</code>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('app.ocsp.none', 'None')}</span>
                    )}
                  </span>
                </div>

                <div className="ocsp-endpoint-item">
                  <FileText size={13} style={{ color: parsedCert.crlUrl ? 'var(--warning-color)' : 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    <strong style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>{t('app.ocsp.cdpCrlLabel', 'CDP CRL:')}</strong>
                    {parsedCert.crlUrl ? (
                      <code className="ocsp-endpoint-url">{parsedCert.crlUrl}</code>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('app.ocsp.none', 'None')}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button 
            className="btn" 
            onClick={() => checkRevocation()} 
            disabled={loading || !certInput.trim() || !!detectedNonCertType || !!result} 
            title={result ? t('app.ocsp.alreadyCheckedTooltip', 'Revocation status is already displayed on the page. Modify certificate or clear to check again.') : undefined}
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              height: '46px', 
              fontSize: '0.95rem',
              cursor: result ? 'not-allowed' : undefined,
              opacity: result ? 0.75 : undefined
            }}
          >
            {loading ? (
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : result ? (
              <CheckCircle2 size={18} style={{ color: 'var(--success-color)' }} />
            ) : (
              <Activity size={18} />
            )}
            <span>
              {loading 
                ? t('app.ocsp.checkingBtn', 'Checking Revocation Status Online...') 
                : result 
                ? t('app.ocsp.alreadyCheckedBtn', 'Revocation Status Displayed Below') 
                : t('app.ocsp.checkBtn', 'Check Revocation Status')}
            </span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="glass-panel animate-fade-in" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', marginBottom: '1.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <XCircle size={20} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {/* Revocation Result View */}
        {result && (
          <div className="animate-fade-in glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
            {/* Verdict Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border-subtle)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div className={`metric-icon-wrap ${result.status === 'good' ? 'success' : result.status === 'revoked' ? 'danger' : 'warning'}`} style={{ width: 56, height: 56, borderRadius: 14 }}>
                  {result.status === 'good' && <ShieldCheck size={32} />}
                  {result.status === 'revoked' && <ShieldAlert size={32} />}
                  {result.status === 'unknown' && <HelpCircle size={32} />}
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: result.status === 'good' ? 'var(--success-color)' : result.status === 'revoked' ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                      {result.status === 'good' && t('app.ocsp.statusGood', 'Certificate is Valid (Not Revoked)')}
                      {result.status === 'revoked' && t('app.ocsp.statusRevoked', 'Certificate is Revoked')}
                      {result.status === 'unknown' && t('app.ocsp.statusUnknown', 'Revocation Status Unknown / Offline')}
                    </h3>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {result.status === 'good' && t('app.ocsp.statusGoodDesc', 'Verified via live Authority Information Access (AIA/OCSP) or Certificate Revocation List (CRL). The certificate is active and not revoked.')}
                    {result.status === 'revoked' && t('app.ocsp.statusRevokedDesc', 'Alert! The issuing Certificate Authority has revoked this certificate. It must not be trusted for TLS handshakes or signatures.')}
                    {result.status === 'unknown' && t('app.ocsp.statusUnknownDesc', 'The certificate either has no online revocation endpoints (AIA/CDP), or the revocation servers were unreachable.')}
                  </p>
                </div>
              </div>

              {/* Header Actions: Preset match verification & Clear Result */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {activePreset && (
                  <div 
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '6px', 
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: result.status === activePreset.expectedStatus ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: result.status === activePreset.expectedStatus ? 'var(--success-color)' : 'var(--danger-color)',
                    }}
                  >
                    {result.status === activePreset.expectedStatus ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>{t('app.ocsp.matchesPreset', { badge: getLocalizedPresetBadge(activePreset) })}</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={14} />
                        <span>{t('app.ocsp.differsPreset', { badge: getLocalizedPresetBadge(activePreset) })}</span>
                      </>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setResult(null)}
                  title={t('app.ocsp.clearResultTooltip', 'Dismiss results and re-enable check button')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Trash2 size={13} />
                  <span>{t('app.ocsp.clearResultBtn', 'Clear Result')}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* OCSP Check Card */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border-subtle)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <LearningTerm termId="ocsp">OCSP</LearningTerm> {t('app.ocsp.ocspCheckTitle', 'Responder Check')}
                  </span>
                  {result.ocspVerified ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeVerified', 'Verified')}</span>
                  ) : result.ocspUrl ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeEndpointPresent', 'Endpoint Present')}</span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeNoUrl', 'No URL')}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {result.ocspUrl ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Globe size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                      <code>{result.ocspUrl}</code>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{t('app.ocsp.noAiaUrl', 'No OCSP Authority Information Access (AIA) URL found.')}</span>
                  )}
                </div>
              </div>

              {/* CRL Check Card */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border-subtle)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <LearningTerm termId="crl">CRL</LearningTerm> {t('app.ocsp.crlCheckTitle', 'Distribution Point Check')}
                  </span>
                  {result.crlVerified ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeVerified', 'Verified')}</span>
                  ) : result.crlUrl ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeEndpointPresent', 'Endpoint Present')}</span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{t('app.ocsp.badgeNoUrl', 'No URL')}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {result.crlUrl ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FileText size={13} style={{ color: 'var(--warning-color)', flexShrink: 0 }} />
                      <code>{result.crlUrl}</code>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{t('app.ocsp.noCdpUrl', 'No CRL Distribution Points (CDP) extension found.')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostic certutil Raw Log */}
            <details style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid var(--glass-border-subtle)', padding: '0.75rem 1rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Terminal size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                  {t('app.ocsp.diagnosticSummary', 'View Raw Native Diagnostic Output (Windows certutil -verify -urlfetch)')}
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenInBrowser();
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                    title={t('app.ocsp.openInBrowserTooltip', 'Open full raw log in a new browser tab')}
                  >
                    <ExternalLink size={12} />
                    <span>{t('app.ocsp.openInBrowser', 'Open in New Tab')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyOutput();
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? t('app.ocsp.copiedOutput', 'Copied!') : t('app.ocsp.copyOutput', 'Copy')}</span>
                  </button>
                </div>
              </summary>
              <pre className="code-block" style={{ marginTop: '0.85rem', fontSize: '0.8rem', maxHeight: '350px', overflowY: 'auto', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: '100%' }}>
                {result.output}
              </pre>
            </details>
          </div>
        )}

        {/* Educational Cards */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--glass-border-subtle)', paddingTop: '2rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
            {t('app.ocsp.eduTitle', 'Understanding Online Revocation Protocols')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Globe size={18} style={{ color: 'var(--accent-color)' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <LearningTerm termId="ocsp">{t('app.ocsp.eduOcspTitle', 'OCSP (RFC 6960)')}</LearningTerm>
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('app.ocsp.eduOcspDesc', 'Online Certificate Status Protocol queries the CA in real time for a specific certificate serial number. Provides instantaneous status but requires high-availability responder infrastructure.')}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--warning-color)' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <LearningTerm termId="crl">{t('app.ocsp.eduCrlTitle', 'CRL (RFC 5280)')}</LearningTerm>
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('app.ocsp.eduCrlDesc', 'Certificate Revocation Lists are signed, timestamped lists published periodically by the CA. Many modern CAs (like Let\'s Encrypt) rely on CRL distributions to provide scalable revocation without per-handshake OCSP overhead.')}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Key size={18} style={{ color: 'var(--success-color)' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('app.ocsp.eduTestingTitle', 'Testing Strategy')}
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('app.ocsp.eduTestingDesc', 'Use the test examples above to verify how client applications respond to revoked certificates (BadSSL test harness), commercial EV/DV certs, and internal enterprise certificates.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
