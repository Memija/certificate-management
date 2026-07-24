import { useState, useCallback, useRef } from 'react';
import {
  Upload, FolderOpen, X, Shield, ShieldCheck, AlertTriangle,
  FileKey, ChevronRight, Info, Eye, EyeOff, RefreshCw, Archive,
  FileText, Lock
} from 'lucide-react';
import { parseTrustStoreFile } from './utils/trustStoreParser';
import type { ParsedTrustStore, TrustStoreEntry, ParsedCertificate } from './utils/trustStoreParser';

// ─── Format label helpers ────────────────────────────────────────────────────
const FORMAT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  'X509-DER':   { label: 'DER Certificate',  color: '#38bdf8', icon: Shield },
  'X509-PEM':   { label: 'PEM Certificate',  color: '#38bdf8', icon: FileText },
  'PEM-Bundle': { label: 'PEM Bundle',        color: '#a78bfa', icon: Archive },
  'PKCS7':      { label: 'PKCS#7 Chain',      color: '#f59e0b', icon: ShieldCheck },
  'PKCS12':     { label: 'PKCS#12 / PFX',    color: '#fb923c', icon: Lock },
  'JKS':        { label: 'Java KeyStore',     color: '#4ade80', icon: FileKey },
  'Unknown':    { label: 'Unknown Format',    color: '#ef4444', icon: AlertTriangle },
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
function CertificateDetails({ cert }: { cert: ParsedCertificate }) {
  const [showPem, setShowPem] = useState(false);

  return (
    <>
      <div className="details-grid" style={{ marginTop: '0.5rem' }}>
        <div className="details-label">Subject</div>
        <div className="details-value">{cert.subject}</div>

        <div className="details-label">Issuer</div>
        <div className="details-value">{cert.issuer}</div>

        <div className="details-label">Valid From</div>
        <div className="details-value">{new Date(cert.validFrom).toLocaleString()}</div>

        <div className="details-label">Valid To</div>
        <div className="details-value" style={{ color: cert.isExpired ? 'var(--danger-color)' : 'var(--text-primary)' }}>
          {new Date(cert.validTo).toLocaleString()}
          {cert.isExpired && <span style={{ marginLeft: '0.5rem', fontSize: '0.8em', color: 'var(--danger-color)' }}>(Expired)</span>}
        </div>

        <div className="details-label">Serial</div>
        <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{cert.serialNumber}</div>

        <div className="details-label">Version</div>
        <div className="details-value">v{cert.version + 1}</div>

        <div className="details-label">Sig. Algorithm</div>
        <div className="details-value">{cert.signatureAlgorithm} ({cert.signatureOid})</div>

        <div className="details-label">Public Key</div>
        <div className="details-value">{cert.publicKeyAlgorithm}{cert.publicKeySize ? ` (${cert.publicKeySize} bits)` : ''}</div>

        <div className="details-label">SHA-1</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em' }}>{cert.fingerprintSha1}</div>

        <div className="details-label">SHA-256</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em' }}>{cert.fingerprintSha256}</div>

        <div className="details-label">Purposes</div>
        <div className="details-value">{cert.purposes.join(', ')}</div>
      </div>

      {cert.extensions && cert.extensions.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
            View Extensions ({cert.extensions.length})
          </summary>
          <div className="details-grid" style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px' }}>
            {cert.extensions.map((ext, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <div className="details-label">{ext.name}</div>
                <div className="details-value">
                  <div>OID: {ext.oid}{ext.critical && <span style={{ color: 'var(--danger-color)', fontSize: '0.8em', marginLeft: '0.4rem' }}>(Critical)</span>}</div>
                  {ext.value && <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.82em', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>{ext.value}</div>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
          onClick={() => setShowPem(v => !v)}
        >
          {showPem ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPem ? 'Hide PEM' : 'View PEM'}
        </button>
        {showPem && <pre style={{ marginTop: '0.75rem' }}>{cert.pem}</pre>}
      </div>
    </>
  );
}

// ─── Cert type badges ────────────────────────────────────────────────────────
function CertBadges({ cert }: { cert: ParsedCertificate }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {cert.isRoot && <span className="badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', margin: 0 }}>Root CA</span>}
      {cert.isIntermediate && <span className="badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', margin: 0 }}>Intermediate CA</span>}
      {cert.isLeaf && <span className="badge" style={{ background: 'rgba(156,163,175,0.2)', color: '#9ca3af', margin: 0 }}>Leaf</span>}
      {cert.isExpired && <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', margin: 0 }}>Expired</span>}
    </div>
  );
}

// ─── Single loaded file panel ─────────────────────────────────────────────────
function FileTrustStore({
  loadedFile,
  onRemove,
  onPasswordSubmit,
  onPasswordChange,
}: {
  loadedFile: LoadedFile;
  onRemove: () => void;
  onPasswordSubmit: (id: string, password: string) => void;
  onPasswordChange: (id: string, val: string) => void;
}) {
  const [selectedEntry, setSelectedEntry] = useState<TrustStoreEntry | null>(
    loadedFile.store.entries[0] ?? null
  );

  const { store, name, needsPassword, id } = loadedFile;
  const fmtInfo = FORMAT_LABELS[store.format] ?? FORMAT_LABELS['Unknown'];
  const FmtIcon = fmtInfo.icon;

  // If this file needs a password
  if (needsPassword) {
    return (
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Lock size={22} color={fmtInfo.color} />
            <div>
              <div style={{ fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtInfo.label}</div>
            </div>
          </div>
          <button onClick={onRemove} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', maxWidth: '400px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            This file is password-protected. Enter the password to decrypt and inspect its certificates.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              placeholder="Enter keystore password…"
              value={loadedFile.passwordInput ?? ''}
              onChange={e => onPasswordChange(id, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onPasswordSubmit(id, loadedFile.passwordInput ?? ''); }}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
            <button
              className="btn"
              onClick={() => onPasswordSubmit(id, loadedFile.passwordInput ?? '')}
              disabled={loadedFile.loading}
            >
              {loadedFile.loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronRight size={16} />}
              Unlock
            </button>
          </div>
          {store.warnings.filter(w => w.includes('password') || w.includes('Password')).map((w, i) => (
            <p key={i} style={{ color: 'var(--danger-color)', marginTop: '0.5rem', fontSize: '0.85rem' }}>{w}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
      {/* File header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FmtIcon size={22} color={fmtInfo.color} />
          <div>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: '0.8rem', color: fmtInfo.color }}>{fmtInfo.label}</div>
          </div>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', margin: 0 }}>
            {store.entries.length} cert{store.entries.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onRemove} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
          <X size={14} />
        </button>
      </div>

      {/* Warnings */}
      {store.warnings.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem', padding: '0.6rem 0.8rem', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
          <Info size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{w}</span>
        </div>
      ))}

      {/* Empty state */}
      {store.entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          <AlertTriangle size={40} color="var(--danger-color)" style={{ margin: '0 auto 0.75rem' }} />
          <p>No certificates could be extracted from this file.</p>
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
                    <Shield size={13} color={isSelected ? 'var(--text-accent)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 500, fontSize: '0.85rem', color: isSelected ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                      {entry.alias}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
                    {entry.certificate.isExpired
                      ? <span style={{ color: '#ef4444' }}>Expired</span>
                      : <span style={{ color: '#10b981' }}>Valid to {new Date(entry.certificate.validTo).toLocaleDateString()}</span>
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
                    <h3 style={{ margin: 0, marginBottom: '0.4rem' }}>{selectedEntry.alias}</h3>
                    <CertBadges cert={selectedEntry.certificate} />
                  </div>
                </div>
                <CertificateDetails cert={selectedEntry.certificate} />
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                Select a certificate from the list
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
        <Upload size={48} />
      </div>
      <h3 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
        Drop certificate files here
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        or click to browse
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
        {['.cer', '.crt', '.pem', '.der', '.p7b / .p7c', '.p12 / .pfx', '.jks', '.keystore'].map(ext => (
          <span key={ext} className="badge" style={{ margin: 0, background: 'rgba(56,189,248,0.1)', color: 'var(--text-accent)' }}>{ext}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main TrustStoreInspector ──────────────────────────────────────────────
export function TrustStoreInspector() {
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    setGlobalLoading(true);
    const newEntries: LoadedFile[] = [];

    for (const file of files) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      try {
        const result = await parseTrustStoreFile(file, '');
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

    setLoadedFiles(prev => [...prev, ...newEntries]);
    setGlobalLoading(false);
  }, []);

  const removeFile = (id: string) => {
    setLoadedFiles(prev => prev.filter(f => f.id !== id));
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
      setLoadedFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, store: { format: 'PKCS12', entries: [], warnings: [e?.message || 'Decryption failed.'] }, needsPassword: true, loading: false }
          : f
      ));
    }
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Intro panel */}
        <div className="glass-panel" style={{ marginBottom: '2rem', background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FolderOpen size={32} color="var(--text-accent)" />
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>Trust Store Inspector</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Load any certificate file or keystore to inspect its contents — 100% client-side, nothing leaves your machine.
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
            Parsing file(s)…
          </div>
        )}

        {/* Loaded files */}
        {loadedFiles.length > 0 && (
          <div style={{ marginTop: '2rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Loaded Files ({loadedFiles.length})
              </h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                onClick={() => setLoadedFiles([])}
              >
                <X size={13} /> Clear All
              </button>
            </div>
            {loadedFiles.map(lf => (
              <FileTrustStore
                key={lf.id}
                loadedFile={lf}
                onRemove={() => removeFile(lf.id)}
                onPasswordSubmit={handlePasswordSubmit}
                onPasswordChange={handlePasswordChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

