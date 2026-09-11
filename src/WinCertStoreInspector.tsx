import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  Shield, ShieldCheck, AlertTriangle, RefreshCw, Search,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Server, User,
  Copy, Download, Loader2, Eye, EyeOff, Check, ArrowUpDown,
  Clock, Award, Layers, X
} from 'lucide-react';
import { useToast } from './ToastContext';
import { splitPurposes, translatePurpose, formatExtensionValue } from './utils/purposeFormatter';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';

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
  { name: 'CA',               label: 'Intermediate CAs',   desc: 'Intermediate certificate authorities',            icon: ShieldCheck,     color: '#06b6d4' },
  { name: 'My',               label: 'Personal',            desc: 'Your personal certificates with private keys',    icon: User,            color: '#a855f7' },
  { name: 'TrustedPublisher', label: 'Trusted Publishers', desc: 'Trusted code-signing publishers',                 icon: CheckCircle,     color: '#f59e0b' },
  { name: 'Disallowed',       label: 'Untrusted',          desc: 'Explicitly distrusted / revoked certificates',   icon: XCircle,         color: '#f43f5e' },
];

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success');
        setTimeout(() => setCopied(false), 1500);
      }}
      title={t('common.copyToClipboard', 'Copy')}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success-color)' : 'var(--text-secondary)', padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
    >
      <Copy size={12} />
    </button>
  );
}

// ─── Certificate detail panel ─────────────────────────────────────────────────

function CertEntryCard({ entry, search = '', activeStore }: { entry: CertStoreEntry; search?: string; activeStore?: StoreName }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showPem, setShowPem] = useState(false);
  const [copiedPem, setCopiedPem] = useState(false);

  const downloadPemFile = () => {
    if (!entry.pem) return;
    const blob = new Blob([entry.pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = (entry.subject.match(/CN=([^,]+)/)?.[1]?.trim() || entry.serialNumber || entry.thumbprint.slice(0, 10)).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${filename}.pem`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}.pem`, 'success');
  };

  const downloadDerFile = () => {
    if (!entry.certB64 && !entry.pem) return;
    try {
      const b64 = entry.certB64 || entry.pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = (entry.subject.match(/CN=([^,]+)/)?.[1]?.trim() || entry.serialNumber || entry.thumbprint.slice(0, 10)).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${filename}.der`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}.der`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export DER', 'error');
    }
  };

  const copyPemText = () => {
    if (!entry.pem) return;
    navigator.clipboard.writeText(entry.pem);
    setCopiedPem(true);
    showToast(t('app.winCertStore.certCard.copiedToast', 'PEM certificate copied to clipboard'), 'success');
    setTimeout(() => setCopiedPem(false), 2000);
  };

  const cn = entry.subject.match(/CN=([^,]+)/)?.[1]?.trim()
    || entry.subject.match(/O=([^,]+)/)?.[1]?.trim()
    || entry.subject;

  const isExpired = entry.isExpired;
  const expiringSoon = entry.isExpiringSoon;

  // Show issuer hint when cert matched via issuer, not own name
  const q = search.toLowerCase();
  const matchesOwnName = !q || cn.toLowerCase().includes(q) || entry.subject.toLowerCase().includes(q) || entry.friendlyName.toLowerCase().includes(q) || entry.thumbprint.toLowerCase().includes(q);
  const issuerCn = entry.issuer.match(/CN=([^,]+)/)?.[1]?.trim() || entry.issuer.match(/O=([^,]+)/)?.[1]?.trim() || '';
  const showIssuerHint = q && !matchesOwnName && entry.issuer.toLowerCase().includes(q);

  return (
    <div
      className="glass-card"
      style={{
        marginBottom: '0.75rem',
        borderLeft: `3px solid ${isExpired ? 'var(--danger-color)' : expiringSoon ? 'var(--warning-color)' : 'var(--glass-border)'}`,
      }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <Shield size={18} color={isExpired ? 'var(--danger-color)' : 'var(--text-accent)'} style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontWeight: 600, color: 'var(--text-primary)',
              fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {cn}
            </div>
            {showIssuerHint ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-accent)', marginTop: 2 }}>
                ↳ {t('app.winCertStore.certCard.issuedBy', 'Issued by')}: {issuerCn}
              </div>
            ) : (
              <div
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}
                title={formatExpiryTooltip(entry.notAfter, t, i18n.language)}
              >
                {t('app.winCertStore.certCard.expires', 'Expires')}: {new Date(entry.notAfter).toLocaleDateString()}{' '}
                <span style={{ color: isExpired ? 'var(--danger-color)' : expiringSoon ? 'var(--warning-color)' : 'var(--text-secondary)' }}>
                  ({formatExpiry(entry.notAfter, t, i18n.language)})
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem', flexWrap: 'wrap' }}>
          {isExpired && (
            <span className="badge badge-danger">
              <span className="badge-dot pulse" />
              {t('app.winCertStore.certCard.expired', 'Expired')}
            </span>
          )}
          {!isExpired && expiringSoon && (
            <span className="badge badge-warning">
              <span className="badge-dot" />
              {t('app.winCertStore.certCard.expiringSoon', 'Expiring Soon')}
            </span>
          )}
          {entry.isRoot && (
            <span className="badge badge-success">
              {t('app.winCertStore.certCard.rootCA', 'Root CA')}
            </span>
          )}
          {entry.isIntermediate && (
            <span className="badge badge-warning">
              {t('app.winCertStore.certCard.intermediate', 'Intermediate')}
            </span>
          )}
          {!entry.isRoot && !entry.isIntermediate && (
            <span className="badge badge-purple">
              {t('app.certDetails.leafCert', 'Leaf')}
            </span>
          )}
          {activeStore === 'CA' && entry.isRoot && (
            <span
              className="badge badge-danger"
              title={t('app.winCertStore.certCard.misplacedRootDesc', 'This self-signed root certificate is physically installed in the Intermediate CAs store.')}
            >
              <AlertTriangle size={12} />
              {t('app.winCertStore.certCard.misplacedRoot', 'Misplaced Root')}
            </span>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
          <div className="details-grid">
            <div className="details-label">{t('app.winCertStore.certCard.subject', 'Subject')}</div>
            <div className="details-value">{entry.subject}</div>

            <div className="details-label">{t('app.winCertStore.certCard.issuer', 'Issuer')}</div>
            <div className="details-value">{entry.issuer}</div>

            <div className="details-label">{t('app.winCertStore.certCard.validFrom', 'Valid From')}</div>
            <div className="details-value">{new Date(entry.notBefore).toLocaleDateString()}</div>

            <div className="details-label">{t('app.winCertStore.certCard.validTo', 'Valid To')}</div>
            <div className="details-value">
              {new Date(entry.notAfter).toLocaleDateString()}{' '}
              <span
                style={{
                  fontSize: '0.8rem',
                  color: isExpired ? 'var(--danger-color)' : expiringSoon ? 'var(--warning-color)' : 'var(--text-secondary)',
                  marginLeft: '0.4rem',
                  cursor: 'help'
                }}
                title={formatExpiryTooltip(entry.notAfter, t, i18n.language)}
              >
                ({formatExpiry(entry.notAfter, t, i18n.language)})
              </span>
            </div>

            <div className="details-label">{t('app.winCertStore.certCard.serialNumber', 'Serial Number')}</div>
            <div className="details-value mono">
              {entry.serialNumber} <CopyButton text={entry.serialNumber} />
            </div>

            <div className="details-label">{t('app.winCertStore.certCard.thumbprint', 'Thumbprint')}</div>
            <div className="details-value mono">
              {entry.thumbprint} <CopyButton text={entry.thumbprint} />
            </div>

            <div className="details-label">{t('app.winCertStore.certCard.signatureAlg', 'Signature Alg.')}</div>
            <div className="details-value">{entry.signatureAlgorithm}</div>

            <div className="details-label">{t('app.winCertStore.certCard.publicKey', 'Public Key')}</div>
            <div className="details-value">
              {entry.publicKeyAlgorithm} {entry.publicKeySize ? `(${entry.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''}
            </div>

            {entry.friendlyName && (
              <>
                <div className="details-label">{t('app.winCertStore.certCard.friendlyName', 'Friendly Name')}</div>
                <div className="details-value">{entry.friendlyName}</div>
              </>
            )}

            <div className="details-label">{t('app.winCertStore.certCard.purposes', 'Purposes')}</div>
            <div className="details-value">
              {splitPurposes(entry.purposes).map((p, idx) => {
                const translated = translatePurpose(p, t);
                return (
                  <span key={idx} className="badge badge-purple" style={{ marginRight: 4, marginBottom: 2 }}>
                    {translated}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Extensions */}
          {entry.extensions && entry.extensions.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.85rem' }}>
                {t('app.winCertStore.certCard.extensions', 'Extensions')} ({entry.extensions.length})
              </summary>
              <div className="details-grid" style={{ marginTop: '0.5rem', background: 'var(--card-bg)', padding: '0.75rem', borderRadius: 8 }}>
                {entry.extensions.map((ext, idx) => (
                  <div key={idx} style={{ display: 'contents' }}>
                    <div className="details-label">
                      {t([`app.winCertStore.extensions.${ext.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ext.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ext.name) as string}
                    </div>
                    <div className="details-value mono" style={{ fontSize: '0.78rem' }}>
                      OID: {ext.oid}
                      {ext.critical && (
                        <span className="badge badge-danger" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                          {t('app.certDetails.critical', '(Critical)')}
                        </span>
                      )}
                      {ext.value && (
                        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatExtensionValue(ext.name, ext.oid, ext.value, t)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {entry.pem && (
              <button
                className="btn btn-download-pem"
                onClick={downloadPemFile}
                title={t('app.winCertStore.certCard.downloadPem', 'Download PEM')}
              >
                <Download size={13} /> {t('app.winCertStore.certCard.downloadPem', 'Download PEM')}
              </button>
            )}
            {(entry.certB64 || entry.pem) && (
              <button
                className="btn btn-download-der"
                onClick={downloadDerFile}
                title={t('app.winCertStore.certCard.downloadDer', 'Download DER')}
              >
                <Download size={13} /> {t('app.winCertStore.certCard.downloadDer', 'Download DER')}
              </button>
            )}
            {entry.pem && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyPemText}
                title={t('app.winCertStore.certCard.copyPem', 'Copy PEM')}
              >
                {copiedPem ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} />}
                <span>{copiedPem ? t('app.winCertStore.certCard.copied', 'Copied') : t('app.winCertStore.certCard.copyPem', 'Copy PEM')}</span>
              </button>
            )}
            {entry.pem && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPem(v => !v)}
              >
                {showPem ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPem ? t('app.winCertStore.certCard.hidePem', 'Hide PEM') : t('app.winCertStore.certCard.viewPem', 'View PEM')}</span>
              </button>
            )}
          </div>
          {showPem && entry.pem && (
            <pre className="code-block" style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
              {entry.pem}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

type TimelineFilterType = 'all' | 'valid' | '30days' | 'expired';

function StatsBar({ certs, filter, setFilter }: { certs: CertStoreEntry[], filter: TimelineFilterType, setFilter: (f: TimelineFilterType) => void }) {
  const { t } = useTranslation();
  const expired = certs.filter(c => c.isExpired).length;
  const expiringSoon = certs.filter(c => !c.isExpired && c.isExpiringSoon).length;
  const valid = certs.length - expired;

  const isFilterDisabled = certs.length <= 1;

  return (
    <div className="stat-grid metric-cards-grid" style={{ marginBottom: '1.25rem' }}>
      {[
        { id: 'all', label: t('app.winCertStore.stats.total', 'Total In Store'), value: certs.length, icon: Shield, type: 'info' },
        { id: 'valid', label: t('app.winCertStore.stats.valid', 'Valid Certificates'), value: valid, icon: CheckCircle, type: 'success' },
        { id: '30days', label: t('app.winCertStore.stats.expiringSoon', 'Expiring Soon (<30d)'), value: expiringSoon, icon: AlertTriangle, type: 'warning' },
        { id: 'expired', label: t('app.winCertStore.stats.expired', 'Expired Certificates'), value: expired, icon: XCircle, type: 'danger' },
      ].map(s => {
        const Icon = s.icon;
        const active = !isFilterDisabled && filter === s.id;
        return (
          <div
            key={s.id}
            onClick={isFilterDisabled ? undefined : () => setFilter(s.id as TimelineFilterType)}
            className="metric-card"
            style={{
              cursor: isFilterDisabled ? 'default' : 'pointer',
              opacity: isFilterDisabled ? 0.75 : 1,
              border: active ? '1px solid var(--accent-color)' : undefined,
              background: active ? 'var(--card-bg-hover)' : undefined,
              boxShadow: active ? '0 0 0 2px var(--accent-glow)' : undefined
            }}
          >
            <div className={`metric-icon-wrap ${s.type}`}>
              <Icon size={22} />
            </div>
            <div className="metric-info">
              <div className="metric-val">{s.value}</div>
              <div className="metric-label">{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WinCertStoreInspector() {
  const { t } = useTranslation();
  const [location, setLocation] = useState<StoreLocation>('CurrentUser');
  const [activeStore, setActiveStore] = useState<StoreName>('Root');
  const [certs, setCerts] = useState<CertStoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsElevation, setNeedsElevation] = useState(false);
  const [isElevating, setElevating] = useState(false);
  const [search, setSearch] = useState('');
  type SortOption = 'default' | 'expiry' | 'name';
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [sortAsc, setSortAsc] = useState(true);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterType>('all');

  const SORT_OPTIONS: { id: SortOption; labelKey: string; defaultLabel: string; icon: React.ElementType }[] = [
    { id: 'default', labelKey: 'app.winCertStore.filters.sortDefault', defaultLabel: 'Default Store Order', icon: Layers },
    { id: 'expiry', labelKey: 'app.dashboard.colExpiryDate', defaultLabel: 'Expiry Date', icon: Clock },
    { id: 'name', labelKey: 'app.dashboard.colCertificate', defaultLabel: 'Subject Name', icon: Award },
  ];

  useEffect(() => {
    if (!isSortOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSortOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortOpen]);

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
        if (msg.toLowerCase().includes('canceled by the user') || msg.toLowerCase().includes('cancelled by the user')) {
          setError('userCanceled');
        } else if (!elevate && (msg.toLowerCase().includes('access') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('privilege'))) {
          setNeedsElevation(true);
        } else {
          setError(msg);
        }
        return;
      }

      setCerts(json.data || []);
    } catch (err: any) {
      const errorMsg = err.message || '';
      if (errorMsg.toLowerCase().includes('canceled by the user') || errorMsg.toLowerCase().includes('cancelled by the user')) {
        setError('userCanceled');
      } else {
        setError(errorMsg);
      }
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

  const filtered = certs.map((c, idx) => ({ cert: c, origIdx: idx })).filter(({ cert: c }) => {
    if (timelineFilter === 'expired' && !c.isExpired) return false;
    if (timelineFilter === 'valid' && c.isExpired) return false;
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
      const diff = new Date(a.cert.notAfter).getTime() - new Date(b.cert.notAfter).getTime();
      return sortAsc ? diff : -diff;
    }
    if (sortBy === 'name') {
      const diff = a.cert.subject.localeCompare(b.cert.subject);
      return sortAsc ? diff : -diff;
    }
    return sortAsc ? (a.origIdx - b.origIdx) : (b.origIdx - a.origIdx);
  }).map(({ cert }) => cert);

  const storeInfo = STORES.find(s => s.name === activeStore)!;

  // ── Elevation prompt (LocalMachine) ─────────────────────────────────────
  if (needsElevation) {
    return (
      <div className="main-content">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <LocationAndStoreTabs
            location={location} activeStore={activeStore}
            onLocationChange={loc => { setLocation(loc); }}
            onStoreChange={s => { setActiveStore(s); }}
          />
          <div className="glass-panel" style={{ padding: '2.5rem 1.25rem', textAlign: 'center', marginTop: '2rem' }}>
              {isElevating ? (
                <>
                  <Loader2 className="animate-spin" size={56} color="var(--accent-color)" style={{ margin: '0 auto 1rem auto' }} />
                  <h2 style={{ color: 'var(--text-accent)' }}>{t('app.adminAccess.waiting')}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{t('app.adminAccess.checkTaskbar')}</p>
                </>
              ) : (
                <>
                  <AlertTriangle size={56} color="var(--danger-color)" style={{ margin: '0 auto 1rem auto' }} />
                  <h2 style={{ color: 'var(--text-primary)' }}>{t('app.adminAccess.title')}</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    <Trans i18nKey="app.adminAccess.localMachineDesc" components={[<strong key="localmachine" />]} />
                  </p>
                  {error && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error === 'userCanceled' ? t('app.adminAccess.userCanceled') : error}</p>}
                  <button
                    className="btn"
                    style={{ background: 'var(--success-color)', width: '100%', justifyContent: 'center' }}
                    onClick={() => fetchStore(activeStore, location, true)}
                  >
                    <Shield size={16} /> {t('app.adminAccess.unlockLocalMachine')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '950px', margin: '0 auto' }}>

        <LocationAndStoreTabs
          location={location} activeStore={activeStore}
          onLocationChange={loc => setLocation(loc)}
          onStoreChange={s => setActiveStore(s)}
        />

        {/* Store description */}
        <div className="glass-panel" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          <div className="metric-icon-wrap info" style={{ width: 36, height: 36, borderRadius: 8 }}>
            <storeInfo.icon size={18} color={storeInfo.color} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{t(`app.winCertStore.stores.${storeInfo.name}.label`, storeInfo.label)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>{t(`app.winCertStore.stores.${storeInfo.name}.desc`, storeInfo.desc)}</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchStore(activeStore, location)}
            title={t('app.winCertStore.refresh', 'Reload')}
          >
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {t('app.winCertStore.refresh', 'Refresh')}
          </button>
        </div>

        {/* Skeleton Loading state */}
        {loading && (
          <div className="animate-fade-in" style={{ marginTop: '1.5rem' }}>
            <div className="stat-grid metric-cards-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="skeleton-pulse skeleton-stat" />
              <div className="skeleton-pulse skeleton-stat" />
              <div className="skeleton-pulse skeleton-stat" />
              <div className="skeleton-pulse skeleton-stat" />
            </div>
            <div className="skeleton-pulse skeleton-card" style={{ height: '72px' }} />
            <div className="skeleton-pulse skeleton-card" style={{ height: '72px' }} />
            <div className="skeleton-pulse skeleton-card" style={{ height: '72px' }} />
            <div className="skeleton-pulse skeleton-card" style={{ height: '72px' }} />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', textAlign: 'center', padding: '2rem' }}>
            <AlertTriangle size={40} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--danger-color)', margin: '0 0 0.5rem 0' }}>{t('common.error', 'Error')}</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{error === 'userCanceled' ? t('app.adminAccess.userCanceled') : error}</p>
          </div>
        )}

        {/* Certs list or Empty state */}
        {!loading && !error && (
          <>
            <StatsBar certs={certs} filter={timelineFilter} setFilter={setTimelineFilter} />

            {/* Filter and Search Bar */}
            <div className="wincert-filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="wincert-filter-search" style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: certs.length <= 1 ? 0.5 : 1 }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('app.winCertStore.filters.searchPlaceholder', 'Filter by subject, issuer, or thumbprint…')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  disabled={certs.length <= 1}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              {/* Standard Select for Desktop View */}
              <div className="wincert-filter-sort wincert-sort-desktop">
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', opacity: (certs.length <= 1 || filtered.length <= 1) ? 0.6 : 1 }}>{t('app.winCertStore.filters.sortBy', 'Sort by:')}</span>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e: any) => {
                    setSortBy(e.target.value);
                    setSortAsc(true);
                  }}
                  disabled={certs.length <= 1 || filtered.length <= 1}
                  style={{ minWidth: '160px', padding: '0.5rem 2.25rem 0.5rem 0.75rem', fontSize: '0.82rem' }}
                >
                  <option value="default">{t('app.winCertStore.filters.sortDefault', 'Default Store Order')}</option>
                  <option value="expiry">{t('app.winCertStore.filters.sortExpiry', 'Expiry Date (Soonest first)')}</option>
                  <option value="name">{t('app.winCertStore.filters.sortName', 'Subject Name (Alphabetical)')}</option>
                </select>
              </div>

              {/* Touch-Friendly Trigger & Bottom Sheet for Mobile View */}
              <div className="wincert-filter-sort wincert-sort-mobile">
                <span className="wincert-sort-label" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', opacity: (certs.length <= 1 || filtered.length <= 1) ? 0.6 : 1 }}>{t('app.winCertStore.filters.sortBy', 'Sort by:')}</span>
                <div className="wincert-sort-actions">
                  <button
                    type="button"
                    className={`expiry-sort-trigger ${isSortOpen ? 'active' : ''}`}
                    onClick={() => setIsSortOpen(prev => !prev)}
                    disabled={certs.length <= 1 || filtered.length <= 1}
                    aria-expanded={isSortOpen}
                    aria-haspopup="dialog"
                    title={t('app.winCertStore.filters.sortBy', 'Sort by')}
                  >
                    {(() => {
                      const activeOpt = SORT_OPTIONS.find(o => o.id === sortBy) || SORT_OPTIONS[0];
                      const Icon = activeOpt.icon;
                      return (
                        <>
                          <Icon size={13} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                          <span className="expiry-sort-trigger-text">{t(activeOpt.labelKey, activeOpt.defaultLabel)}</span>
                          <ChevronDown size={13} className={`expiry-sort-chevron ${isSortOpen ? 'open' : ''}`} />
                        </>
                      );
                    })()}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm expiry-sort-dir-btn"
                    onClick={() => setSortAsc(prev => !prev)}
                    disabled={certs.length <= 1 || filtered.length <= 1}
                    title={sortAsc ? t('app.dashboard.sortAscending', 'Ascending order (tap to flip)') : t('app.dashboard.sortDescending', 'Descending order (tap to flip)')}
                    aria-label={sortAsc ? 'Ascending' : 'Descending'}
                  >
                    {sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="expiry-sort-dir-text">{sortAsc ? 'ASC' : 'DESC'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sort Modal via Portal */}
            {isSortOpen && typeof document !== 'undefined' && createPortal(
              <>
                <div
                  className="expiry-sort-backdrop"
                  onClick={() => setIsSortOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="expiry-sort-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('app.dashboard.selectSortField', 'Sort Certificates')}
                >
                  <div className="expiry-sort-sheet-handle" aria-hidden="true" />

                  <div className="expiry-sort-sheet-header">
                    <div className="expiry-sort-sheet-title-wrap">
                      <div className="expiry-sort-sheet-title-icon">
                        <ArrowUpDown size={15} />
                      </div>
                      <span className="expiry-sort-sheet-title">
                        {t('app.dashboard.selectSortField', 'Sort Certificates')}
                      </span>
                    </div>

                    <div className="expiry-sort-sheet-actions">
                      <button
                        type="button"
                        className="expiry-sort-sheet-dir-btn"
                        onClick={() => setSortAsc(prev => !prev)}
                        title={sortAsc ? t('app.dashboard.sortAscending', 'Ascending order (tap to flip)') : t('app.dashboard.sortDescending', 'Descending order (tap to flip)')}
                      >
                        {sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{sortAsc ? t('app.dashboard.orderAsc', 'ASC') : t('app.dashboard.orderDesc', 'DESC')}</span>
                      </button>

                      <button
                        type="button"
                        className="expiry-sort-sheet-close-btn"
                        onClick={() => setIsSortOpen(false)}
                        aria-label={t('app.aria.close', 'Close')}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="expiry-sort-sheet-options" role="listbox">
                    {SORT_OPTIONS.map(item => {
                      const Icon = item.icon;
                      const isActive = sortBy === item.id;
                      const label = t(item.labelKey, item.defaultLabel);
                      let hint = '';
                      if (item.id === 'expiry') {
                        hint = sortAsc ? t('app.dashboard.orderAsc', 'Ascending') + ' (Soonest first)' : t('app.dashboard.orderDesc', 'Descending') + ' (Latest first)';
                      } else if (item.id === 'name') {
                        hint = sortAsc ? t('app.dashboard.orderAsc', 'Ascending') + ' (A to Z)' : t('app.dashboard.orderDesc', 'Descending') + ' (Z to A)';
                      } else {
                        hint = sortAsc ? t('app.dashboard.orderAsc', 'Ascending') : t('app.dashboard.orderDesc', 'Descending');
                      }

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`expiry-sort-sheet-option ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (isActive) {
                              setSortAsc(prev => !prev);
                            } else {
                              setSortBy(item.id);
                            }
                            setIsSortOpen(false);
                          }}
                        >
                          <div className="expiry-sort-sheet-opt-left">
                            <div className={`expiry-sort-sheet-opt-icon ${isActive ? 'active' : ''}`}>
                              <Icon size={16} />
                            </div>
                            <div className="expiry-sort-sheet-opt-details">
                              <span className="expiry-sort-sheet-opt-label">{label}</span>
                              {isActive && (
                                <span className="expiry-sort-sheet-opt-hint">
                                  {hint}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="expiry-sort-sheet-opt-right">
                            {isActive && (
                              <div className="expiry-sort-sheet-active-pill">
                                <span className="expiry-sort-sheet-arrow">{sortAsc ? '↑' : '↓'}</span>
                                <Check size={14} />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>,
              document.body
            )}

            {certs.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 2rem' }}>
                <ShieldCheck size={44} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{t('app.winCertStore.emptyTitle', 'No Certificates Found')}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  <Trans i18nKey="app.winCertStore.emptyDesc" values={{ storeLabel: storeInfo.label, location }}>
                    The <strong>{"{{storeLabel}}"}</strong> store is empty for {"{{location}}"}.
                  </Trans>
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1.5rem' }}>
                {t('app.winCertStore.filters.noMatch', 'No certificates match your filter.')}
              </div>
            ) : (
              <div>
                {filtered.map(cert => (
                  <CertEntryCard key={cert.thumbprint} entry={cert} search={search} activeStore={activeStore} />
                ))}
              </div>
            )}
          </>
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
  const { t } = useTranslation();

  return (
    <div className="wincert-top-section">
      {/* Location toggle */}
      <div className="store-location-bar">
        <span className="store-location-label">
          <Shield size={14} style={{ color: 'var(--text-accent)' }} />
          {t('app.winCertStore.storeLocation', 'Store Location:')}
        </span>
        <div className="store-location-segmented">
          {(['CurrentUser', 'LocalMachine'] as StoreLocation[]).map(loc => {
            const locLabel = t(`app.winCertStore.locations.${loc}`, loc);
            return (
              <button
                key={loc}
                className={`store-location-btn ${location === loc ? 'active' : ''}`}
                onClick={() => onLocationChange(loc)}
                title={locLabel}
                aria-label={locLabel}
              >
                {loc === 'CurrentUser' ? <User size={13} /> : <Server size={13} />}
                <span>{locLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Store tabs */}
      <div className="store-tabs-scroll-container">
        {STORES.map(s => {
          const Icon = s.icon;
          const active = activeStore === s.name;
          const storeLabel = t(`app.winCertStore.stores.${s.name}.label`, s.label);
          return (
            <button
              key={s.name}
              data-store={s.name}
              onClick={() => onStoreChange(s.name)}
              className={`store-tab-btn ${active ? 'active' : ''}`}
              title={storeLabel}
              aria-label={storeLabel}
            >
              <Icon size={16} color={active ? '#ffffff' : s.color} />
              <span>{storeLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
