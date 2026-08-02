import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldCheck, AlertTriangle, RefreshCw, Search,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Server, User,
  FileText, Copy, Download, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoreLocation = 'CurrentUser' | 'LocalMachine';

export type StoreName =
  | 'Root'
  | 'CA'
  | 'My'
  | 'TrustedPublisher'
  | 'Disallowed';

interface CertStoreEntry {
  thumbprint: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  serialNumber: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  friendlyName: string;
  purposes: string[];
  isRoot: boolean;
  isIntermediate: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  pem: string;
  certB64?: string;
  extensions: { name: string; oid: string; critical: boolean; value: string }[];
}

// ─── Store metadata ───────────────────────────────────────────────────────────

const STORES: { name: StoreName; label: string; desc: string; icon: any; color: string }[] = [
  { name: 'Root',             label: 'Trusted Root CAs',   desc: 'Self-signed root certificate authorities',        icon: Shield,          color: '#10b981' },
  { name: 'CA',               label: 'Intermediate CAs',   desc: 'Intermediate certificate authorities',            icon: ShieldCheck,     color: '#38bdf8' },
  { name: 'My',               label: 'Personal',            desc: 'Your personal certificates with private keys',    icon: User,            color: '#a78bfa' },
  { name: 'TrustedPublisher', label: 'Trusted Publishers', desc: 'Trusted code-signing publishers',                 icon: CheckCircle,     color: '#f59e0b' },
  { name: 'Disallowed',       label: 'Untrusted',          desc: 'Explicitly distrusted / revoked certificates',   icon: XCircle,         color: '#ef4444' },
];

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success-color)' : 'var(--text-secondary)', padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
    >
      <Copy size={12} />
    </button>
  );
}

// ─── Certificate detail panel ─────────────────────────────────────────────────

function CertEntryCard({ entry }: { entry: CertStoreEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [showPem, setShowPem] = useState(false);
  const [showExts, setShowExts] = useState(false);

  const cn = entry.subject.match(/CN=([^,]+)/)?.[1]?.trim()
    || entry.subject.match(/O=([^,]+)/)?.[1]?.trim()
    || entry.subject;

  const isExpired = entry.isExpired;
  const expiringSoon = entry.isExpiringSoon;

  return (
    <div
      className="glass-card"
      style={{
        marginBottom: '0.75rem',
        borderLeft: `3px solid ${isExpired ? '#ef4444' : expiringSoon ? '#f59e0b' : 'var(--glass-border)'}`,
      }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <Shield size={18} color={isExpired ? '#ef4444' : 'var(--text-accent)'} style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontWeight: 600, color: 'var(--text-primary)',
              fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {cn}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Expires: {new Date(entry.notAfter).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
          {isExpired && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              Expired
            </span>
          )}
          {!isExpired && expiringSoon && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              Expiring Soon
            </span>
          )}
          {entry.isRoot && (
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
              Root CA
            </span>
          )}
          {entry.isIntermediate && (
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
              Intermediate
            </span>
          )}
          {expanded ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div className="details-grid">
            <div className="details-label">Subject</div>
            <div className="details-value" style={{ fontSize: '0.88em' }}>{entry.subject}</div>

            <div className="details-label">Issuer</div>
            <div className="details-value" style={{ fontSize: '0.88em' }}>{entry.issuer}</div>

            <div className="details-label">Valid From</div>
            <div className="details-value">{new Date(entry.notBefore).toLocaleString()}</div>

            <div className="details-label">Valid To</div>
            <div className="details-value" style={{ color: isExpired ? 'var(--danger-color)' : undefined }}>
              {new Date(entry.notAfter).toLocaleString()}
              {isExpired && <span style={{ marginLeft: '0.5rem', fontSize: '0.8em', color: 'var(--danger-color)' }}>(Expired)</span>}
            </div>

            <div className="details-label">Serial Number</div>
            <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all' }}>
              {entry.serialNumber} <CopyButton value={entry.serialNumber} />
            </div>

            <div className="details-label">Thumbprint</div>
            <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all' }}>
              {entry.thumbprint} <CopyButton value={entry.thumbprint} />
            </div>

            <div className="details-label">CT Log Lookup</div>
            <div className="details-value">
              <a
                href={`https://crt.sh/?q=${entry.thumbprint.replace(/:/g, '').toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Search on crt.sh <ExternalLink size={13} />
              </a>
            </div>

            <div className="details-label">Signature Alg.</div>
            <div className="details-value">{entry.signatureAlgorithm}</div>

            <div className="details-label">Public Key</div>
            <div className="details-value">
              {entry.publicKeyAlgorithm}{entry.publicKeySize ? ` (${entry.publicKeySize} bits)` : ''}
            </div>

            {entry.friendlyName && (
              <>
                <div className="details-label">Friendly Name</div>
                <div className="details-value">{entry.friendlyName}</div>
              </>
            )}

            <div className="details-label">Purposes</div>
            <div className="details-value">{entry.purposes.join(', ')}</div>
          </div>

          {/* Extensions */}
          {entry.extensions.length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary
                style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', marginBottom: '0.5rem' }}
                onClick={e => { e.preventDefault(); setShowExts(v => !v); }}
              >
                {showExts ? '▾' : '▸'} Extensions ({entry.extensions.length})
              </summary>
              {showExts && (
                <div className="details-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: 6, marginTop: '0.5rem' }}>
                  {entry.extensions.map((ext, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      <div className="details-label">
                        {ext.name}
                        {ext.critical && <span style={{ marginLeft: 4, fontSize: '0.72em', color: 'var(--danger-color)' }}>Critical</span>}
                      </div>
                      <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.82em', wordBreak: 'break-all' }}>
                        {ext.value || '—'}
                        {ext.oid && <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 2 }}>OID: {ext.oid}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          )}

          {/* PEM & Export */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {entry.pem && (
              <>
                <button
                  onClick={() => setShowPem(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-accent)', fontSize: '0.85rem', padding: 0 }}
                >
                  <FileText size={13} />
                  {showPem ? 'Hide PEM' : 'View PEM'}
                  {showPem ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([entry.pem], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${entry.thumbprint.slice(0, 10)}.pem`;
                    a.click();
                  }}
                  style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--text-accent)', padding: '0.35rem 0.7rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
                >
                  <Download size={13} /> Download PEM
                </button>
              </>
            )}
            {entry.certB64 && (
              <button
                onClick={() => {
                  const binary = atob(entry.certB64!);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                  const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${entry.thumbprint.slice(0, 10)}.der`;
                  a.click();
                }}
                style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '0.35rem 0.7rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={13} /> Download DER
              </button>
            )}
          </div>
          {showPem && entry.pem && (
            <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
              {entry.pem}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

function StatsBar({ certs }: { certs: CertStoreEntry[] }) {
  const expired = certs.filter(c => c.isExpired).length;
  const expiringSoon = certs.filter(c => !c.isExpired && c.isExpiringSoon).length;
  const valid = certs.length - expired;

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {[
        { label: 'Total', value: certs.length, color: 'var(--text-accent)', bg: 'rgba(56,189,248,0.08)' },
        { label: 'Valid', value: valid, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
        { label: 'Expired', value: expired, color: expired > 0 ? '#ef4444' : 'var(--text-muted)', bg: expired > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)' },
        { label: 'Expiring Soon', value: expiringSoon, color: expiringSoon > 0 ? '#f59e0b' : 'var(--text-muted)', bg: expiringSoon > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)' },
      ].map(s => (
        <div key={s.label} style={{ flex: '1 1 100px', background: s.bg, borderRadius: 10, padding: '0.6rem 1rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WinCertStoreInspector() {
  const [location, setLocation] = useState<StoreLocation>('CurrentUser');
  const [activeStore, setActiveStore] = useState<StoreName>('Root');
  const [certs, setCerts] = useState<CertStoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsElevation, setNeedsElevation] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'expiry' | 'name'>('default');
  const [timelineFilter, setTimelineFilter] = useState<'all' | '30days' | 'expired'>('all');

  const fetchStore = useCallback(async (store: StoreName, loc: StoreLocation, elevate = false) => {
    setError('');
    setNeedsElevation(false);
    if (elevate) setElevating(true);
    else setLoading(true);

    try {
      const url = `/api/certstore?store=${store}&location=${loc}${elevate ? '&elevate=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        const msg: string = json.error || 'Failed to fetch';
        if (msg.toLowerCase().includes('access') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('privilege')) {
          setNeedsElevation(true);
        } else {
          setError(msg);
        }
        return;
      }

      setCerts(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setElevating(false);
    }
  }, []);

  // Reload whenever store or location changes
  useEffect(() => {
    setSearch('');
    setCerts([]);
    fetchStore(activeStore, location);
  }, [activeStore, location, fetchStore]);

  const filtered = certs.filter(c => {
    if (timelineFilter === 'expired' && !c.isExpired) return false;
    if (timelineFilter === '30days' && (!c.isExpiringSoon || c.isExpired)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.subject.toLowerCase().includes(q) ||
      c.issuer.toLowerCase().includes(q) ||
      c.thumbprint.toLowerCase().includes(q) ||
      c.friendlyName.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'expiry') {
      return new Date(a.notAfter).getTime() - new Date(b.notAfter).getTime();
    }
    if (sortBy === 'name') {
      return a.subject.localeCompare(b.subject);
    }
    return 0;
  });

  const storeInfo = STORES.find(s => s.name === activeStore)!;

  // ── Elevation prompt (LocalMachine) ─────────────────────────────────────
  if (needsElevation) {
    return (
      <div className="main-content">
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <LocationAndStoreTabs
            location={location} activeStore={activeStore}
            onLocationChange={loc => { setLocation(loc); }}
            onStoreChange={s => { setActiveStore(s); }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <div className="glass-panel" style={{ textAlign: 'center', maxWidth: 480, padding: '3rem' }}>
              {elevating ? (
                <>
                  <Shield size={56} color="var(--text-accent)" style={{ animation: 'pulse 2s infinite', margin: '0 auto 1rem auto' }} />
                  <h2 style={{ color: 'var(--text-accent)' }}>Waiting for Administrator Approval…</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Check your taskbar for a Windows UAC prompt.</p>
                </>
              ) : (
                <>
                  <AlertTriangle size={56} color="var(--danger-color)" style={{ margin: '0 auto 1rem auto' }} />
                  <h2 style={{ color: 'var(--text-primary)' }}>Administrator Access Required</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Reading the <strong>LocalMachine</strong> certificate store requires Administrator privileges.
                    Click below to elevate — you will only be prompted once per session.
                  </p>
                  {error && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</p>}
                  <button
                    className="btn"
                    style={{ background: 'var(--success-color)', width: '100%', justifyContent: 'center' }}
                    onClick={() => fetchStore(activeStore, location, true)}
                  >
                    <Shield size={16} /> Unlock LocalMachine Store
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        <LocationAndStoreTabs
          location={location} activeStore={activeStore}
          onLocationChange={loc => setLocation(loc)}
          onStoreChange={s => setActiveStore(s)}
        />

        {/* Store description */}
        <div className="glass-panel" style={{ marginBottom: '1.25rem', padding: '0.9rem 1.1rem', background: 'rgba(56,189,248,0.05)', borderColor: 'rgba(56,189,248,0.15)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <storeInfo.icon size={18} color={storeInfo.color} style={{ flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{storeInfo.label}</span>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>— {storeInfo.desc}</span>
          </div>
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', padding: '0.25rem 0.5rem', borderRadius: 6, transition: 'color 0.15s' }}
            onClick={() => fetchStore(activeStore, location)}
            title="Reload"
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
            <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--text-accent)' }} />
            <p>Loading {storeInfo.label}…</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="glass-panel" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', textAlign: 'center', padding: '2rem' }}>
            <AlertTriangle size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Error</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Certs list */}
        {!loading && !error && certs.length > 0 && (
          <>
            <StatsBar certs={certs} />

            {/* Expiry timeline and sorting controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginRight: 4, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={14} /> Timeline:
                </span>
                <button
                  onClick={() => setTimelineFilter('all')}
                  style={{ background: timelineFilter === 'all' ? 'var(--text-accent)' : 'rgba(255,255,255,0.05)', color: timelineFilter === 'all' ? '#0f172a' : 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.25rem 0.6rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}
                >
                  All
                </button>
                <button
                  onClick={() => setTimelineFilter('30days')}
                  style={{ background: timelineFilter === '30days' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)', color: timelineFilter === '30days' ? '#0f172a' : '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.25rem 0.6rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}
                >
                  Expiring Within 30 Days
                </button>
                <button
                  onClick={() => setTimelineFilter('expired')}
                  style={{ background: timelineFilter === 'expired' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)', color: timelineFilter === 'expired' ? '#fff' : '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.6rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}
                >
                  Expired Only
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="default">Default Store Order</option>
                  <option value="expiry">Expiry Date (Soonest first)</option>
                  <option value="name">Subject Name (Alphabetical)</option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Filter by subject, issuer, or thumbprint…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                  background: 'var(--input-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                No certificates match your filter.
              </div>
            ) : (
              <div>
                {filtered.map(cert => (
                  <CertEntryCard key={cert.thumbprint} entry={cert} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty store */}
        {!loading && !error && certs.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>
            <ShieldCheck size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h3>No Certificates Found</h3>
            <p style={{ margin: 0 }}>The <strong>{storeInfo.label}</strong> store is empty for {location}.</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Location + Store tab row ─────────────────────────────────────────────────

function LocationAndStoreTabs({
  location, activeStore, onLocationChange, onStoreChange,
}: {
  location: StoreLocation;
  activeStore: StoreName;
  onLocationChange: (l: StoreLocation) => void;
  onStoreChange: (s: StoreName) => void;
}) {
  return (
    <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {/* Location toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: 4 }}>Store:</span>
        {(['CurrentUser', 'LocalMachine'] as StoreLocation[]).map(loc => (
          <button
            key={loc}
            className={`btn ${location === loc ? '' : 'btn-secondary'}`}
            style={{ padding: '0.3rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => onLocationChange(loc)}
          >
            {loc === 'CurrentUser' ? <User size={12} /> : <Server size={12} />}
            {loc}
          </button>
        ))}
      </div>

      {/* Store tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {STORES.map(s => {
          const Icon = s.icon;
          const active = activeStore === s.name;
          return (
            <button
              key={s.name}
              onClick={() => onStoreChange(s.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: 8, fontSize: '0.83rem', fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? s.color : 'var(--glass-border)'}`,
                background: active ? `${s.color}18` : 'transparent',
                color: active ? s.color : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Icon size={13} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
