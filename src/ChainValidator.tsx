import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload, AlertTriangle, CheckCircle, XCircle, ShieldCheck, Shield,
  ChevronDown, ChevronUp, Copy, ExternalLink, Trash2, ArrowDown
} from 'lucide-react';
import { parseTrustStoreFile } from './utils/trustStoreParser';
import type { ParsedCertificate } from './utils/trustStoreParser';
import forge from 'node-forge';

function CopyButton({ value }: { value: string }) {
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
      title="Copy to clipboard"
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
    return childCert.verify(parentCert as any);
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
    isSelfSigned: c.subject === c.issuer && verifySelfSignature(c.pem),
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
    // Find issuer in our pool
    const potentialParents = allNodes.filter(p => p !== node && p.cert.subject === node.cert.issuer);
    if (potentialParents.length > 0) {
      // Pick the first whose public key verifies this cert's signature
      for (const parent of potentialParents) {
        if (verifySignature(node.cert.pem, parent.cert.pem)) {
          node.parent = parent;
          parent.children.push(node);
          node.signatureVerified = true;
          break;
        }
      }
      if (!node.parent) {
        // Match by DN even if signature failed or couldn't verify
        node.parent = potentialParents[0];
        potentialParents[0].children.push(node);
        node.signatureVerified = false;
      }
    }
  }

  const rootNodes = allNodes.filter(n => n.isSelfSigned && n.parent === null);
  // Any node that has no parent and is not self signed is the root of an incomplete chain
  const orphanNodes = allNodes.filter(n => !n.isSelfSigned && n.parent === null);

  return { rootNodes, orphanNodes, allNodes };
}

function CertNodeCard({ node, depth = 0 }: { node: CertNode; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const c = node.cert;
  const now = new Date();
  const validToDate = new Date(c.validTo);
  const isExpired = validToDate < now;
  const cleanFp = c.fingerprintSha256.replace(/:/g, '').toLowerCase();
  const crtShUrl = `https://crt.sh/?q=${cleanFp}`;

  let statusBadge = null;
  if (node.isSelfSigned) {
    statusBadge = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--text-accent)', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}>
        <Shield size={12} /> Root CA (Self-Signed)
      </span>
    );
  } else if (node.signatureVerified === true) {
    statusBadge = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
        <CheckCircle size={12} /> Signature Verified
      </span>
    );
  } else if (node.signatureVerified === false) {
    statusBadge = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600 }}>
        <XCircle size={12} /> Signature Mismatch
      </span>
    );
  } else {
    statusBadge = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
        <AlertTriangle size={12} /> Missing Issuer
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '750px',
          padding: '1.25rem',
          border: isExpired ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
          background: isExpired ? 'rgba(239, 68, 68, 0.03)' : undefined,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {statusBadge}
              {isExpired ? (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>
                  Expired
                </span>
              ) : (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                  Valid
                </span>
              )}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.5rem', borderRadius: 8 }}>
                {c.signatureAlgorithm || 'Unknown Alg'}
              </span>
            </div>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {c.subject || 'Empty Subject'}
            </h4>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span>Issued by: {node.isSelfSigned ? 'Self (Root CA)' : c.issuer}</span>
              <span>Expires: {new Date(c.validTo).toLocaleDateString()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={crtShUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-accent)', border: '1px solid var(--border-color)', padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', textDecoration: 'none', transition: 'background 0.2s' }}
              title="Look up certificate transparency logs on crt.sh"
            >
              crt.sh <ExternalLink size={12} />
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.4rem 0.6rem', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
            >
              {expanded ? 'Less Details' : 'More Details'} {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.88rem', display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '0.65rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Serial Number</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.serialNumber} <CopyButton value={c.serialNumber} /></div>

            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>SHA-256</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all' }}>{c.fingerprintSha256} <CopyButton value={c.fingerprintSha256} /></div>

            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Valid From</div>
            <div>{new Date(c.validFrom).toLocaleString()}</div>

            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Valid To</div>
            <div style={{ color: isExpired ? '#ef4444' : 'inherit', fontWeight: isExpired ? 600 : 400 }}>{new Date(c.validTo).toLocaleString()}</div>

            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Key Purposes</div>
            <div>{c.purposes.length > 0 ? c.purposes.join(', ') : 'None specified'}</div>

            {c.extensions && c.extensions.length > 0 && (
              <>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500, alignSelf: 'start', marginTop: '0.25rem' }}>Extensions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {c.extensions.map((ex, idx) => (
                    <div key={idx} style={{ padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}: </span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{ex.value || 'Binary value'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {node.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <ArrowDown size={20} style={{ color: 'var(--text-secondary)', opacity: 0.6, margin: '0.25rem 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {node.children.map(child => (
              <CertNodeCard key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChainValidator() {
  const [certs, setCerts] = useState<ParsedCertificate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
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
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const { rootNodes, orphanNodes } = useMemo(() => buildChains(certs), [certs]);

  const allChainComplete = certs.length > 0 && orphanNodes.length === 0 && rootNodes.length > 0;
  const hasSignMismatch = certs.some(c => {
    const iss = certs.find(p => p.subject === c.issuer && p !== c);
    return iss && !verifySignature(c.pem, iss.pem);
  });

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Certificate Chain Validator &amp; Linker
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Upload multiple certificate files (or a bundle like .p7b / PEM bundle) to reconstruct and cryptographically verify leaf, intermediate, and root trust chains.
          </p>
        </div>

        {certs.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--text-accent)', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Upload size={14} /> Add Certificates
            </button>
            <button
              onClick={() => { setCerts([]); setError(null); }}
              style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Trash2 size={14} /> Clear Pool
            </button>
          </div>
        )}
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
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
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
          style={{
            border: `2px dashed ${isDragging ? 'var(--text-accent)' : 'var(--border-color)'}`,
            borderRadius: '12px',
            background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            padding: '4.5rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Upload size={48} style={{ color: 'var(--text-accent)', marginBottom: '1rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            Drop certificates here to validate chain
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem' }}>
            Drop Root, Intermediate, and Leaf certificates together (PEM, DER, P7B, etc.)
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Status Banner */}
          <div style={{
            padding: '1.25rem',
            borderRadius: 10,
            background: allChainComplete && !hasSignMismatch ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${allChainComplete && !hasSignMismatch ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {allChainComplete && !hasSignMismatch ? (
              <ShieldCheck size={32} style={{ color: '#10b981', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={32} style={{ color: '#f59e0b', flexShrink: 0 }} />
            )}
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: allChainComplete && !hasSignMismatch ? '#10b981' : '#f59e0b', fontSize: '1.1rem' }}>
                {allChainComplete && !hasSignMismatch
                  ? 'Valid Complete Trust Chain(s)'
                  : 'Incomplete or Unverified Chain(s) Detected'}
              </h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {allChainComplete && !hasSignMismatch
                  ? `All ${certs.length} loaded certificate(s) link back to a verified self-signed Root CA in the pool.`
                  : `Some certificates are missing their issuing CA or root certificate in the pool. Add missing intermediate/root certificates to complete the chain.`}
              </p>
            </div>
          </div>

          {/* Complete Root Chains */}
          {rootNodes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: '#10b981' }} /> Complete Chains (Root CA Verified)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', alignItems: 'center' }}>
                {rootNodes.map(node => (
                  <div key={node.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CertNodeCard node={node} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incomplete / Orphaned Chains */}
          {orphanNodes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Incomplete / Orphaned Certificates (Missing Issuer in Pool)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center' }}>
                {orphanNodes.map(node => (
                  <div key={node.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CertNodeCard node={node} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
