import { useState } from 'react';
import { Globe, Shield, RefreshCw, AlertTriangle, Link as LinkIcon, Download, Server, Lock } from 'lucide-react';
import * as forge from 'node-forge';

export function TlsScanner() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState(443);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);

  const scan = async () => {
    if (!host) {
      setError('Host is required');
      return;
    }
    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      const res = await fetch(`/api/tlsscanner?host=${encodeURIComponent(host)}&port=${port}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to scan');
      }

      // Enrich with PEM using node-forge
      const enrichedChain = json.data.chain.map((c: any) => {
        try {
          const derStr = forge.util.decode64(c.rawB64);
          const asn1 = forge.asn1.fromDer(derStr);
          const cert = forge.pki.certificateFromAsn1(asn1);
          c.pem = forge.pki.certificateToPem(cert);
          
          c.subjectCN = cert.subject.getField('CN')?.value || 'Unknown';
          c.issuerCN = cert.issuer.getField('CN')?.value || 'Unknown';
          
          c.extensions = cert.extensions || [];
        } catch (e) {
          c.pem = '';
        }
        return c;
      });

      setScanResult({
         ...json.data,
         chain: enrichedChain
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadPem = (pem: string, name: string) => {
     const blob = new Blob([pem], { type: 'text/plain' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${name.replace(/[^a-z0-9]/gi, '_')}.pem`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Connect to any remote TLS/SSL endpoint to inspect its active certificate chain, protocol, and cipher suite.
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '2rem' }}>
           <div style={{ flex: '1 1 200px' }}>
              <label className="details-label">Hostname / IP</label>
              <input 
                 type="text" 
                 value={host} 
                 onChange={e => setHost(e.target.value)} 
                 placeholder="e.g. google.com"
                 onKeyDown={e => e.key === 'Enter' && scan()}
                 style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.75rem', color: '#fff' }} 
              />
           </div>
           <div style={{ flex: '0 1 100px' }}>
              <label className="details-label">Port</label>
              <input 
                 type="number" 
                 value={port} 
                 onChange={e => setPort(Number(e.target.value))} 
                 placeholder="443"
                 onKeyDown={e => e.key === 'Enter' && scan()}
                 style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.75rem', color: '#fff' }} 
              />
           </div>
           <button className="btn" onClick={scan} disabled={loading} style={{ padding: '0.75rem 1.5rem' }}>
              {loading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={18} />}
              Scan
           </button>
        </div>

        {error && (
           <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-color)', color: 'var(--danger-color)', marginBottom: '2rem' }}>
              <AlertTriangle size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
              <span style={{ verticalAlign: 'middle' }}>{error}</span>
           </div>
        )}

        {scanResult && (
           <div className="animate-fade-in">
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                 <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Server size={32} color="var(--accent-color)" />
                    <div>
                       <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Protocol</h4>
                       <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{scanResult.protocol}</strong>
                    </div>
                 </div>
                 <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Lock size={32} color="var(--accent-color)" />
                    <div>
                       <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Cipher Suite</h4>
                       <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{scanResult.cipher?.name || 'Unknown'}</strong>
                    </div>
                 </div>
              </div>

              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><LinkIcon size={20} /> Certificate Chain</h3>
              
              <div className="signature-lists">
                 {scanResult.chain.map((cert: any, idx: number) => {
                    const isExpired = new Date(cert.valid_to) < new Date();
                    
                    return (
                       <div key={idx} className="glass-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Shield size={24} color={isExpired ? 'var(--danger-color)' : 'var(--success-color)'} />
                                <div>
                                   <strong style={{ display: 'block', fontSize: '1.1rem' }}>{cert.subjectCN}</strong>
                                   <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Issuer: {cert.issuerCN}</span>
                                </div>
                             </div>
                             <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {idx === 0 && <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }}>Leaf</span>}
                                {idx > 0 && idx < scanResult.chain.length - 1 && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Intermediate</span>}
                                {idx === scanResult.chain.length - 1 && idx > 0 && <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Root</span>}
                                {isExpired && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Expired</span>}
                                
                                {cert.pem && (
                                   <button className="btn btn-secondary" onClick={() => downloadPem(cert.pem, cert.subjectCN)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto', marginLeft: '0.5rem' }}>
                                      <Download size={14} /> PEM
                                   </button>
                                )}
                             </div>
                          </div>
                          
                          <div className="details-grid">
                             <div className="details-label">Subject</div>
                             <div className="details-value">{cert.subject}</div>
                             
                             <div className="details-label">Issuer</div>
                             <div className="details-value">{cert.issuer}</div>

                             <div className="details-label">Valid From</div>
                             <div className="details-value">{new Date(cert.valid_from).toLocaleString()}</div>

                             <div className="details-label">Valid To</div>
                             <div className="details-value">{new Date(cert.valid_to).toLocaleString()}</div>

                             <div className="details-label">Serial Number</div>
                             <div className="details-value" style={{ fontFamily: 'monospace' }}>{cert.serialNumber}</div>
                             
                             <div className="details-label">SHA-256 Fingerprint</div>
                             <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{cert.fingerprint256}</div>
                          </div>
                          
                          {cert.extensions && cert.extensions.length > 0 && (
                            <details style={{ marginTop: '1rem' }}>
                              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>View Extensions ({cert.extensions.length})</summary>
                              <div className="details-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '4px' }}>
                                 {cert.extensions.map((ext: any, i: number) => (
                                    <div key={i} style={{ display: 'contents' }}>
                                       <div className="details-label">{ext.name || ext.oid}</div>
                                       <div className="details-value">
                                         <div>OID: {ext.oid} {ext.critical && <span style={{ color: 'var(--danger-color)', fontSize: '0.8em' }}>(Critical)</span>}</div>
                                         {ext.value && <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em', marginTop: '0.25rem' }}>{String(ext.value)}</div>}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                            </details>
                          )}

                          {cert.pem && (
                            <details style={{ marginTop: '1rem' }}>
                              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)' }}>View PEM</summary>
                              <pre>{cert.pem}</pre>
                            </details>
                          )}
                       </div>
                    );
                 })}
              </div>
           </div>
        )}

      </div>
    </div>
  );
}
