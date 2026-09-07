import { useState } from 'react';
import { Zap, Copy, FileKey, Shield, RefreshCw, Download } from 'lucide-react';
import * as forge from 'node-forge';
import { useToast } from './ToastContext';

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
  const { showToast } = useToast();

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
        showToast(outputType === 'csr' ? 'Generated RSA Key Pair & CSR' : 'Generated RSA Key Pair & Certificate', 'success');
      } catch (err: any) {
        setError(`Failed to generate: ${err.message}`);
        showToast(`Generation failed: ${err.message}`, 'error');
      } finally {
        setGenerating(false);
      }
    }, 100);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard`, 'success');
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  };

  const safeName = cn.replace(/[^a-zA-Z0-9_-]/g, '_') || 'certificate';

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Key Pair &amp; CSR / Self-Signed Generator
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Generate a new RSA Key Pair and a Certificate Signing Request (CSR) or Self-Signed Certificate entirely in your browser using pure cryptography.
          </p>
        </div>

        <div className="key-gen-main-grid">
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Zap size={18} style={{ color: 'var(--accent-color)' }} /> Subject Details &amp; Parameters
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Common Name (CN)</label>
                <input type="text" value={cn} onChange={e => setCn(e.target.value)} className="form-input" placeholder="e.g. example.com" />
              </div>

              <div className="key-gen-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Organization (O)</label>
                  <input type="text" value={org} onChange={e => setOrg(e.target.value)} className="form-input" placeholder="Organization" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unit (OU)</label>
                  <input type="text" value={ou} onChange={e => setOu(e.target.value)} className="form-input" placeholder="IT Dept" />
                </div>
              </div>

              <div className="key-gen-row-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">City (L)</label>
                  <input type="text" value={locality} onChange={e => setLocality(e.target.value)} className="form-input" placeholder="City" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">State (ST)</label>
                  <input type="text" value={state} onChange={e => setState(e.target.value)} className="form-input" placeholder="State" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Country (C)</label>
                  <input type="text" value={country} onChange={e => setCountry(e.target.value)} maxLength={2} className="form-input" placeholder="US" />
                </div>
              </div>

              <div className="key-gen-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Key Size</label>
                  <select value={keySize} onChange={e => setKeySize(Number(e.target.value))} className="form-select">
                    <option value={2048}>2048-bit (Standard)</option>
                    <option value={4096}>4096-bit (High Security)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Output Type</label>
                  <select value={outputType} onChange={e => setOutputType(e.target.value as any)} className="form-select">
                    <option value="csr">CSR (Signing Request)</option>
                    <option value="self-signed">Self-Signed Certificate</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="btn" onClick={generate} disabled={generating} style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', height: '44px' }}>
              {generating ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
              <span>{generating ? (outputType === 'csr' ? 'Generating Keys & CSR...' : 'Generating Keys & Cert...') : (outputType === 'csr' ? 'Generate Key Pair & CSR' : 'Generate Key Pair & Cert')}</span>
            </button>
            
            {error && (
               <div style={{ marginTop: '1rem', color: 'var(--danger-color)', fontSize: '0.88rem' }}>{error}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                 <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                   <FileKey size={16} style={{ color: 'var(--accent-color)' }} /> Generated Private Key
                 </h3>
                 {generatedKey && (
                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                     <button className="btn btn-download-pem btn-sm" onClick={() => downloadFile(generatedKey, `${safeName}_private.key`, 'application/x-pem-file')}>
                       <Download size={12} /> .key
                     </button>
                     <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(generatedKey, 'Private Key')}>
                       <Copy size={12} /> Copy
                     </button>
                   </div>
                 )}
               </div>
               <textarea
                 value={generatedKey}
                 readOnly
                 className="form-textarea mono"
                 placeholder="Generated RSA private key will appear here..."
                 style={{ height: '140px', fontSize: '0.82rem' }}
               />
            </div>
            
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                 <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                   <Shield size={16} style={{ color: 'var(--success-color)' }} /> Generated {outputType === 'csr' ? 'CSR' : 'Certificate'}
                 </h3>
                 {generatedOutput && (
                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                     <button className="btn btn-download-pem btn-sm" onClick={() => downloadFile(generatedOutput, `${safeName}.${outputType === 'csr' ? 'csr' : 'crt'}`, 'application/x-pem-file')}>
                       <Download size={12} /> {outputType === 'csr' ? '.csr' : '.crt'}
                     </button>
                     <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(generatedOutput, outputType === 'csr' ? 'CSR' : 'Certificate')}>
                       <Copy size={12} /> Copy
                     </button>
                   </div>
                 )}
               </div>
               <textarea
                 value={generatedOutput}
                 readOnly
                 className="form-textarea mono"
                 placeholder={outputType === 'csr' ? "Generated CSR will appear here..." : "Generated Self-Signed Certificate will appear here..."}
                 style={{ height: '140px', fontSize: '0.82rem' }}
               />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
