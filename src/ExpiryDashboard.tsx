import { useState, useEffect } from 'react';
import { Clock, RefreshCw, Shield, AlertCircle } from 'lucide-react';

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
  
  const fetchStores = async () => {
     setLoading(true);
     setError('');
     
     try {
       const locations = ['CurrentUser'];
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
       
       // Sort by expiry date, ascending
       expiringCerts.sort((a, b) => new Date(a.notAfter).getTime() - new Date(b.notAfter).getTime());
       
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

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Overview of certificates that are expired or expiring within 30 days in your CurrentUser store.
          </p>
        </div>

        {error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-color)', color: 'var(--danger-color)', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ flex: '1 1 200px', textAlign: 'center' }}>
            <AlertCircle size={32} color={expiredCount > 0 ? "var(--danger-color)" : "var(--success-color)"} style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ margin: 0, fontSize: '2rem', color: expiredCount > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>{expiredCount}</h2>
            <div style={{ color: 'var(--text-secondary)' }}>Expired Certificates</div>
          </div>
          <div className="glass-panel" style={{ flex: '1 1 200px', textAlign: 'center' }}>
            <Clock size={32} color={expiringSoonCount > 0 ? "var(--warning-color)" : "var(--success-color)"} style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ margin: 0, fontSize: '2rem', color: expiringSoonCount > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>{expiringSoonCount}</h2>
            <div style={{ color: 'var(--text-secondary)' }}>Expiring Soon (&lt;30 days)</div>
          </div>
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn" onClick={fetchStores} disabled={loading}>
              <RefreshCw size={20} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> 
              Refresh
            </button>
          </div>
        </div>

        <div className="glass-panel">
           <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} /> Action Items
           </h3>
           
           {loading ? (
             <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--text-accent)' }} />
                <div>Scanning certificate stores...</div>
             </div>
           ) : certs.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--success-color)' }}>
                <Shield size={48} style={{ marginBottom: '1rem', opacity: 0.8 }} />
                <h3>All Clear!</h3>
                <p style={{ color: 'var(--text-secondary)' }}>No expired or expiring certificates found in your CurrentUser store.</p>
             </div>
           ) : (
             <div style={{ overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                     <th style={{ padding: '0.75rem', width: '40%' }}>Subject</th>
                     <th style={{ padding: '0.75rem', width: '20%' }}>Store</th>
                     <th style={{ padding: '0.75rem', width: '20%' }}>Expiry Date</th>
                     <th style={{ padding: '0.75rem', width: '20%' }}>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {certs.map((c) => {
                      const cn = c.subject.match(/CN=([^,]+)/)?.[1]?.trim() || c.subject.match(/O=([^,]+)/)?.[1]?.trim() || c.subject;
                      return (
                         <tr key={c.thumbprint} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                           <td style={{ padding: '0.75rem', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                             <strong style={{ color: 'var(--text-primary)' }}>{cn}</strong><br/>
                             <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.thumbprint}</span>
                           </td>
                           <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                             {c.location}\{c.storeName}
                           </td>
                           <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                             {new Date(c.notAfter).toLocaleDateString()}
                           </td>
                           <td style={{ padding: '0.75rem' }}>
                             {c.isExpired ? (
                               <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Expired</span>
                             ) : (
                               <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Expiring Soon</span>
                             )}
                           </td>
                         </tr>
                      )
                   })}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
