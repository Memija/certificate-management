import { useState } from 'react';
import { Zap, Copy, FileKey, Shield, RefreshCw } from 'lucide-react';
import * as forge from 'node-forge';

export function KeyGenerator() {
  const [cn, setCn] = useState('example.com');
  const [org, setOrg] = useState('My Company');
  const [ou, setOu] = useState('IT');
  const [locality, setLocality] = useState('City');
  const [state, setState] = useState('State');
  const [country, setCountry] = useState('US');
  const [keySize, setKeySize] = useState(2048);

  const [outputType, setOutputType] = useState<'csr' | 'self-signed'>('csr');
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [error, setError] = useState('');

  const generate = () => {
    setGenerating(true);
    setError('');
    
    // Use setTimeout so the UI can update before blocking key generation
    setTimeout(() => {
      try {
        const keys = forge.pki.rsa.generateKeyPair(keySize);
        const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
        
        const attrs = [
          { name: 'commonName', value: cn },
          { name: 'countryName', value: country },
          { name: 'stateOrProvinceName', value: state },
          { name: 'localityName', value: locality },
          { name: 'organizationName', value: org },
          { name: 'organizationalUnitName', value: ou }
        ];

        let outputStr = '';

        if (outputType === 'csr') {
          const csr = forge.pki.createCertificationRequest();
          csr.publicKey = keys.publicKey;
          csr.setSubject(attrs);
          csr.sign(keys.privateKey);
          outputStr = forge.pki.certificationRequestToPem(csr);
        } else {
          const cert = forge.pki.createCertificate();
          cert.publicKey = keys.publicKey;
          cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));
          cert.validity.notBefore = new Date();
          cert.validity.notAfter = new Date();
          cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
          cert.setSubject(attrs);
          cert.setIssuer(attrs);
          // Add some standard extensions
          cert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
            { name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true },
            { name: 'nsCertType', client: true, server: true, email: true, objsign: true, sslCA: true, emailCA: true, objCA: true },
            { name: 'subjectAltName', altNames: [{ type: 2, value: cn }] },
            { name: 'subjectKeyIdentifier' }
          ]);
          cert.sign(keys.privateKey, forge.md.sha256.create());
          outputStr = forge.pki.certificateToPem(cert);
        }
        
        setGeneratedKey(privateKeyPem);
        setGeneratedOutput(outputStr);
      } catch (err: any) {
        setError(`Failed to generate: ${err.message}`);
      } finally {
        setGenerating(false);
      }
    }, 100);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Generate a new RSA Key Pair and a Certificate Signing Request (CSR) or Self-Signed Certificate entirely in your browser.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={20} /> Request Details
            </h3>

            <div className="details-grid">
              <label className="details-label" style={{ alignSelf: 'center' }}>Common Name (CN)</label>
              <input type="text" value={cn} onChange={e => setCn(e.target.value)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>Organization (O)</label>
              <input type="text" value={org} onChange={e => setOrg(e.target.value)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>Organizational Unit (OU)</label>
              <input type="text" value={ou} onChange={e => setOu(e.target.value)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>Locality / City (L)</label>
              <input type="text" value={locality} onChange={e => setLocality(e.target.value)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>State / Province (ST)</label>
              <input type="text" value={state} onChange={e => setState(e.target.value)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>Country (C)</label>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)} maxLength={2} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }} />

              <label className="details-label" style={{ alignSelf: 'center' }}>Key Size</label>
              <select value={keySize} onChange={e => setKeySize(Number(e.target.value))} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }}>
                <option value={2048}>2048-bit (Standard)</option>
                <option value={4096}>4096-bit (High Security)</option>
              </select>

              <label className="details-label" style={{ alignSelf: 'center' }}>Output Type</label>
              <select value={outputType} onChange={e => setOutputType(e.target.value as any)} className="details-value" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '0.5rem', color: '#fff' }}>
                <option value="csr">Certificate Signing Request (CSR)</option>
                <option value="self-signed">Self-Signed Certificate</option>
              </select>
            </div>

            <button className="btn" onClick={generate} disabled={generating} style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', background: 'var(--accent-color)', color: '#000' }}>
              {generating ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
              {generating ? (outputType === 'csr' ? 'Generating Keys & CSR...' : 'Generating Keys & Cert...') : (outputType === 'csr' ? 'Generate Key Pair & CSR' : 'Generate Key Pair & Cert')}
            </button>
            
            {error && (
               <div style={{ marginTop: '1rem', color: 'var(--danger-color)' }}>{error}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel">
               <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileKey size={18} /> Private Key</h3>
                 {generatedKey && <button className="btn btn-secondary" onClick={() => copyToClipboard(generatedKey)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}><Copy size={14} /> Copy</button>}
               </div>
               <textarea
                 value={generatedKey}
                 readOnly
                 placeholder="Private key will appear here..."
                 style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '1rem', color: 'var(--text-secondary)', fontFamily: 'monospace', resize: 'vertical', outline: 'none', fontSize: '0.85rem' }}
               />
            </div>
            
            <div className="glass-panel">
               <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={18} /> {outputType === 'csr' ? 'CSR' : 'Certificate'}</h3>
                 {generatedOutput && <button className="btn btn-secondary" onClick={() => copyToClipboard(generatedOutput)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}><Copy size={14} /> Copy</button>}
               </div>
               <textarea
                 value={generatedOutput}
                 readOnly
                 placeholder={outputType === 'csr' ? "CSR will appear here..." : "Certificate will appear here..."}
                 style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '1rem', color: 'var(--text-secondary)', fontFamily: 'monospace', resize: 'vertical', outline: 'none', fontSize: '0.85rem' }}
               />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
