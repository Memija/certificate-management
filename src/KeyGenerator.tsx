import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Copy, FileKey, Shield, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import * as forge from 'node-forge';
import { useToast } from './ToastContext';
import { validateCsr, PLACEHOLDER_CN_LIST, isOnlyPlaceholderSubject, isPlaceholderValue } from './utils/csrValidation';

export function KeyGenerator() {
  const { t } = useTranslation();
  const [cn, setCn] = useState('');
  const [org, setOrg] = useState('');
  const [ou, setOu] = useState('');
  const [locality, setLocality] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [keySize, setKeySize] = useState(2048);

  const [outputType, setOutputType] = useState<'csr' | 'self-signed'>('csr');
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const isCnPlaceholder = (val: string) => {
    const clean = val.trim().toLowerCase();
    return clean.length > 0 && PLACEHOLDER_CN_LIST.includes(clean);
  };

  const isOnlyPlaceholderSetup = () => {
    return isOnlyPlaceholderSubject({ cn, org, ou, locality, state });
  };

  const generate = () => {
    setError('');

    const valResult = validateCsr(
      { cn, country, state, locality, org, ou },
      { requireCn: true, checkPlaceholders: true, t }
    );

    if (!valResult.isValid) {
      const msg = valResult.errors.country
        ? valResult.errors.country
        : !cn.trim()
        ? t('app.keyGenerator.cnRequired', 'Common Name (CN) is required.')
        : valResult.errors.general || Object.values(valResult.errors)[0] || t('common.error', 'Invalid inputs.');
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setGenerating(true);
    
    // Use setTimeout so the UI can update before blocking key generation
    setTimeout(() => {
      try {
        const keys = forge.pki.rsa.generateKeyPair(keySize);
        const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
        
        const trimmedCn = cn.trim();
        const trimmedCountry = country.trim();
        const trimmedState = state.trim();
        const trimmedLocality = locality.trim();
        const trimmedOrg = org.trim();
        const trimmedOu = ou.trim();

        const attrs: any[] = [];
        if (trimmedCn) attrs.push({ name: 'commonName', value: trimmedCn });
        if (trimmedCountry) attrs.push({ name: 'countryName', value: trimmedCountry });
        if (trimmedState) attrs.push({ name: 'stateOrProvinceName', value: trimmedState });
        if (trimmedLocality) attrs.push({ name: 'localityName', value: trimmedLocality });
        if (trimmedOrg) attrs.push({ name: 'organizationName', value: trimmedOrg });
        if (trimmedOu) attrs.push({ name: 'organizationalUnitName', value: trimmedOu });

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
            { name: 'subjectAltName', altNames: [{ type: 2, value: trimmedCn }] },
            { name: 'subjectKeyIdentifier' }
          ]);
          cert.sign(keys.privateKey, forge.md.sha256.create());
          outputStr = forge.pki.certificateToPem(cert);
        }
        
        setGeneratedKey(privateKeyPem);
        setGeneratedOutput(outputStr);
        showToast(
          outputType === 'csr'
            ? t('app.keyGenerator.successToastCsr', 'Generated RSA Key Pair & CSR')
            : t('app.keyGenerator.successToastCert', 'Generated RSA Key Pair & Certificate'),
          'success'
        );
      } catch (err: any) {
        const failMsg = t('app.keyGenerator.failedToGenerate', { error: err.message, defaultValue: `Failed to generate: ${err.message}` });
        const toastFailMsg = t('app.keyGenerator.generationFailedToast', { error: err.message, defaultValue: `Generation failed: ${err.message}` });
        setError(failMsg);
        showToast(toastFailMsg, 'error');
      } finally {
        setGenerating(false);
      }
    }, 100);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(t('app.keyGenerator.copiedToast', { label, defaultValue: `Copied ${label} to clipboard` }), 'success');
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('app.keyGenerator.downloadedToast', { filename, defaultValue: `Downloaded ${filename}` }), 'success');
  };

  const safeName = cn.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'certificate';
  const hasCnPlaceholder = isCnPlaceholder(cn);
  const hasLocPlaceholder = isPlaceholderValue('locality', locality);
  const hasOrgPlaceholder = isPlaceholderValue('org', org);
  const hasOuPlaceholder = isPlaceholderValue('ou', ou);
  const hasStatePlaceholder = isPlaceholderValue('state', state);
  const isInvalidSetup = isOnlyPlaceholderSetup();
  const isCountryInvalid = country.trim().length > 0 && !/^[A-Za-z]{2}$/.test(country.trim());

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.keyGenerator.title', 'Key Pair & CSR / Self-Signed Generator')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {t('app.keyGenerator.subtitle', 'Generate a new RSA Key Pair and a Certificate Signing Request (CSR) or Self-Signed Certificate entirely in your browser using pure cryptography.')}
          </p>
        </div>

        <div className="key-gen-main-grid">
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Zap size={18} style={{ color: 'var(--accent-color)' }} /> {t('app.keyGenerator.subjectDetailsTitle', 'Subject Details & Parameters')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {t('app.keyGenerator.commonName', 'Common Name (CN)')} <span style={{ color: 'var(--accent-color)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={cn}
                  onChange={e => {
                    setCn(e.target.value);
                    if (error) setError('');
                  }}
                  className="form-input"
                  placeholder={t('app.keyGenerator.commonNamePlaceholder', 'e.g. example.com')}
                />
                {hasCnPlaceholder && (
                  <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{t('app.keyGenerator.placeholderSetup', 'Cannot create a setup using only placeholder values. Please provide real subject details.')}</span>
                  </div>
                )}
              </div>

              <div className="key-gen-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.organization', 'Organization (O)')}</label>
                  <input
                    type="text"
                    value={org}
                    onChange={e => {
                      setOrg(e.target.value);
                      if (error) setError('');
                    }}
                    className="form-input"
                    placeholder={t('app.keyGenerator.organizationPlaceholder', 'Organization')}
                  />
                  {hasOrgPlaceholder && (
                    <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{t('app.keyGenerator.placeholderOrg', 'Generic placeholder detected for Organization. Real organization name required.')}</span>
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.organizationalUnit', 'Unit (OU)')}</label>
                  <input
                    type="text"
                    value={ou}
                    onChange={e => {
                      setOu(e.target.value);
                      if (error) setError('');
                    }}
                    className="form-input"
                    placeholder={t('app.keyGenerator.organizationalUnitPlaceholder', 'IT Dept')}
                  />
                  {hasOuPlaceholder && (
                    <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{t('app.keyGenerator.placeholderOu', 'Generic placeholder detected for Organizational Unit. Real unit name required.')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="key-gen-row-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.locality', 'City (L)')}</label>
                  <input
                    type="text"
                    value={locality}
                    onChange={e => {
                      setLocality(e.target.value);
                      if (error) setError('');
                    }}
                    className="form-input"
                    placeholder={t('app.keyGenerator.localityPlaceholder', 'City')}
                  />
                  {hasLocPlaceholder && (
                    <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{t('app.keyGenerator.placeholderLoc', 'Generic placeholder detected for City ("{{value}}"). Real locality required.', { value: locality.trim() })}</span>
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.state', 'State (ST)')}</label>
                  <input
                    type="text"
                    value={state}
                    onChange={e => {
                      setState(e.target.value);
                      if (error) setError('');
                    }}
                    className="form-input"
                    placeholder={t('app.keyGenerator.statePlaceholder', 'State')}
                  />
                  {hasStatePlaceholder && (
                    <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{t('app.keyGenerator.placeholderState', 'Generic placeholder detected for State. Real state name required.')}</span>
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.country', 'Country (C)')}</label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => {
                      setCountry(e.target.value.toUpperCase());
                      if (error) setError('');
                    }}
                    maxLength={2}
                    className="form-input"
                    placeholder={t('app.keyGenerator.countryPlaceholder', 'US')}
                  />
                  {country.trim().length > 0 && !/^[A-Za-z]{2}$/.test(country.trim()) && (
                    <div style={{ marginTop: '0.4rem', color: 'var(--danger-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{t('app.keyGenerator.countryInvalid', 'Country Code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, GB).')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="key-gen-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.keySize', 'Key Size')}</label>
                  <select value={keySize} onChange={e => setKeySize(Number(e.target.value))} className="form-select">
                    <option value={2048}>{t('app.keyGenerator.keySize2048', '2048-bit (Standard)')}</option>
                    <option value={4096}>{t('app.keyGenerator.keySize4096', '4096-bit (High Security)')}</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('app.keyGenerator.outputType', 'Output Type')}</label>
                  <select value={outputType} onChange={e => setOutputType(e.target.value as any)} className="form-select">
                    <option value="csr">{t('app.keyGenerator.outputCsr', 'CSR (Signing Request)')}</option>
                    <option value="self-signed">{t('app.keyGenerator.outputSelfSigned', 'Self-Signed Certificate')}</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              className="btn"
              onClick={generate}
              disabled={
                generating ||
                isInvalidSetup ||
                hasCnPlaceholder ||
                hasLocPlaceholder ||
                hasOrgPlaceholder ||
                hasOuPlaceholder ||
                hasStatePlaceholder ||
                isCountryInvalid
              }
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '1.5rem',
                height: '44px',
                opacity: isInvalidSetup && !generating ? 0.6 : 1,
                cursor: isInvalidSetup && !generating ? 'not-allowed' : 'pointer'
              }}
              title={
                isInvalidSetup
                  ? (!cn.trim()
                      ? t('app.keyGenerator.cnRequired', 'Common Name (CN) is required.')
                      : t('app.keyGenerator.placeholderSetup', 'Cannot create a setup using only placeholder values. Please provide real subject details.'))
                  : undefined
              }
            >
              {generating ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
              <span>
                {generating
                  ? (outputType === 'csr'
                      ? t('app.keyGenerator.generatingCsr', 'Generating Keys & CSR...')
                      : t('app.keyGenerator.generatingCert', 'Generating Keys & Cert...'))
                  : (outputType === 'csr'
                      ? t('app.keyGenerator.generateCsr', 'Generate Key Pair & CSR')
                      : t('app.keyGenerator.generateCert', 'Generate Key Pair & Cert'))}
              </span>
            </button>
            
            {error && (
               <div style={{ marginTop: '1rem', color: 'var(--danger-color)', fontSize: '0.88rem' }}>{error}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                 <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                   <FileKey size={16} style={{ color: 'var(--accent-color)' }} /> {t('app.keyGenerator.generatedPrivateKey', 'Generated Private Key')}
                 </h3>
                 {generatedKey && (
                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                     <button className="btn btn-download-pem btn-sm" onClick={() => downloadFile(generatedKey, `${safeName}_private.key`, 'application/x-pem-file')}>
                       <Download size={12} /> {t('app.keyGenerator.downloadKey', '.key')}
                     </button>
                     <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(generatedKey, t('app.keyGenerator.privateKeyLabel', 'Private Key'))}>
                       <Copy size={12} /> {t('app.keyGenerator.copy', 'Copy')}
                     </button>
                   </div>
                 )}
               </div>
               <textarea
                 value={generatedKey}
                 readOnly
                 className="form-textarea mono"
                 placeholder={t('app.keyGenerator.privateKeyPlaceholder', 'Generated RSA private key will appear here...')}
                 style={{ height: '140px', fontSize: '0.82rem' }}
               />
            </div>
            
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                 <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                   <Shield size={16} style={{ color: 'var(--success-color)' }} /> {outputType === 'csr' ? t('app.keyGenerator.generatedCsr', 'Generated CSR') : t('app.keyGenerator.generatedCert', 'Generated Certificate')}
                 </h3>
                 {generatedOutput && (
                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                     <button className="btn btn-download-pem btn-sm" onClick={() => downloadFile(generatedOutput, `${safeName}.${outputType === 'csr' ? 'csr' : 'crt'}`, 'application/x-pem-file')}>
                       <Download size={12} /> {outputType === 'csr' ? t('app.keyGenerator.downloadCsr', '.csr') : t('app.keyGenerator.downloadCert', '.crt')}
                     </button>
                     <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(generatedOutput, outputType === 'csr' ? t('app.keyGenerator.csrLabel', 'CSR') : t('app.keyGenerator.certLabel', 'Certificate'))}>
                       <Copy size={12} /> {t('app.keyGenerator.copy', 'Copy')}
                     </button>
                   </div>
                 )}
               </div>
               <textarea
                 value={generatedOutput}
                 readOnly
                 className="form-textarea mono"
                 placeholder={outputType === 'csr' ? t('app.keyGenerator.csrPlaceholder', 'Generated CSR will appear here...') : t('app.keyGenerator.certPlaceholder', 'Generated Self-Signed Certificate will appear here...')}
                 style={{ height: '140px', fontSize: '0.82rem' }}
               />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
