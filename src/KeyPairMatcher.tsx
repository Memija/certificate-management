import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Shield, CheckCircle, XCircle, FileKey, Sparkles, Trash2, Hash } from 'lucide-react';
import * as forge from 'node-forge';
import { KEY_MATCHER_PRESETS } from './utils/keyMatcherSamples';
import type { KeyMatcherSamplePreset } from './utils/keyMatcherSamples';

interface KeyModulusInfo {
  type: string;
  bits: number;
  modulusHex: string;
  sha256: string;
}

function computeModulusSha256(hex: string): string {
  try {
    const md = forge.md.sha256.create();
    md.update(forge.util.hexToBytes(hex));
    return md.digest().toHex();
  } catch {
    return '';
  }
}

export function KeyPairMatcher() {
  const { t } = useTranslation();
  const [certInput, setCertInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  const [certStatus, setCertStatus] = useState<string | null>(null);
  const [certIsError, setCertIsError] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [keyIsError, setKeyIsError] = useState(false);
  const [certInfo, setCertInfo] = useState<KeyModulusInfo | null>(null);
  const [keyInfo, setKeyInfo] = useState<KeyModulusInfo | null>(null);

  const [matchResult, setMatchResult] = useState<boolean | null>(null);

  const formatErrorMessage = (rawMsg?: string) => {
    const msg = rawMsg || '';
    if (
      !msg ||
      msg.includes('Invalid PEM formatted message') ||
      msg.includes('header') ||
      msg.includes('base64') ||
      msg.includes('ASN.1') ||
      msg.includes('DER') ||
      msg.includes('Cannot read')
    ) {
      return t('app.keyMatcher.invalidPem', 'Invalid PEM formatted message.');
    }
    if (msg.includes('No RSA public key found in CSR')) {
      return t('app.keyMatcher.noRsaInCsr', 'No RSA public key found in CSR.');
    }
    if (msg.includes('No RSA public key found in Certificate')) {
      return t('app.keyMatcher.noRsaInCert', 'No RSA public key found in Certificate.');
    }
    return msg;
  };

  const executeMatch = (certText: string, keyText: string) => {
    let certModulus = '';
    let keyModulus = '';
    let cInfo: KeyModulusInfo | null = null;
    let kInfo: KeyModulusInfo | null = null;
    
    setCertStatus(null);
    setCertIsError(false);
    setKeyStatus(null);
    setKeyIsError(false);
    setCertInfo(null);
    setKeyInfo(null);
    setMatchResult(null);

    // Parse Cert/CSR
    try {
      if (certText.includes('CERTIFICATE REQUEST')) {
        const csr = forge.pki.certificationRequestFromPem(certText);
        if (csr.publicKey && (csr.publicKey as any).n) {
          certModulus = (csr.publicKey as any).n.toString(16);
          const bits = (csr.publicKey as any).n.bitLength();
          cInfo = {
            type: 'CSR',
            bits,
            modulusHex: certModulus,
            sha256: computeModulusSha256(certModulus),
          };
          setCertInfo(cInfo);
          setCertIsError(false);
          setCertStatus(t('app.keyMatcher.validCsrParsed', { bits, defaultValue: `Valid CSR parsed (RSA ${bits} bits).` }));
        } else {
          throw new Error(t('app.keyMatcher.noRsaInCsr', 'No RSA public key found in CSR.'));
        }
      } else {
        const cert = forge.pki.certificateFromPem(certText);
        if (cert.publicKey && (cert.publicKey as any).n) {
          certModulus = (cert.publicKey as any).n.toString(16);
          const bits = (cert.publicKey as any).n.bitLength();
          cInfo = {
            type: 'Certificate',
            bits,
            modulusHex: certModulus,
            sha256: computeModulusSha256(certModulus),
          };
          setCertInfo(cInfo);
          setCertIsError(false);
          setCertStatus(t('app.keyMatcher.validCertParsed', { bits, defaultValue: `Valid Certificate parsed (RSA ${bits} bits).` }));
        } else {
          throw new Error(t('app.keyMatcher.noRsaInCert', 'No RSA public key found in Certificate.'));
        }
      }
    } catch (e: any) {
      setCertIsError(true);
      setCertStatus(`${t('common.error', 'Error')}: ${formatErrorMessage(e?.message)}`);
      return;
    }

    // Parse Private Key
    try {
      const privateKey = forge.pki.privateKeyFromPem(keyText);
      if ((privateKey as any).n) {
        keyModulus = (privateKey as any).n.toString(16);
        const bits = (privateKey as any).n.bitLength();
        kInfo = {
          type: 'Private Key',
          bits,
          modulusHex: keyModulus,
          sha256: computeModulusSha256(keyModulus),
        };
        setKeyInfo(kInfo);
        setKeyIsError(false);
        setKeyStatus(t('app.keyMatcher.validKeyParsed', { bits, defaultValue: `Valid RSA Private Key parsed (${bits} bits).` }));
      } else {
        throw new Error(t('app.keyMatcher.rsaOnlySupported', 'Only RSA keys are currently supported for matching.'));
      }
    } catch (e: any) {
      setKeyIsError(true);
      setKeyStatus(`${t('common.error', 'Error')}: ${formatErrorMessage(e?.message)}`);
      return;
    }

    if (certModulus === keyModulus) {
      setMatchResult(true);
    } else {
      setMatchResult(false);
    }
  };

  const handleMatch = () => {
    executeMatch(certInput, keyInput);
  };

  const loadPreset = (preset: KeyMatcherSamplePreset) => {
    setActivePreset(preset.id);
    setCertInput(preset.certOrCsr);
    setKeyInput(preset.privateKey);
    executeMatch(preset.certOrCsr, preset.privateKey);
  };

  const handleClear = () => {
    setActivePreset(null);
    setCertInput('');
    setKeyInput('');
    setCertStatus(null);
    setCertIsError(false);
    setKeyStatus(null);
    setKeyIsError(false);
    setCertInfo(null);
    setKeyInfo(null);
    setMatchResult(null);
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.keyMatcher.title', 'Key Pair Modulus Matcher')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {t('app.keyMatcher.subtitle', 'Paste a Certificate (or CSR) and a Private Key in PEM format to mathematically verify if their RSA public key moduli match.')}
          </p>
        </div>

        {/* ─── Test Sample Presets Bar ─── */}
        <div
          className="glass-panel"
          style={{
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--card-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.25rem' }}>
            <Sparkles size={15} style={{ color: 'var(--accent-color)' }} />
            {t('app.keyMatcher.tryExamples', 'Try Test Examples:')}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
            {KEY_MATCHER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`chain-sample-pill${activePreset === preset.id ? ' active' : ''}`}
                onClick={() => loadPreset(preset)}
                title={preset.description}
              >
                <span>{preset.name}</span>
                {preset.badge && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: preset.expectedMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: preset.expectedMatch ? 'var(--success-color)' : 'var(--danger-color)',
                      fontWeight: 600,
                    }}
                  >
                    {preset.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {(certInput || keyInput) && (
            <button
              type="button"
              className="chain-sample-pill"
              onClick={handleClear}
              style={{ color: 'var(--danger-color)' }}
              title={t('app.keyMatcher.clearInputs', 'Clear both inputs')}
            >
              <Trash2 size={13} />
              {t('common.clear', 'Clear')}
            </button>
          )}
        </div>

        <div className="responsive-grid-2" style={{ gap: '1.5rem' }}>
          {/* ─── Left Box: Certificate or CSR ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                <Shield size={18} style={{ color: 'var(--accent-color)' }} /> {t('app.keyMatcher.certOrCsr', 'Certificate or CSR (PEM)')}
              </h3>
              {certInfo && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-color)' }}>
                  RSA {certInfo.bits}-bit
                </span>
              )}
            </div>

            <textarea
              className="form-textarea mono"
              value={certInput}
              onChange={e => {
                setCertInput(e.target.value);
                setActivePreset(null);
              }}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              style={{ height: '240px', fontSize: '0.82rem' }}
            />
            {certStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', fontWeight: 500, color: certIsError ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {certStatus}
              </div>
            )}
            {certInfo && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--input-bg)', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <Hash size={12} /> {t('app.keyMatcher.modulusSha256', 'Modulus SHA-256:')}
                </div>
                <div style={{ wordBreak: 'break-all' }}>{certInfo.sha256}</div>
              </div>
            )}
          </div>

          {/* ─── Right Box: Private Key ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                <FileKey size={18} style={{ color: 'var(--warning-color)' }} /> {t('app.keyMatcher.privateKey', 'Private Key (PEM)')}
              </h3>
              {keyInfo && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.12)', color: 'var(--warning-color)' }}>
                  RSA {keyInfo.bits}-bit
                </span>
              )}
            </div>

            <textarea
              className="form-textarea mono"
              value={keyInput}
              onChange={e => {
                setKeyInput(e.target.value);
                setActivePreset(null);
              }}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              style={{ height: '240px', fontSize: '0.82rem' }}
            />
            {keyStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', fontWeight: 500, color: keyIsError ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {keyStatus}
              </div>
            )}
            {keyInfo && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--input-bg)', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <Hash size={12} /> {t('app.keyMatcher.modulusSha256', 'Modulus SHA-256:')}
                </div>
                <div style={{ wordBreak: 'break-all' }}>{keyInfo.sha256}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn" onClick={handleMatch} disabled={!certInput || !keyInput} style={{ height: '44px', padding: '0 2rem' }}>
            <Key size={18} /> {t('app.keyMatcher.verifyMatch', 'Verify Modulus Match')}
          </button>
        </div>

        {matchResult !== null && (
          <div className="glass-panel animate-fade-in" style={{ 
            marginTop: '2rem', 
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            background: matchResult ? 'var(--success-bg)' : 'var(--danger-bg)',
            borderColor: matchResult ? 'var(--success-border)' : 'var(--danger-border)'
          }}>
            <div className={`metric-icon-wrap ${matchResult ? 'success' : 'danger'}`} style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 1.25rem' }}>
              {matchResult ? (
                <CheckCircle size={32} />
              ) : (
                <XCircle size={32} />
              )}
            </div>
            <h3 style={{ color: matchResult ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>
              {matchResult
                ? t('app.keyMatcher.matchSuccess', 'The Private Key matches the Certificate/CSR!')
                : t('app.keyMatcher.matchFailed', 'The Private Key DOES NOT match the Certificate/CSR.')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>
              {matchResult
                ? t('app.keyMatcher.matchSuccessDesc', 'Both the public key modulus in the certificate/CSR and the private key modulus match bit-for-bit.')
                : t('app.keyMatcher.matchFailedDesc', 'The cryptographic modulus differs. This private key cannot be used with this certificate.')}
            </p>

            {/* Cryptographic Comparison Details */}
            {certInfo && keyInfo && (
              <div
                style={{
                  maxWidth: '700px',
                  margin: '0 auto',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                  border: '1px solid var(--glass-border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                  {t('app.keyMatcher.comparisonTitle', 'Cryptographic Modulus Comparison')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.4rem', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('app.keyMatcher.certHash', 'Cert/CSR Hash:')}</span>
                  <span style={{ wordBreak: 'break-all', color: matchResult ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {certInfo.sha256}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('app.keyMatcher.keyHash', 'Private Key Hash:')}</span>
                  <span style={{ wordBreak: 'break-all', color: matchResult ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {keyInfo.sha256}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('app.keyMatcher.bitLength', 'Bit Length:')}</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {certInfo.bits} bits (Cert) vs {keyInfo.bits} bits (Key)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

