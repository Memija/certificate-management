import { useState, useRef } from 'react';
import { FileArchive, Download, Upload, Shield, Key } from 'lucide-react';
import * as forge from 'node-forge';

type ConvertMode = 'pem-der' | 'pfx';

export function FormatConverter() {
  const [mode, setMode] = useState<ConvertMode>('pem-der');

  // PEM <-> DER state
  const [file1, setFile1] = useState<File | null>(null);
  const [file1Content, setFile1Content] = useState<string | ArrayBuffer | null>(null);
  const [convertType, setConvertType] = useState<'cert' | 'key'>('cert');
  const [outputFormat, setOutputFormat] = useState<'pem' | 'der'>('der');
  const file1InputRef = useRef<HTMLInputElement>(null);

  // PFX state
  const [certInput, setCertInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFile1Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile1(f);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setFile1Content(evt.target.result);
        }
      };
      if (f.name.endsWith('.der') || f.name.endsWith('.cer') || f.name.endsWith('.crt')) {
         // might be binary
         reader.readAsArrayBuffer(f);
      } else {
         reader.readAsText(f);
      }
    }
  };

  const handlePemDerConvert = () => {
    setError('');
    setMessage('');
    if (!file1 || !file1Content) return;

    try {

      let isInputBinary = file1Content instanceof ArrayBuffer;

      // Handle Input
      let asn1Obj: any = null;

      if (isInputBinary) {
         const bytes = new Uint8Array(file1Content as ArrayBuffer);
         let binaryStr = '';
         for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i]);
         asn1Obj = forge.asn1.fromDer(binaryStr);
      } else {
         const text = file1Content as string;
         if (text.includes('BEGIN')) {
            if (convertType === 'cert') {
               const cert = forge.pki.certificateFromPem(text);
               asn1Obj = forge.pki.certificateToAsn1(cert);
            } else {
               const key = forge.pki.privateKeyFromPem(text);
               asn1Obj = forge.pki.privateKeyToAsn1(key);
            }
         } else {
            // Assume base64 DER
            const binaryStr = forge.util.decode64(text);
            asn1Obj = forge.asn1.fromDer(binaryStr);
         }
      }

      // Handle Output
      if (outputFormat === 'der') {
         const derStr = forge.asn1.toDer(asn1Obj).getBytes();
         const bytes = new Uint8Array(derStr.length);
         for (let i = 0; i < derStr.length; i++) bytes[i] = derStr.charCodeAt(i);
         downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), `converted_${file1.name.split('.')[0]}.der`);
         setMessage('DER file downloaded!');
      } else {
         let pem = '';
         if (convertType === 'cert') {
            const cert = forge.pki.certificateFromAsn1(asn1Obj);
            pem = forge.pki.certificateToPem(cert);
         } else {
            const key = forge.pki.privateKeyFromAsn1(asn1Obj);
            pem = forge.pki.privateKeyToPem(key as any);
         }
         downloadBlob(new Blob([pem], { type: 'text/plain' }), `converted_${file1.name.split('.')[0]}.pem`);
         setMessage('PEM file downloaded!');
      }

    } catch (e: any) {
      setError(`Conversion failed: ${e.message}`);
    }
  };

  const handlePfxBuild = () => {
    setError('');
    setMessage('');
    if (!certInput || !keyInput) {
       setError('Certificate and Private Key are required.');
       return;
    }

    try {
      const cert = forge.pki.certificateFromPem(certInput);
      const key = forge.pki.privateKeyFromPem(keyInput);
      
      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], pfxPassword, { generateLocalKeyId: true, algorithm: '3des' });
      const derStr = forge.asn1.toDer(p12Asn1).getBytes();
      
      const bytes = new Uint8Array(derStr.length);
      for (let i = 0; i < derStr.length; i++) bytes[i] = derStr.charCodeAt(i);
      
      downloadBlob(new Blob([bytes], { type: 'application/x-pkcs12' }), 'certificate.pfx');
      setMessage('PFX file downloaded!');
    } catch (e: any) {
      setError(`PFX generation failed: ${e.message}`);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
            Certificate Format Converter &amp; PFX Builder
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Convert between PEM and DER formats, or package a Certificate and Private Key into a PFX (PKCS#12) archive.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '2rem', justifyContent: 'center' }}>
          <button 
            data-mode="pem-der"
            className={`format-tab-btn ${mode === 'pem-der' ? 'active' : ''}`} 
            onClick={() => { setMode('pem-der'); setError(''); setMessage(''); }}
          >
            <FileArchive size={16} /> PEM ↔ DER Converter
          </button>
          <button 
            data-mode="pfx"
            className={`format-tab-btn ${mode === 'pfx' ? 'active' : ''}`} 
            onClick={() => { setMode('pfx'); setError(''); setMessage(''); }}
          >
            <Shield size={16} /> Build PFX (PKCS#12)
          </button>
        </div>

        {mode === 'pem-der' && (
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '650px', margin: '0 auto', padding: '1.75rem' }}>
             <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>PEM ↔ DER File Converter</h3>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                   <label className="form-label">Select Source File</label>
                   <div>
                      <input type="file" ref={file1InputRef} onChange={handleFile1Upload} style={{ display: 'none' }} />
                      <button className="btn btn-secondary" onClick={() => file1InputRef.current?.click()} style={{ width: '100%', justifyContent: 'center' }}>
                         <Upload size={16} /> {file1 ? file1.name : 'Choose PEM or DER File...'}
                      </button>
                   </div>
                </div>

                <div className="format-converter-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Content Type</label>
                    <select className="form-select" value={convertType} onChange={e => setConvertType(e.target.value as any)}>
                      <option value="cert">Certificate (X.509)</option>
                      <option value="key">Private Key (RSA)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Target Output Format</label>
                    <select className="form-select" value={outputFormat} onChange={e => setOutputFormat(e.target.value as any)}>
                      <option value="der">DER (Raw Binary)</option>
                      <option value="pem">PEM (Base64 ASCII)</option>
                    </select>
                  </div>
                </div>
             </div>

             <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button className="btn" onClick={handlePemDerConvert} disabled={!file1} style={{ width: '100%', justifyContent: 'center', height: '44px' }}>
                   <Download size={18} /> Convert &amp; Download
                </button>
             </div>
          </div>
        )}

        {mode === 'pfx' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem' }}>
             <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>Package PFX Archive</h3>
             <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                Combine a PEM Certificate and a PEM Private Key into a secure PFX (PKCS#12) container suitable for Windows Certificate Store, IIS, or Azure Key Vault.
             </p>

             <div className="responsive-grid-2" style={{ gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={15} style={{ color: 'var(--accent-color)' }} /> Certificate (PEM)</label>
                  <textarea
                    className="form-textarea mono"
                    value={certInput}
                    onChange={e => setCertInput(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    style={{ height: '220px', fontSize: '0.82rem' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={15} style={{ color: 'var(--warning-color)' }} /> Private Key (PEM)</label>
                  <textarea
                    className="form-textarea mono"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    style={{ height: '220px', fontSize: '0.82rem' }}
                  />
                </div>
             </div>

             <div style={{ maxWidth: '420px', margin: '1.5rem auto 0 auto' }}>
                <div className="form-group" style={{ textAlign: 'center', marginBottom: 0 }}>
                  <label className="form-label">PFX Archive Password</label>
                  <input 
                    type="password" 
                    className="form-input"
                    value={pfxPassword} 
                    onChange={e => setPfxPassword(e.target.value)} 
                    placeholder="Enter secure export password..."
                    style={{ textAlign: 'center' }} 
                  />
                </div>
             </div>

             <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button className="btn" onClick={handlePfxBuild} disabled={!certInput || !keyInput || !pfxPassword} style={{ height: '44px', padding: '0 2rem' }}>
                   <Download size={18} /> Download PFX Archive
                </button>
             </div>
          </div>
        )}

        {(error || message) && (
           <div className="glass-panel" style={{ 
              marginTop: '1.5rem', 
              textAlign: 'center',
              padding: '1rem 1.25rem',
              background: error ? 'var(--danger-bg)' : 'var(--success-bg)',
              borderColor: error ? 'var(--danger-border)' : 'var(--success-border)',
              color: error ? 'var(--danger-color)' : 'var(--success-color)',
              fontWeight: 500,
              fontSize: '0.9rem'
           }}>
              <span>{error || message}</span>
           </div>
        )}

      </div>
    </div>
  );
}
