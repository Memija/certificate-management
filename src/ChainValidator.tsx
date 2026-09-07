import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Upload, AlertTriangle, CheckCircle, XCircle, ShieldCheck, Shield,
  Copy, Trash2, GitFork, List,
  Download, Eye, Globe, Sparkles, X
} from 'lucide-react';
import { parseTrustStoreFile } from './utils/trustStoreParser';
import type { ParsedCertificate } from './utils/trustStoreParser';
import { createCryptographicChain, type ChainPreset } from './utils/sampleChainGenerator';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPurposesList, formatKeyUsageValue } from './utils/purposeFormatter';
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
    id: `${c.fingerprintSha256}-${index}`,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span className={`chain-node-badge ${badgeClass}`}>
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
  onClose
}: {
  node: CertNode;
  onClose: () => void;
}) {
  const c = node.cert;
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [showPem, setShowPem] = useState(false);
  const now = new Date();
  const validToDate = new Date(c.validTo);
  const isExpired = validToDate < now;

  const copyVal = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    showToast(`Copied ${label} to clipboard`, 'success');
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
    <div className="glass-panel animate-slide-up" style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--glass-border-accent)' }}>
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
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.88rem' }}>
            {t('app.chain.extensions', 'Extensions')} ({c.extensions.length})
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
            {c.extensions.map((ex, idx) => (
              <div key={idx} style={{ padding: '0.5rem 0.75rem', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border-subtle)', fontSize: '0.8rem' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                  {t([`app.winCertStore.extensions.${ex.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ex.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ex.name)}
                </strong>
                <span className="mono" style={{ color: 'var(--text-muted)', wordBreak: 'break-all', fontSize: '0.75rem' }}>
                  {ex.name === 'Key Usage' || ex.oid === '2.5.29.15'
                    ? formatKeyUsageValue(ex.value, t)
                    : (ex.value || t('app.chain.configured', 'Configured'))}
                </span>
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
  );
}

// ─── Main ChainValidator Component ───────────────────────────────────────────

export function ChainValidator() {
  const { t, i18n } = useTranslation();
  const [certs, setCerts] = useState<ParsedCertificate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [selectedNode, setSelectedNode] = useState<CertNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    let addedCount = 0;
    for (const file of files) {
      try {
        const parsed = await parseTrustStoreFile(file, '');
        if (parsed.entries.length > 0) {
          setCerts(prev => {
            const existingFps = new Set(prev.map(p => p.fingerprintSha256));
            const newCerts = parsed.entries
              .map(e => e.certificate)
              .filter(c => !existingFps.has(c.fingerprintSha256));
            return [...prev, ...newCerts];
          });
          addedCount += parsed.entries.length;
        } else if (parsed.warnings.length > 0) {
          setError(`Warning for "${file.name}": ${parsed.warnings[0]}`);
        }
      } catch (err: any) {
        setError(`Failed to process "${file.name}": ${err.message || 'Unknown error'}`);
      }
    }
    if (addedCount === 0 && files.length > 0 && !error) {
      setError('No valid X.509 certificates could be extracted from the uploaded files.');
    } else if (addedCount > 0) {
      showToast(`Loaded ${addedCount} certificate(s) into chain pool`, 'success');
    }
  }, [error, showToast]);

  const loadSample = (preset: ChainPreset, label: string) => {
    try {
      const sampleCerts = createCryptographicChain(preset);
      setCerts(sampleCerts);
      setError(null);
      showToast(`Loaded sample: ${label}`, 'info');
    } catch (e: any) {
      setError(`Failed to load sample: ${e.message}`);
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

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const { rootNodes, orphanNodes, allNodes } = useMemo(() => buildChains(certs), [certs]);

  // Default select first node when certs change
  useEffect(() => {
    if (allNodes.length > 0 && !selectedNode) {
      setSelectedNode(rootNodes[0] || orphanNodes[0] || allNodes[0]);
    } else if (allNodes.length === 0) {
      setSelectedNode(null);
    }
  }, [allNodes, rootNodes, orphanNodes, selectedNode]);

  const allChainComplete = certs.length > 0 && orphanNodes.length === 0 && rootNodes.length > 0;
  const hasSignMismatch = certs.some(c => {
    const iss = certs.find(p => p.subject === c.issuer && p !== c);
    return iss && !verifySignature(c.pem, iss.pem);
  });

  return (
    <div className="main-content">
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
                  onClick={() => { setCerts([]); setError(null); setSelectedNode(null); }}
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
          <button className="chain-sample-pill" onClick={() => loadSample('3-tier-web', '3-Tier Web PKI (Root → Inter → Leaf)')}>
            {t('app.chain.sample3Tier', '3-Tier Web PKI')}
          </button>
          <button className="chain-sample-pill" onClick={() => loadSample('4-tier-enterprise', '4-Tier Enterprise (Root → Policy → Issuing → Leaf)')}>
            {t('app.chain.sample4Tier', '4-Tier Enterprise PKI')}
          </button>
          <button className="chain-sample-pill" onClick={() => loadSample('multi-leaf-branch', 'Multi-Leaf Branching Tree')}>
            {t('app.chain.sampleMultiLeaf', 'Multi-Leaf Branch')}
          </button>
          <button className="chain-sample-pill" onClick={() => loadSample('broken-intermediate', 'Broken Chain (Missing Intermediate)')}>
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
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', fontSize: '0.9rem', maxWidth: '520px' }}>
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
                      selectedId={selectedNode?.id || null}
                      onSelectNode={setSelectedNode}
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
                            selectedId={selectedNode?.id || null}
                            onSelectNode={setSelectedNode}
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
                  return (
                    <div
                      key={node.id}
                      className="glass-card"
                      style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }}
                      onClick={() => setSelectedNode(node)}
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
            {selectedNode && (
              <NodeInspector
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
              />
            )}

          </div>
        )}

      </div>
    </div>
  );
}
