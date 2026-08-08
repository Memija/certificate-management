import { useState } from 'react';
import { Search, Globe, Calendar, Shield, ExternalLink, RefreshCw } from 'lucide-react';

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
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Search public Certificate Transparency (CT) logs to discover all certificates issued for a specific domain name.
          </p>
        </div>

        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={20} /> Domain Search
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. google.com"
              className="details-value"
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.75rem 1rem', color: '#fff', fontSize: '1rem', outline: 'none' }}
            />
            <button className="btn" onClick={searchLogs} disabled={loading} style={{ padding: '0 2rem' }}>
              {loading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {error && <div style={{ marginTop: '1rem', color: 'var(--danger-color)' }}>{error}</div>}
        </div>

        {results && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-accent)' }}>
               Found {results.length} unique certificates
            </h3>
            
            {results.length === 0 ? (
               <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No certificates found for this domain.</p>
               </div>
            ) : (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                 {results.map((entry) => (
                   <div key={entry.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                           <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', wordBreak: 'break-all' }}>{entry.common_name}</div>
                           <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Shield size={14} /> {formatIssuer(entry.issuer_name)}
                           </div>
                        </div>
                        <a href={`https://crt.sh/?id=${entry.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', background: 'rgba(56, 189, 248, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                           crt.sh <ExternalLink size={12} />
                        </a>
                     </div>

                     <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        {entry.name_value.split('\n').join(', ')}
                     </div>
                     
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                           <Calendar size={14} /> Not Before: {new Date(entry.not_before).toLocaleDateString()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                           Not After: {new Date(entry.not_after).toLocaleDateString()}
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
