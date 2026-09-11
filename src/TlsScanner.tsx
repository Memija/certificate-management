import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Shield, RefreshCw, AlertTriangle, Link as LinkIcon, Download, Server, Lock } from 'lucide-react';
import * as forge from 'node-forge';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';
import { formatExtensionValue } from './utils/purposeFormatter';

export function TlsScanner() {
  const { t, i18n } = useTranslation();
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
        } catch {
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
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Remote TLS Endpoint Scanner
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Connect to any remote TLS/SSL endpoint to inspect its active certificate chain, protocol negotiation, and cipher suite.
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '2rem', padding: '1.5rem' }}>
           <div className="form-group" style={{ flex: '1 1 240px', marginBottom: 0 }}>
              <label className="form-label">Hostname / Domain / IP</label>
              <input 
                 type="text" 
                 className="form-input"
                 value={host} 
                 onChange={e => setHost(e.target.value)} 
                 placeholder="e.g. google.com or api.github.com"
                 onKeyDown={e => e.key === 'Enter' && scan()}
              />
           </div>
           <div className="form-group" style={{ flex: '0 1 120px', marginBottom: 0 }}>
              <label className="form-label">Port</label>
              <input 
                 type="number" 
                 className="form-input"
                 value={port} 
                 onChange={e => setPort(Number(e.target.value))} 
                 placeholder="443"
                 onKeyDown={e => e.key === 'Enter' && scan()}
              />
           </div>
           <button className="btn" onClick={scan} disabled={loading} style={{ height: '42px', padding: '0 1.5rem' }}>
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={16} />}
              <span>Scan Endpoint</span>
           </button>
        </div>

        {error && (
           <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', marginBottom: '2rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <span>{error}</span>
           </div>
        )}

        {scanResult && (
           <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div className="metric-cards-grid">
                 <div className="metric-card">
                    <div className="metric-icon-wrap info">
                      <Server size={22} />
                    </div>
                    <div className="metric-info">
                       <div className="metric-label">Negotiated Protocol</div>
                       <div className="metric-val" style={{ fontSize: '1.25rem' }}>{scanResult.protocol}</div>
                    </div>
                 </div>
                 <div className="metric-card">
                    <div className="metric-icon-wrap success">
                      <Lock size={22} />
                    </div>
                    <div className="metric-info">
                       <div className="metric-label">Negotiated Cipher Suite</div>
                       <div className="metric-val" style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>{scanResult.cipher?.name || 'Unknown'}</div>
                    </div>
                 </div>
              </div>

              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                  <LinkIcon size={18} style={{ color: 'var(--text-accent)' }} /> 
                  Presented Certificate Chain ({scanResult.chain.length})
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   {scanResult.chain.map((cert: any, idx: number) => {
                      const isExpired = new Date(cert.valid_to) < new Date();
                      
                      return (
                         <div key={idx} className="glass-card" style={{ borderLeft: `3px solid ${isExpired ? 'var(--danger-color)' : idx === 0 ? 'var(--accent-color)' : 'var(--glass-border-accent)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div className={`metric-icon-wrap ${isExpired ? 'danger' : 'success'}`} style={{ width: 38, height: 38, borderRadius: 8 }}>
                                    <Shield size={18} />
                                  </div>
                                  <div>
                                     <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{cert.subjectCN}</strong>
                                     <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Issuer: {cert.issuerCN}</span>
                                  </div>
                               </div>
                               <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {idx === 0 && <span className="badge badge-purple">{t('app.certDetails.leafCert', 'Leaf Certificate')}</span>}
                                  {idx > 0 && idx < scanResult.chain.length - 1 && <span className="badge badge-warning">{t('app.certDetails.intermediateCa', 'Intermediate CA')}</span>}
                                  {idx === scanResult.chain.length - 1 && idx > 0 && <span className="badge badge-success">{t('app.certDetails.rootCa', 'Root CA')}</span>}
                                  {isExpired && <span className="badge badge-danger"><span className="badge-dot pulse" />{t('app.certDetails.expired', 'Expired')}</span>}
                                  
                                  {cert.pem && (
                                     <button className="btn btn-download-pem" onClick={() => downloadPem(cert.pem, cert.subjectCN)} style={{ marginLeft: '0.4rem' }}>
                                        <Download size={13} /> Download PEM
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
                               <div className="details-value" style={{ color: isExpired ? 'var(--danger-color)' : undefined, fontWeight: isExpired ? 600 : undefined }}>
                                 {new Date(cert.valid_to).toLocaleString()}{' '}
                                 <span
                                   style={{ fontSize: '0.85rem', fontWeight: 500, color: isExpired ? 'var(--danger-color)' : 'var(--text-secondary)', marginLeft: '0.35rem', cursor: 'help' }}
                                   title={formatExpiryTooltip(cert.valid_to, t, i18n.language)}
                                 >
                                   ({formatExpiry(cert.valid_to, t, i18n.language)})
                                 </span>
                               </div>

                               <div className="details-label">Serial Number</div>
                               <div className="details-value mono">{cert.serialNumber}</div>
                               
                               <div className="details-label">SHA-256 Fingerprint</div>
                               <div className="details-value mono" style={{ wordBreak: 'break-all' }}>{cert.fingerprint256}</div>
                            </div>
                            
                            {cert.extensions && cert.extensions.length > 0 && (
                              <details style={{ marginTop: '1rem' }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem', fontSize: '0.88rem', fontWeight: 600 }}>View Extensions ({cert.extensions.length})</summary>
                                <div className="details-grid" style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border-subtle)', padding: '0.85rem 1rem', borderRadius: 8, marginTop: 4 }}>
                                   {cert.extensions.map((ext: any, i: number) => (
                                      <div key={i} style={{ display: 'contents' }}>
                                         <div className="details-label" style={{ fontSize: '0.78rem' }}>{ext.name || ext.oid}</div>
                                         <div className="details-value">
                                           <div style={{ fontSize: '0.8rem' }}>OID: {ext.oid} {ext.critical && <span className="badge badge-danger" style={{ fontSize: '0.65em', marginLeft: 4 }}>{t('app.certDetails.critical', 'Critical')}</span>}</div>
                                            {ext.value && <div className="mono" style={{ wordBreak: 'break-all', fontSize: '0.78rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>{formatExtensionValue(ext.name, ext.oid, String(ext.value), t)}</div>}
                                         </div>
                                      </div>
                                   ))}
                                </div>
                              </details>
                            )}

                            {cert.pem && (
                              <details style={{ marginTop: '0.75rem' }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600 }}>View PEM</summary>
                                <pre className="code-block" style={{ marginTop: '0.5rem' }}>{cert.pem}</pre>
                              </details>
                            )}
                         </div>
                      );
                   })}
                </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
}
