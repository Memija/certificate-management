import { useState, useCallback, useRef } from 'react';
import {
  Upload, FileKey, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Copy, Download, RefreshCw, X, Eye, EyeOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseCSRFile } from './utils/csrParser';
import { LearningTerm } from './LearningTerm';
import type { ParsedCSR } from './utils/csrParser';
import { formatPurposesList } from './utils/purposeFormatter';

// ─── Small reusable pieces ────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={t('common.copyToClipboard', 'Copy to clipboard')}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? 'var(--success-color)' : 'var(--text-secondary)',
        padding: '2px 4px', borderRadius: 4, transition: 'color 0.2s',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <Copy size={13} />
    </button>
  );
}

// ─── Loaded file state ────────────────────────────────────────────────────────

interface LoadedCSR {
  id: string;
  name: string;
  csr: ParsedCSR;
}

// ─── Details panel ────────────────────────────────────────────────────────────

function CSRDetails({ csr }: { csr: ParsedCSR }) {
  const { t } = useTranslation();
  const [showPem, setShowPem] = useState(false);
  const [showExts, setShowExts] = useState(true);

  const downloadDer = () => {
    const link = document.createElement('a');
    link.href = `data:application/octet-stream;base64,${csr.derBase64}`;
    link.download = 'request.der';
    link.click();
  };

  const downloadPem = () => {
    const blob = new Blob([csr.pem], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'request.csr';
    link.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Signature validity badge */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {csr.signatureValid ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}>
            <CheckCircle size={13} /> {t('app.csr.validSignature', 'Self-Signature Valid')}
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <XCircle size={13} /> {t('app.csr.invalidSignature', 'Self-Signature Invalid')}
          </span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem',
          background: 'rgba(56, 189, 248, 0.12)', color: 'var(--text-accent)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}>
          <FileKey size={13} /> CSR
        </span>
      </div>

      {/* Subject fields */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
          {t('app.csr.subjectTitle', 'Subject')}
        </h4>
        <div className="details-grid">
          {csr.subjectFields.length > 0 ? csr.subjectFields.map((f, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className="details-label">{f.name}</div>
              <div className="details-value">{f.value}</div>
            </div>
          )) : (
            <>
              <div className="details-label">{t('app.csr.fullDn', 'Full DN')}</div>
              <div className="details-value">{csr.subject || '(empty subject)'}</div>
            </>
          )}
        </div>
      </div>

      {/* Key & Signature */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
          {t('app.csr.cryptoDetailsTitle', 'Cryptographic Details')}
        </h4>
        <div className="details-grid">
          <div className="details-label">{t('app.csr.publicKey', 'Public Key')}</div>
          <div className="details-value">
            {csr.publicKeyAlgorithm}
            {csr.publicKeySize ? ` (${csr.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''}
          </div>

          <div className="details-label">{t('app.csr.signatureAlgorithm', 'Signature Algorithm')}</div>
          <div className="details-value">{csr.signatureAlgorithm}</div>

          <div className="details-label">{t('app.csr.signatureOid', 'Signature OID')}</div>
          <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{csr.signatureOid}</div>

          <div className="details-label">{t('app.csr.requestedPurposes', 'Requested Purposes')}</div>
          <div className="details-value">{formatPurposesList(csr.requestedPurposes, t) || t('app.chain.noneSpecified', 'None specified')}</div>

          <div className="details-label">{t('app.csr.sha256Fingerprint', 'SHA-256 Fingerprint')}</div>
          <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em' }}>
            {csr.fingerprintSha256}
            <CopyButton value={csr.fingerprintSha256} />
          </div>
        </div>
      </div>

      {/* Requested Extensions */}
      {csr.requestedExtensions.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showExts ? '0.85rem' : 0 }}
            onClick={() => setShowExts(e => !e)}
          >
            <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
              Requested Extensions ({csr.requestedExtensions.length})
            </h4>
            {showExts ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
          </div>
          {showExts && (
            <div className="details-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: 6 }}>
              {csr.requestedExtensions.map((ext, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  <div className="details-label">
                    {ext.name}
                    {ext.critical && (
                      <span style={{ marginLeft: 6, fontSize: '0.75em', color: 'var(--danger-color)' }}>Critical</span>
                    )}
                  </div>
                  <div className="details-value" style={{ fontFamily: ext.value.length > 60 ? 'monospace' : undefined, fontSize: '0.88em', wordBreak: 'break-all' }}>
                    {ext.value || '(no value)'}
                    {ext.oid && <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 2 }}>OID: {ext.oid}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PEM + Download */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setShowPem(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-accent)', fontSize: '0.88rem', padding: 0 }}
          >
            {showPem ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showPem ? t('app.chain.hidePem', 'Hide PEM') : t('app.chain.viewPem', 'View PEM')}</span>
            {showPem ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-download-pem" onClick={downloadPem}>
              <Download size={13} /> Download .csr
            </button>
            <button className="btn btn-download-der" onClick={downloadDer}>
              <Download size={13} /> Download .der
            </button>
          </div>
        </div>
        {showPem && (
          <pre style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {csr.pem}
          </pre>
        )}
      </div>

    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(csr|req|pem|der|cer|txt)$/i.test(f.name) || f.type === 'application/x-x509-ca-cert'
    );
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      className={`glass-panel${dragging ? ' dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        textAlign: 'center', padding: '3.5rem 2rem', cursor: 'pointer',
        border: `2px dashed ${dragging ? 'var(--accent-color)' : 'var(--glass-border)'}`,
        background: dragging ? 'rgba(56,189,248,0.06)' : undefined,
        transition: 'all 0.2s ease',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csr,.req,.pem,.der,.cer,.txt"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <Upload size={48} color="var(--text-accent)" style={{ marginBottom: '1rem', opacity: dragging ? 1 : 0.7 }} />
      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
        Drop CSR files here
      </h3>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Supports PEM and DER · <code>.csr</code> · <code>.req</code> · <code>.pem</code> · <code>.der</code>
      </p>
    </div>
  );
}

// ─── Loaded CSR card ──────────────────────────────────────────────────────────

function CSRCard({ item, onRemove }: { item: LoadedCSR; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const cn = item.csr.subjectFields.find(f => f.shortName === 'CN')?.value || item.name;

  return (
    <div className="glass-panel" style={{ marginBottom: '1rem' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileKey size={22} color="var(--text-accent)" />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cn}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {expanded ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
          <CSRDetails csr={item.csr} />
        </div>
      )}
    </div>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ name, message, onRemove }: { name: string; message: string; onRemove: () => void }) {
  return (
    <div className="glass-panel" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--danger-color)', marginTop: '0.25rem' }}>{message}</div>
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CSREntry {
  id: string;
  name: string;
  result: { ok: true; csr: ParsedCSR } | { ok: false; error: string };
  loading: boolean;
}

export function CsrInspector() {
  const [entries, setEntries] = useState<CSREntry[]>([]);

  const handleFiles = useCallback(async (files: File[]) => {
    const pending: CSREntry[] = files.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      name: f.name,
      result: { ok: false, error: '' },
      loading: true,
    }));
    setEntries(prev => [...prev, ...pending]);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = pending[i].id;
      try {
        const csr = await parseCSRFile(f);
        setEntries(prev => prev.map(e =>
          e.id === id ? { ...e, loading: false, result: { ok: true, csr } } : e
        ));
      } catch (err: any) {
        setEntries(prev => prev.map(e =>
          e.id === id ? { ...e, loading: false, result: { ok: false, error: err.message } } : e
        ));
      }
    }
  }, []);

  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));
  const clearAll = () => setEntries([]);

  return (
    <div className="main-content">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Info banner */}
        <div className="glass-panel" style={{ marginBottom: '1.5rem', background: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.2)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <FileKey size={18} color="var(--text-accent-2)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}><LearningTerm termId="csr">CSR</LearningTerm> Inspector</strong> - Inspect Certificate Signing Requests before submitting them to a CA.
              Verifies the self-signature, shows all requested extensions and subject fields.
              &nbsp;<strong style={{ color: 'var(--text-primary)' }}>100% offline</strong> · no data leaves your machine.
            </div>
          </div>
        </div>

        <DropZone onFiles={handleFiles} />

        {entries.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {entries.length} file{entries.length !== 1 ? 's' : ''} loaded
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }} onClick={clearAll}>
                <X size={13} /> Clear all
              </button>
            </div>

            {entries.map(entry => {
              if (entry.loading) {
                return (
                  <div key={entry.id} className="glass-panel" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <RefreshCw size={18} color="var(--text-accent)" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Parsing {entry.name}…</span>
                  </div>
                );
              }
              if (entry.result.ok) {
                return (
                  <CSRCard
                    key={entry.id}
                    item={{ id: entry.id, name: entry.name, csr: entry.result.csr }}
                    onRemove={() => removeEntry(entry.id)}
                  />
                );
              }
              return (
                <ErrorCard
                  key={entry.id}
                  name={entry.name}
                  message={entry.result.error}
                  onRemove={() => removeEntry(entry.id)}
                />
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
