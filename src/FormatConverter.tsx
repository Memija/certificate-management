import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileArchive,
  Download,
  Upload,
  Shield,
  Key,
  Sparkles,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Binary,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import * as forge from 'node-forge';
import { useToast } from './ToastContext';
import {
  PEM_DER_PRESETS,
  PFX_PRESETS,
  type PemDerSamplePreset,
  type PfxSamplePreset,
} from './utils/formatConverterSamples';

type ConvertMode = 'pem-der' | 'pfx';

export function FormatConverter() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [mode, setMode] = useState<ConvertMode>('pem-der');

  // PEM <-> DER state
  const [file1, setFile1] = useState<File | null>(null);
  const [file1Content, setFile1Content] = useState<string | ArrayBuffer | null>(null);
  const [convertType, setConvertType] = useState<'cert' | 'key'>('cert');
  const [outputFormat, setOutputFormat] = useState<'pem' | 'der'>('der');
  const [activePemDerPreset, setActivePemDerPreset] = useState<string | null>(null);
  const file1InputRef = useRef<HTMLInputElement>(null);

  // PFX state
  const [certInput, setCertInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activePfxPreset, setActivePfxPreset] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ─── Format File Size Helper ────────────────────────────────────────────────
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // ─── Preset Handlers ────────────────────────────────────────────────────────
  const handleSelectPemDerPreset = (preset: PemDerSamplePreset) => {
    try {
      const f = preset.createFile();
      const content = preset.getContent();
      setFile1(f);
      setFile1Content(content);
      setConvertType(preset.contentType);
      setOutputFormat(preset.outputFormat);
      setActivePemDerPreset(preset.id);
      setError('');
      setMessage('');
      if (file1InputRef.current) file1InputRef.current.value = '';

      const localizedName = getLocalizedPemDerPresetName(preset);
      showToast(t('app.formatConverter.presetLoaded', `Loaded "${localizedName}" preset`, { name: localizedName }), 'info');
    } catch (e: any) {
      setError(t('app.formatConverter.conversionFailed', `Conversion failed: ${e.message}`, { error: e.message }));
    }
  };

  const handleClearPemDer = () => {
    setFile1(null);
    setFile1Content(null);
    setActivePemDerPreset(null);
    setError('');
    setMessage('');
    if (file1InputRef.current) file1InputRef.current.value = '';
  };

  const handleSelectPfxPreset = (preset: PfxSamplePreset) => {
    setCertInput(preset.certPem);
    setKeyInput(preset.keyPem);
    setPfxPassword(preset.defaultPassword);
    setActivePfxPreset(preset.id);
    setError('');
    setMessage('');

    const localizedName = getLocalizedPfxPresetName(preset);
    showToast(t('app.formatConverter.presetLoaded', `Loaded "${localizedName}" preset`, { name: localizedName }), 'info');
  };

  const handleClearPfx = () => {
    setCertInput('');
    setKeyInput('');
    setPfxPassword('');
    setActivePfxPreset(null);
    setError('');
    setMessage('');
  };

  const getLocalizedPemDerPresetName = (preset: PemDerSamplePreset) => {
    switch (preset.id) {
      case 'cert-pem-to-der':
        return t('app.formatConverter.presetCertPemToDer', preset.name);
      case 'cert-der-to-pem':
        return t('app.formatConverter.presetCertDerToPem', preset.name);
      case 'key-pem-to-der':
        return t('app.formatConverter.presetKeyPemToDer', preset.name);
      case 'key-der-to-pem':
        return t('app.formatConverter.presetKeyDerToPem', preset.name);
      default:
        return preset.name;
    }
  };

  const getLocalizedPfxPresetName = (preset: PfxSamplePreset) => {
    switch (preset.id) {
      case 'pfx-rsa2048':
        return t('app.formatConverter.presetPfxRsa2048', preset.name);
      case 'pfx-rsa4096':
        return t('app.formatConverter.presetPfxRsa4096', preset.name);
      default:
        return preset.name;
    }
  };

  // ─── File Upload Handler ────────────────────────────────────────────────────
  const handleFile1Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile1(f);
      setActivePemDerPreset(null);
      setError('');
      setMessage('');

      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const buffer = evt.target.result as ArrayBuffer;
          const bytes = new Uint8Array(buffer);
          let preview = '';
          for (let i = 0; i < Math.min(bytes.length, 120); i++) {
            preview += String.fromCharCode(bytes[i]);
          }

          if (preview.includes('-----BEGIN')) {
            // It's ASCII PEM
            const text = new TextDecoder('utf-8').decode(buffer);
            setFile1Content(text);
            setOutputFormat('der');
            if (text.includes('PRIVATE KEY') || f.name.toLowerCase().includes('key')) {
              setConvertType('key');
            } else {
              setConvertType('cert');
            }
          } else {
            // It's binary DER
            setFile1Content(buffer);
            setOutputFormat('pem');
            if (f.name.toLowerCase().includes('key')) {
              setConvertType('key');
            } else {
              setConvertType('cert');
            }
          }
        }
      };
      reader.readAsArrayBuffer(f);
    }
  };

  // ─── PEM <-> DER Conversion ─────────────────────────────────────────────────
  const handlePemDerConvert = () => {
    setError('');
    setMessage('');
    if (!file1 || !file1Content) return;

    try {
      const isInputBinary = file1Content instanceof ArrayBuffer;
      let asn1Obj: any = null;

      // Handle Input
      if (isInputBinary) {
        const bytes = new Uint8Array(file1Content as ArrayBuffer);
        let binaryStr = '';
        for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i]);
        asn1Obj = forge.asn1.fromDer(binaryStr);
      } else {
        const text = file1Content as string;
        if (text.includes('BEGIN')) {
          if (convertType === 'cert') {
            const cert = forge.pki.certificateFromPem(text);
            asn1Obj = forge.pki.certificateToAsn1(cert);
          } else {
            const key = forge.pki.privateKeyFromPem(text);
            asn1Obj = forge.pki.privateKeyToAsn1(key);
          }
        } else {
          // Assume base64 DER
          const binaryStr = forge.util.decode64(text);
          asn1Obj = forge.asn1.fromDer(binaryStr);
        }
      }

      // Safe base name
      const baseName = file1.name.replace(/\.[^/.]+$/, '') || 'converted_file';

      // Handle Output
      if (outputFormat === 'der') {
        const derStr = forge.asn1.toDer(asn1Obj).getBytes();
        const bytes = new Uint8Array(derStr.length);
        for (let i = 0; i < derStr.length; i++) bytes[i] = derStr.charCodeAt(i);
        downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), `converted_${baseName}.der`);
        const msg = t('app.formatConverter.derDownloaded', 'DER file downloaded!');
        setMessage(msg);
        showToast(msg, 'success');
      } else {
        let pem = '';
        if (convertType === 'cert') {
          const cert = forge.pki.certificateFromAsn1(asn1Obj);
          pem = forge.pki.certificateToPem(cert);
        } else {
          const key = forge.pki.privateKeyFromAsn1(asn1Obj);
          pem = forge.pki.privateKeyToPem(key as any);
        }
        downloadBlob(new Blob([pem], { type: 'text/plain' }), `converted_${baseName}.pem`);
        const msg = t('app.formatConverter.pemDownloaded', 'PEM file downloaded!');
        setMessage(msg);
        showToast(msg, 'success');
      }
    } catch (e: any) {
      const errText = t('app.formatConverter.conversionFailed', `Conversion failed: ${e.message}`, { error: e.message });
      setError(errText);
      showToast(errText, 'error');
    }
  };

  // ─── PFX Builder ────────────────────────────────────────────────────────────
  const handlePfxBuild = () => {
    setError('');
    setMessage('');
    if (!certInput.trim() || !keyInput.trim()) {
      const errText = t('app.formatConverter.certAndKeyRequired', 'Certificate and Private Key are required.');
      setError(errText);
      showToast(errText, 'error');
      return;
    }
    if (!pfxPassword) {
      const errText = t('app.formatConverter.passwordRequired', 'PFX export password is required.');
      setError(errText);
      showToast(errText, 'error');
      return;
    }

    try {
      const cert = forge.pki.certificateFromPem(certInput);
      const key = forge.pki.privateKeyFromPem(keyInput);

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], pfxPassword, {
        generateLocalKeyId: true,
        algorithm: '3des',
      });
      const derStr = forge.asn1.toDer(p12Asn1).getBytes();

      const bytes = new Uint8Array(derStr.length);
      for (let i = 0; i < derStr.length; i++) bytes[i] = derStr.charCodeAt(i);

      let filename = 'certificate.pfx';
      try {
        const cnField = cert.subject.getField('CN');
        if (cnField && typeof cnField.value === 'string') {
          filename = `${cnField.value.replace(/[^a-zA-Z0-9_.-]/g, '_')}.pfx`;
        }
      } catch {
        // Fallback to certificate.pfx
      }

      downloadBlob(new Blob([bytes], { type: 'application/x-pkcs12' }), filename);
      const msg = t('app.formatConverter.pfxDownloaded', 'PFX file downloaded!');
      setMessage(msg);
      showToast(msg, 'success');
    } catch (e: any) {
      const errText = t('app.formatConverter.pfxFailed', `PFX generation failed: ${e.message}`, { error: e.message });
      setError(errText);
      showToast(errText, 'error');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isCurrentFileBinary = file1Content instanceof ArrayBuffer;

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.formatConverter.title', 'Certificate Format Converter & PFX Builder')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {t(
              'app.formatConverter.subtitle',
              'Convert between PEM and DER formats, or package a Certificate and Private Key into a PFX (PKCS#12) archive.'
            )}
          </p>
        </div>

        {/* ─── Mode Tabs ─── */}
        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          <button
            data-mode="pem-der"
            className={`format-tab-btn ${mode === 'pem-der' ? 'active' : ''}`}
            onClick={() => {
              setMode('pem-der');
              setError('');
              setMessage('');
            }}
          >
            <FileArchive size={16} /> {t('app.formatConverter.tabPemDer', 'PEM ↔ DER Converter')}
          </button>
          <button
            data-mode="pfx"
            className={`format-tab-btn ${mode === 'pfx' ? 'active' : ''}`}
            onClick={() => {
              setMode('pfx');
              setError('');
              setMessage('');
            }}
          >
            <Shield size={16} /> {t('app.formatConverter.tabPfx', 'Build PFX (PKCS#12)')}
          </button>
        </div>

        {/* ─── Test Examples Presets Bar ─── */}
        {mode === 'pem-der' && (
          <div className="glass-panel format-converter-presets-panel animate-fade-in">
            <div className="key-matcher-presets-header">
              <div className="key-matcher-presets-title">
                <Sparkles size={15} style={{ color: 'var(--accent-color)' }} />
                <span>{t('app.formatConverter.tryExamples', 'Try Test Examples:')}</span>
              </div>

              {file1 && (
                <button
                  type="button"
                  className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-mobile"
                  onClick={handleClearPemDer}
                  title={t('app.formatConverter.clearInputs', 'Clear current inputs')}
                >
                  <Trash2 size={13} />
                  <span>{t('common.clear', 'Clear')}</span>
                </button>
              )}
            </div>

            <div className="key-matcher-presets-list">
              {PEM_DER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`chain-sample-pill key-matcher-preset-pill${
                    activePemDerPreset === preset.id ? ' active' : ''
                  }`}
                  onClick={() => handleSelectPemDerPreset(preset)}
                  title={preset.description}
                >
                  <span className="key-matcher-preset-name">{getLocalizedPemDerPresetName(preset)}</span>
                  <span
                    className="key-matcher-preset-badge"
                    style={{
                      background: preset.outputFormat === 'der' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: preset.outputFormat === 'der' ? 'var(--accent-color)' : 'var(--warning-color)',
                    }}
                  >
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>

            {file1 && (
              <button
                type="button"
                className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-desktop"
                onClick={handleClearPemDer}
                title={t('app.formatConverter.clearInputs', 'Clear current inputs')}
              >
                <Trash2 size={13} />
                <span>{t('common.clear', 'Clear')}</span>
              </button>
            )}
          </div>
        )}

        {mode === 'pfx' && (
          <div className="glass-panel format-converter-presets-panel animate-fade-in">
            <div className="key-matcher-presets-header">
              <div className="key-matcher-presets-title">
                <Sparkles size={15} style={{ color: 'var(--accent-color)' }} />
                <span>{t('app.formatConverter.tryExamples', 'Try Test Examples:')}</span>
              </div>

              {(certInput || keyInput || pfxPassword) && (
                <button
                  type="button"
                  className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-mobile"
                  onClick={handleClearPfx}
                  title={t('app.formatConverter.clearInputs', 'Clear current inputs')}
                >
                  <Trash2 size={13} />
                  <span>{t('common.clear', 'Clear')}</span>
                </button>
              )}
            </div>

            <div className="key-matcher-presets-list">
              {PFX_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`chain-sample-pill key-matcher-preset-pill${activePfxPreset === preset.id ? ' active' : ''}`}
                  onClick={() => handleSelectPfxPreset(preset)}
                  title={preset.description}
                >
                  <span className="key-matcher-preset-name">{getLocalizedPfxPresetName(preset)}</span>
                  <span
                    className="key-matcher-preset-badge"
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: 'var(--success-color)',
                    }}
                  >
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>

            {(certInput || keyInput || pfxPassword) && (
              <button
                type="button"
                className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-desktop"
                onClick={handleClearPfx}
                title={t('app.formatConverter.clearInputs', 'Clear current inputs')}
              >
                <Trash2 size={13} />
                <span>{t('common.clear', 'Clear')}</span>
              </button>
            )}
          </div>
        )}

        {/* ─── PEM ↔ DER Mode Panel ─── */}
        {mode === 'pem-der' && (
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '680px', margin: '0 auto', padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              {t('app.formatConverter.pemDerTitle', 'PEM ↔ DER File Converter')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('app.formatConverter.selectSourceFile', 'Select Source File')}</label>
                <div>
                  <input type="file" ref={file1InputRef} onChange={handleFile1Upload} style={{ display: 'none' }} />
                  <button
                    className="btn btn-secondary"
                    onClick={() => file1InputRef.current?.click()}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Upload size={16} /> {t('app.formatConverter.chooseFile', 'Choose PEM or DER File...')}
                  </button>

                  {/* Staged File Info Card */}
                  {file1 && (
                    <div className="format-staged-file-card">
                      <div className="format-staged-file-info">
                        {isCurrentFileBinary ? (
                          <Binary size={22} style={{ color: 'var(--warning-color)', flexShrink: 0 }} />
                        ) : (
                          <FileText size={22} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div className="format-staged-file-name" title={file1.name}>
                            {file1.name}
                          </div>
                          <div className="format-staged-file-meta">
                            <span>{formatFileSize(file1.size)}</span>
                            <span>•</span>
                            <span
                              className={`format-badge ${isCurrentFileBinary ? 'format-badge-der' : 'format-badge-pem'}`}
                            >
                              {isCurrentFileBinary ? 'DER (Binary)' : 'PEM (Text)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearPemDer}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', height: 'auto', gap: '0.25rem' }}
                        title={t('app.formatConverter.removeFile', 'Remove file')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="format-converter-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.formatConverter.contentType', 'Content Type')}</label>
                  <select
                    className="form-select"
                    value={convertType}
                    onChange={(e) => setConvertType(e.target.value as any)}
                  >
                    <option value="cert">{t('app.formatConverter.typeCert', 'Certificate (X.509)')}</option>
                    <option value="key">{t('app.formatConverter.typeKey', 'Private Key (RSA)')}</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.formatConverter.targetFormat', 'Target Output Format')}</label>
                  <select
                    className="form-select"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as any)}
                  >
                    <option value="der">{t('app.formatConverter.formatDer', 'DER (Raw Binary)')}</option>
                    <option value="pem">{t('app.formatConverter.formatPem', 'PEM (Base64 ASCII)')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button
                className="btn"
                onClick={handlePemDerConvert}
                disabled={!file1}
                style={{ width: '100%', justifyContent: 'center', height: '44px' }}
              >
                <Download size={18} /> {t('app.formatConverter.convertAndDownload', 'Convert & Download')}
              </button>
            </div>
          </div>
        )}

        {/* ─── PFX Builder Mode Panel ─── */}
        {mode === 'pfx' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              {t('app.formatConverter.pfxTitle', 'Package PFX Archive')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              {t(
                'app.formatConverter.pfxSubtitle',
                'Combine a PEM Certificate and a PEM Private Key into a secure PFX (PKCS#12) container suitable for Windows Certificate Store, IIS, or Azure Key Vault.'
              )}
            </p>

            <div className="responsive-grid-2" style={{ gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={15} style={{ color: 'var(--accent-color)' }} />
                  {t('app.formatConverter.certLabel', 'Certificate (PEM)')}
                </label>
                <textarea
                  className="form-textarea mono"
                  value={certInput}
                  onChange={(e) => {
                    setCertInput(e.target.value);
                    setActivePfxPreset(null);
                  }}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  style={{ height: '220px', fontSize: '0.82rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={15} style={{ color: 'var(--warning-color)' }} />
                  {t('app.formatConverter.keyLabel', 'Private Key (PEM)')}
                </label>
                <textarea
                  className="form-textarea mono"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    setActivePfxPreset(null);
                  }}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  style={{ height: '220px', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ maxWidth: '420px', margin: '1.5rem auto 0 auto' }}>
              <div className="form-group" style={{ textAlign: 'center', marginBottom: 0 }}>
                <label className="form-label">{t('app.formatConverter.pfxPassword', 'PFX Archive Password')}</label>
                <div className="pfx-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={pfxPassword}
                    onChange={(e) => setPfxPassword(e.target.value)}
                    placeholder={t('app.formatConverter.passwordPlaceholder', 'Enter secure export password...')}
                    style={{ textAlign: 'center', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    className="pfx-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={
                      showPassword
                        ? t('app.formatConverter.hidePassword', 'Hide password')
                        : t('app.formatConverter.showPassword', 'Show password')
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button
                className="btn"
                onClick={handlePfxBuild}
                disabled={!certInput || !keyInput || !pfxPassword}
                style={{ height: '44px', padding: '0 2rem' }}
              >
                <Download size={18} /> {t('app.formatConverter.downloadPfx', 'Download PFX Archive')}
              </button>
            </div>
          </div>
        )}

        {/* ─── Feedback Alert ─── */}
        {(error || message) && (
          <div
            className="glass-panel"
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              padding: '1rem 1.25rem',
              background: error ? 'var(--danger-bg)' : 'var(--success-bg)',
              borderColor: error ? 'var(--danger-border)' : 'var(--success-border)',
              color: error ? 'var(--danger-color)' : 'var(--success-color)',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
