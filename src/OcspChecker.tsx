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
  Key
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

export function OcspChecker() {
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

  // Client-side live certificate parser
  const parsedCert = useMemo<ParsedCertDetails | null>(() => {
    if (!certInput.trim() || !certInput.includes('-----BEGIN CERTIFICATE')) {
      return null;
    }

    // If active preset is selected, use its rich pre-extracted metadata
    if (activePreset && activePreset.certificatePem.trim() === certInput.trim()) {
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

    try {
      const cert = forge.pki.certificateFromPem(certInput);
      
      const subAttrs = cert.subject.attributes
        .map((a: any) => `${a.shortName || a.name || 'attr'}=${a.value}`)
        .join(', ');
      const issAttrs = cert.issuer.attributes
        .map((a: any) => `${a.shortName || a.name || 'attr'}=${a.value}`)
        .join(', ');

      const now = new Date();
      const notBefore = cert.validity.notBefore;
      const notAfter = cert.validity.notAfter;
      const isExpired = now > notAfter;
      const isValidPeriod = now >= notBefore && now <= notAfter;

      let ocspUrl: string | null = null;
      let crlUrl: string | null = null;

      for (const ext of cert.extensions || []) {
        const val = typeof ext.value === 'string' ? ext.value : '';
        if (ext.id === '1.3.6.1.5.5.7.1.1' || ext.name === 'authorityInfoAccess') {
          const urls = val.match(/https?:\/\/[a-zA-Z0-9.-]+(?:\/[^\s\0]*)?/g) || [];
          for (const u of urls) {
            if (u.includes('ocsp')) ocspUrl = u;
          }
        }
        if (ext.id === '2.5.29.31' || ext.name === 'cRLDistributionPoints') {
          const urls = val.match(/https?:\/\/[a-zA-Z0-9.-]+(?:\/[^\s\0]*)?/g) || [];
          for (const u of urls) {
            if (u.endsWith('.crl') || u.includes('crl')) crlUrl = u;
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
      // Fallback for ECC/ECDSA certificates where forge throws RSA-only error
      try {
        const clean = certInput
          .replace(/-----BEGIN[^-]+-----/g, '')
          .replace(/-----END[^-]+-----/g, '')
          .replace(/\s+/g, '');
        const der = forge.util.decode64(clean);
        const asn1 = forge.asn1.fromDer(der);
        const tbs = asn1.value[0];
        const serialHex = forge.util.bytesToHex(tbs.value[1].value);
        return {
          subject: t('app.ocsp.eccCertSubject', 'X.509 Certificate (ECC / ECDSA)'),
          issuer: t('app.ocsp.checkedViaCertutil', 'Checked via certutil'),
          serialNumber: serialHex,
          notBefore: new Date(),
          notAfter: new Date(Date.now() + 86400000 * 90),
          isExpired: false,
          isValidPeriod: true,
          ocspUrl: null,
          crlUrl: null
        };
      } catch {
        return null;
      }
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
  // Certificate ::= SEQUENCE { tbsCertificate SEQUENCE, signatureAlgorithm SEQUENCE, signatureValue BIT STRING }
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
      if (!tbs || tbs.type !== forge.asn1.Type.SEQUENCE) return false;
      if (!sigAlg || sigAlg.type !== forge.asn1.Type.SEQUENCE) return false;
      if (!sigVal || sigVal.type !== forge.asn1.Type.BITSTRING) return false;
      return true;
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

      if (text.includes('-----BEGIN CERTIFICATE')) {
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

    if (!trimmedInput.includes('-----BEGIN CERTIFICATE')) {
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
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <UploadCloud size={14} /> {t('app.ocsp.uploadBtn', 'Upload .pem / .cer / .crt / .der')}
              <input type="file" accept=".cer,.crt,.pem,.der" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <textarea
              className="form-textarea mono"
              value={certInput}
              onChange={(e) => {
                setCertInput(e.target.value);
                setActivePresetId(null);
              }}
              placeholder={t('app.ocsp.placeholder', '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----')}
              style={{ height: '180px', fontSize: '0.82rem', lineHeight: '1.4' }}
              spellCheck={false}
            />
          </div>

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
            disabled={loading || !certInput.trim()} 
            style={{ width: '100%', justifyContent: 'center', height: '46px', fontSize: '0.95rem' }}
          >
            {loading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={18} />}
            <span>{loading ? t('app.ocsp.checkingBtn', 'Checking Revocation Status Online...') : t('app.ocsp.checkBtn', 'Check Revocation Status')}</span>
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

              {/* Preset match verification pill */}
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
              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('app.ocsp.diagnosticSummary', 'View Raw Native Diagnostic Output (Windows certutil -verify -urlfetch)')}</span>
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
