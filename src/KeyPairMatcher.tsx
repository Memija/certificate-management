import { useState } from 'react';
import { Key, Shield, CheckCircle, XCircle, FileKey } from 'lucide-react';
import * as forge from 'node-forge';

export function KeyPairMatcher() {
  const [certInput, setCertInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  
  const [certStatus, setCertStatus] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<boolean | null>(null);
  const [matchMessage, setMatchMessage] = useState('');

  const handleMatch = () => {
    let certModulus = '';
    let keyModulus = '';
    
    setCertStatus(null);
    setKeyStatus(null);
    setMatchResult(null);

    // Parse Cert/CSR
    try {
      if (certInput.includes('CERTIFICATE REQUEST')) {
        const csr = forge.pki.certificationRequestFromPem(certInput);
        if (csr.publicKey && (csr.publicKey as any).n) {
          certModulus = (csr.publicKey as any).n.toString(16);
          setCertStatus('Valid CSR parsed.');
        } else {
          throw new Error('No RSA public key found in CSR.');
        }
      } else {
        const cert = forge.pki.certificateFromPem(certInput);
        if (cert.publicKey && (cert.publicKey as any).n) {
          certModulus = (cert.publicKey as any).n.toString(16);
          setCertStatus('Valid Certificate parsed.');
        } else {
          throw new Error('No RSA public key found in Certificate.');
        }
      }
    } catch (e: any) {
      setCertStatus(`Error: ${e.message}`);
      return;
    }

    // Parse Private Key
    try {
      const privateKey = forge.pki.privateKeyFromPem(keyInput);
      if ((privateKey as any).n) {
        keyModulus = (privateKey as any).n.toString(16);
        setKeyStatus('Valid RSA Private Key parsed.');
      } else {
        throw new Error('Only RSA keys are currently supported for matching.');
      }
    } catch (e: any) {
      setKeyStatus(`Error: ${e.message}`);
      return;
    }

    if (certModulus === keyModulus) {
      setMatchResult(true);
      setMatchMessage('The Private Key matches the Certificate/CSR!');
    } else {
      setMatchResult(false);
      setMatchMessage('The Private Key DOES NOT match the Certificate/CSR.');
    }
  };

  return (
     <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Key Pair Modulus Matcher
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Paste a Certificate (or CSR) and a Private Key in PEM format to mathematically verify if their RSA public key moduli match.
          </p>
        </div>

        <div className="responsive-grid-2" style={{ gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              <Shield size={18} style={{ color: 'var(--accent-color)' }} /> Certificate or CSR (PEM)
            </h3>
            <textarea
              className="form-textarea mono"
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              style={{ height: '240px', fontSize: '0.82rem' }}
            />
            {certStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', fontWeight: 500, color: certStatus.startsWith('Error') ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {certStatus}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              <FileKey size={18} style={{ color: 'var(--warning-color)' }} /> Private Key (PEM)
            </h3>
            <textarea
              className="form-textarea mono"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              style={{ height: '240px', fontSize: '0.82rem' }}
            />
            {keyStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', fontWeight: 500, color: keyStatus.startsWith('Error') ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {keyStatus}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn" onClick={handleMatch} disabled={!certInput || !keyInput} style={{ height: '44px', padding: '0 2rem' }}>
            <Key size={18} /> Verify Modulus Match
          </button>
        </div>

        {matchResult !== null && (
          <div className="glass-panel animate-fade-in" style={{ 
            marginTop: '2rem', 
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            background: matchResult ? 'var(--success-bg)' : 'var(--danger-bg)',
            borderColor: matchResult ? 'var(--success-border)' : 'var(--danger-border)'
          }}>
            <div className={`metric-icon-wrap ${matchResult ? 'success' : 'danger'}`} style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 1.25rem' }}>
              {matchResult ? (
                <CheckCircle size={32} />
              ) : (
                <XCircle size={32} />
              )}
            </div>
            <h3 style={{ color: matchResult ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>
              {matchMessage}
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
              {matchResult
                ? 'Both the public key modulus in the certificate/CSR and the private key modulus match bit-for-bit.'
                : 'The cryptographic modulus differs. This private key cannot be used with this certificate.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
