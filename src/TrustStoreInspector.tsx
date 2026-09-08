import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, FolderOpen, X, Shield, ShieldCheck, AlertTriangle,
  FileKey, ChevronRight, Info, Eye, EyeOff, RefreshCw, Archive,
  FileText, Lock, Download, Copy, Check
} from 'lucide-react';
import { parseTrustStoreFile, decryptJKSPrivateKey } from './utils/trustStoreParser';
import type { ParsedTrustStore, TrustStoreEntry, ParsedCertificate } from './utils/trustStoreParser';
import { formatPurposesList, formatKeyUsageValue } from './utils/purposeFormatter';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';

// ─── Format label helpers ────────────────────────────────────────────────────
// ─── Format label helpers ────────────────────────────────────────────────────
const FORMAT_LABELS: Record<string, { key: string; label: string; color: string; icon: any }> = {
  'X509-DER':   { key: 'app.trustStore.format.x509Der',   label: 'DER Certificate',  color: '#38bdf8', icon: Shield },
  'X509-PEM':   { key: 'app.trustStore.format.x509Pem',   label: 'PEM Certificate',  color: '#38bdf8', icon: FileText },
  'PEM-Bundle': { key: 'app.trustStore.format.pemBundle', label: 'PEM Bundle',        color: '#a78bfa', icon: Archive },
  'PKCS7':      { key: 'app.trustStore.format.pkcs7',     label: 'PKCS#7 Chain',      color: '#f59e0b', icon: ShieldCheck },
  'PKCS12':     { key: 'app.trustStore.format.pkcs12',    label: 'PKCS#12 / PFX',    color: '#fb923c', icon: Lock },
  'JKS':        { key: 'app.trustStore.format.jks',       label: 'Java KeyStore',     color: '#4ade80', icon: FileKey },
  'Unknown':    { key: 'app.trustStore.format.unknown',   label: 'Unknown Format',    color: '#ef4444', icon: AlertTriangle },
};

// ─── Loaded file state ────────────────────────────────────────────────────────
interface LoadedFile {
  id: string;
  name: string;
  store: ParsedTrustStore;
  needsPassword?: boolean;
  pendingFile?: File;
  passwordInput?: string;
  loading?: boolean;
}

// ─── CertificateDetails (self-contained, mirrored from App.tsx) ──────────────
function CertificateDetails({ cert, privateKeyPem }: { cert: ParsedCertificate; privateKeyPem?: string }) {
  const { t, i18n } = useTranslation();
  const [showPem, setShowPem] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedPem, setCopiedPem] = useState(false);

  const copyPemText = () => {
    if (!cert.pem) return;
    navigator.clipboard.writeText(cert.pem);
    setCopiedPem(true);
    setTimeout(() => setCopiedPem(false), 2000);
  };

  return (
    <>
      <div className="details-grid" style={{ marginTop: '0.5rem' }}>
        <div className="details-label">{t('app.trustStore.certDetails.subject', 'Subject')}</div>
        <div className="details-value">{cert.subject}</div>

        <div className="details-label">{t('app.trustStore.certDetails.issuer', 'Issuer')}</div>
        <div className="details-value">{cert.issuer}</div>

        <div className="details-label">{t('app.trustStore.certDetails.validFrom', 'Valid From')}</div>
        <div className="details-value">{new Date(cert.validFrom).toLocaleString()}</div>

        <div className="details-label">{t('app.trustStore.certDetails.validTo', 'Valid To')}</div>
        <div className="details-value" style={{ color: cert.isExpired ? 'var(--danger-color)' : 'var(--text-primary)' }}>
          {new Date(cert.validTo).toLocaleString()}{' '}
          <span
            style={{ marginLeft: '0.4rem', fontSize: '0.85em', color: cert.isExpired ? 'var(--danger-color)' : 'var(--text-secondary)', cursor: 'help' }}
            title={formatExpiryTooltip(cert.validTo, t, i18n.language)}
          >
            ({formatExpiry(cert.validTo, t, i18n.language)})
          </span>
        </div>

        <div className="details-label">{t('app.trustStore.certDetails.serial', 'Serial')}</div>
        <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{cert.serialNumber}</div>

        <div className="details-label">{t('app.trustStore.certDetails.version', 'Version')}</div>
        <div className="details-value">v{cert.version + 1}</div>

        <div className="details-label">{t('app.trustStore.certDetails.sigAlgorithm', 'Sig. Algorithm')}</div>
        <div className="details-value">{cert.signatureAlgorithm} ({cert.signatureOid})</div>

        <div className="details-label">{t('app.trustStore.certDetails.publicKey', 'Public Key')}</div>
        <div className="details-value">{cert.publicKeyAlgorithm}{cert.publicKeySize ? ` (${cert.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''}</div>

        <div className="details-label">{t('app.trustStore.certDetails.sha1', 'SHA-1')}</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em' }}>{cert.fingerprintSha1}</div>

        <div className="details-label">{t('app.trustStore.certDetails.sha256', 'SHA-256')}</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em' }}>{cert.fingerprintSha256}</div>

        <div className="details-label">{t('app.trustStore.certDetails.purposes', 'Purposes')}</div>
        <div className="details-value">{formatPurposesList(cert.purposes, t)}</div>
      </div>

      {cert.extensions && cert.extensions.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
            {t('app.trustStore.certDetails.viewExtensions', 'View Extensions')} ({cert.extensions.length})
          </summary>
          <div className="details-grid" style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px' }}>
            {cert.extensions.map((ext, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <div className="details-label">
                  {t([`app.winCertStore.extensions.${ext.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ext.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ext.name)}
                </div>
                <div className="details-value">
                  <div>OID: {ext.oid}{ext.critical && <span style={{ color: 'var(--danger-color)', fontSize: '0.8em', marginLeft: '0.4rem' }}>{t('app.certDetails.critical', '(Critical)')}</span>}</div>
                  {ext.value && (
                    <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.82em', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      {ext.name === 'Key Usage' || ext.oid === '2.5.29.15'
                        ? formatKeyUsageValue(ext.value, t)
                        : ext.value}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {cert.pem && (
          <button
            className="btn btn-download-pem"
            onClick={() => {
              const blob = new Blob([cert.pem], { type: 'application/x-pem-file' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const fn = (cert.subject.match(/CN=([^,]+)/)?.[1]?.trim() || cert.serialNumber || 'cert').replace(/[^a-zA-Z0-9_-]/g, '_');
              a.download = `${fn}.pem`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={13} /> {t('app.winCertStore.certCard.downloadPem', 'Download PEM')}
          </button>
        )}

        {cert.pem && (
          <button
            className="btn btn-download-der"
            onClick={() => {
              try {
                const b64 = cert.pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const fn = (cert.subject.match(/CN=([^,]+)/)?.[1]?.trim() || cert.serialNumber || 'cert').replace(/[^a-zA-Z0-9_-]/g, '_');
                a.download = `${fn}.der`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {}
            }}
          >
            <Download size={13} /> {t('app.winCertStore.certCard.downloadDer', 'Download DER')}
          </button>
        )}

        {cert.pem && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={copyPemText}
            title={t('app.winCertStore.certCard.copyPem', 'Copy PEM')}
          >
            {copiedPem ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} />}
            <span>{copiedPem ? t('app.winCertStore.certCard.copied', 'Copied') : t('app.winCertStore.certCard.copyPem', 'Copy PEM')}</span>
          </button>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowPem(v => !v)}
        >
          {showPem ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPem ? t('app.trustStore.certDetails.hidePem', 'Hide PEM') : t('app.trustStore.certDetails.viewPem', 'View PEM')}
        </button>

        {privateKeyPem && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setShowPrivateKey(v => !v)}
          >
            {showPrivateKey ? <EyeOff size={13} /> : <FileKey size={13} />}
            {showPrivateKey ? t('app.trustStore.certDetails.hidePrivateKey', 'Hide Private Key') : t('app.trustStore.certDetails.viewPrivateKey', 'View Private Key')}
          </button>
        )}
      </div>

      {showPem && <pre className="code-block" style={{ marginTop: '0.75rem' }}>{cert.pem}</pre>}
      {showPrivateKey && privateKeyPem && <pre className="code-block" style={{ marginTop: '0.75rem', borderColor: 'var(--danger-border)' }}>{privateKeyPem}</pre>}
    </>
  );
}

// ─── Cert type badges ────────────────────────────────────────────────────────
function CertBadges({ cert }: { cert: ParsedCertificate }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {cert.isRoot && <span className="badge badge-success" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.rootCa', 'Root CA')}</span>}
      {cert.isIntermediate && <span className="badge badge-warning" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.intermediateCa', 'Intermediate CA')}</span>}
      {cert.isLeaf && <span className="badge badge-purple" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.leafCert', 'Leaf')}</span>}
      {cert.isExpired && <span className="badge badge-danger" style={{ margin: 0 }}><span className="badge-dot pulse" />{t('app.certDetails.expired', 'Expired')}</span>}
    </div>
  );
}

// ─── Single loaded file panel ─────────────────────────────────────────────────
interface FileTrustStoreProps {
  loadedFile: LoadedFile;
  onRemove: () => void;
  onPasswordSubmit: (id: string, password: string) => void;
  onPasswordChange: (id: string, val: string) => void;
  onJksUnlockSubmit: (id: string, password: string) => void;
}

function FileTrustStore({
  loadedFile,
  onRemove,
  onPasswordSubmit,
  onPasswordChange,
  onJksUnlockSubmit,
}: FileTrustStoreProps) {
  const { t, i18n } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<TrustStoreEntry | null>(
    loadedFile.store.entries[0] ?? null
  );

  useEffect(() => {
    if (!selectedEntry && loadedFile.store.entries.length > 0) {
      setSelectedEntry(loadedFile.store.entries[0]);
    } else if (
      selectedEntry &&
      !loadedFile.store.entries.some(
        e => e.alias === selectedEntry.alias && e.certificate.serialNumber === selectedEntry.certificate.serialNumber
      )
    ) {
      setSelectedEntry(loadedFile.store.entries[0] ?? null);
    }
  }, [loadedFile.store.entries, selectedEntry]);

  const { store, name, needsPassword, id } = loadedFile;
  const fmtInfo = FORMAT_LABELS[store.format] ?? FORMAT_LABELS['Unknown'];
  const FmtIcon = fmtInfo.icon;

  // If this file needs a password
  if (needsPassword) {
    return (
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="metric-icon-wrap warning" style={{ width: 40, height: 40 }}>
              <Lock size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{name}</div>
              <div style={{ fontSize: '0.8rem', color: fmtInfo.color, fontWeight: 500 }}>{t(fmtInfo.key, fmtInfo.label)}</div>
            </div>
          </div>
          <button onClick={onRemove} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', maxWidth: '420px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.88rem' }}>
            {t('app.trustStore.inspector.passwordProtectedDesc', 'This file is password-protected. Enter the password to decrypt and inspect its certificates.')}
          </p>
          <div className="input-group">
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder={t('app.trustStore.inspector.passwordPlaceholder', 'Enter keystore password…')}
                value={loadedFile.passwordInput ?? ''}
                onChange={e => onPasswordChange(id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onPasswordSubmit(id, loadedFile.passwordInput ?? ''); }}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
                aria-label={showPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              className="btn"
              onClick={() => onPasswordSubmit(id, loadedFile.passwordInput ?? '')}
              disabled={loadedFile.loading}
            >
              {loadedFile.loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronRight size={16} />}
              {t('app.trustStore.inspector.unlock', 'Unlock')}
            </button>
          </div>
          {store.warnings.filter(w => w.includes('password') || w.includes('Password')).map((w, i) => (
            <p key={i} style={{ color: 'var(--danger-color)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {w === 'Incorrect password.' ? t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.') : w}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
      {/* File header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="metric-icon-wrap info" style={{ width: 40, height: 40 }}>
            <FmtIcon size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{name}</div>
            <div style={{ fontSize: '0.8rem', color: fmtInfo.color, fontWeight: 500 }}>{t(fmtInfo.key, fmtInfo.label)}</div>
          </div>
          <span className="badge" style={{ marginLeft: '0.5rem' }}>
            {store.entries.length} {store.entries.length === 1 ? t('app.trustStore.inspector.certsCount_one', 'cert') : t('app.trustStore.inspector.certsCount_other', 'certs')}
          </span>
        </div>
        <button onClick={onRemove} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
          <X size={14} />
        </button>
      </div>

      {/* Warnings */}
      {store.warnings.map((w, i) => {
        let localizedW = w;
        if (w.includes('Private keys are never displayed')) {
          const match = w.match(/contains (\d+) private key/);
          if (match) {
            localizedW = t('app.trustStore.warnings.privateKeyCount', 'This file contains {{count}} private key(s).', { count: parseInt(match[1], 10) });
          } else {
            localizedW = t('app.trustStore.warnings.privateKey', 'This file contains a private key entry.');
          }
        } else if (w.includes('JKS MAC verification skipped')) {
          localizedW = t('app.trustStore.warnings.jksMacSkipped', 'JKS MAC verification skipped. Private keys are encrypted and require a password.');
        } else if (w.includes('private key is encrypted')) {
          const aliasMatch = w.match(/Alias "([^"]+)"/);
          if (aliasMatch) {
            localizedW = t('app.trustStore.warnings.jksPrivKeySkipped', 'Alias "{{alias}}": private key is encrypted.', { alias: aliasMatch[1] });
          }
        }
        
        return (
          <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.75rem', padding: '0.75rem 1rem', background: 'var(--warning-bg)', borderRadius: '10px', borderLeft: '3px solid var(--warning-color)' }}>
            <Info size={16} color="var(--warning-color)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{localizedW}</span>
          </div>
        );
      })}

      {/* JKS Unlock Private Keys */}
      {store.entries.some(e => e.isEncryptedJksKey && !e.privateKeyPem) && (
        <div style={{ padding: '1.25rem', background: 'var(--card-bg)', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid var(--glass-border-subtle)' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            <Lock size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.5rem', color: 'var(--warning-color)' }} />
            {t("app.trustStore.inspector.unlockJksTitle", "Unlock Private Keys")}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '420px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder={t("app.trustStore.inspector.passwordPlaceholder", "Enter password...")}
                value={loadedFile.passwordInput || ''}
                onChange={e => onPasswordChange(id, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
                aria-label={showPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button className="btn" onClick={() => onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')}>
               {t("app.trustStore.inspector.unlock", "Unlock")}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {store.entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--text-secondary)' }}>
          <AlertTriangle size={40} color="var(--danger-color)" style={{ margin: '0 auto 0.75rem' }} />
          <p>{t('app.trustStore.inspector.noCertsExtracted', 'No certificates could be extracted from this file.')}</p>
        </div>
      )}

      {/* Two-column layout: sidebar + details */}
      {store.entries.length > 0 && (
        <div className="trust-store-layout">
          {/* Sidebar */}
          <div className="cert-list-sidebar">
            {store.entries.map((entry, idx) => {
              const isSelected = selectedEntry?.alias === entry.alias && selectedEntry?.certificate.serialNumber === entry.certificate.serialNumber;
              return (
                <button
                  key={idx}
                  className={`cert-list-item${isSelected ? ' active' : ''}`}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Shield size={14} color={isSelected ? 'var(--accent-color)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {entry.alias}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1.4rem' }}>
                    {entry.certificate.isExpired
                      ? <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                          {t('app.certDetails.expired', 'Expired')} ({formatExpiry(entry.certificate.validTo, t, i18n.language)})
                        </span>
                      : <span>
                          {t('app.trustStore.inspector.validTo', 'Valid to {{date}}', { date: new Date(entry.certificate.validTo).toLocaleDateString() })} ({formatExpiry(entry.certificate.validTo, t, i18n.language)})
                        </span>
                    }
                  </div>
                </button>
              );
            })}
          </div>

          {/* Details panel */}
          <div className="cert-details-panel">
            {selectedEntry ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.4rem', fontSize: '1.1rem' }}>{selectedEntry.alias}</h3>
                    <CertBadges cert={selectedEntry.certificate} />
                  </div>
                </div>
                <CertificateDetails cert={selectedEntry.certificate} privateKeyPem={selectedEntry.privateKeyPem} />
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 1.5rem' }}>
                {t('app.trustStore.inspector.selectCert', 'Select a certificate from the list')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFiles(files);
    e.target.value = '';
  };

  return (
    <div
      className={`drop-zone${dragging ? ' active' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".cer,.crt,.pem,.der,.p7b,.p7c,.jks,.p12,.pfx,.keystore"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="drop-zone-icon">
        <Upload size={44} />
      </div>
      <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.4rem', fontSize: '1.2rem' }}>
        {t('app.trustStore.inspector.dropFilesHere', 'Drop certificate files here')}
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
        {t('app.trustStore.inspector.orClickToBrowse', 'or click to browse from your computer')}
      </p>
      <div className="drop-zone-formats">
        {['.cer', '.crt', '.pem', '.der', '.p7b / .p7c', '.p12 / .pfx', '.jks', '.keystore'].map(ext => (
          <span key={ext} className="drop-zone-format-pill">{ext}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main TrustStoreInspector ──────────────────────────────────────────────
export function TrustStoreInspector() {
  const { t } = useTranslation();
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  useEffect(() => {
    if (loadedFiles.length > 0 && (!activeFileId || !loadedFiles.some(f => f.id === activeFileId))) {
      setActiveFileId(loadedFiles[0].id);
    } else if (loadedFiles.length === 0) {
      setActiveFileId(null);
    }
  }, [loadedFiles, activeFileId]);

  const processFiles = useCallback(async (files: File[]) => {
    setGlobalLoading(true);
    const newEntries: LoadedFile[] = [];

    for (const file of files) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      try {
        const result = await parseTrustStoreFile(file, '');
        if (result.needsPassword) {
          result.warnings = result.warnings.filter(w => w !== 'Incorrect password.');
        }
        newEntries.push({
          id,
          name: file.name,
          store: result,
          needsPassword: result.needsPassword,
          pendingFile: result.needsPassword ? file : undefined,
          passwordInput: '',
        });
      } catch (e: any) {
        newEntries.push({
          id,
          name: file.name,
          store: { format: 'Unknown', entries: [], warnings: [e?.message || 'Unknown error'] },
        });
      }
    }

    if (newEntries.length > 0) {
      setLoadedFiles(prev => [...prev, ...newEntries]);
      setActiveFileId(newEntries[newEntries.length - 1].id);
    }
    setGlobalLoading(false);
  }, []);

  const removeFile = (id: string) => {
    setLoadedFiles(prev => {
      const remaining = prev.filter(f => f.id !== id);
      if (activeFileId === id) {
        const removedIndex = prev.findIndex(f => f.id === id);
        const nextActive = remaining[removedIndex] || remaining[removedIndex - 1] || remaining[0];
        setActiveFileId(nextActive ? nextActive.id : null);
      }
      return remaining;
    });
  };

  const handlePasswordChange = (id: string, val: string) => {
    setLoadedFiles(prev => prev.map(f => f.id === id ? { ...f, passwordInput: val } : f));
  };

  const handlePasswordSubmit = async (id: string, password: string) => {
    const entry = loadedFiles.find(f => f.id === id);
    if (!entry?.pendingFile) return;

    setLoadedFiles(prev => prev.map(f => f.id === id ? { ...f, loading: true } : f));

    try {
      const result = await parseTrustStoreFile(entry.pendingFile, password);
      setLoadedFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, store: result, needsPassword: result.needsPassword, loading: false, passwordInput: '' }
          : f
      ));
    } catch (e: any) {
      const isIncorrect = e?.message?.includes('password') || e?.message?.includes('MAC') || e?.message === 'Incorrect password.';
      const warningText = isIncorrect ? 'Incorrect password.' : (e?.message || 'Decryption failed.');

      setLoadedFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, store: { format: 'PKCS12', entries: [], warnings: [warningText] }, needsPassword: true, loading: false }
          : f
      ));
    }
  };

  const onJksUnlockSubmit = (id: string, pwd: string) => {
    setLoadedFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      const newEntries = [...f.store.entries];
      let newWarnings = [...f.store.warnings];
      let errorEncountered = false;

      for (let i = 0; i < newEntries.length; i++) {
        const e = newEntries[i];
        if (e.isEncryptedJksKey && e.encryptedJksKeyData && !e.privateKeyPem) {
          try {
            const pem = decryptJKSPrivateKey(e.encryptedJksKeyData, pwd);
            newEntries[i] = { ...e, privateKeyPem: pem };
          } catch (err: any) {
            errorEncountered = true;
          }
        }
      }

      if (errorEncountered) {
        if (!newWarnings.includes('Incorrect password.')) {
          newWarnings.unshift('Incorrect password.');
        }
      } else {
        newWarnings = newWarnings.filter(w => !w.includes('JKS MAC') && w !== 'Incorrect password.');
        newWarnings = newWarnings.filter(w => !w.includes('private key is encrypted'));
      }
      return { ...f, store: { ...f.store, entries: newEntries, warnings: newWarnings } };
    }));
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Intro panel */}
        <div className="glass-panel" style={{ marginBottom: '2rem', background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FolderOpen size={32} color="var(--text-accent)" />
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>{t('app.trustStore.inspector.title', 'Trust Store Inspector')}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {t('app.trustStore.inspector.subtitle.p1', 'Load any certificate file or keystore to inspect its contents.')} <strong>{t('app.trustStore.inspector.subtitle.p2', '100% client-side, nothing leaves your machine.')}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <DropZone onFiles={processFiles} />

        {/* Loading indicator */}
        {globalLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0', color: 'var(--text-secondary)' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            {t('app.trustStore.inspector.parsingFiles', 'Parsing file(s)…')}
          </div>
        )}

        {/* Loaded files */}
        {loadedFiles.length > 0 && (
          <div style={{ marginTop: '2rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
                {t('app.trustStore.inspector.loadedFiles', 'Loaded Files')} ({loadedFiles.length})
              </h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                onClick={() => setLoadedFiles([])}
              >
                <X size={13} /> {t('app.trustStore.inspector.clearAll', 'Clear All')}
              </button>
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {loadedFiles.map(lf => {
                const isActive = activeFileId === lf.id;
                return (
                  <button
                    key={lf.id}
                    onClick={() => setActiveFileId(lf.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: isActive ? 'var(--bg-glass)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid var(--text-accent)' : '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <FileText size={14} />
                    <span style={{ textTransform: 'none' }}>{lf.name}</span>
                    <X 
                      size={14} 
                      onClick={(e) => { e.stopPropagation(); removeFile(lf.id); }}
                      style={{ marginLeft: '0.5rem', opacity: 0.6, cursor: 'pointer' }}
                    />
                  </button>
                );
              })}
            </div>

            {loadedFiles.filter(lf => lf.id === activeFileId).map(lf => (
              <FileTrustStore
                key={lf.id}
                loadedFile={lf}
                onRemove={() => removeFile(lf.id)}
                onPasswordSubmit={handlePasswordSubmit}
                onPasswordChange={handlePasswordChange}
                onJksUnlockSubmit={onJksUnlockSubmit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

