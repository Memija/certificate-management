import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Upload, AlertTriangle, CheckCircle, XCircle, ShieldCheck, Shield,
  Copy, Trash2, GitFork, List,
  Download, Eye, EyeOff, Globe, Sparkles, X, Lock, RefreshCw
} from 'lucide-react';
import { parseTrustStoreFile } from './utils/trustStoreParser';
import type { ParsedCertificate } from './utils/trustStoreParser';
import { createCryptographicChain, type ChainPreset } from './utils/sampleChainGenerator';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPurposesList, formatExtensionValue } from './utils/purposeFormatter';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';
import forge from 'node-forge';

interface CertNode {
  id: string;
  cert: ParsedCertificate;
  isSelfSigned: boolean;
  parent: CertNode | null;
  children: CertNode[];
  signatureVerified: boolean | null; // null if no parent in pool to verify against
}

function verifySignature(childPem: string, parentPem: string): boolean {
  try {
    const childCert = forge.pki.certificateFromPem(childPem);
    const parentCert = forge.pki.certificateFromPem(parentPem);
    return parentCert.verify(childCert) || childCert.verify(parentCert as any);
  } catch {
    return false;
  }
}

function verifySelfSignature(pem: string): boolean {
  try {
    const cert = forge.pki.certificateFromPem(pem);
    return cert.verify(cert as any);
  } catch {
    return false;
  }
}

function buildChains(certs: ParsedCertificate[]): { rootNodes: CertNode[]; orphanNodes: CertNode[]; allNodes: CertNode[] } {
  const allNodes: CertNode[] = certs.map((c, index) => ({
    id: `node-${index}-${c.fingerprintSha256 || 'cert'}`,
    cert: c,
    isSelfSigned: c.isRoot || (c.subject === c.issuer && verifySelfSignature(c.pem)),
    parent: null,
    children: [],
    signatureVerified: null,
  }));

  // Link parents and children
  for (const node of allNodes) {
    if (node.isSelfSigned) {
      node.signatureVerified = true;
      continue;
    }

    // 1. Try cryptographic verification against any node in pool
    for (const potentialParent of allNodes) {
      if (potentialParent !== node && verifySignature(node.cert.pem, potentialParent.cert.pem)) {
        node.parent = potentialParent;
        potentialParent.children.push(node);
        node.signatureVerified = true;
        break;
      }
    }

    // 2. If signature couldn't verify, fallback to DN / CN match
    if (!node.parent) {
      const dnMatch = allNodes.find(p => p !== node && (
        p.cert.subject === node.cert.issuer ||
        getSubjectCN(p.cert.subject) === getSubjectCN(node.cert.issuer)
      ));
      if (dnMatch) {
        node.parent = dnMatch;
        dnMatch.children.push(node);
        node.signatureVerified = false;
      }
    }
  }

  const rootNodes = allNodes.filter(n => n.isSelfSigned && n.parent === null);
  const orphanNodes = allNodes.filter(n => !n.isSelfSigned && n.parent === null);

  return { rootNodes, orphanNodes, allNodes };
}

function getSubjectCN(subject: string): string {
  return subject.match(/CN=([^,]+)/)?.[1]?.trim() ||
    subject.match(/O=([^,]+)/)?.[1]?.trim() ||
    subject;
}

// ─── Visual Graph Node Component ─────────────────────────────────────────────

function VisualTreeNode({
  node,
  selectedId,
  onSelectNode
}: {
  node: CertNode;
  selectedId: string | null;
  onSelectNode: (node: CertNode) => void;
}) {
  const { t, i18n } = useTranslation();
  const c = node.cert;
  const isExpired = new Date(c.validTo) < new Date();
  const cn = getSubjectCN(c.subject);
  const isSelected = selectedId === node.id;

  let roleClass = 'leaf-cert';
  let badgeClass = 'badge-leaf';
  let roleLabel = t('app.chain.roles.leafEntity', 'Leaf / End-Entity');
  let RoleIcon = Globe;

  if (node.isSelfSigned) {
    roleClass = 'root-anchor';
    badgeClass = 'badge-root';
    roleLabel = t('app.chain.roles.rootAnchor', 'Root CA (Trust Anchor)');
    RoleIcon = ShieldCheck;
  } else if (c.isIntermediate || node.children.length > 0) {
    roleClass = 'intermediate-ca';
    badgeClass = 'badge-intermediate';
    roleLabel = t('app.chain.roles.intermediateCa', 'Intermediate CA');
    RoleIcon = Shield;
  }

  let statusBorder = roleClass;
  if (isExpired || node.signatureVerified === false) {
    statusBorder = 'status-error';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <div
        className={`chain-node-card ${statusBorder} ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelectNode(node)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.55rem' }}>
          <span className={`chain-node-badge ${badgeClass}`} style={{ marginBottom: 0 }}>
            <RoleIcon size={12} /> {roleLabel}
          </span>
          {isExpired ? (
            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
              <span className="badge-dot pulse" /> {t('app.certDetails.expired', 'Expired')}
            </span>
          ) : node.signatureVerified === true ? (
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              <CheckCircle size={11} /> {t('app.chain.valid', 'Valid')}
            </span>
          ) : node.signatureVerified === false ? (
            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
              <XCircle size={11} /> {t('app.chain.badSig', 'Bad Sig')}
            </span>
          ) : (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              <AlertTriangle size={11} /> {t('app.chain.missingParent', 'Missing Parent')}
            </span>
          )}
        </div>

        <div className="chain-node-title" title={c.subject}>
          {cn}
        </div>

        <div className="chain-node-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>{t('app.certDetails.validTo', 'Expires')}:</span>
            <strong
              style={{ color: isExpired ? 'var(--danger-color)' : 'var(--text-primary)', cursor: 'help' }}
              title={formatExpiryTooltip(c.validTo, t, i18n.language)}
            >
              {new Date(c.validTo).toLocaleDateString()}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>
                ({formatExpiry(c.validTo, t, i18n.language)})
              </span>
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('app.chain.key', 'Key')}:</span>
            <span className="mono" style={{ fontSize: '0.75rem' }}>
              {c.publicKeyAlgorithm} {c.publicKeySize ? `(${c.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''}
            </span>
          </div>
        </div>
      </div>

      {node.children.length > 0 && (
        <>
          <div className="chain-connector-line">
            <div className="chain-connector-arrow" />
            <div className="chain-connector-pill">
              <CheckCircle size={11} style={{ color: 'var(--success-color)' }} />
              <span>{t('app.chain.signsAndIssues', 'Signs & Issues')} ({node.children.length})</span>
            </div>
            <div className="chain-connector-arrow" />
          </div>

          <div className="chain-graph-level" style={{ marginTop: '0.5rem' }}>
            {node.children.map(child => (
              <VisualTreeNode
                key={child.id}
                node={child}
                selectedId={selectedId}
                onSelectNode={onSelectNode}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Selected Node Detail Inspector ──────────────────────────────────────────

function NodeInspector({
  node,
  allNodes = [],
  onSelectNode,
  onClose
}: {
  node: CertNode;
  allNodes?: CertNode[];
  onSelectNode?: (node: CertNode) => void;
  onClose: () => void;
}) {
  const c = node.cert;
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [showPem, setShowPem] = useState(false);
  const now = new Date();
  const validToDate = new Date(c.validTo);
  const isExpired = validToDate < now;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyVal = (val: string, _label: string) => {
    navigator.clipboard.writeText(val);
    showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success');
  };

  const downloadPem = () => {
    if (!c.pem) return;
    const blob = new Blob([c.pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `${getSubjectCN(c.subject).replace(/[^a-zA-Z0-9_-]/g, '_')}.pem`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  };

  const downloadDer = () => {
    if (!c.pem) return;
    try {
      const b64 = c.pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `${getSubjectCN(c.subject).replace(/[^a-zA-Z0-9_-]/g, '_')}.der`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (e) {
      showToast('Failed to export DER', 'error');
    }
  };

  return (
    <div className="chain-modal-backdrop" onClick={onClose}>
      <div className="chain-modal-dialog" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>
                {t('app.chain.inspectingNode', 'Inspecting Node')}
              </span>
              {node.isSelfSigned ? (
                <span className="badge badge-success"><ShieldCheck size={12} /> {t('app.chain.rootCaSelfSigned', 'Root CA (Self-Signed)')}</span>
              ) : node.signatureVerified ? (
                <span className="badge badge-success"><CheckCircle size={12} /> {t('app.chain.cryptoVerified', 'Cryptographically Verified')}</span>
              ) : (
                <span className="badge badge-warning"><AlertTriangle size={12} /> {t('app.chain.parentMissing', 'Parent Missing in Pool')}</span>
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {getSubjectCN(c.subject)}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-download-pem btn-sm" onClick={downloadPem}>
              <Download size={12} /> PEM
            </button>
            <button className="btn btn-download-der btn-sm" onClick={downloadDer}>
              <Download size={12} /> DER
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPem(!showPem)}>
              <Eye size={12} /> {showPem ? t('app.chain.hidePem', 'Hide PEM') : t('app.chain.viewPem', 'View PEM')}
            </button>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose} title={t('app.chain.closeInspector', 'Close Inspector')}>
              <X size={14} />
            </button>
          </div>
        </div>

        {allNodes.length > 1 && onSelectNode && (
          <div className="chain-cert-tabs-container" style={{ paddingBottom: '0.65rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border-subtle)' }}>
            {allNodes.map(n => {
              const isActive = n.id === node.id;
              const cn = getSubjectCN(n.cert.subject);
              const isExp = new Date(n.cert.validTo) < new Date();
              const hasErr = isExp || n.signatureVerified === false;
              let rType: 'root' | 'intermediate' | 'leaf' = 'leaf';
              let RIcon = Globe;
              if (n.isSelfSigned) {
                rType = 'root';
                RIcon = ShieldCheck;
              } else if (n.cert.isIntermediate || n.children.length > 0) {
                rType = 'intermediate';
                RIcon = Shield;
              }

              return (
                <button
                  key={n.id}
                  onClick={() => onSelectNode(n)}
                  className={`chain-cert-tab role-${rType} ${hasErr ? 'status-error' : ''} ${isActive ? 'active' : ''}`}
                  title={n.cert.subject}
                >
                  {isActive && <span className="tab-active-dot" />}
                  <RIcon size={13} className="tab-role-icon" />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cn}</span>
                  {n.isSelfSigned && (
                    <span className="badge badge-root" style={{ fontSize: '0.62rem', padding: '0.05rem 0.3rem' }}>
                      {t('app.chain.roles.root', 'Root')}
                    </span>
                  )}
                  {isActive && <span className="tab-accent-line" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="details-grid">
          <div className="details-label">{t('app.chain.subjectDn', 'Subject DN')}</div>
          <div className="details-value copy-trigger-wrap" onClick={() => copyVal(c.subject, 'Subject DN')} title="Click to copy">
            <span>{c.subject}</span>
            <Copy size={12} className="copy-trigger-icon" />
          </div>

          <div className="details-label">{t('app.chain.issuerDn', 'Issuer DN')}</div>
          <div className="details-value copy-trigger-wrap" onClick={() => copyVal(c.issuer, 'Issuer DN')} title="Click to copy">
            <span>{c.issuer}</span>
            <Copy size={12} className="copy-trigger-icon" />
          </div>

          <div className="details-label">{t('app.chain.serialNumber', 'Serial Number')}</div>
          <div className="details-value mono copy-trigger-wrap" onClick={() => copyVal(c.serialNumber, 'Serial Number')} title="Click to copy">
            <span>{c.serialNumber}</span>
            <Copy size={12} className="copy-trigger-icon" />
          </div>

          <div className="details-label">{t('app.chain.validity', 'Validity')}</div>
          <div className="details-value">
            {new Date(c.validFrom).toLocaleDateString()} - {new Date(c.validTo).toLocaleDateString()}{' '}
            <span
              style={{ fontSize: '0.8rem', color: isExpired ? 'var(--danger-color)' : 'var(--text-secondary)', marginLeft: '0.35rem', cursor: 'help' }}
              title={formatExpiryTooltip(c.validTo, t, i18n.language)}
            >
              ({formatExpiry(c.validTo, t, i18n.language)})
            </span>
            {isExpired && <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>{t('app.certDetails.expired', 'Expired')}</span>}
          </div>

          <div className="details-label">{t('app.chain.publicKey', 'Public Key')}</div>
          <div className="details-value">
            {c.publicKeyAlgorithm} {c.publicKeySize ? `(${c.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''} &nbsp;•&nbsp; Sig: {c.signatureAlgorithm}
          </div>

          <div className="details-label">{t('app.chain.sha256', 'SHA-256 Fingerprint')}</div>
          <div className="details-value mono copy-trigger-wrap" style={{ wordBreak: 'break-all', fontSize: '0.82rem' }} onClick={() => copyVal(c.fingerprintSha256, 'SHA-256 Fingerprint')} title="Click to copy">
            <span>{c.fingerprintSha256}</span>
            <Copy size={12} className="copy-trigger-icon" />
          </div>

          <div className="details-label">{t('app.chain.keyUsages', 'Key Usages')}</div>
          <div className="details-value">
            {formatPurposesList(c.purposes, t) || t('app.chain.noneSpecified', 'None specified')}
          </div>
        </div>

        {c.extensions && c.extensions.length > 0 && (
          <details style={{ marginTop: '1.25rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>
              {t('app.chain.extensions', 'Extensions')} ({c.extensions.length})
            </summary>
            <div className="details-grid" style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border-subtle)', padding: '1rem 1.25rem', borderRadius: '10px' }}>
              {c.extensions.map((ex, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  <div className="details-label">
                    {t([`app.winCertStore.extensions.${ex.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ex.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ex.name) as string}
                  </div>
                  <div className="details-value">
                    <div>
                      OID: <span className="mono">{ex.oid}</span>
                      {ex.critical && (
                        <span className="badge badge-danger" style={{ fontSize: '0.68rem', marginLeft: '0.4rem' }}>
                          {t('app.certDetails.critical', '(Critical)')}
                        </span>
                      )}
                    </div>
                    {ex.value && (
                      <div className="mono" style={{ wordBreak: 'break-all', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                        {formatExtensionValue(ex.name, ex.oid, ex.value, t) || t('app.chain.configured', 'Configured')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {showPem && (
          <pre className="code-block" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
            {c.pem}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Main ChainValidator Component ───────────────────────────────────────────

export function ChainValidator() {
  const { t, i18n } = useTranslation();
  const [certs, setCerts] = useState<ParsedCertificate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [inspectingNode, setInspectingNode] = useState<CertNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSelectCertRef = useRef<ParsedCertificate | null>(null);
  const { showToast } = useToast();
  const [activePreset, setActivePreset] = useState<ChainPreset | null>(null);

  interface PendingPfxUnlock {
    file: File;
    passwordInput: string;
    error?: string;
    loading?: boolean;
  }

  const [pendingPfxUnlock, setPendingPfxUnlock] = useState<PendingPfxUnlock | null>(null);
  const [showPfxPassword, setShowPfxPassword] = useState(false);

  const handleUnlockPfxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPfxUnlock || pendingPfxUnlock.loading) return;

    if (!pendingPfxUnlock.passwordInput?.trim()) {
      setPendingPfxUnlock(prev => prev ? {
        ...prev,
        loading: false,
        error: t('app.trustStore.inspector.pkcs12RequiresPassword', 'This PKCS#12 file requires a password.')
      } : null);
      return;
    }

    setPendingPfxUnlock(prev => prev ? { ...prev, loading: true, error: undefined } : null);

    try {
      const parsed = await parseTrustStoreFile(pendingPfxUnlock.file, pendingPfxUnlock.passwordInput);
      if (parsed.entries.length > 0) {
        const newCerts = parsed.entries.map(entry => entry.certificate);
        pendingSelectCertRef.current = newCerts[newCerts.length - 1];
        setActivePreset(null);
        setCerts(prev => [...prev, ...newCerts]);
        const count = newCerts.length;
        setPendingPfxUnlock(null);
        showToast(
          t('app.chain.loadedPoolSuccess', {
            count,
            defaultValue: count === 1 ? 'Loaded 1 certificate into chain pool' : `Loaded ${count} certificates into chain pool`
          }),
          'success'
        );
      } else {
        const rawWarning = parsed.warnings[0] || 'Incorrect password.';
        const localizedError = rawWarning === 'Incorrect password.'
          ? t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.')
          : rawWarning === 'This PKCS#12 file requires a password.'
          ? t('app.trustStore.inspector.pkcs12RequiresPassword', 'This PKCS#12 file requires a password.')
          : rawWarning;
        setPendingPfxUnlock(prev => prev ? {
          ...prev,
          loading: false,
          error: localizedError,
        } : null);
      }
    } catch (err: any) {
      setPendingPfxUnlock(prev => prev ? {
        ...prev,
        loading: false,
        error: err.message || t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.'),
      } : null);
    }
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    const certsToAdd: ParsedCertificate[] = [];
    let pfxToUnlock: File | null = null;

    for (const file of files) {
      try {
        const parsed = await parseTrustStoreFile(file, '');
        if (parsed.needsPassword) {
          if (!pfxToUnlock) {
            pfxToUnlock = file;
          }
          continue;
        }

        if (parsed.entries.length > 0) {
          for (const entry of parsed.entries) {
            certsToAdd.push(entry.certificate);
          }
        } else if (parsed.warnings.length > 0) {
          const rawWarn = parsed.warnings[0];
          const localizedWarn = rawWarn === 'This PKCS#12 file requires a password.'
            ? t('app.trustStore.inspector.pkcs12RequiresPassword', 'This PKCS#12 file requires a password.')
            : rawWarn === 'Incorrect password.'
            ? t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.')
            : rawWarn;
          setError(t('app.chain.fileWarning', { fileName: file.name, warning: localizedWarn, defaultValue: `Warning for "${file.name}": ${localizedWarn}` }));
        }
      } catch (err: any) {
        setError(t('app.chain.fileProcessError', { fileName: file.name, error: err.message || 'Unknown error', defaultValue: `Failed to process "${file.name}": ${err.message || 'Unknown error'}` }));
      }
    }

    if (certsToAdd.length > 0) {
      pendingSelectCertRef.current = certsToAdd[certsToAdd.length - 1];
      setActivePreset(null);
      setCerts(prev => [...prev, ...certsToAdd]);
      showToast(
        t('app.chain.loadedPoolSuccess', {
          count: certsToAdd.length,
          defaultValue: certsToAdd.length === 1 ? 'Loaded 1 certificate into chain pool' : `Loaded ${certsToAdd.length} certificates into chain pool`
        }),
        'success'
      );
    }

    if (pfxToUnlock) {
      setPendingPfxUnlock({
        file: pfxToUnlock,
        passwordInput: '',
        error: undefined,
        loading: false,
      });
      setShowPfxPassword(false);
    } else if (files.length > 0 && certsToAdd.length === 0 && !error) {
      setError(t('app.chain.noValidCerts', 'No valid X.509 certificates could be extracted from the uploaded files.'));
    }
  }, [error, showToast, t]);

  const loadSample = (preset: ChainPreset, label: string) => {
    if (activePreset === preset && certs.length > 0) {
      return;
    }
    try {
      const sampleCerts = createCryptographicChain(preset);
      setActivePreset(preset);
      setCerts(sampleCerts);
      setInspectingNode(null);
      setActiveNodeId(null);
      setError(null);
      showToast(t('app.chain.loadedSample', { label, defaultValue: `Loaded sample: ${label}` }), 'info');
    } catch (e: any) {
      setError(t('app.chain.failedLoadSample', { error: e.message, defaultValue: `Failed to load sample: ${e.message}` }));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only turn off dragging if leaving the outer window / main container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const { rootNodes, orphanNodes, allNodes } = useMemo(() => buildChains(certs), [certs]);

  // Sync activeNodeId with allNodes: default to leaf/root if unset or invalid
  useEffect(() => {
    if (allNodes.length === 0) {
      setActiveNodeId(null);
      setInspectingNode(null);
    } else if (!activeNodeId || !allNodes.some(n => n.id === activeNodeId)) {
      const defaultNode = allNodes[allNodes.length - 1] || allNodes[0];
      setActiveNodeId(defaultNode.id);
    }
  }, [allNodes, activeNodeId]);

  // Select newly added certificate automatically
  useEffect(() => {
    if (pendingSelectCertRef.current && allNodes.length > 0) {
      const targetCert = pendingSelectCertRef.current;
      const found = allNodes.find(n => n.cert === targetCert) ||
                    allNodes.find(n => n.cert.fingerprintSha256 === targetCert.fingerprintSha256);
      if (found) {
        setActiveNodeId(found.id);
        pendingSelectCertRef.current = null;
      }
    }
  }, [allNodes]);

  // Sync inspectingNode reference or reset if pool emptied or cert removed
  useEffect(() => {
    if (allNodes.length === 0) {
      setInspectingNode(null);
    } else if (inspectingNode) {
      const stillExists = allNodes.find(n => n.id === inspectingNode.id);
      if (!stillExists) {
        setInspectingNode(null);
      } else if (stillExists !== inspectingNode) {
        setInspectingNode(stillExists);
      }
    }
  }, [allNodes, inspectingNode]);

  const removeCert = useCallback((nodeId: string) => {
    const targetNode = allNodes.find(n => n.id === nodeId);
    if (targetNode) {
      setActivePreset(null);
      setCerts(prev => prev.filter(c => c !== targetNode.cert));
      if (activeNodeId === nodeId) {
        const remaining = allNodes.filter(n => n.id !== nodeId);
        setActiveNodeId(remaining[0]?.id || null);
      }
      if (inspectingNode?.id === nodeId) {
        setInspectingNode(null);
      }
      showToast(t('app.chain.certRemoved', 'Certificate removed from pool'), 'info');
    }
  }, [allNodes, activeNodeId, inspectingNode, showToast, t]);

  const handleTabClick = (node: CertNode) => {
    if (activeNodeId === node.id) {
      setInspectingNode(node);
    } else {
      setActiveNodeId(node.id);
    }
  };

  const allChainComplete = certs.length > 0 && orphanNodes.length === 0 && rootNodes.length > 0;
  const hasSignMismatch = certs.some(c => {
    const iss = certs.find(p => p.subject === c.issuer && p !== c);
    return iss && !verifySignature(c.pem, iss.pem);
  });

  return (
    <div
      className="main-content"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          border: '3px dashed var(--text-accent)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--card-bg)',
            padding: '2.5rem 3.5rem',
            borderRadius: '16px',
            border: '1px solid var(--text-accent)',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
            <Upload size={54} color="var(--text-accent)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.35rem' }}>
              {t('app.chain.dropZoneTitle', 'Drop certificates here to reconstruct trust graph')}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('app.chain.dropZoneDesc', 'Upload single files or multi-certificate bundles (.pem, .crt, .p7b, .pfx)')}
            </p>
          </div>
        </div>
      )}
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('app.chain.title', 'Certificate Chain Visual Graph & Validator')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
              {t('app.chain.subtitle', 'Reconstruct and cryptographically verify multi-tier PKI hierarchies (Root CA → Intermediate → Leaf) in an interactive visual tree diagram.')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {certs.length > 0 && (
              <>
                <div style={{ display: 'inline-flex', padding: '0.2rem', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--glass-border-subtle)' }}>
                  <button
                    className={`btn btn-sm ${viewMode === 'graph' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('graph')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    <GitFork size={13} /> {t('app.chain.visualGraph', 'Visual Graph')}
                  </button>
                  <button
                    className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('list')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    <List size={13} /> {t('app.chain.classicStack', 'Classic Stack')}
                  </button>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-sm"
                >
                  <Upload size={13} /> {t('app.chain.addCerts', 'Add Certs')}
                </button>
                <button
                  onClick={() => { setCerts([]); setError(null); setActiveNodeId(null); setInspectingNode(null); setActivePreset(null); }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} /> {t('common.clear', 'Clear')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Sample Presets Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={14} style={{ color: 'var(--cat-validation)' }} /> {t('app.chain.trySamples', 'Try Sample Chains:')}
          </span>
          <button
            className={`chain-sample-pill${activePreset === '3-tier-web' && certs.length > 0 ? ' active' : ''}`}
            onClick={() => loadSample('3-tier-web', '3-Tier Web PKI (Root → Inter → Leaf)')}
            disabled={activePreset === '3-tier-web' && certs.length > 0}
            title={activePreset === '3-tier-web' && certs.length > 0 ? t('app.chain.sampleAlreadyLoaded', 'Sample already loaded') : undefined}
          >
            {t('app.chain.sample3Tier', '3-Tier Web PKI')}
          </button>
          <button
            className={`chain-sample-pill${activePreset === '4-tier-enterprise' && certs.length > 0 ? ' active' : ''}`}
            onClick={() => loadSample('4-tier-enterprise', '4-Tier Enterprise (Root → Policy → Issuing → Leaf)')}
            disabled={activePreset === '4-tier-enterprise' && certs.length > 0}
            title={activePreset === '4-tier-enterprise' && certs.length > 0 ? t('app.chain.sampleAlreadyLoaded', 'Sample already loaded') : undefined}
          >
            {t('app.chain.sample4Tier', '4-Tier Enterprise PKI')}
          </button>
          <button
            className={`chain-sample-pill${activePreset === 'multi-leaf-branch' && certs.length > 0 ? ' active' : ''}`}
            onClick={() => loadSample('multi-leaf-branch', 'Multi-Leaf Branching Tree')}
            disabled={activePreset === 'multi-leaf-branch' && certs.length > 0}
            title={activePreset === 'multi-leaf-branch' && certs.length > 0 ? t('app.chain.sampleAlreadyLoaded', 'Sample already loaded') : undefined}
          >
            {t('app.chain.sampleMultiLeaf', 'Multi-Leaf Branch')}
          </button>
          <button
            className={`chain-sample-pill${activePreset === 'broken-intermediate' && certs.length > 0 ? ' active' : ''}`}
            onClick={() => loadSample('broken-intermediate', 'Broken Chain (Missing Intermediate)')}
            disabled={activePreset === 'broken-intermediate' && certs.length > 0}
            title={activePreset === 'broken-intermediate' && certs.length > 0 ? t('app.chain.sampleAlreadyLoaded', 'Sample already loaded') : undefined}
          >
            {t('app.chain.sampleBroken', 'Broken Chain Warning')}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pem,.crt,.cer,.der,.p7b,.p12,.pfx,.jks"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {error}
            </span>
            <XCircle size={16} style={{ cursor: 'pointer' }} onClick={() => setError(null)} />
          </div>
        )}

        {certs.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`drop-zone ${isDragging ? 'active' : ''}`}
          >
            <div className="drop-zone-icon">
              <GitFork size={44} style={{ color: 'var(--cat-validation)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              {t('app.chain.dropZoneTitle', 'Drop certificates here to reconstruct trust graph')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 auto 1.25rem auto', fontSize: '0.9rem', maxWidth: '520px', textAlign: 'center' }}>
              {t('app.chain.dropZoneDesc', 'Upload single files or multi-certificate bundles (.pem, .crt, .p7b, .pfx) to visualize and mathematically verify the full certification path.')}
            </p>
            <div className="drop-zone-formats">
              <span className="drop-zone-format-pill">.PEM</span>
              <span className="drop-zone-format-pill">.CRT / .CER</span>
              <span className="drop-zone-format-pill">.P7B / PKCS#7</span>
              <span className="drop-zone-format-pill">.PFX / .P12</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Status Summary Banner */}
            <div className="glass-panel" style={{
              padding: '1.15rem 1.5rem',
              background: allChainComplete && !hasSignMismatch ? 'var(--success-bg)' : 'var(--warning-bg)',
              borderColor: allChainComplete && !hasSignMismatch ? 'var(--success-border)' : 'var(--warning-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className={`metric-icon-wrap ${allChainComplete && !hasSignMismatch ? 'success' : 'warning'}`}>
                  {allChainComplete && !hasSignMismatch ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.2rem 0', color: allChainComplete && !hasSignMismatch ? 'var(--success-color)' : 'var(--warning-color)', fontSize: '1.05rem' }}>
                    {allChainComplete && !hasSignMismatch
                      ? t('app.chain.validCompleteHierarchy', 'Valid Complete Trust Hierarchy')
                      : t('app.chain.incompleteChain', 'Incomplete Chain (Missing Intermediate or Issuer in Pool)')}
                  </h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                    {allChainComplete && !hasSignMismatch
                      ? t('app.chain.allCertsLinkRoot', 'All {{count}} certificate(s) link back to a verified self-signed Root CA.', { count: certs.length })
                      : t('app.chain.missingParentDesc', 'One or more certificates cannot find their parent issuer in the current pool.')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span className="badge" style={{ fontSize: '0.78rem' }}>{t('app.chain.loadedCerts', '{{count}} Loaded Certs', { count: certs.length })}</span>
                <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>{t('app.chain.rootAnchorsCount', '{{count}} Root Anchor(s)', { count: rootNodes.length })}</span>
              </div>
            </div>

            {/* Certificate Tabs Row */}
            <div className="chain-cert-tabs-container">
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
                <Shield size={14} style={{ color: 'var(--cat-validation)' }} />
                {t('app.chain.certTabsLabel', 'Certificates')} ({allNodes.length}):
              </span>
              {allNodes.map(node => {
                const isActive = activeNodeId === node.id;
                const cn = getSubjectCN(node.cert.subject);
                const isExp = new Date(node.cert.validTo) < new Date();
                const hasErr = isExp || node.signatureVerified === false;
                let roleType: 'root' | 'intermediate' | 'leaf' = 'leaf';
                let RoleIcon = Globe;
                if (node.isSelfSigned) {
                  roleType = 'root';
                  RoleIcon = ShieldCheck;
                } else if (node.cert.isIntermediate || node.children.length > 0) {
                  roleType = 'intermediate';
                  RoleIcon = Shield;
                }

                return (
                  <button
                    key={node.id}
                    onClick={() => handleTabClick(node)}
                    className={`chain-cert-tab role-${roleType} ${hasErr ? 'status-error' : ''} ${isActive ? 'active' : ''}`}
                    title={node.cert.subject}
                  >
                    {isActive && <span className="tab-active-dot" />}
                    <RoleIcon size={13} className="tab-role-icon" />
                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cn}</span>
                    {node.isSelfSigned && (
                      <span className="badge badge-root" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                        {t('app.chain.roles.root', 'Root')}
                      </span>
                    )}
                    <span
                      className="tab-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveNodeId(node.id);
                        setInspectingNode(node);
                      }}
                      title={t('app.chain.inspectNode', 'Inspect details')}
                    >
                      <Eye size={12} />
                    </span>
                    <span
                      className="tab-action-btn btn-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCert(node.id);
                      }}
                      title={t('common.remove', 'Remove')}
                    >
                      <X size={12} />
                    </span>
                    {isActive && <span className="tab-accent-line" />}
                  </button>
                );
              })}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-sm btn-secondary"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '9px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  border: '1px dashed var(--text-accent)',
                  color: 'var(--text-accent)',
                  background: 'rgba(56, 189, 248, 0.05)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title={t('app.chain.addCerts', 'Add Certs')}
              >
                <Upload size={13} />
                <span>+ {t('app.chain.addCerts', 'Add Certs')}</span>
              </button>
            </div>

            {/* View Mode 1: Interactive Visual Graph */}
            {viewMode === 'graph' ? (
              <div className="chain-graph-wrapper animate-fade-in">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <GitFork size={15} style={{ color: 'var(--cat-validation)' }} />
                    <span>{t('app.chain.clickNodeHint', 'Click any node to inspect detailed cryptographic properties')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-root"><ShieldCheck size={11} /> {t('app.chain.roles.root', 'Root')}</span>
                    <span className="badge badge-intermediate"><Shield size={11} /> {t('app.chain.roles.intermediate', 'Intermediate')}</span>
                    <span className="badge badge-leaf"><Globe size={11} /> {t('app.chain.roles.leaf', 'Leaf')}</span>
                  </div>
                </div>

                <div className="chain-graph-tree">
                  {rootNodes.map(rootNode => (
                    <VisualTreeNode
                      key={rootNode.id}
                      node={rootNode}
                      selectedId={activeNodeId}
                      onSelectNode={(node) => {
                        setActiveNodeId(node.id);
                        setInspectingNode(node);
                      }}
                    />
                  ))}

                  {orphanNodes.length > 0 && (
                    <div style={{ width: '100%', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--warning-border)' }}>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} /> {t('app.chain.orphanedChains', 'Orphaned / Incomplete Chains')}
                        </span>
                      </div>
                      <div className="chain-graph-level">
                        {orphanNodes.map(node => (
                          <VisualTreeNode
                            key={node.id}
                            node={node}
                            selectedId={activeNodeId}
                            onSelectNode={(node) => {
                              setActiveNodeId(node.id);
                              setInspectingNode(node);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* View Mode 2: Classic Card Stack */
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allNodes.map(node => {
                  const c = node.cert;
                  const isExp = new Date(c.validTo) < new Date();
                  const isSelected = activeNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      className={`glass-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '1.25rem 1.5rem',
                        cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--accent-color)' : undefined,
                        boxShadow: isSelected ? '0 0 16px rgba(16, 185, 129, 0.25)' : undefined
                      }}
                      onClick={() => {
                        setActiveNodeId(node.id);
                        setInspectingNode(node);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                            {node.isSelfSigned ? <span className="badge badge-root">{t('app.certDetails.rootCa', 'Root CA')}</span> : <span className="badge badge-intermediate">{t('app.chain.intermediateLeaf', 'Intermediate / Leaf')}</span>}
                            {isExp ? <span className="badge badge-danger">{t('app.certDetails.expired', 'Expired')}</span> : <span className="badge badge-success">{t('app.chain.valid', 'Valid')}</span>}
                          </div>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{getSubjectCN(c.subject)}</h4>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('app.certDetails.issuer', 'Issuer')}: {c.issuer}</p>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {t('app.certDetails.validTo', 'Expires')}: {new Date(c.validTo).toLocaleDateString()}{' '}
                          <span
                            style={{ color: isExp ? 'var(--danger-color)' : 'var(--text-secondary)', cursor: 'help' }}
                            title={formatExpiryTooltip(c.validTo, t, i18n.language)}
                          >
                            ({formatExpiry(c.validTo, t, i18n.language)})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Node Inspector Drawer */}
            {inspectingNode && (
              <NodeInspector
                node={inspectingNode}
                allNodes={allNodes}
                onSelectNode={(node) => {
                  setActiveNodeId(node.id);
                  setInspectingNode(node);
                }}
                onClose={() => setInspectingNode(null)}
              />
            )}

            {/* PFX / PKCS#12 Unlock Modal */}
            {pendingPfxUnlock && (
              <div
                className="chain-modal-backdrop"
                onClick={() => !pendingPfxUnlock.loading && setPendingPfxUnlock(null)}
              >
                <div
                  className="chain-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  style={{ maxWidth: '440px', width: '90%' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="metric-icon-wrap warning" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={18} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {t('app.chain.unlockPfxTitle', 'Unlock PKCS#12 / PFX Keystore')}
                      </h3>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => !pendingPfxUnlock.loading && setPendingPfxUnlock(null)}
                      title={t('common.cancel', 'Cancel')}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                    {t('app.chain.pfxPasswordPrompt', {
                      fileName: pendingPfxUnlock.file.name,
                      defaultValue: `The file "${pendingPfxUnlock.file.name}" is password-protected. Enter the password to extract certificates into the chain validation pool.`
                    })}
                  </p>

                  {pendingPfxUnlock.error && (
                    <div
                      className="glass-card"
                      style={{
                        padding: '0.6rem 0.8rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderColor: 'var(--danger-border)',
                        color: 'var(--danger-color)',
                        marginBottom: '1rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      {pendingPfxUnlock.error}
                    </div>
                  )}

                  <form onSubmit={handleUnlockPfxSubmit}>
                    <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                      <input
                        type={showPfxPassword ? 'text' : 'password'}
                        className="form-input"
                        autoFocus
                        placeholder={t('app.trustStore.inspector.passwordPlaceholder', 'Enter keystore password…')}
                        value={pendingPfxUnlock.passwordInput}
                        onChange={e => setPendingPfxUnlock(prev => prev ? { ...prev, passwordInput: e.target.value, error: undefined } : null)}
                        onBlur={() => {
                          if (!pendingPfxUnlock.passwordInput?.trim()) {
                            setPendingPfxUnlock(prev => prev ? {
                              ...prev,
                              error: t('app.trustStore.inspector.pkcs12RequiresPassword', 'This PKCS#12 file requires a password.')
                            } : null);
                          }
                        }}
                        style={{ paddingRight: '2.5rem', width: '100%' }}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPfxPassword(!showPfxPassword)}
                        title={showPfxPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
                        aria-label={showPfxPassword ? t('app.trustStore.inspector.hidePassword', 'Hide password') : t('app.trustStore.inspector.showPassword', 'Show password')}
                      >
                        {showPfxPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setPendingPfxUnlock(null)}
                        disabled={pendingPfxUnlock.loading}
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={pendingPfxUnlock.loading}
                      >
                        {pendingPfxUnlock.loading ? (
                          <>
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            {t('app.chain.unlocking', 'Unlocking…')}
                          </>
                        ) : (
                          t('app.trustStore.inspector.unlock', 'Unlock')
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
