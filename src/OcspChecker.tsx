import { useState } from 'react';
import { ShieldCheck, ShieldAlert, UploadCloud, RefreshCw, Activity, HelpCircle } from 'lucide-react';
import { LearningTerm } from './LearningTerm';
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
      } catch {
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
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Online Revocation Checker
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Check real-time revocation status using <LearningTerm termId="ocsp">OCSP</LearningTerm> and <LearningTerm termId="crl">CRL</LearningTerm> endpoints extracted directly from the certificate.
          </p>
        </div>

        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>Certificate (<LearningTerm termId="pem">PEM</LearningTerm> Format)</label>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <UploadCloud size={14} /> Upload <LearningTerm termId="pem">.pem</LearningTerm> / <LearningTerm termId="der">.cer</LearningTerm>
              <input type="file" accept=".cer,.crt,.pem" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <textarea
              className="form-textarea mono"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              style={{ height: '220px' }}
            />
          </div>

          <button className="btn" onClick={checkRevocation} disabled={loading} style={{ width: '100%', justifyContent: 'center', height: '44px' }}>
            {loading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={18} />}
            <span>{loading ? 'Checking Revocation Status...' : 'Check Revocation Status'}</span>
          </button>
        </div>

        {error && (
          <div className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', marginBottom: '2rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="animate-fade-in glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border-subtle)', marginBottom: '1.5rem' }}>
              <div className={`metric-icon-wrap ${result.status === 'good' ? 'success' : result.status === 'revoked' ? 'danger' : 'warning'}`} style={{ width: 52, height: 52, borderRadius: 12 }}>
                {result.status === 'good' && <ShieldCheck size={28} />}
                {result.status === 'revoked' && <ShieldAlert size={28} />}
                {result.status === 'unknown' && <HelpCircle size={28} />}
              </div>
              
              <div>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', color: result.status === 'good' ? 'var(--success-color)' : result.status === 'revoked' ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                  {result.status === 'good' && 'Certificate is Valid (Not Revoked)'}
                  {result.status === 'revoked' && 'Certificate is REVOKED'}
                  {result.status === 'unknown' && 'Revocation Status Unknown'}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Checked using native Windows certificate utility algorithms (<LearningTerm termId="ocsp">OCSP</LearningTerm>/<LearningTerm termId="crl">CRL</LearningTerm>).
                </p>
              </div>
            </div>

            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600 }}>View Raw Diagnostic Output</summary>
              <pre className="code-block" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                {result.output}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
