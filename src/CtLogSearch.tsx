import { useState } from 'react';
import { Search, Globe, Calendar, Shield, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LearningTerm } from './LearningTerm';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';

interface CtEntry {
  id: number;
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}

export function CtLogSearch() {
  const { t, i18n } = useTranslation();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<CtEntry[] | null>(null);

  const searchLogs = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch(`/api/ctsearch?domain=${encodeURIComponent(domain.trim())}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to search CT logs');
      }

      // crt.sh can sometimes return duplicates, we can deduplicate by serial_number
      const uniqueResults = (result.data || []).reduce((acc: CtEntry[], current: CtEntry) => {
        const x = acc.find(item => item.serial_number === current.serial_number);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      setResults(uniqueResults.sort((a: CtEntry, b: CtEntry) => new Date(b.not_before).getTime() - new Date(a.not_before).getTime()));
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching CT logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchLogs();
    }
  };

  const formatIssuer = (issuer: string) => {
    const cnMatch = issuer.match(/CN=([^,]+)/);
    const oMatch = issuer.match(/O=([^,]+)/);
    if (oMatch && cnMatch) return `${oMatch[1]} - ${cnMatch[1]}`;
    if (cnMatch) return cnMatch[1];
    if (oMatch) return oMatch[1];
    return issuer;
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Certificate Transparency (CT) Log Search
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Search public <LearningTerm termId="ctlog">Certificate Transparency (CT)</LearningTerm> logs to discover all certificates ever issued for a specific domain name.
          </p>
        </div>

        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            <Globe size={18} style={{ color: 'var(--accent-color)' }} /> Domain / Subdomain Query
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. google.com or github.com"
              className="form-input"
              style={{ flex: '1 1 240px' }}
            />
            <button className="btn" onClick={searchLogs} disabled={loading} style={{ height: '42px', padding: '0 1.5rem' }}>
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              <span>{loading ? 'Searching Logs...' : 'Search CT Logs'}</span>
            </button>
          </div>
          {error && <div style={{ marginTop: '1rem', color: 'var(--danger-color)', fontSize: '0.88rem' }}>{error}</div>}
        </div>

        {results && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                 Found <span style={{ color: 'var(--accent-color)' }}>{results.length}</span> certificates
              </h3>
            </div>
            
            {results.length === 0 ? (
               <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No transparency logs recorded for this domain.</p>
               </div>
            ) : (
               <div className="responsive-grid-2" style={{ gap: '1rem' }}>
                 {results.map((entry) => (
                   <div key={entry.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                           <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: '0.25rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{entry.common_name}</div>
                           <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Shield size={13} style={{ color: 'var(--text-accent)' }} /> {formatIssuer(entry.issuer_name)}
                           </div>
                        </div>
                        <span className="badge" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          ID: {entry.id}
                        </span>
                     </div>

                     <div className="mono" style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border-subtle)', padding: '0.65rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                        {entry.name_value.split('\n').join(', ')}
                     </div>
                     
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                           <Calendar size={12} /> Issued: {new Date(entry.not_before).toLocaleDateString()}
                        </div>
                         <div
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }}
                            title={formatExpiryTooltip(entry.not_after, t, i18n.language)}
                         >
                            Expires: {new Date(entry.not_after).toLocaleDateString()}{' '}
                            <span style={{ color: new Date(entry.not_after) < new Date() ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                              ({formatExpiry(entry.not_after, t, i18n.language)})
                            </span>
                         </div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
