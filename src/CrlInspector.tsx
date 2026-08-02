import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Copy, Download, FileText, X, Search, ShieldAlert, Calendar
} from 'lucide-react';
import { parseCrlFile } from './utils/crlParser';
import type { ParsedCRL } from './utils/crlParser';

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

interface LoadedCRL {
  id: string;
  name: string;
  crl: ParsedCRL;
}

function CRLDetails({ crl }: { crl: ParsedCRL }) {
  const [showPem, setShowPem] = useState(false);
  const [showExts, setShowExts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const downloadDer = () => {
    const link = document.createElement('a');
    link.href = `data:application/octet-stream;base64,${crl.derBase64}`;
    link.download = 'revocation_list.der';
    link.click();
  };

  const downloadPem = () => {
    const blob = new Blob([crl.pem], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'revocation_list.crl';
    link.click();
  };

  const filteredRevoked = useMemo(() => {
    if (!searchTerm.trim()) return crl.revokedCertificates;
    const q = searchTerm.toLowerCase();
    return crl.revokedCertificates.filter(
      (item) => item.serialNumber.toLowerCase().includes(q) || item.reason.toLowerCase().includes(q)
    );
  }, [crl.revokedCertificates, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRevoked.length / pageSize));
  const currentSlice = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRevoked.slice(start, start + pageSize);
  }, [filteredRevoked, currentPage]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Badges Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {crl.isExpired ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <XCircle size={13} /> Expired CRL
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}>
            <CheckCircle size={13} /> Active CRL
          </span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem',
          background: 'rgba(56, 189, 248, 0.12)', color: 'var(--text-accent)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}>
          <ShieldAlert size={13} /> {crl.revokedCertificates.length} Revoked Certificates
        </span>
      </div>

      {/* Overview Card */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          CRL Overview &amp; Issuer
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: '0.75rem', fontSize: '0.88rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Issuer DN</div>
          <div style={{ wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.85rem' }}>{crl.issuer || 'Unknown Issuer'}</div>

          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Version</div>
          <div>v{crl.version}</div>

          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>This Update</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span>{formatDate(crl.thisUpdate)}</span>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Next Update</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} style={{ color: crl.isExpired ? '#ef4444' : 'var(--text-secondary)' }} />
            <span style={{ color: crl.isExpired ? '#ef4444' : 'inherit', fontWeight: crl.isExpired ? 600 : 400 }}>
              {formatDate(crl.nextUpdate)} {crl.isExpired ? '(Expired)' : ''}
            </span>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>SHA-256 Fingerprint</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', wordBreak: 'break-all' }}>
            {crl.fingerprintSha256}
            <CopyButton value={crl.fingerprintSha256} />
          </div>
        </div>
      </div>

      {/* Revoked Certificates Table */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={16} /> Revoked Certificate Entries ({filteredRevoked.length})
          </h4>
          {crl.revokedCertificates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg, rgba(255,255,255,0.05))', borderRadius: '6px', padding: '0.35rem 0.6rem', border: '1px solid var(--border-color)', minWidth: '240px' }}>
              <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
              <input
                type="text"
                placeholder="Search by serial or reason..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
              />
              {searchTerm && (
                <X size={14} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => { setSearchTerm(''); setCurrentPage(1); }} />
              )}
            </div>
          )}
        </div>

        {filteredRevoked.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {crl.revokedCertificates.length === 0 ? 'This CRL currently lists no revoked certificates.' : 'No revoked certificates match your search query.'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Serial Number (Hex)</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Revocation Date</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reason Code</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSlice.map((entry, idx) => (
                    <tr key={`${entry.serialNumber}-${idx}`} style={{ borderBottom: idx < currentSlice.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontWeight: 500 }}>
                        {entry.serialNumber}
                        <CopyButton value={entry.serialNumber} />
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>
                        {formatDate(entry.revocationDate)}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.78rem',
                          background: entry.reason.includes('Compromise') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                          color: entry.reason.includes('Compromise') ? '#ef4444' : 'var(--text-primary)',
                          border: `1px solid ${entry.reason.includes('Compromise') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}`
                        }}>
                          {entry.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>Page {currentPage} of {totalPages}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CRL Extensions */}
      {crl.extensions.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowExts(!showExts)}
          >
            <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CRL Extensions ({crl.extensions.length})
            </h4>
            {showExts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {showExts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
              {crl.extensions.map((ext, idx) => (
                <div key={idx} style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: '0.3rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ext.name}</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    OID: {ext.oid} {ext.critical && <span style={{ color: '#f59e0b', marginLeft: '0.5rem', fontWeight: 600 }}>[CRITICAL]</span>}
                  </div>
                  <div />
                  <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{ext.value || 'None'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw PEM View / Downloads */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            onClick={() => setShowPem(!showPem)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <FileText size={15} />
            {showPem ? 'Hide Raw PEM' : 'View Raw PEM'}
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={downloadPem}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--text-accent)', padding: '0.5rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <Download size={14} /> Download PEM
            </button>
            <button
              onClick={downloadDer}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '0.5rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <Download size={14} /> Download DER
            </button>
          </div>
        </div>

        {showPem && (
          <div style={{ marginTop: '1rem', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 8, top: 8 }}>
              <CopyButton value={crl.pem} />
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '280px' }}>
              {crl.pem}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function CrlInspector() {
  const [items, setItems] = useState<LoadedCRL[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    for (const file of files) {
      try {
        const parsed = await parseCrlFile(file);
        const item: LoadedCRL = {
          id: Math.random().toString(36).substring(2, 11),
          name: file.name,
          crl: parsed,
        };
        setItems(prev => {
          const updated = [...prev, item];
          if (!selectedId) setSelectedId(item.id);
          return updated;
        });
        if (!selectedId) setSelectedId(item.id);
      } catch (err: any) {
        setError(`Failed to parse "${file.name}": ${err.message || 'Unknown structure'}. Ensure it is a valid PEM or DER CRL file.`);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [selectedId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const activeItem = items.find(i => i.id === selectedId) || items[0];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Certificate Revocation List (CRL) Inspector
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          Inspect X.509 CRL files (.crl, .pem, .der). Check issuer metadata, next update validity dates, and search through revoked certificate entries and reason codes.
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> {error}
          </span>
          <X size={16} style={{ cursor: 'pointer' }} onClick={() => setError(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--text-accent)' : 'var(--border-color)'}`,
            borderRadius: '12px',
            background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            padding: '4rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".crl,.pem,.der"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
            }}
          />
          <Upload size={48} style={{ color: 'var(--text-accent)', marginBottom: '1rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            Drop CRL files here or click to browse
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem' }}>
            Supports standard PEM and DER formatted Certificate Revocation Lists (.crl, .pem, .der)
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Sidebar file list */}
          <div className="glass-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Loaded CRLs ({items.length})</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'rgba(56, 189, 248, 0.15)', border: 'none', color: 'var(--text-accent)', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
              >
                + Add More
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".crl,.pem,.der"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) processFiles(e.target.files);
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
              {items.map((item) => {
                const isActive = item.id === (selectedId || activeItem.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: 6,
                      background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.3)' : 'transparent'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ color: isActive ? 'var(--text-accent)' : 'var(--text-primary)', fontWeight: 500, fontSize: '0.88rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {item.crl.revokedCertificates.length} revoked · {item.crl.isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setItems(prev => prev.filter(i => i.id !== item.id));
                        if (isActive && items.length > 1) {
                          const rem = items.filter(i => i.id !== item.id);
                          setSelectedId(rem[0]?.id || null);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                      title="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active item details */}
          {activeItem && <CRLDetails crl={activeItem.crl} />}
        </div>
      )}
    </div>
  );
}
