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
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Paste a Certificate (or CSR) and a Private Key in PEM format to verify if they are a mathematically matched pair.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ flex: '1 1 400px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Shield size={20} /> Certificate or CSR (PEM)
            </h3>
            <textarea
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----..."
              style={{
                width: '100%',
                height: '250px',
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '1rem',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none'
              }}
            />
            {certStatus && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: certStatus.startsWith('Error') ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {certStatus}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ flex: '1 1 400px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <FileKey size={20} /> Private Key (PEM)
            </h3>
            <textarea
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              style={{
                width: '100%',
                height: '250px',
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '1rem',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none'
              }}
            />
            {keyStatus && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: keyStatus.startsWith('Error') ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {keyStatus}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn" onClick={handleMatch} disabled={!certInput || !keyInput}>
            <Key size={18} /> Verify Match
          </button>
        </div>

        {matchResult !== null && (
          <div className="glass-panel" style={{ 
            marginTop: '2rem', 
            textAlign: 'center',
            background: matchResult ? 'var(--success-bg)' : 'var(--danger-bg)',
            borderColor: matchResult ? 'var(--success-color)' : 'var(--danger-color)'
          }}>
            {matchResult ? (
              <CheckCircle size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
            ) : (
              <XCircle size={48} color="var(--danger-color)" style={{ margin: '0 auto 1rem' }} />
            )}
            <h2 style={{ color: matchResult ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {matchMessage}
            </h2>
          </div>
        )}
      </div>
    </div>
  );
}
