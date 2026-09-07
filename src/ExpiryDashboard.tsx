import { useState, useEffect, useRef } from 'react';
import { Clock, RefreshCw, Shield, AlertCircle, ChevronUp, ChevronDown, ArrowUpDown, User, Monitor, Folder, Fingerprint, Award, CheckCircle2, Copy, Server, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';

interface CertStoreEntry {
  thumbprint: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  storeName: string;
  location: string;
}

export function ExpiryDashboard() {
  const [certs, setCerts] = useState<CertStoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  type SortColumn = 'subject' | 'store' | 'expiry' | 'status';
  const [sortCol, setSortCol] = useState<SortColumn>('expiry');
  const [sortAsc, setSortAsc] = useState(true);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const SORT_COLUMNS: { col: SortColumn; labelKey: string; defaultLabel: string; icon: React.ElementType }[] = [
    { col: 'expiry', labelKey: 'app.dashboard.colExpiryDate', defaultLabel: 'Expiry Date', icon: Clock },
    { col: 'subject', labelKey: 'app.dashboard.colCertificate', defaultLabel: 'Certificate', icon: Award },
    { col: 'store', labelKey: 'app.dashboard.colStore', defaultLabel: 'Store Location', icon: Server },
    { col: 'status', labelKey: 'app.dashboard.colStatus', defaultLabel: 'Status', icon: AlertCircle },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSortOpen]);
  
  const fetchStores = async () => {
     setLoading(true);
     setError('');
     
     try {
       const locations = ['CurrentUser', 'LocalMachine'];
       const stores = ['My', 'Root', 'CA'];
       let allCerts: CertStoreEntry[] = [];
       
       for (const loc of locations) {
         for (const store of stores) {
           try {
             const res = await fetch(`/api/certstore?store=${store}&location=${loc}`);
             if (res.ok) {
               const json = await res.json();
               const data = json.data || [];
               const mapped = data.map((c: any) => ({
                  ...c,
                  storeName: store,
                  location: loc
               }));
               allCerts = [...allCerts, ...mapped];
             }
           } catch (e) {
             console.error(`Failed to fetch ${loc}\\${store}`);
           }
         }
       }
       
       // Filter for expired or expiring soon
       const expiringCerts = allCerts.filter(c => c.isExpired || c.isExpiringSoon);
       
       setCerts(expiringCerts);
     } catch (e: any) {
       setError(e.message);
     } finally {
       setLoading(false);
     }
  };
  
  useEffect(() => {
    fetchStores();
  }, []);

  const expiredCount = certs.filter(c => c.isExpired).length;
  const expiringSoonCount = certs.filter(c => !c.isExpired && c.isExpiringSoon).length;

  const sortedCerts = [...certs].sort((a, b) => {
    let diff = 0;
    if (sortCol === 'subject') {
      const cnA = a.subject.match(/CN=([^,]+)/)?.[1]?.trim() || a.subject.match(/O=([^,]+)/)?.[1]?.trim() || a.subject;
      const cnB = b.subject.match(/CN=([^,]+)/)?.[1]?.trim() || b.subject.match(/O=([^,]+)/)?.[1]?.trim() || b.subject;
      diff = cnA.localeCompare(cnB);
    } else if (sortCol === 'store') {
      const storeA = `${a.location}\\${a.storeName}`;
      const storeB = `${b.location}\\${b.storeName}`;
      diff = storeA.localeCompare(storeB);
    } else if (sortCol === 'status') {
      diff = (a.isExpired === b.isExpired) ? 0 : a.isExpired ? -1 : 1;
    } else {
      diff = new Date(a.notAfter).getTime() - new Date(b.notAfter).getTime();
    }
    return sortAsc ? diff : -diff;
  });

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(prev => !prev);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortCol !== col) return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />;
    return sortAsc ? <ChevronUp size={13} style={{ color: 'var(--text-accent)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-accent)' }} />;
  };

  const isSortable = {
    subject: new Set(certs.map(c => c.subject.match(/CN=([^,]+)/)?.[1]?.trim() || c.subject.match(/O=([^,]+)/)?.[1]?.trim() || c.subject)).size > 1,
    store: new Set(certs.map(c => `${c.location}\\${c.storeName}`)).size > 1,
    expiry: new Set(certs.map(c => c.notAfter)).size > 1,
    status: new Set(certs.map(c => c.isExpired)).size > 1
  };

  const renderHeader = (col: SortColumn, label: string, width: string) => {
    if (!isSortable[col]) {
      return (
        <th style={{ width }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{label}</div>
        </th>
      );
    }
    return (
      <th className="sortable-th" style={{ width }} onClick={() => handleSort(col)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{label} <SortIcon col={col} /></div>
      </th>
    );
  };

  const getDaysDiff = (dateStr: string) => {
    const target = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.4rem 0' }}>{t('app.nav.expiry-dashboard', 'Certificate Expiry Dashboard')}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
              {t('app.dashboard.subtitle', 'Overview of certificates that are expired or expiring within 30 days in your CurrentUser and LocalMachine stores.')}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={fetchStores} disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? t('app.dashboard.scanning', 'Scanning...') : t('app.winCertStore.refresh', 'Refresh Stores')}
          </button>
        </div>

        {error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <div className="metric-cards-grid">
          <div className="metric-card">
            <div className={`metric-icon-wrap ${expiredCount > 0 ? 'danger' : 'success'}`}>
              <AlertCircle size={24} />
            </div>
            <div className="metric-info">
              <div className="metric-val" style={{ color: expiredCount > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>{expiredCount}</div>
              <div className="metric-label">{t('app.dashboard.expiredCount', 'Expired Certificates')}</div>
            </div>
          </div>

          <div className="metric-card">
            <div className={`metric-icon-wrap ${expiringSoonCount > 0 ? 'warning' : 'success'}`}>
              <Clock size={24} />
            </div>
            <div className="metric-info">
              <div className="metric-val" style={{ color: expiringSoonCount > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>{expiringSoonCount}</div>
              <div className="metric-label">{t('app.dashboard.expiringSoonCount', 'Expiring Soon (<30 days)')}</div>
            </div>
          </div>

          <div className="metric-card" title={`${t('app.dashboard.totalActionItems', 'Total Action Items')}: ${t('app.dashboard.totalActionItemsSub', 'Expired + Expiring Soon')}`}>
            <div className="metric-icon-wrap info">
              <Shield size={24} />
            </div>
            <div className="metric-info">
              <div className="metric-val">{certs.length}</div>
              <div className="metric-label">{t('app.dashboard.totalActionItems', 'Total Action Items')}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel">
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
             <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Shield size={18} /> {t('app.dashboard.actionItems', 'Action Items')}
             </h3>
             <span className="badge" style={{ fontSize: '0.75rem' }}>
               {t(certs.length === 1 ? 'app.dashboard.certCount_one' : 'app.dashboard.certCount_other', { count: certs.length, defaultValue: `${certs.length} ${certs.length === 1 ? 'certificate' : 'certificates'}` })}
             </span>
           </div>
           
           {loading ? (
             <div className="animate-fade-in">
               <div className="skeleton-pulse skeleton-table-row" style={{ height: '42px', marginBottom: '0.75rem' }} />
               <div className="skeleton-pulse skeleton-table-row" />
               <div className="skeleton-pulse skeleton-table-row" />
               <div className="skeleton-pulse skeleton-table-row" />
               <div className="skeleton-pulse skeleton-table-row" />
             </div>
           ) : certs.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--success-color)' }}>
                <div className="metric-icon-wrap success" style={{ width: 56, height: 56, margin: '0 auto 1.25rem auto' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{t('app.dashboard.allClear', 'All Clear!')}</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto', fontSize: '0.9rem' }}>
                  {t('app.dashboard.noCertsDesc', 'No expired or expiring certificates found in your CurrentUser or LocalMachine stores.')}
                </p>
             </div>
           ) : (
             <>
               {/* Desktop Table View */}
               <div className="table-responsive expiry-desktop-table">
                 <table className="modern-table">
                    <thead>
                      <tr>
                        {renderHeader('subject', t('app.dashboard.colCertificate', 'Certificate'), '42%')}
                        {renderHeader('store', t('app.dashboard.colStore', 'Store Location'), '22%')}
                        {renderHeader('expiry', t('app.dashboard.colExpiryDate', 'Expiry Date'), '18%')}
                        {renderHeader('status', t('app.dashboard.colStatus', 'Status'), '18%')}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCerts.map((c) => {
                        const cn = c.subject.match(/CN=([^,]+)/)?.[1]?.trim() || c.subject.match(/O=([^,]+)/)?.[1]?.trim() || c.subject;
                        const diffDays = getDaysDiff(c.notAfter);
                        return (
                           <tr key={`${c.location}-${c.storeName}-${c.thumbprint}`}>
                             <td style={{ wordBreak: 'break-word' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                 <Award size={15} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                                 <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{cn}</strong>
                               </div>
                               <div
                                 className="copy-trigger-wrap"
                                 style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                 onClick={() => {
                                   navigator.clipboard.writeText(c.thumbprint);
                                   showToast(t('app.dashboard.copiedThumbprint', { name: cn, defaultValue: `Copied thumbprint for ${cn}` }), 'success');
                                 }}
                                 title={t('app.dashboard.copyThumbprint', 'Click to copy thumbprint')}
                               >
                                 <Fingerprint size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                                 <span className="mono">{c.thumbprint}</span>
                                 <Copy size={11} className="copy-trigger-icon" />
                               </div>
                             </td>
                             <td>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                                 {c.location === 'LocalMachine' ? <Monitor size={14} style={{ color: 'var(--text-accent-2)' }} /> : <User size={14} style={{ color: 'var(--text-accent-2)' }} />}
                                 <span style={{ fontWeight: 500 }}>{t(`app.winCertStore.locations.${c.location}`, c.location)}</span>
                               </div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                 <Folder size={12} style={{ opacity: 0.7 }} />
                                 <span>{t(`app.winCertStore.stores.${c.storeName}.label`, c.storeName)}</span>
                               </div>
                             </td>
                              <td style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 500 }}>{new Date(c.notAfter).toLocaleDateString()}</div>
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    color: diffDays < 0 ? 'var(--danger-color)' : 'var(--warning-color)',
                                    marginTop: '0.15rem',
                                    cursor: 'help'
                                  }}
                                  title={formatExpiryTooltip(c.notAfter, t, i18n.language)}
                                >
                                  {formatExpiry(c.notAfter, t, i18n.language)}
                                </div>
                              </td>
                             <td>
                               {c.isExpired ? (
                                 <span className="badge badge-danger">
                                   <span className="badge-dot pulse" />
                                   {t('app.winCertStore.certCard.expired', 'Expired')}
                                 </span>
                               ) : (
                                 <span className="badge badge-warning">
                                   <span className="badge-dot" />
                                   {t('app.winCertStore.certCard.expiringSoon', 'Expiring Soon')}
                                 </span>
                               )}
                             </td>
                           </tr>
                        )
                      })}
                    </tbody>
                 </table>
               </div>

                {/* Mobile Card List View */}
                <div className="expiry-mobile-card-list">
                  <div className="expiry-mobile-sort-bar" ref={sortMenuRef}>
                    <div className="expiry-sort-label-group">
                      <ArrowUpDown size={14} className="expiry-sort-icon" />
                      <span className="expiry-sort-label">{t('app.winCertStore.filters.sortBy', 'Sort by:')}</span>
                    </div>

                    <div className="expiry-sort-actions">
                      <button
                        type="button"
                        className={`expiry-sort-trigger ${isSortOpen ? 'active' : ''}`}
                        onClick={() => setIsSortOpen(prev => !prev)}
                        aria-expanded={isSortOpen}
                        aria-haspopup="listbox"
                        title={t('app.winCertStore.filters.sortBy', 'Sort by')}
                      >
                        {(() => {
                          const activeCol = SORT_COLUMNS.find(c => c.col === sortCol) || SORT_COLUMNS[0];
                          const Icon = activeCol.icon;
                          return (
                            <>
                              <Icon size={13} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                              <span className="expiry-sort-trigger-text">{t(activeCol.labelKey, activeCol.defaultLabel)}</span>
                              <ChevronDown size={13} className={`expiry-sort-chevron ${isSortOpen ? 'open' : ''}`} />
                            </>
                          );
                        })()}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm expiry-sort-dir-btn"
                        onClick={() => setSortAsc(prev => !prev)}
                        title={sortAsc ? t('app.dashboard.sortAscending', 'Ascending order (tap to flip)') : t('app.dashboard.sortDescending', 'Descending order (tap to flip)')}
                        aria-label={sortAsc ? 'Ascending' : 'Descending'}
                      >
                        {sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className="expiry-sort-dir-text">{sortAsc ? 'ASC' : 'DESC'}</span>
                      </button>
                    </div>

                    {/* Custom Dropdown Menu */}
                    {isSortOpen && (
                      <div className="expiry-sort-dropdown" role="listbox">
                        <div className="expiry-sort-dropdown-header">
                          <span>{t('app.dashboard.selectSortField', 'Sort Field')}</span>
                          <span className="expiry-sort-dropdown-dir-hint">
                            {sortAsc ? '↑ ASC' : '↓ DESC'}
                          </span>
                        </div>
                        {SORT_COLUMNS.map(item => {
                          const Icon = item.icon;
                          const isActive = sortCol === item.col;
                          const label = t(item.labelKey, item.defaultLabel);
                          return (
                            <button
                              key={item.col}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`expiry-sort-option ${isActive ? 'active' : ''}`}
                              onClick={() => {
                                if (isActive) {
                                  setSortAsc(prev => !prev);
                                } else {
                                  setSortCol(item.col);
                                }
                                setIsSortOpen(false);
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                <div className={`expiry-sort-opt-icon ${isActive ? 'active' : ''}`}>
                                  <Icon size={14} />
                                </div>
                                <span style={{ fontWeight: isActive ? 600 : 500, fontSize: '0.84rem' }}>{label}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isActive && (
                                  <>
                                    <span style={{ fontSize: '0.72rem', opacity: 0.8, color: 'var(--text-accent)' }}>
                                      {sortAsc ? '↑' : '↓'}
                                    </span>
                                    <Check size={14} style={{ color: 'var(--accent-color)' }} />
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {sortedCerts.map((c) => {
                   const cn = c.subject.match(/CN=([^,]+)/)?.[1]?.trim() || c.subject.match(/O=([^,]+)/)?.[1]?.trim() || c.subject;
                   const diffDays = getDaysDiff(c.notAfter);
                   return (
                     <div key={`mobile-${c.location}-${c.storeName}-${c.thumbprint}`} className="glass-card expiry-mobile-card">
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.65rem' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                           <Award size={16} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                           <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', wordBreak: 'break-word', lineHeight: 1.3 }}>{cn}</strong>
                         </div>
                         <div style={{ flexShrink: 0 }}>
                           {c.isExpired ? (
                             <span className="badge badge-danger" style={{ margin: 0 }}>
                               <span className="badge-dot pulse" />
                               {t('app.winCertStore.certCard.expired', 'Expired')}
                             </span>
                           ) : (
                             <span className="badge badge-warning" style={{ margin: 0 }}>
                               <span className="badge-dot" />
                               {t('app.winCertStore.certCard.expiringSoon', 'Expiring Soon')}
                             </span>
                           )}
                         </div>
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem', padding: '0.5rem 0.75rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--glass-border-subtle)' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                           {c.location === 'LocalMachine' ? <Monitor size={13} style={{ color: 'var(--text-accent-2)' }} /> : <User size={13} style={{ color: 'var(--text-accent-2)' }} />}
                           <span style={{ fontWeight: 600 }}>{t(`app.winCertStore.locations.${c.location}`, c.location)}</span>
                           <span style={{ color: 'var(--text-muted)' }}>/</span>
                           <span style={{ color: 'var(--text-secondary)' }}>{t(`app.winCertStore.stores.${c.storeName}.label`, c.storeName)}</span>
                         </div>

                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                           <Clock size={13} style={{ color: diffDays < 0 ? 'var(--danger-color)' : 'var(--warning-color)' }} />
                           <span style={{ fontWeight: 600, color: diffDays < 0 ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                             {new Date(c.notAfter).toLocaleDateString()}
                           </span>
                           <span style={{ fontSize: '0.75rem', color: diffDays < 0 ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                             ({formatExpiry(c.notAfter, t, i18n.language)})
                           </span>
                         </div>
                       </div>

                       <div
                         className="copy-trigger-wrap"
                         style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem 0.6rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}
                         onClick={() => {
                           navigator.clipboard.writeText(c.thumbprint);
                           showToast(t('app.dashboard.copiedThumbprint', { name: cn, defaultValue: `Copied thumbprint for ${cn}` }), 'success');
                         }}
                         title={t('app.dashboard.copyThumbprint', 'Click to copy thumbprint')}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, overflow: 'hidden' }}>
                           <Fingerprint size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                           <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.thumbprint}</span>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, color: 'var(--text-accent)', fontSize: '0.72rem', fontWeight: 600 }}>
                           <span>{t('common.copy', 'Copy')}</span>
                           <Copy size={11} className="copy-trigger-icon" />
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
}
