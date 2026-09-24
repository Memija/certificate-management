import React, { useState, useEffect } from 'react';
import { X, Key, Zap, CheckCircle, AlertTriangle, RefreshCw, Upload, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as forge from 'node-forge';
import type { ParsedCSR } from './utils/csrParser';
import { parseCSRFromText } from './utils/csrParser';
import { validateCsr, validatePrivateKeyPem } from './utils/csrValidation';
import type { CsrFieldErrors } from './utils/csrValidation';

export interface CsrEditorModalProps {
  isOpen: boolean;
  csr: ParsedCSR;
  initialName: string;
  onClose: () => void;
  onSave: (newCsr: ParsedCSR, fileName: string, generatedPrivateKeyPem?: string) => void;
}

export function CsrEditorModal({
  isOpen,
  csr,
  initialName,
  onClose,
  onSave,
}: CsrEditorModalProps) {
  const { t } = useTranslation();

  // ── Subject state ─────────────────────────────────────────────────────────
  const [cn, setCn] = useState('');
  const [org, setOrg] = useState('');
  const [ou, setOu] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [email, setEmail] = useState('');

  // ── SANs state ────────────────────────────────────────────────────────────
  const [sans, setSans] = useState('');

  // ── Key Usages state ──────────────────────────────────────────────────────
  const [keyUsages, setKeyUsages] = useState({
    digitalSignature: true,
    nonRepudiation: false,
    keyEncipherment: true,
    dataEncipherment: false,
    keyAgreement: false,
    keyCertSign: false,
    cRLSign: false,
  });

  // ── Extended Key Usages state ─────────────────────────────────────────────
  const [extKeyUsages, setExtKeyUsages] = useState({
    serverAuth: true,
    clientAuth: false,
    codeSigning: false,
    emailProtection: false,
    timeStamping: false,
  });

  // ── Signing key state ─────────────────────────────────────────────────────
  const [keyMode, setKeyMode] = useState<'generate' | 'existing'>('generate');
  const [keySize, setKeySize] = useState<number>(2048);
  const [existingKeyPem, setExistingKeyPem] = useState('');
  const [existingKeyValid, setExistingKeyValid] = useState<boolean | null>(null);
  const [existingKeyBits, setExistingKeyBits] = useState<number | undefined>(undefined);
  const [keyErrorDetail, setKeyErrorDetail] = useState('');

  // ── Validation and submission state ───────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<CsrFieldErrors>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Populate from input CSR whenever modal opens or CSR changes
  useEffect(() => {
    if (!isOpen) return;

    // Subject fields
    const getField = (keys: string[]) => {
      const match = csr.subjectFields.find(f => keys.includes(f.shortName) || keys.includes(f.name));
      return match ? match.value : '';
    };

    setCn(getField(['CN', 'commonName']));
    setOrg(getField(['O', 'organizationName']));
    setOu(getField(['OU', 'organizationalUnitName']));
    setCountry(getField(['C', 'countryName']));
    setState(getField(['ST', 'stateOrProvinceName']));
    setLocality(getField(['L', 'localityName']));
    setEmail(getField(['E', 'emailAddress']));

    // Extract SANs
    const sanExt = csr.requestedExtensions.find(e =>
      e.name?.toLowerCase().includes('subjectaltname') || e.oid === '2.5.29.17'
    );
    if (sanExt && sanExt.value) {
      // Clean up prefixes like DNS:, IP:, etc.
      const cleaned = sanExt.value
        .split(',')
        .map(s => s.trim().replace(/^(DNS|IP|Email|URI|Type\s*\d+):\s*/i, ''))
        .filter(Boolean)
        .join(', ');
      setSans(cleaned);
    } else {
      setSans(getField(['CN', 'commonName']));
    }

    // Extract Key Usage
    const kuExt = csr.requestedExtensions.find(e =>
      e.name?.toLowerCase().includes('keyusage') || e.oid === '2.5.29.15'
    );
    if (kuExt && kuExt.value) {
      const v = kuExt.value.toLowerCase();
      setKeyUsages({
        digitalSignature: v.includes('digital signature'),
        nonRepudiation: v.includes('non-repudiation') || v.includes('nonrepudiation'),
        keyEncipherment: v.includes('key encipherment'),
        dataEncipherment: v.includes('data encipherment'),
        keyAgreement: v.includes('key agreement'),
        keyCertSign: v.includes('certificate sign') || v.includes('key cert sign'),
        cRLSign: v.includes('crl sign'),
      });
    } else {
      setKeyUsages({
        digitalSignature: true,
        nonRepudiation: false,
        keyEncipherment: true,
        dataEncipherment: false,
        keyAgreement: false,
        keyCertSign: false,
        cRLSign: false,
      });
    }

    // Extract Ext Key Usage
    const ekuExt = csr.requestedExtensions.find(e =>
      e.name?.toLowerCase().includes('extkeyusage') || e.oid === '2.5.29.37'
    );
    if (ekuExt && ekuExt.value) {
      const v = ekuExt.value.toLowerCase();
      setExtKeyUsages({
        serverAuth: v.includes('server auth'),
        clientAuth: v.includes('client auth'),
        codeSigning: v.includes('code signing'),
        emailProtection: v.includes('email protection'),
        timeStamping: v.includes('time stamping'),
      });
    } else {
      setExtKeyUsages({
        serverAuth: true,
        clientAuth: false,
        codeSigning: false,
        emailProtection: false,
        timeStamping: false,
      });
    }

    // Key size
    if (csr.publicKeySize && [2048, 3072, 4096].includes(csr.publicKeySize)) {
      setKeySize(csr.publicKeySize);
    } else {
      setKeySize(2048);
    }

    setExistingKeyPem('');
    setExistingKeyValid(null);
    setExistingKeyBits(undefined);
    setKeyErrorDetail('');
    setKeyMode('generate');
    setFieldErrors({});
    setError('');
  }, [isOpen, csr]);

  // Validate existing key as user types/pastes
  useEffect(() => {
    if (!existingKeyPem.trim()) {
      setExistingKeyValid(null);
      setExistingKeyBits(undefined);
      setKeyErrorDetail('');
      return;
    }
    const res = validatePrivateKeyPem(existingKeyPem, t);
    if (res.valid) {
      setExistingKeyValid(true);
      setExistingKeyBits(res.bitLength);
      setKeyErrorDetail('');
      setFieldErrors(prev => ({ ...prev, existingKey: undefined }));
    } else {
      setExistingKeyValid(false);
      setExistingKeyBits(res.bitLength);
      setKeyErrorDetail(res.error || t('app.csr.editor.keyInvalid', 'Invalid private key format'));
    }
  }, [existingKeyPem, t]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setExistingKeyPem(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGenerateAndSign = () => {
    // Validate inputs
    const valResult = validateCsr(
      { cn, org, ou, country, state, locality, email },
      {
        requireCn: false, // In standard PKCS#10, either CN or at least one SAN is required
        sans,
        serverAuthEnabled: extKeyUsages.serverAuth,
        existingKeyPem: keyMode === 'existing' ? existingKeyPem : undefined,
        checkPlaceholders: true,
        t,
      }
    );

    if (!valResult.isValid) {
      setFieldErrors(valResult.errors);
      const firstError = Object.values(valResult.errors)[0] || t('app.csr.editor.cnOrSanRequired', 'Common Name (CN) or at least one Subject Alternative Name (SAN) is required.');
      setError(firstError);
      return;
    }

    setFieldErrors({});
    setGenerating(true);
    setError('');

    // Allow UI to render loading spinner
    setTimeout(() => {
      try {
        let privKey: forge.pki.rsa.PrivateKey;
        let pubKey: forge.pki.rsa.PublicKey;
        let generatedPrivKeyPem: string | undefined = undefined;

        if (keyMode === 'generate') {
          const keypair = forge.pki.rsa.generateKeyPair(keySize);
          privKey = keypair.privateKey;
          pubKey = keypair.publicKey;
          generatedPrivKeyPem = forge.pki.privateKeyToPem(privKey);
        } else {
          if (!existingKeyPem.trim()) {
            throw new Error(t('app.csr.editor.keyRequired', 'Please provide or generate a private key to sign the CSR.'));
          }
          privKey = forge.pki.privateKeyFromPem(existingKeyPem.trim());
          pubKey = forge.pki.setRsaPublicKey(privKey.n, privKey.e);
        }

        const req = forge.pki.createCertificationRequest();
        req.publicKey = pubKey;

        // Attributes (Subject)
        const attrs: any[] = [];
        if (cn.trim()) attrs.push({ name: 'commonName', value: cn.trim() });
        if (country.trim()) attrs.push({ name: 'countryName', value: country.trim() });
        if (state.trim()) attrs.push({ name: 'stateOrProvinceName', value: state.trim() });
        if (locality.trim()) attrs.push({ name: 'localityName', value: locality.trim() });
        if (org.trim()) attrs.push({ name: 'organizationName', value: org.trim() });
        if (ou.trim()) attrs.push({ name: 'organizationalUnitName', value: ou.trim() });
        if (email.trim()) attrs.push({ name: 'emailAddress', value: email.trim() });
        req.setSubject(attrs);

        // Extensions (SANs, Key Usage, Ext Key Usage)
        const extensions: any[] = [];

        // Parse SANs
        const sanItems = sans
          .split(/[\n,]+/)
          .map(s => s.trim())
          .filter(Boolean);

        if (sanItems.length > 0) {
          const altNames = sanItems.map(item => {
            if (/^(\d{1,3}\.){3}\d{1,3}$/.test(item) || item.includes(':')) {
              return { type: 7, ip: item };
            }
            if (item.includes('@') && !item.includes('/')) {
              return { type: 1, value: item };
            }
            if (item.startsWith('http://') || item.startsWith('https://')) {
              return { type: 6, value: item };
            }
            return { type: 2, value: item };
          });
          extensions.push({
            name: 'subjectAltName',
            altNames,
          });
        }

        // Key Usage
        const kuObj: any = { name: 'keyUsage' };
        let kuActive = false;
        if (keyUsages.digitalSignature) { kuObj.digitalSignature = true; kuActive = true; }
        if (keyUsages.nonRepudiation) { kuObj.nonRepudiation = true; kuActive = true; }
        if (keyUsages.keyEncipherment) { kuObj.keyEncipherment = true; kuActive = true; }
        if (keyUsages.dataEncipherment) { kuObj.dataEncipherment = true; kuActive = true; }
        if (keyUsages.keyAgreement) { kuObj.keyAgreement = true; kuActive = true; }
        if (keyUsages.keyCertSign) { kuObj.keyCertSign = true; kuActive = true; }
        if (keyUsages.cRLSign) { kuObj.cRLSign = true; kuActive = true; }
        if (kuActive) extensions.push(kuObj);

        // Extended Key Usage
        const ekuObj: any = { name: 'extKeyUsage' };
        let ekuActive = false;
        if (extKeyUsages.serverAuth) { ekuObj.serverAuth = true; ekuActive = true; }
        if (extKeyUsages.clientAuth) { ekuObj.clientAuth = true; ekuActive = true; }
        if (extKeyUsages.codeSigning) { ekuObj.codeSigning = true; ekuActive = true; }
        if (extKeyUsages.emailProtection) { ekuObj.emailProtection = true; ekuActive = true; }
        if (extKeyUsages.timeStamping) { ekuObj.timeStamping = true; ekuActive = true; }
        if (ekuActive) extensions.push(ekuObj);

        if (extensions.length > 0) {
          req.setAttributes([
            {
              name: 'extensionRequest',
              extensions,
            },
          ]);
        }

        // Cryptographically sign with SHA-256
        req.sign(privKey, forge.md.sha256.create());

        const pem = forge.pki.certificationRequestToPem(req);
        const newParsedCsr = parseCSRFromText(pem);

        const baseName = initialName.replace(/\.[^/.]+$/, '');
        const safeCn = (cn.trim() || baseName || 'edited_csr').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeCn}.csr`;

        onSave(newParsedCsr, fileName, generatedPrivKeyPem);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Error creating CSR');
      } finally {
        setGenerating(false);
      }
    }, 80);
  };

  if (!isOpen) return null;

  return (
    <div className="chain-modal-backdrop" onClick={onClose}>
      <div
        className="chain-modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border-subtle)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="metric-icon-wrap" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--cat-inspection)' }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {t('app.csr.editor.modalTitle', 'Edit & Re-sign CSR')}
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                {t('app.csr.editor.modalSubtitle', 'Modify subject attributes, SANs, or key usages, then re-sign to generate a valid CSR.')}
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={onClose}
            title={t('common.cancel', 'Cancel')}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            className="glass-card"
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--danger-border)',
              color: 'var(--danger-color)',
              marginBottom: '1.25rem',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section 1: Subject Information */}
          <div className="glass-card" style={{ padding: '1.15rem' }}>
            <h4 style={{ margin: '0 0 0.9rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
              {t('app.csr.editor.subjectSection', 'Subject Information')}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.commonName', 'Common Name (CN)')} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={cn}
                  maxLength={64}
                  style={{ borderColor: fieldErrors.cn ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setCn(e.target.value);
                    if (fieldErrors.cn) setFieldErrors(prev => ({ ...prev, cn: undefined }));
                    if (error) setError('');
                  }}
                  placeholder={t('app.csr.editor.commonNamePlaceholder', 'e.g. example.com')}
                />
                {fieldErrors.cn && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.cn}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.organization', 'Organization (O)')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={org}
                  maxLength={64}
                  style={{ borderColor: fieldErrors.org ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setOrg(e.target.value);
                    if (fieldErrors.org) setFieldErrors(prev => ({ ...prev, org: undefined }));
                  }}
                  placeholder={t('app.csr.editor.organizationPlaceholder', 'e.g. Acme Corp')}
                />
                {fieldErrors.org && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.org}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.organizationalUnit', 'Organizational Unit (OU)')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={ou}
                  maxLength={64}
                  style={{ borderColor: fieldErrors.ou ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setOu(e.target.value);
                    if (fieldErrors.ou) setFieldErrors(prev => ({ ...prev, ou: undefined }));
                  }}
                  placeholder={t('app.csr.editor.organizationalUnitPlaceholder', 'e.g. IT Security')}
                />
                {fieldErrors.ou && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.ou}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.country', 'Country Code (C)')}</label>
                <input
                  type="text"
                  className="form-input"
                  maxLength={2}
                  style={{ borderColor: fieldErrors.country ? 'var(--danger-color, #ef4444)' : undefined }}
                  value={country}
                  onChange={e => {
                    setCountry(e.target.value.toUpperCase());
                    if (fieldErrors.country) setFieldErrors(prev => ({ ...prev, country: undefined }));
                    if (error) setError('');
                  }}
                  placeholder={t('app.csr.editor.countryPlaceholder', 'e.g. US (2 letters)')}
                />
                {fieldErrors.country && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.country}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.state', 'State / Province (ST)')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={state}
                  maxLength={128}
                  style={{ borderColor: fieldErrors.state ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setState(e.target.value);
                    if (fieldErrors.state) setFieldErrors(prev => ({ ...prev, state: undefined }));
                  }}
                  placeholder={t('app.csr.editor.statePlaceholder', 'e.g. California')}
                />
                {fieldErrors.state && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.state}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.locality', 'City / Locality (L)')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={locality}
                  maxLength={128}
                  style={{ borderColor: fieldErrors.locality ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setLocality(e.target.value);
                    if (fieldErrors.locality) setFieldErrors(prev => ({ ...prev, locality: undefined }));
                  }}
                  placeholder={t('app.csr.editor.localityPlaceholder', 'e.g. San Francisco')}
                />
                {fieldErrors.locality && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.locality}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.email', 'Email Address')}</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  style={{ borderColor: fieldErrors.email ? 'var(--danger-color, #ef4444)' : undefined }}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                    if (error) setError('');
                  }}
                  placeholder={t('app.csr.editor.emailPlaceholder', 'e.g. admin@example.com')}
                />
                {fieldErrors.email && (
                  <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Subject Alternative Names (SANs) */}
          <div className="glass-card" style={{ padding: '1.15rem' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
              {t('app.csr.editor.sansSection', 'Subject Alternative Names (SANs)')}
            </h4>
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {t('app.csr.editor.sansHelp', 'Enter hostnames, domains, or IPs separated by commas or newlines.')}
            </p>
            <textarea
              className="form-textarea"
              rows={2}
              value={sans}
              style={{ fontSize: '0.85rem', borderColor: fieldErrors.sans ? 'var(--danger-color, #ef4444)' : undefined }}
              onChange={e => {
                setSans(e.target.value);
                if (fieldErrors.sans) setFieldErrors(prev => ({ ...prev, sans: undefined }));
                if (error) setError('');
              }}
              placeholder={t('app.csr.editor.sansPlaceholder', 'e.g. example.com, *.example.com, 192.168.1.1')}
            />
            {fieldErrors.sans && (
              <div style={{ marginTop: '0.35rem', color: 'var(--danger-color, #ef4444)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                <span>{fieldErrors.sans}</span>
              </div>
            )}
            {extKeyUsages.serverAuth && !sans.trim() && (
              <div
                style={{
                  marginTop: '0.6rem',
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  color: '#f59e0b',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{t('app.csr.editor.sanMissingWarning', 'Warning: TLS Server Authentication is selected, but no Subject Alternative Names (SANs) are defined. Modern browsers (RFC 2818) ignore Common Name and will reject this certificate.')}</span>
              </div>
            )}
          </div>

          {/* Section 3: Key Usages & EKU */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1.15rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
                {t('app.csr.editor.keyUsageSection', 'Key Usages')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.digitalSignature}
                    onChange={e => setKeyUsages(prev => ({ ...prev, digitalSignature: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.digitalSignature', 'Digital Signature')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.keyEncipherment}
                    onChange={e => setKeyUsages(prev => ({ ...prev, keyEncipherment: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.keyEncipherment', 'Key Encipherment')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.dataEncipherment}
                    onChange={e => setKeyUsages(prev => ({ ...prev, dataEncipherment: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.dataEncipherment', 'Data Encipherment')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.keyCertSign}
                    onChange={e => setKeyUsages(prev => ({ ...prev, keyCertSign: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.keyCertSign', 'Certificate Sign')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.cRLSign}
                    onChange={e => setKeyUsages(prev => ({ ...prev, cRLSign: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.cRLSign', 'CRL Sign')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keyUsages.nonRepudiation}
                    onChange={e => setKeyUsages(prev => ({ ...prev, nonRepudiation: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.nonRepudiation', 'Non-Repudiation')}</span>
                </label>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.15rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
                {t('app.csr.editor.extKeyUsageSection', 'Extended Key Usages (EKU)')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extKeyUsages.serverAuth}
                    onChange={e => setExtKeyUsages(prev => ({ ...prev, serverAuth: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.serverAuth', 'Server Authentication (TLS Web Server)')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extKeyUsages.clientAuth}
                    onChange={e => setExtKeyUsages(prev => ({ ...prev, clientAuth: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.clientAuth', 'Client Authentication (mTLS)')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extKeyUsages.codeSigning}
                    onChange={e => setExtKeyUsages(prev => ({ ...prev, codeSigning: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.codeSigning', 'Code Signing')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extKeyUsages.emailProtection}
                    onChange={e => setExtKeyUsages(prev => ({ ...prev, emailProtection: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.emailProtection', 'Email Protection (S/MIME)')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extKeyUsages.timeStamping}
                    onChange={e => setExtKeyUsages(prev => ({ ...prev, timeStamping: e.target.checked }))}
                  />
                  <span>{t('app.csr.editor.usages.timeStamping', 'Time Stamping')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Signing Key & Cryptography */}
          <div className="glass-card" style={{ padding: '1.15rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
              {t('app.csr.editor.signingKeySection', 'Signing Key & Cryptography')}
            </h4>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="radio"
                  name="keyMode"
                  checked={keyMode === 'generate'}
                  onChange={() => setKeyMode('generate')}
                />
                <span style={{ fontWeight: keyMode === 'generate' ? 600 : 400 }}>
                  {t('app.csr.editor.keyOptionGenerate', 'Generate New Key Pair')}
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="radio"
                  name="keyMode"
                  checked={keyMode === 'existing'}
                  onChange={() => setKeyMode('existing')}
                />
                <span style={{ fontWeight: keyMode === 'existing' ? 600 : 400 }}>
                  {t('app.csr.editor.keyOptionExisting', 'Provide Existing Private Key')}
                </span>
              </label>
            </div>

            {keyMode === 'generate' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('app.csr.editor.keySizeLabel', 'Key Size')}</label>
                  <select
                    className="form-select"
                    value={keySize}
                    onChange={e => setKeySize(Number(e.target.value))}
                  >
                    <option value={2048}>{t('app.csr.editor.keySize2048', '2048-bit (Standard)')}</option>
                    <option value={3072}>{t('app.csr.editor.keySize3072', '3072-bit (Enhanced)')}</option>
                    <option value={4096}>{t('app.csr.editor.keySize4096', '4096-bit (High Security)')}</option>
                  </select>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1.2rem' }}>
                  <Zap size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4, color: 'var(--accent-color)' }} />
                  {t('app.csr.editor.keyDownloadNotice', 'A new private key will be generated. You can download your .key file after signing.')}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>
                    {t('app.csr.editor.pasteKeyLabel', 'Paste Private Key (PEM format)')}
                  </label>
                  <label
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Upload size={12} />
                    {t('app.csr.editor.uploadKeyBtn', 'Upload .key / .pem')}
                    <input
                      type="file"
                      accept=".key,.pem,.txt"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={existingKeyPem}
                  onChange={e => setExistingKeyPem(e.target.value)}
                  placeholder={t('app.csr.editor.pasteKeyPlaceholder', '-----BEGIN RSA PRIVATE KEY-----\n...')}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                {existingKeyValid === true && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                    <CheckCircle size={14} />
                    <span>
                      {existingKeyBits
                        ? t('app.csr.editor.keyValidWithBits', { bits: existingKeyBits, defaultValue: `Valid ${existingKeyBits}-bit RSA private key loaded` })
                        : t('app.csr.editor.keyValid', 'Valid private key loaded')}
                    </span>
                  </div>
                )}
                {existingKeyValid === false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{keyErrorDetail || t('app.csr.editor.keyInvalid', 'Invalid private key format')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={generating}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerateAndSign}
            disabled={generating || (keyMode === 'existing' && existingKeyValid !== true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {generating ? (
              <>
                <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{t('app.csr.editor.generating', 'Generating Key & Signing…')}</span>
              </>
            ) : (
              <>
                <Key size={15} />
                <span>{t('app.csr.editor.saveBtn', 'Generate & Re-sign CSR')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
