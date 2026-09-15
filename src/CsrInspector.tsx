import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Upload, FileKey, AlertTriangle, CheckCircle, XCircle, ShieldCheck, Lock,
  ChevronDown, ChevronUp, Copy, Download, RefreshCw, X, Eye, EyeOff, Sparkles,
  Edit3, Key
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { parseCSRFile, parseCSRFromText, SAMPLE_CSR_PEM } from './utils/csrParser';
import { LearningTerm } from './LearningTerm';
import type { ParsedCSR } from './utils/csrParser';
import { formatPurposesList, formatExtensionValue } from './utils/purposeFormatter';
import { CsrEditorModal } from './CsrEditorModal';
import { useToast } from './ToastContext';

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
  privateKeyPem?: string;
}

// ─── Details panel ────────────────────────────────────────────────────────────

function CSRDetails({
  csr,
  fileName,
  privateKeyPem,
  onEdit,
}: {
  csr: ParsedCSR;
  fileName: string;
  privateKeyPem?: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const [showPem, setShowPem] = useState(false);
  const [showExts, setShowExts] = useState(true);

  const downloadDer = () => {
    const link = document.createElement('a');
    link.href = `data:application/octet-stream;base64,${csr.derBase64}`;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}.der`;
    link.click();
  };

  const downloadPem = () => {
    const blob = new Blob([csr.pem], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName.endsWith('.csr') || fileName.endsWith('.req') || fileName.endsWith('.pem') ? fileName : `${fileName}.csr`;
    link.click();
  };

  const downloadKey = () => {
    if (!privateKeyPem) return;
    const blob = new Blob([privateKeyPem], { type: 'application/x-pem-file' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}.key`;
    link.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Signature validity badge & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
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
            <FileKey size={13} /> {t('app.csr.csrBadge', 'CSR')}
          </span>
          {privateKeyPem && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
              background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}>
              <Key size={13} /> {t('app.csr.editor.privateKeyAvailable', 'Private Key Available')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onEdit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
            title={t('app.csr.editor.modalTitle', 'Edit & Re-sign CSR')}
          >
            <Edit3 size={14} style={{ color: 'var(--text-accent)' }} /> {t('app.csr.editor.editCsrBtn', 'Edit CSR')}
          </button>
        </div>
      </div>

      {/* Subject fields */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
          {t('app.csr.subjectTitle', 'Subject')}
        </h4>
        <div className="details-grid">
          {csr.subjectFields.length > 0 ? csr.subjectFields.map((f, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className="details-label">
                {t([`app.csr.fields.${f.shortName}`, `app.csr.fields.${f.name}`] as any, f.name) as string}
              </div>
              <div className="details-value">{f.value}</div>
            </div>
          )) : (
            <>
              <div className="details-label">{t('app.csr.fullDn', 'Full DN')}</div>
              <div className="details-value">{csr.subject || t('app.csr.emptySubject', '(empty subject)')}</div>
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
              {t('app.csr.requestedExtensions', {
                count: csr.requestedExtensions.length,
                defaultValue: `Requested Extensions (${csr.requestedExtensions.length})`
              })}
            </h4>
            {showExts ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
          </div>
          {showExts && (
            <div className="details-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: 6 }}>
              {csr.requestedExtensions.map((ext, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  <div className="details-label">
                    {t([`app.winCertStore.extensions.${ext.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ext.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ext.name) as string}
                    {ext.critical && (
                      <span style={{ marginLeft: 6, fontSize: '0.75em', color: 'var(--danger-color)' }}>
                        {t('app.csr.critical', 'Critical')}
                      </span>
                    )}
                  </div>
                  <div className="details-value" style={{ fontFamily: ext.value.length > 60 ? 'monospace' : undefined, fontSize: '0.88em', wordBreak: 'break-all' }}>
                    {formatExtensionValue(ext.name, ext.oid, ext.value, t) || ext.value || t('app.csr.noValue', '(no value)')}
                    {ext.oid && <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 2 }}>{t('app.csr.oidLabel', 'OID:')} {ext.oid}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PEM + Download */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => setShowPem(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-accent)', fontSize: '0.88rem', padding: 0 }}
          >
            {showPem ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showPem ? t('app.chain.hidePem', 'Hide PEM') : t('app.chain.viewPem', 'View PEM')}</span>
            {showPem ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-download-pem" onClick={downloadPem}>
              <Download size={13} /> {t('app.csr.downloadCsr', 'Download .csr')}
            </button>
            <button className="btn btn-download-der" onClick={downloadDer}>
              <Download size={13} /> {t('app.csr.downloadDer', 'Download .der')}
            </button>
            {privateKeyPem && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={downloadKey}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              >
                <Key size={13} /> {t('app.csr.editor.downloadKey', 'Download .key')}
              </button>
            )}
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

function DropZone({ onFiles, onLoadSample, hasSample }: { onFiles: (files: File[]) => void; onLoadSample?: () => void; hasSample?: boolean }) {
  const { t } = useTranslation();
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
        {t('app.csr.dropTitle', 'Drop CSR files here')}
      </h3>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <Trans
          i18nKey="app.csr.dropDesc"
          defaults="Supports PEM and DER · <0>.csr</0> · <1>.req</1> · <2>.pem</2> · <3>.der</3>"
          components={[<code key="0" />, <code key="1" />, <code key="2" />, <code key="3" />]}
        />
      </p>
      {onLoadSample && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSample();
            }}
            disabled={hasSample}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              opacity: hasSample ? 0.5 : 1,
              cursor: hasSample ? 'not-allowed' : 'pointer'
            }}
            title={hasSample ? t('app.csr.sampleAlreadyLoaded', 'Sample CSR is already loaded') : undefined}
          >
            <Sparkles size={14} style={{ color: 'var(--text-accent)' }} />
            {t('app.csr.trySampleCsr', 'Try Sample CSR')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Loaded CSR card ──────────────────────────────────────────────────────────

function CSRCard({
  item,
  onRemove,
  onEdit,
}: {
  item: LoadedCSR;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
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
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>{cn}</span>
              {item.privateKeyPem && (
                <span title={t('app.csr.editor.privateKeyAvailable', 'Private Key Available')} style={{ display: 'inline-flex' }}>
                  <Key size={13} style={{ color: '#c084fc' }} />
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {expanded ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title={t('common.remove', 'Remove')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
          <CSRDetails
            csr={item.csr}
            fileName={item.name}
            privateKeyPem={item.privateKeyPem}
            onEdit={onEdit}
          />
        </div>
      )}
    </div>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({
  name,
  error,
  action,
  onRemove
}: {
  name: string;
  error: string;
  action?: { label: string; onClick: () => void };
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  let displayMessage = error;
  if (error === 'ERR_CERT_NOT_CSR') {
    displayMessage = t('app.csr.certNotCsr', 'This file contains an X.509 Certificate, not a Certificate Signing Request (CSR). Please inspect this file in the Trust Store Inspector.');
  } else if (error === 'ERR_CRL_NOT_CSR') {
    displayMessage = t('app.csr.crlNotCsr', 'This file contains a Certificate Revocation List (CRL), not a Certificate Signing Request (CSR). Please inspect this file in the CRL Inspector.');
  } else if (error === 'ERR_KEY_NOT_CSR') {
    displayMessage = t('app.csr.keyNotCsr', 'This file contains a Private Key, not a Certificate Signing Request (CSR).');
  } else if (error === 'ERR_INVALID_FORMAT' || error.startsWith('ERR_INVALID_FORMAT:')) {
    displayMessage = t('app.csr.invalidFormat', 'File is not a valid PEM or DER Certificate Signing Request.');
  } else {
    displayMessage = t('app.csr.parseError', { name, error, defaultValue: `Failed to parse "${name}": ${error}` });
  }

  return (
    <div className="glass-panel" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--danger-color)', marginTop: '0.25rem' }}>{displayMessage}</div>
            {action && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={action.onClick}
                style={{ marginTop: '0.6rem', fontSize: '0.82rem', padding: '0.35rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          title={t('common.remove', 'Remove')}
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
  result: { ok: true; csr: ParsedCSR; privateKeyPem?: string } | { ok: false; error: string };
  loading: boolean;
}

export function CsrInspector({ onNavigate }: { onNavigate?: (mode: any) => void } = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<CSREntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [editingCsr, setEditingCsr] = useState<{ csr: ParsedCSR; name: string } | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entries.length > 0 && (!activeEntryId || !entries.some(e => e.id === activeEntryId))) {
      setActiveEntryId(entries[0].id);
    } else if (entries.length === 0) {
      setActiveEntryId(null);
    }
  }, [entries, activeEntryId]);

  const hasSample = useMemo(() => {
    return entries.some(e => e.id.startsWith('sample-csr-') || e.name === 'sample_request.csr');
  }, [entries]);

  const handleFiles = useCallback(async (files: File[]) => {
    // Avoid adding exact duplicate files by name if already loaded
    const newFiles = files.filter(f => !entries.some(e => e.name === f.name));
    if (newFiles.length === 0) {
      const firstExisting = entries.find(e => files.some(f => f.name === e.name));
      if (firstExisting) setActiveEntryId(firstExisting.id);
      return;
    }

    const pending: CSREntry[] = newFiles.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      name: f.name,
      result: { ok: false, error: '' },
      loading: true,
    }));
    setEntries(prev => [...prev, ...pending]);
    if (pending.length > 0) {
      setActiveEntryId(pending[pending.length - 1].id);
    }

    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
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
  }, [entries]);

  const removeEntry = (id: string) => {
    setEntries(prev => {
      const remaining = prev.filter(e => e.id !== id);
      if (activeEntryId === id) {
        const removedIdx = prev.findIndex(e => e.id === id);
        const next = remaining[removedIdx] || remaining[removedIdx - 1] || remaining[0] || null;
        setActiveEntryId(next ? next.id : null);
      }
      return remaining;
    });
  };

  const clearAll = () => {
    setEntries([]);
    setActiveEntryId(null);
  };

  const loadSampleCsr = useCallback(() => {
    const existing = entries.find(e => e.id.startsWith('sample-csr-') || e.name === 'sample_request.csr');
    if (existing) {
      setActiveEntryId(existing.id);
      return;
    }
    try {
      const csr = parseCSRFromText(SAMPLE_CSR_PEM);
      const entry: CSREntry = {
        id: 'sample-csr-' + Date.now(),
        name: 'sample_request.csr',
        result: { ok: true, csr },
        loading: false,
      };
      setEntries(prev => {
        if (prev.some(e => e.id.startsWith('sample-csr-') || e.name === 'sample_request.csr')) {
          return prev;
        }
        return [...prev, entry];
      });
      setActiveEntryId(entry.id);
    } catch (err: any) {
      console.error(err);
    }
  }, [entries]);

  const getAction = (err: string) => {
    if (!onNavigate) return undefined;
    if (err === 'ERR_CERT_NOT_CSR') {
      return {
        label: t('app.csr.goToTrustStore', 'Open in Trust Store Inspector'),
        onClick: () => onNavigate('trust-store'),
      };
    }
    if (err === 'ERR_CRL_NOT_CSR') {
      return {
        label: t('app.csr.goToCrlInspector', 'Open in CRL Inspector'),
        onClick: () => onNavigate('crl-inspector'),
      };
    }
    return undefined;
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>

        {/* Premium Header */}
        <div className="premium-header-panel theme-csr">
          <div className="premium-header-content">
            <div className="premium-header-icon-wrap csr">
              <FileKey size={24} />
            </div>
            <div className="premium-header-body">
              <div className="premium-header-eyebrow" style={{ color: '#818cf8' }}>
                <FileKey size={12} />
                <span>{t('app.csr.eyebrow', 'PKCS#10 Request Inspection')}</span>
              </div>
              <h2 className="premium-header-title">
                <Trans
                  i18nKey="app.csr.title"
                  defaults="<0>Certificate Signing Request (CSR)</0> Inspector"
                  components={[
                    <LearningTerm key="0" termId="csr">Certificate Signing Request (CSR)</LearningTerm>
                  ]}
                />
              </h2>
              <div className="premium-header-desc">
                <span>{t('app.csr.descP1', 'Verify embedded self-signatures, inspect requested Subject DN attributes and SAN extensions.')}</span>
                <span className="premium-header-note">
                  {t('app.csr.descP2', 'Client-side cryptographic parsing: modify and re-sign in place without exposing private keys.')}
                </span>
              </div>
              <div className="premium-header-tags">
                <span className="premium-header-tag active-pill">
                  <ShieldCheck size={12} style={{ color: 'var(--success-color)' }} />
                  <span>{t('app.csr.pills.selfSig', 'Self-Signature Verification')}</span>
                </span>
                <span className="premium-header-tag">
                  <FileKey size={12} style={{ color: '#818cf8' }} />
                  <span>{t('app.csr.pills.rfc2986', 'PKCS#10 RFC 2986')}</span>
                </span>
                <span className="premium-header-tag">
                  <Edit3 size={12} style={{ color: '#38bdf8' }} />
                  <span>{t('app.csr.pills.editor', 'Interactive Editor & Re-sign')}</span>
                </span>
                <span className="premium-header-tag">
                  <Lock size={12} style={{ color: '#fb923c' }} />
                  <span>{t('app.csr.pills.offline', '100% Offline Parsing')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <DropZone onFiles={handleFiles} onLoadSample={loadSampleCsr} hasSample={hasSample} />

        <input
          ref={addFileInputRef}
          type="file"
          accept=".csr,.req,.pem,.der,.cer,.txt"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files || []);
            if (files.length) handleFiles(files);
            e.target.value = '';
          }}
        />

        {entries.length > 0 && (
          <div style={{ marginTop: '2rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
                {t('app.csr.loadedFiles', 'Loaded Files')} ({entries.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                  onClick={() => addFileInputRef.current?.click()}
                >
                  <Upload size={13} /> {t('app.csr.addCsr', 'Add CSR')}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                  onClick={clearAll}
                >
                  <X size={13} /> {t('common.clearAll', 'Clear All')}
                </button>
              </div>
            </div>

            {/* Certificate Tabs Row */}
            <div className="chain-cert-tabs-container" style={{ marginBottom: '1.5rem' }}>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                flexShrink: 0,
                marginRight: '0.25rem'
              }}>
                <FileKey size={14} style={{ color: 'var(--text-accent-2)' }} />
                {t('app.csr.tabsLabel', 'CSRs')} ({entries.length}):
              </span>
              {entries.map(entry => {
                const isActive = activeEntryId === entry.id;
                const cn = entry.result.ok
                  ? (entry.result.csr.subjectFields.find(f => f.shortName === 'CN')?.value || entry.name)
                  : entry.name;
                const hasKey = entry.result.ok && !!entry.result.privateKeyPem;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setActiveEntryId(entry.id)}
                    className={`chain-cert-tab role-csr ${!entry.result.ok ? 'status-error' : ''} ${isActive ? 'active' : ''}`}
                    title={entry.name}
                  >
                    {isActive && <span className="tab-active-dot" />}
                    <FileKey size={13} className="tab-role-icon" />
                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cn}</span>
                    {hasKey && (
                      <span title={t('app.csr.editor.privateKeyAvailable', 'Private Key Available')} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Key size={11} style={{ color: '#c084fc', flexShrink: 0, marginLeft: 2 }} />
                      </span>
                    )}
                    <span
                      className="tab-action-btn btn-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEntry(entry.id);
                      }}
                      title={t('common.remove', 'Remove')}
                    >
                      <X size={12} />
                    </span>
                    {isActive && <span className="tab-accent-line" />}
                  </button>
                );
              })}
            </div>

            {/* Active CSR details panel */}
            {entries.filter(e => e.id === activeEntryId).map(entry => {
              if (entry.loading) {
                return (
                  <div key={entry.id} className="glass-panel" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <RefreshCw size={18} color="var(--text-accent)" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {t('app.csr.parsing', { name: entry.name, defaultValue: `Parsing ${entry.name}…` })}
                    </span>
                  </div>
                );
              }
              if (entry.result.ok) {
                const csr = entry.result.csr;
                const privateKeyPem = entry.result.privateKeyPem;
                return (
                  <CSRCard
                    key={entry.id}
                    item={{
                      id: entry.id,
                      name: entry.name,
                      csr,
                      privateKeyPem,
                    }}
                    onRemove={() => removeEntry(entry.id)}
                    onEdit={() => setEditingCsr({ csr, name: entry.name })}
                  />
                );
              }
              return (
                <ErrorCard
                  key={entry.id}
                  name={entry.name}
                  error={entry.result.error}
                  action={getAction(entry.result.error)}
                  onRemove={() => removeEntry(entry.id)}
                />
              );
            })}
          </div>
        )}

      </div>

      {/* CSR Editor Modal */}
      {editingCsr && (
        <CsrEditorModal
          isOpen={!!editingCsr}
          csr={editingCsr.csr}
          initialName={editingCsr.name}
          onClose={() => setEditingCsr(null)}
          onSave={(newCsr, fileName, generatedPrivateKeyPem) => {
            const newId = `csr-edited-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const newEntry: CSREntry = {
              id: newId,
              name: fileName,
              result: {
                ok: true,
                csr: newCsr,
                privateKeyPem: generatedPrivateKeyPem,
              },
              loading: false,
            };
            setEntries(prev => [...prev, newEntry]);
            setActiveEntryId(newId);
            showToast(t('app.csr.editor.saveSuccess', 'CSR successfully re-signed and loaded!'), 'success');
          }}
        />
      )}
    </div>
  );
}
