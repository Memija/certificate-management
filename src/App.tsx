import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseEfiSignatureLists, parseRawX509, type EfiSignatureList, type ParsedCertificate } from './utils/efiParser';
import { Shield, ShieldCheck, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, FolderOpen, Sun, Moon, FileKey, Monitor, ShieldAlert, Link as LinkIcon, ExternalLink, Key, Zap, FileArchive, Globe, Activity, LayoutDashboard, Menu, X, Search } from 'lucide-react';
import { TrustStoreInspector } from './TrustStoreInspector';
import { CsrInspector } from './CsrInspector';
import { WinCertStoreInspector } from './WinCertStoreInspector';
import { CrlInspector } from './CrlInspector';
import { ChainValidator } from './ChainValidator';
import { KeyPairMatcher } from './KeyPairMatcher';
import { KeyGenerator } from './KeyGenerator';
import { FormatConverter } from './FormatConverter';
import { TlsScanner } from './TlsScanner';
import { OcspChecker } from './OcspChecker';
import { ExpiryDashboard } from './ExpiryDashboard';
import { CtLogSearch } from './CtLogSearch';
import './index.css';

type AppMode = 'secure-boot' | 'trust-store' | 'csr-inspector' | 'win-cert-store' | 'crl-inspector' | 'chain-validator' | 'key-matcher' | 'key-generator' | 'format-converter' | 'tls-scanner' | 'ocsp-checker' | 'expiry-dashboard' | 'ct-log-search';
type Theme = 'dark' | 'light';

const APP_VERSION = '1.4.0';

const CATEGORIES = [
  {
    id: "systemCheck",
    items: [
      { id: 'secure-boot', icon: Shield },
      { id: 'win-cert-store', icon: Monitor },
      { id: 'expiry-dashboard', icon: LayoutDashboard },
    ]
  },
  {
    id: "inspectionValidation",
    items: [
      { id: 'trust-store', icon: FolderOpen },
      { id: 'crl-inspector', icon: ShieldAlert },
      { id: 'chain-validator', icon: LinkIcon },
      { id: 'csr-inspector', icon: FileKey },
    ]
  },
  {
    id: "keyManagement",
    items: [
      { id: 'key-matcher', icon: Key },
      { id: 'key-generator', icon: Zap },
      { id: 'format-converter', icon: FileArchive },
    ]
  },
  {
    id: "networkStatus",
    items: [
      { id: 'tls-scanner', icon: Globe },
      { id: 'ocsp-checker', icon: Activity },
      { id: 'ct-log-search', icon: Search },
    ]
  }
];

function App() {
  const [mode, setMode] = useState<AppMode>(() => {
    return (localStorage.getItem('app-mode') as AppMode) || 'secure-boot';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || 'dark';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t: Theme) => t === 'dark' ? 'light' : 'dark');

  const switchMode = (m: AppMode) => {
    setMode(m);
    localStorage.setItem('app-mode', m);
    setSidebarOpen(false); // Close mobile sidebar on navigation
  };

  const [activeVar, setActiveVar] = useState<string>('db');
  const [variablesCache, setVariablesCache] = useState<Record<string, string>>({});
  
  const [signatureLists, setSignatureLists] = useState<EfiSignatureList[]>([]);
  const [rawCert, setRawCert] = useState<ParsedCertificate | null>(null);
  
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [needsElevation, setNeedsElevation] = useState<boolean>(false);
  const [elevating, setElevating] = useState<boolean>(false);

  useEffect(() => {
    loadAllVariables(false);
  }, []);

  const loadAllVariables = async (elevate: boolean) => {
    setError('');
    if (elevate) {
        setElevating(true);
    } else {
        setLoading(true);
    }

    try {
      const response = await fetch(`/api/secureboot?var=all${elevate ? '&elevate=true' : ''}`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch');
      }

      setVariablesCache(json.data);
      setNeedsElevation(false);
      
      // Parse the active variable ('db' initially)
      parseAndSet('db', json.data['db']);
    } catch (err: any) {
      if (!elevate) {
         setNeedsElevation(true);
      } else {
         setError(err.message);
      }
    } finally {
      setLoading(false);
      setElevating(false);
    }
  };

  const parseAndSet = (varName: string, base64Data: string | undefined) => {
    setActiveVar(varName);
    setSignatureLists([]);
    setRawCert(null);
    setError('');

    if (!base64Data) {
        return; // Empty
    }

    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;

      const lists = parseEfiSignatureLists(buffer);
      if (lists.length > 0) {
        setSignatureLists(lists);
        return;
      }

      const raw = parseRawX509(buffer);
      if (raw) {
        setRawCert(raw);
        return;
      }

      setError(`Could not parse ${varName} as an EFI Signature List or X.509 certificate.`);
    } catch (err: any) {
      setError(`Error parsing ${varName}: ${err.message}`);
    }
  };

  const handleTabClick = (varName: string) => {
    parseAndSet(varName, variablesCache[varName]);
  };

  const renderContent = () => {
    switch (mode) {
      case 'trust-store': return <TrustStoreInspector />;
      case 'csr-inspector': return <CsrInspector />;
      case 'win-cert-store': return <WinCertStoreInspector />;
      case 'crl-inspector': return <CrlInspector />;
      case 'chain-validator': return <ChainValidator />;
      case 'key-matcher': return <KeyPairMatcher />;
      case 'key-generator': return <KeyGenerator />;
      case 'format-converter': return <FormatConverter />;
      case 'tls-scanner': return <TlsScanner />;
      case 'ocsp-checker': return <OcspChecker />;
      case 'expiry-dashboard': return <ExpiryDashboard />;
      case 'ct-log-search': return <CtLogSearch />;
      case 'secure-boot':
      default:
        if (loading) {
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '4rem 2rem' }}>
              <RefreshCw size={56} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--text-accent)' }} />
              <h2>Loading Secure Boot Environment...</h2>
            </div>
          );
        }
        if (needsElevation) {
          return (
            <div style={{ minHeight: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '500px', padding: '3rem' }}>
                  {elevating ? (
                    <>
                       <Shield size={64} color="var(--text-accent)" style={{ animation: 'pulse 2s infinite', margin: '0 auto 1rem auto' }} />
                       <h2 style={{ color: 'var(--text-accent)' }}>Waiting for Administrator Approval...</h2>
                       <p style={{ color: 'var(--text-secondary)' }}>Please check your taskbar for a Windows UAC prompt. We only need to do this once to read the secure variables into memory.</p>
                    </>
                  ) : (
                    <>
                       <AlertTriangle size={64} color="var(--danger-color)" style={{ margin: '0 auto 1rem auto' }} />
                       <h2 style={{ color: 'var(--text-primary)' }}>Administrator Access Required</h2>
                       <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                          Reading Secure Boot NVRAM variables requires Administrator privileges.
                          Click below to unlock the system database. You will only be prompted once per session.
                       </p>
                       {error && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</p>}
                       <button className="btn" style={{ background: 'var(--success-color)', width: '100%', justifyContent: 'center' }} onClick={() => loadAllVariables(true)}>
                          <Shield size={18} />
                          Unlock Secure Boot Variables
                       </button>
                    </>
                  )}
               </div>
            </div>
          );
        }
        return (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
              {['db', 'dbx', 'KEK', 'PK'].map(v => (
                <button
                  key={v}
                  className={`btn ${activeVar === v ? '' : 'btn-secondary'}`}
                  onClick={() => handleTabClick(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {activeVar === 'db' && signatureLists.length > 0 && (
              <BootHealthWarnings lists={signatureLists} />
            )}

            {error ? (
              <div className="glass-panel" style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
                <h2 style={{ color: 'var(--danger-color)' }}>Error parsing variable</h2>
                <p>{error}</p>
              </div>
            ) : (!signatureLists.length && !rawCert) ? (
              <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <h2>Variable is Empty</h2>
                <p>No valid signatures or certificates found in {activeVar}.</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="signature-lists">
                  {rawCert && (
                     <div className="glass-card">
                        <div className="badge">Raw X.509 Certificate</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          {rawCert.isRoot && <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Root CA</span>}
                          {rawCert.isIntermediate && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Intermediate CA</span>}
                          {rawCert.isLeaf && <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }}>Leaf Certificate</span>}
                          {rawCert.isExpired && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Expired</span>}
                        </div>
                        <CertificateDetails cert={rawCert} />
                     </div>
                  )}

                  {signatureLists.map((list: EfiSignatureList, index: number) => (
                    <div key={index} className="glass-panel">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <ShieldCheck size={28} color="var(--success-color)" />
                        <div>
                          <h3 style={{ margin: 0 }}>Signature List #{index + 1}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Type: {list.signatureTypeName} <br/>
                            GUID: {list.signatureTypeGuid}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <div>List Size: {list.signatureListSize} bytes</div>
                        <div>Signatures: {list.signatures.length}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {list.signatures.map((sig: any, sigIndex: number) => (
                          <SignatureItem key={sigIndex} signature={sig} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="app-layout">
      <AppSidebar mode={mode} onModeChange={switchMode} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="app-main-wrapper">
        <AppHeader 
          mode={mode} 
          theme={theme} 
          onToggleTheme={toggleTheme} 
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <div className="main-content-area">
          {renderContent()}
        </div>
        <Footer />
      </div>
    </div>
  );
}

function SignatureItem({ signature }: { signature: any }) {
  const [expanded, setExpanded] = useState(false);
  const cert = signature.certificate;

  return (
    <div className="glass-card signature-item">
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={20} color={cert ? 'var(--text-accent)' : 'var(--text-secondary)'} />
          <span style={{ fontWeight: 500 }}>
            {cert ? 'X.509 Certificate' : 'Hash / Binary Signature'}
          </span>
          {cert && (
             <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
               {cert.isRoot && <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', margin: 0 }}>Root CA</span>}
               {cert.isIntermediate && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', margin: 0 }}>Intermediate CA</span>}
               {cert.isLeaf && <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af', margin: 0 }}>Leaf</span>}
               {cert.isExpired && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', margin: 0 }}>Expired</span>}
             </div>
          )}
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease' }}>
          <div className="details-grid">
            <div className="details-label">Owner GUID</div>
            <div className="details-value">{signature.signatureOwner}</div>
          </div>

          {cert && (
            <>
              <CertificateDetails cert={cert} />
            </>
          )}

          {!cert && signature.hashData && (
            <div style={{ marginTop: '1rem' }}>
              <div className="details-label" style={{ marginBottom: '0.5rem' }}>Raw Hex Data:</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {signature.hashData}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BootHealthWarnings({ lists }: { lists: EfiSignatureList[] }) {
  const warnings: string[] = [];
  const criticals: string[] = [];
  
  let hasValidCert = false;
  let hasMsWindowsCert = false;
  let hasMsUefiCert = false;
  
  let expiredMsWindows = false;
  let expiredMsUefi = false;

  let latestWindowsDate = new Date(0);
  let latestWindowsSubject = '';
  
  let latestUefiDate = new Date(0);
  let latestUefiSubject = '';

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  lists.forEach(list => {
    list.signatures.forEach(sig => {
      if (sig.certificate) {
        const cert = sig.certificate;
        const validTo = new Date(cert.validTo);
        const subject = cert.subject;

        if (validTo > now) {
          hasValidCert = true;
        }

        const isMsWindows = subject.includes('Windows Production PCA') || subject.includes('Windows UEFI CA 2023');
        const isMsUefi = subject.includes('UEFI CA') && subject.includes('Microsoft') && !subject.includes('Windows UEFI CA 2023');

        if (isMsWindows) {
            if (validTo > now) {
                hasMsWindowsCert = true;
                if (validTo > latestWindowsDate) {
                    latestWindowsDate = validTo;
                    latestWindowsSubject = subject;
                }
            } else {
                expiredMsWindows = true;
            }
        }
        
        if (isMsUefi) {
            if (validTo > now) {
                hasMsUefiCert = true;
                if (validTo > latestUefiDate) {
                    latestUefiDate = validTo;
                    latestUefiSubject = subject;
                }
            } else {
                expiredMsUefi = true;
            }
        }

        if (validTo >= now && validTo < thirtyDaysFromNow) {
           warnings.push(`Certificate is expiring soon (within 30 days): ${subject}`);
        }
      }
    });
  });

  if (!hasValidCert) {
    criticals.push("No valid, unexpired certificates found in the Signature Database (db). Your system may fail to boot any operating system.");
  }

  // Windows PCA Check
  if (expiredMsWindows && !hasMsWindowsCert) {
      criticals.push("The Windows Production PCA certificate is expired and no valid replacement was found.");
  } else if (!hasMsWindowsCert && !criticals.length) {
      warnings.push("Could not find a valid Windows Production PCA certificate. If you use Windows, your system might fail to boot if it relies solely on standard Secure Boot keys.");
  }

  // UEFI CA Check
  if (expiredMsUefi && !hasMsUefiCert) {
      criticals.push("The Microsoft/Windows UEFI CA certificate is expired and no valid replacement was found.");
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      
      <div className="glass-panel" style={{ marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <h3 style={{ color: 'var(--text-accent)', margin: '0 0 1rem 0' }}>Secure Boot System Assessment</h3>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
             <strong style={{ color: 'var(--text-primary)' }}>Why were the 2011 certificates replaced?</strong>
             <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>
               The original <em>Microsoft Corporation UEFI CA 2011</em> and <em>Windows Production PCA 2011</em> certificates expire in 2026. 
               To prevent millions of devices from failing to boot, Microsoft rolled out "2023" replacement certificates via Windows Updates and firmware updates. 
               The old certificates will safely remain expired, while the new ones take over.
             </p>
          </div>
          
          <div>
             <strong style={{ color: 'var(--text-primary)' }}>Impact of Windows Production PCA:</strong>
             <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>
               This certificate validates the standard Microsoft Windows bootloader. Without it, standard Windows OS installs will refuse to boot under Secure Boot.
             </p>
          </div>
          
          <div>
             <strong style={{ color: 'var(--text-primary)' }}>Impact of Microsoft UEFI CA:</strong>
             <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>
               This certificate validates third-party bootloaders (such as Linux distributions) and Option ROM firmware on PCIe devices (like Graphics Cards). 
               Without it, you cannot boot Linux, and your GPU might fail to initialize during a Secure Boot startup.
             </p>
          </div>

          <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
             <strong style={{ color: 'var(--text-primary)' }}>Is Secure Boot Functional?</strong>
             <ul style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', paddingLeft: '1.5rem', lineHeight: '1.6' }}>
               <li>
                 <strong>Windows Boot:</strong> {hasMsWindowsCert ? <span style={{ color: 'var(--success-color)' }}>VALID until {latestWindowsDate.toLocaleDateString()}</span> : <span style={{ color: 'var(--danger-color)' }}>INVALID</span>}
                 {hasMsWindowsCert && <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>Governed by: {latestWindowsSubject}</div>}
               </li>
               <li style={{ marginTop: '0.5rem' }}>
                 <strong>Third-Party OS & Hardware:</strong> {hasMsUefiCert ? <span style={{ color: 'var(--success-color)' }}>VALID until {latestUefiDate.toLocaleDateString()}</span> : <span style={{ color: 'var(--danger-color)' }}>INVALID</span>}
                 {hasMsUefiCert && <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>Governed by: {latestUefiSubject}</div>}
               </li>
             </ul>
          </div>
        </div>
      </div>

      {criticals.map((crit, idx) => (
        <div key={`crit-${idx}`} className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertTriangle size={32} color="#ef4444" />
            <div>
              <h3 style={{ color: '#ef4444', margin: 0 }}>CRITICAL WARNING</h3>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{crit}</p>
            </div>
          </div>
        </div>
      ))}
      
      {warnings.map((warn, idx) => (
        <div key={`warn-${idx}`} className="glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', marginBottom: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Shield size={32} color="#f59e0b" />
            <div>
              <h3 style={{ color: '#f59e0b', margin: 0 }}>Warning</h3>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{warn}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CertificateDetails({ cert }: { cert: ParsedCertificate }) {
  return (
    <>
      <div className="details-grid" style={{ marginTop: '0.5rem' }}>
        <div className="details-label">Subject</div>
        <div className="details-value">{cert.subject}</div>
        
        <div className="details-label">Issuer</div>
        <div className="details-value">{cert.issuer}</div>
        
        <div className="details-label">Valid From</div>
        <div className="details-value">{new Date(cert.validFrom).toLocaleString()}</div>
        
        <div className="details-label">Valid To</div>
        <div className="details-value">{new Date(cert.validTo).toLocaleString()}</div>
        
        <div className="details-label">Serial Number</div>
        <div className="details-value">{cert.serialNumber}</div>
        
        <div className="details-label">Version</div>
        <div className="details-value">v{cert.version + 1}</div>

        <div className="details-label">Signature Algorithm</div>
        <div className="details-value">{cert.signatureAlgorithm} ({cert.signatureOid})</div>

        <div className="details-label">Public Key</div>
        <div className="details-value">{cert.publicKeyAlgorithm} {cert.publicKeySize ? `(${cert.publicKeySize} bits)` : ''}</div>
        
        <div className="details-label">SHA-1 Fingerprint</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.9em' }}>{cert.fingerprintSha1}</div>
        
        <div className="details-label">SHA-256 Fingerprint</div>
        <div className="details-value" style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.9em' }}>{cert.fingerprintSha256}</div>
        
        <div className="details-label">CT Log Lookup</div>
        <div className="details-value">
          <a
            href={`https://crt.sh/?q=${cert.fingerprintSha256.replace(/:/g, '').toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Search on crt.sh <ExternalLink size={13} />
          </a>
        </div>

        <div className="details-label">Purposes</div>
        <div className="details-value">{cert.purposes.join(', ')}</div>
      </div>
      
      {cert.extensions && cert.extensions.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>View Extensions ({cert.extensions.length})</summary>
          <div className="details-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '4px' }}>
             {cert.extensions.map((ext: any, idx: number) => (
                <div key={idx} style={{ display: 'contents' }}>
                   <div className="details-label">{ext.name}</div>
                   <div className="details-value">
                     <div>OID: {ext.oid} {ext.critical && <span style={{ color: 'var(--danger-color)', fontSize: '0.8em' }}>(Critical)</span>}</div>
                     {ext.value && <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85em', marginTop: '0.25rem' }}>{ext.value}</div>}
                   </div>
                </div>
             ))}
          </div>
        </details>
      )}

      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-accent)' }}>View PEM</summary>
        <pre>{cert.pem}</pre>
      </details>
    </>
  );
}

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
function AppSidebar({ mode, onModeChange, isOpen, onClose }: { mode: AppMode, onModeChange: (m: AppMode) => void, isOpen: boolean, onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className={`app-sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="app-sidebar-header">
          <img src="/logo.png" alt="Logo" className="app-sidebar-logo" />
          <div className="app-sidebar-title">
            <h2>Certificate</h2>
            <span>Manager</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} title={t('app.aria.closeSidebar')}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="app-sidebar-nav">
          {CATEGORIES.map((category, idx) => (
            <div key={idx} className="sidebar-category">
              <h4 className="sidebar-category-title">{t(`app.categories.${category.id}`)}</h4>
              <ul className="sidebar-nav-list">
                {category.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button 
                        className={`sidebar-nav-btn ${mode === item.id ? 'active' : ''}`} 
                        onClick={() => onModeChange(item.id as AppMode)}
                      >
                        <Icon size={16} />
                        <span>{t(`app.nav.${item.id}`)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        
        <div className="app-sidebar-footer">
          v{APP_VERSION}
        </div>
      </aside>
    </>
  );
}

// ─── Shared App Header ───────────────────────────────────────────────────────
function AppHeader({
  mode, theme, onToggleTheme, onOpenSidebar
}: {
  mode: AppMode;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
}) {
  const { t, i18n } = useTranslation();
  let title = t('app.title');
  CATEGORIES.forEach(cat => {
    const item = cat.items.find(i => i.id === mode);
    if (item) title = t(`app.nav.${item.id}`);
  });

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-left">
          <button className="sidebar-toggle-btn" onClick={onOpenSidebar} title={t('app.aria.openSidebar')}>
            <Menu size={24} />
          </button>
          <h1 className="app-header-title">{title}</h1>
        </div>

        <div className="app-header-right">
          <select 
            className="btn btn-secondary" 
            style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem', fontSize: '0.85rem' }}
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            title={t('app.language.switch')}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="bs">Bosanski</option>
            <option value="sr-Cyrl">Српски (Ћирилица)</option>
            <option value="id">Bahasa Indonesia</option>
            <option value="pl">Polski</option>
          </select>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={t('app.aria.toggleTheme')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-left">
          <img src="/logo.png" alt="" style={{ width: 18, height: 18, opacity: 0.6, borderRadius: 4 }} />
          <span>{t('app.title')}</span>
        </div>
        <div className="app-footer-right">
          <span>100% client-side core · Extensible Backend Plugins</span>
        </div>
      </div>
    </footer>
  );
}

export default App;

