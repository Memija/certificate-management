import { useState } from 'react';
import { ShieldAlert, ShieldCheck, HelpCircle, Activity, UploadCloud, RefreshCw } from 'lucide-react';
import * as forge from 'node-forge';

export function OcspChecker() {
  const [certInput, setCertInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCertInput(content);
    };
    reader.readAsText(file);
  };

  const checkRevocation = async () => {
    if (!certInput.trim()) {
      setError('Please provide a PEM certificate');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Parse the PEM to ensure it's valid and get the DER base64
      let certB64 = '';
      try {
        const cert = forge.pki.certificateFromPem(certInput);
        const asn1 = forge.pki.certificateToAsn1(cert);
        const der = forge.asn1.toDer(asn1).getBytes();
        certB64 = forge.util.encode64(der);
      } catch (err) {
        throw new Error('Invalid PEM certificate provided.');
      }

      const res = await fetch('/api/ocsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ certB64 })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to check OCSP status');
      }

      setResult(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Check if a certificate has been revoked using OCSP and CRL endpoints extracted directly from the certificate.
          </p>
        </div>

        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <label className="details-label" style={{ margin: 0 }}>Certificate (PEM Format)</label>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <UploadCloud size={16} /> Upload .cer / .pem
              <input type="file" accept=".cer,.crt,.pem" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          <textarea
            value={certInput}
            onChange={(e) => setCertInput(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            style={{ 
              width: '100%', 
              height: '200px', 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '4px', 
              padding: '1rem', 
              color: '#fff',
              fontFamily: 'monospace',
              resize: 'vertical',
              marginBottom: '1rem'
            }}
          />

          <button className="btn" onClick={checkRevocation} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={20} />}
            {loading ? 'Checking...' : 'Check Revocation Status'}
          </button>
        </div>

        {error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-color)', color: 'var(--danger-color)', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {result && (
          <div className="animate-fade-in glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.5rem' }}>
              {result.status === 'good' && <ShieldCheck size={48} color="var(--success-color)" />}
              {result.status === 'revoked' && <ShieldAlert size={48} color="var(--danger-color)" />}
              {result.status === 'unknown' && <HelpCircle size={48} color="var(--warning-color)" />}
              
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0' }}>
                  {result.status === 'good' && 'Certificate is Valid (Not Revoked)'}
                  {result.status === 'revoked' && 'Certificate is REVOKED'}
                  {result.status === 'unknown' && 'Revocation Status Unknown'}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  Checked using native Windows certificate utility algorithms (OCSP/CRL).
                </p>
              </div>
            </div>

            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)' }}>View Raw Diagnostic Output</summary>
              <pre style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '1rem', 
                borderRadius: '4px', 
                marginTop: '1rem',
                overflowX: 'auto',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                {result.output}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
