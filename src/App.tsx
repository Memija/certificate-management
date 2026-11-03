import React, { useState, useEffect, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { parseEfiSignatureLists, parseRawX509, type EfiSignatureList, type ParsedCertificate } from './utils/efiParser';
import { Shield, ShieldCheck, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, FolderOpen, Sun, Moon, FileKey, Monitor, ShieldAlert, Link as LinkIcon, Key, Zap, FileArchive, Globe, Activity, LayoutDashboard, Menu, X, Search, BookOpen, Download, Copy, Check, Eye, EyeOff } from 'lucide-react';
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
import { EducationCenter } from './EducationCenter';
import { LearningTerm } from './LearningTerm';
import { ToastProvider, useToast } from './ToastContext';
import { splitPurposes, translatePurpose, formatExtensionValue } from './utils/purposeFormatter';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';
import { fetchLocalApiJson, getWebFallbackSecureBootVars, WebApiUnavailableError } from './utils/webFallbacks';
import {
  getInitialThemePreference,
  resolveEffectiveTheme,
  setUserThemePreference,
  setUserLanguagePreference,
  normalizeLanguageTag,
  detectSystemLanguage,
  isLanguageCustomized,
  isThemeCustomized,
  syncSystemSettingsFromApi,
  type SupportedLanguage
} from './utils/systemSettings';
import './index.css';

export type AppMode = 'secure-boot' | 'trust-store' | 'csr-inspector' | 'win-cert-store' | 'crl-inspector' | 'chain-validator' | 'key-matcher' | 'key-generator' | 'format-converter' | 'tls-scanner' | 'ocsp-checker' | 'expiry-dashboard' | 'ct-log-search' | 'education-center';
export type Theme = 'dark' | 'light' | 'system';
export type HeaderPhase = 'waiting' | 'shredding' | 'repairing' | 'repaired';

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
  },
  {
    id: "learning",
    items: [
      { id: 'education-center', icon: BookOpen }
    ]
  }
];

function App() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<AppMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get('mode') as AppMode;
    if (queryMode) return queryMode;
    return (localStorage.getItem('app-mode') as AppMode) || 'secure-boot';
  });

  const [theme, setTheme] = useState<Theme>(() => getInitialThemePreference());

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sequenced choreography: 1. Hide left title -> 2. Float content to top -> 3. Mend right-side glass controls capsule
  const [headerPhase, setHeaderPhase] = useState<HeaderPhase>('waiting');
  const headerPhaseRef = useRef<HeaderPhase>('waiting');
  const [showLeftTitle, setShowLeftTitle] = useState<boolean>(true);
  const [floatGen, setFloatGen] = useState<number>(1);
  const [isSectionFloating, setIsSectionFloating] = useState<boolean>(true);
  const [repairGen, setRepairGen] = useState<number>(0);
  const [transitionGen, setTransitionGen] = useState<number>(1);
  const mainContentAreaRef = useRef<HTMLDivElement>(null);
  const headerTimersRef = useRef<number[]>([]);

  const updateHeaderPhase = (next: HeaderPhase) => {
    headerPhaseRef.current = next;
    setHeaderPhase(next);
  };

  const clearHeaderTimers = () => {
    headerTimersRef.current.forEach(id => window.clearTimeout(id));
    headerTimersRef.current = [];
  };

  useEffect(() => {
    // Beat 1 (0..305ms): Left-side header title hides completely before content floats up (325ms+)
    const tHideLeft = window.setTimeout(() => {
      setShowLeftTitle(false);
    }, 305);
    // Beat 3 (350..1130ms): Right-side glass controls capsule mends into view as content floats into top
    const tRepair = window.setTimeout(() => {
      setRepairGen(g => g + 1);
      updateHeaderPhase('repairing');
    }, 350);
    const tDone = window.setTimeout(() => {
      updateHeaderPhase('repaired');
    }, 350 + 780);
    const tFloatClear = window.setTimeout(() => {
      setIsSectionFloating(false);
    }, 950);
    headerTimersRef.current.push(tHideLeft, tRepair, tDone, tFloatClear);
    return () => clearHeaderTimers();
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      const activeTheme = resolveEffectiveTheme(theme);
      document.documentElement.setAttribute('data-theme', activeTheme);
    };

    applyTheme();

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (window.__SYSTEM_SETTINGS__) {
          window.__SYSTEM_SETTINGS__.colorScheme = e.matches ? 'dark' : 'light';
        }
        applyTheme();
      };
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [theme]);

  useEffect(() => {
    syncSystemSettingsFromApi().then((sys) => {
      if (!sys) return;
      if (!isLanguageCustomized()) {
        const detected = detectSystemLanguage(sys);
        if (detected && normalizeLanguageTag(i18n.language) !== detected) {
          i18n.changeLanguage(detected);
        }
      }
      if (!isThemeCustomized()) {
        document.documentElement.setAttribute('data-theme', resolveEffectiveTheme('system', sys));
      }
    });
  }, [i18n]);

  const toggleTheme = () => setTheme((prev: Theme) => {
    let next: Theme;
    if (prev === 'dark') next = 'light';
    else if (prev === 'light') next = 'system';
    else next = 'dark';
    setUserThemePreference(next);
    return next;
  });

  const switchMode = (m: AppMode) => {
    clearHeaderTimers();
    setMode(m);
    localStorage.setItem('app-mode', m);
    setSidebarOpen(false); // Close mobile sidebar on navigation

    // Reset viewport scroll; content holds below header until left title hides (at 305ms), then floats up
    if (mainContentAreaRef.current) {
      mainContentAreaRef.current.scrollTop = 0;
    }
    setShowLeftTitle(true);
    setFloatGen(g => g + 1);
    setTransitionGen(g => g + 1);
    setIsSectionFloating(true);

    const wasVisible = headerPhaseRef.current === 'repaired' || headerPhaseRef.current === 'repairing';
    updateHeaderPhase(wasVisible ? 'shredding' : 'waiting');

    if (wasVisible) {
      const tWait = window.setTimeout(() => {
        updateHeaderPhase('waiting');
      }, 210);
      headerTimersRef.current.push(tWait);
    }

    const tHideLeft = window.setTimeout(() => {
      setShowLeftTitle(false);
    }, 305);
    const tRepair = window.setTimeout(() => {
      setRepairGen(g => g + 1);
      updateHeaderPhase('repairing');
    }, 350);
    const tDone = window.setTimeout(() => {
      updateHeaderPhase('repaired');
    }, 350 + 780);
    const tFloatClear = window.setTimeout(() => {
      setIsSectionFloating(false);
    }, 950);
    headerTimersRef.current.push(tHideLeft, tRepair, tDone, tFloatClear);
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
      const json = await fetchLocalApiJson<{ data: Record<string, string> }>(
        `/api/secureboot?var=all${elevate ? '&elevate=true' : ''}`
      );

      setVariablesCache(json.data);
      setNeedsElevation(false);

      // Parse the active variable ('db' initially)
      parseAndSet('db', json.data['db']);
    } catch (err: any) {
      if (err instanceof WebApiUnavailableError || err?.isWebFallback) {
        const fallbackVars = getWebFallbackSecureBootVars();
        setVariablesCache(fallbackVars);
        setNeedsElevation(false);
        parseAndSet('db', fallbackVars['db']);
      } else if (!elevate) {
        setNeedsElevation(true);
      } else {
        const errorMsg = err.message || '';
        if (errorMsg.toLowerCase().includes('canceled by the user') || errorMsg.toLowerCase().includes('cancelled by the user')) {
          setError(t('app.adminAccess.userCanceled'));
        } else {
          setError(errorMsg);
        }
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
      case 'trust-store': return <TrustStoreInspector onNavigate={switchMode} />;
      case 'csr-inspector': return <CsrInspector onNavigate={switchMode} />;
      case 'win-cert-store': return <WinCertStoreInspector />;
      case 'crl-inspector': return <CrlInspector onNavigate={switchMode} />;
      case 'chain-validator': return <ChainValidator />;
      case 'key-matcher': return <KeyPairMatcher />;
      case 'key-generator': return <KeyGenerator />;
      case 'format-converter': return <FormatConverter />;
      case 'tls-scanner': return <TlsScanner />;
      case 'ocsp-checker': return <OcspChecker onNavigate={switchMode} />;
      case 'expiry-dashboard': return <ExpiryDashboard />;
      case 'ct-log-search': return <CtLogSearch />;
      case 'education-center': return <EducationCenter onNavigate={switchMode} />;
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <div className="glass-panel admin-elevation-panel">
                {elevating ? (
                  <>
                    <Shield size={64} color="var(--text-accent)" style={{ animation: 'pulse 2s infinite', margin: '0 auto 1rem auto' }} />
                    <h2 style={{ color: 'var(--text-accent)' }}>{t('app.adminAccess.waiting')}</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      <Trans i18nKey="app.adminAccess.checkTaskbarUac" components={[<LearningTerm key="uac" termId="uac">{""}</LearningTerm>]} />
                    </p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={64} color="var(--danger-color)" style={{ margin: '0 auto 1rem auto' }} />
                    <h2 style={{ color: 'var(--text-primary)' }}>{t('app.adminAccess.title')}</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                      <Trans i18nKey="app.adminAccess.secureBootDesc" components={[<LearningTerm key="nvram" termId="nvram">{""}</LearningTerm>]} />
                    </p>
                    {error && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</p>}
                    <button className="btn" style={{ background: 'var(--success-color)', width: '100%', justifyContent: 'center' }} onClick={() => loadAllVariables(true)}>
                      <Shield size={18} />
                      {t('app.adminAccess.unlockSecureBoot')}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="main-content">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', position: 'relative', zIndex: 10 }}>
              <div className="glass-card" style={{ display: 'inline-flex', padding: '0.35rem', gap: '0.35rem', borderRadius: '12px', background: 'var(--input-bg)' }}>
                {['db', 'dbx', 'KEK', 'PK'].map(v => (
                  <button
                    key={v}
                    data-var={v}
                    className={`secboot-var-btn ${activeVar === v ? 'active' : ''}`}
                    onClick={() => handleTabClick(v)}
                  >
                    <LearningTerm termId={v.toLowerCase() as any}>{v}</LearningTerm>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
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
                        <div className="badge">{t('app.certDetails.rawX509', 'Raw X.509 Certificate')}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          {rawCert.isRoot && <span className="badge badge-success"><span className="badge-dot" /><LearningTerm termId="rootCa">{t('app.certDetails.rootCa', 'Root CA')}</LearningTerm></span>}
                          {rawCert.isIntermediate && <span className="badge badge-warning"><span className="badge-dot" /><LearningTerm termId="intermediateCa">{t('app.certDetails.intermediateCa', 'Intermediate CA')}</LearningTerm></span>}
                          {rawCert.isLeaf && <span className="badge badge-purple"><span className="badge-dot" /><LearningTerm termId="leafCert">{t('app.certDetails.leafCert', 'Leaf Certificate')}</LearningTerm></span>}
                          {rawCert.isExpired && <span className="badge badge-danger"><span className="badge-dot pulse" />{t('app.certDetails.expired', 'Expired')}</span>}
                        </div>
                        <CertificateDetails cert={rawCert} />
                      </div>
                    )}

                    {signatureLists.map((list: EfiSignatureList, index: number) => (
                      <div key={index} className="glass-panel">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          <div className="metric-icon-wrap success">
                            <ShieldCheck size={26} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t('app.certDetails.signatureList', { index: index + 1 })}</h3>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                              {t('app.certDetails.type', 'Type')}: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{list.signatureTypeName}</span> &nbsp;•&nbsp;
                              {t('app.certDetails.guid', 'GUID')}: <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{list.signatureTypeGuid}</span>
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <div>{t('app.certDetails.listSize', 'List Size')}: <strong style={{ color: 'var(--text-primary)' }}>{list.signatureListSize} {t('app.certDetails.bytes', 'bytes')}</strong></div>
                          <div>{t('app.certDetails.signatures', 'Signatures')}: <strong style={{ color: 'var(--text-primary)' }}>{list.signatures.length}</strong></div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {list.signatures.map((sig: any, sigIndex: number) => (
                            <SignatureItem key={`${activeVar}-${index}-${sigIndex}`} signature={sig} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const floatAnimClass = isSectionFloating
    ? (floatGen % 2 === 1 ? 'section-float-pass-a' : 'section-float-pass-b')
    : '';

  let activeCategoryId = 'systemCheck';
  CATEGORIES.forEach(cat => {
    if (cat.items.some(i => i.id === mode)) {
      activeCategoryId = cat.id;
    }
  });

  return (
    <ToastProvider>
      <div className="app-layout">
        <AppSidebar mode={mode} onModeChange={switchMode} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div
          className="app-main-wrapper is-floated"
          data-mode={mode}
          data-category={activeCategoryId}
          data-header-phase={headerPhase}
        >
          {/* Ambient updraft horizon glow while section floats to the top */}
          {isSectionFloating && (
            <div key={`updraft-${floatGen}`} className="section-updraft-aura" aria-hidden="true" />
          )}

          <button
            className="floating-sidebar-trigger"
            onClick={() => setSidebarOpen(true)}
            title={t('app.aria.openSidebar')}
            aria-label={t('app.aria.openSidebar')}
          >
            <Menu size={20} />
          </button>

          {/* Beat 1: Left-side header title hides completely BEFORE content floats up */}
          {showLeftTitle && (
            <HeaderLeftTitle key={`left-title-${transitionGen}`} mode={mode} />
          )}

          {/* Beat 3: Sleek right-side glass controls capsule mends together out of wind-swept shards */}
          <HeaderControlsCapsule
            mode={mode}
            theme={theme}
            phase={headerPhase}
            repairGen={repairGen}
            onToggleTheme={toggleTheme}
            onInteractEarly={() => {
              if (headerPhaseRef.current !== 'repaired') {
                clearHeaderTimers();
                setShowLeftTitle(false);
                updateHeaderPhase('repaired');
              }
            }}
          />

          <div className="main-content-area" ref={mainContentAreaRef}>
            <div
              className={`section-float-stage ${floatAnimClass}`}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) {
                  setIsSectionFloating(false);
                }
              }}
            >
              {renderContent()}
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </ToastProvider>
  );
}

function SignatureItem({ signature }: { signature: any }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const cert = signature.certificate;

  return (
    <div className="glass-card signature-item">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
          <Shield size={20} color={cert ? 'var(--text-accent)' : 'var(--text-secondary)'} />
          <span style={{ fontWeight: 600 }}>
            {cert ? <LearningTerm termId="x509">{t('app.certDetails.rawX509', 'Raw X.509 Certificate')}</LearningTerm> : t('app.certDetails.unknownSignatureType', 'Hash / Binary Signature')}
          </span>
          {cert && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {cert.isRoot && <span className="badge badge-success" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.rootCa', 'Root CA')}</span>}
              {cert.isIntermediate && <span className="badge badge-warning" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.intermediateCa', 'Intermediate CA')}</span>}
              {cert.isLeaf && <span className="badge badge-purple" style={{ margin: 0 }}><span className="badge-dot" />{t('app.certDetails.leafCert', 'Leaf Certificate')}</span>}
              {cert.isExpired && <span className="badge badge-danger" style={{ margin: 0 }}><span className="badge-dot pulse" />{t('app.certDetails.expired', 'Expired')}</span>}
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
            <div className="details-label">{t('app.certDetails.ownerGuid', 'Owner GUID')}</div>
            <div className="details-value mono">{signature.signatureOwner}</div>
          </div>

          {cert && (
            <>
              <CertificateDetails cert={cert} />
            </>
          )}

          {!cert && signature.hashData && (
            <div style={{ marginTop: '1rem' }}>
              <div className="details-label" style={{ marginBottom: '0.5rem' }}>{t('app.certDetails.rawHexData', 'Raw Hex Data:')}</div>
              <pre className="code-block">
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
  const { t, i18n } = useTranslation();
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
          warnings.push(t('app.secureBoot.warnExpiringSoon', { subject }));
        }
      }
    });
  });

  if (!hasValidCert) {
    criticals.push(t('app.secureBoot.critNoValidDb'));
  }

  // Windows PCA Check
  if (expiredMsWindows && !hasMsWindowsCert) {
    criticals.push(t('app.secureBoot.critExpiredWindowsPca'));
  } else if (!hasMsWindowsCert && !criticals.length) {
    warnings.push(t('app.secureBoot.warnMissingWindowsPca'));
  }

  // UEFI CA Check
  if (expiredMsUefi && !hasMsUefiCert) {
    criticals.push(t('app.secureBoot.critExpiredUefiCa'));
  }

  return (
    <div style={{ marginBottom: '2rem' }}>

      <div className="glass-panel" style={{ marginBottom: '1.25rem', borderColor: 'var(--info-border)' }}>
        <h3 style={{ color: 'var(--text-accent-2)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} /> {t('app.secureBoot.assessmentTitle')}
        </h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{t('app.secureBoot.whyReplacedTitle')}</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <Trans 
                i18nKey="app.secureBoot.whyReplacedDesc"
                components={[<em key="0" />, <em key="1" />]} 
              />
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{t('app.secureBoot.impactWindowsTitle')}</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {t('app.secureBoot.impactWindowsDesc')}
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{t('app.secureBoot.impactUefiTitle')}</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {t('app.secureBoot.impactUefiDesc')}
            </p>
          </div>

          <div style={{ marginTop: '0.5rem', padding: '1rem 1.25rem', background: 'var(--card-bg)', border: '1px solid var(--glass-border-subtle)', borderRadius: '12px' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{t('app.secureBoot.functionalTitle')}</strong>
            <ul style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', paddingLeft: '1.5rem', lineHeight: '1.7', fontSize: '0.88rem' }}>
              <li>
                <strong>{t('app.secureBoot.windowsBoot')}:</strong> {hasMsWindowsCert ? <span className="badge badge-success" style={{ marginLeft: '0.4rem' }}><span className="badge-dot" />{t('app.secureBoot.validUntil', { date: latestWindowsDate.toLocaleDateString(i18n.language) })}</span> : <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}><span className="badge-dot pulse" />{t('app.secureBoot.invalid')}</span>}
                {hasMsWindowsCert && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t('app.secureBoot.governedBy', { subject: latestWindowsSubject })}</div>}
              </li>
              <li style={{ marginTop: '0.75rem' }}>
                <strong>{t('app.secureBoot.thirdPartyBoot')}:</strong> {hasMsUefiCert ? <span className="badge badge-success" style={{ marginLeft: '0.4rem' }}><span className="badge-dot" />{t('app.secureBoot.validUntil', { date: latestUefiDate.toLocaleDateString(i18n.language) })}</span> : <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}><span className="badge-dot pulse" />{t('app.secureBoot.invalid')}</span>}
                {hasMsUefiCert && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t('app.secureBoot.governedBy', { subject: latestUefiSubject })}</div>}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {criticals.map((crit, idx) => (
        <div key={`crit-${idx}`} className="glass-panel" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', marginBottom: '1rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="metric-icon-wrap danger">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ color: 'var(--danger-color)', margin: 0, fontSize: '1rem' }}>Critical Warning</h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-primary)', fontSize: '0.88rem' }}>{crit}</p>
            </div>
          </div>
        </div>
      ))}

      {warnings.map((warn, idx) => (
        <div key={`warn-${idx}`} className="glass-panel" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', marginBottom: '1rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="metric-icon-wrap warning">
              <Shield size={24} />
            </div>
            <div>
              <h3 style={{ color: 'var(--warning-color)', margin: 0, fontSize: '1rem' }}>Warning</h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-primary)', fontSize: '0.88rem' }}>{warn}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CertificateDetails({ cert }: { cert: ParsedCertificate }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showPem, setShowPem] = useState(false);

  const downloadPemFile = () => {
    if (!cert.pem) return;
    const blob = new Blob([cert.pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = (cert.subject.match(/CN=([^,]+)/)?.[1]?.trim() || cert.serialNumber || 'certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${filename}.pem`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}.pem`, 'success');
  };

  const downloadDerFile = () => {
    if (!cert.pem) return;
    try {
      const b64 = cert.pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = (cert.subject.match(/CN=([^,]+)/)?.[1]?.trim() || cert.serialNumber || 'certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${filename}.der`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}.der`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export DER', 'error');
    }
  };

  const copyPemText = () => {
    if (!cert.pem) return;
    navigator.clipboard.writeText(cert.pem);
    setCopied(true);
    showToast(t('app.winCertStore.certCard.copiedToast', 'PEM certificate copied to clipboard'), 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyValue = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    showToast(`Copied ${label} to clipboard`, 'success');
  };

  return (
    <>
      <div className="details-grid" style={{ marginTop: '0.5rem' }}>
        <div className="details-label">{t('app.certDetails.subject', 'Subject')}</div>
        <div className="details-value">{cert.subject}</div>

        <div className="details-label">{t('app.certDetails.issuer', 'Issuer')}</div>
        <div className="details-value">{cert.issuer}</div>

        <div className="details-label">{t('app.certDetails.validFrom', 'Valid From')}</div>
        <div className="details-value">{new Date(cert.validFrom).toLocaleString(i18n.language)}</div>

        <div className="details-label">{t('app.certDetails.validTo', 'Valid To')}</div>
        <div className="details-value">
          {new Date(cert.validTo).toLocaleString(i18n.language)}{' '}
          <span
            style={{ fontSize: '0.82rem', color: cert.isExpired ? 'var(--danger-color)' : 'var(--text-secondary)', marginLeft: '0.35rem', cursor: 'help' }}
            title={formatExpiryTooltip(cert.validTo, t, i18n.language)}
          >
            ({formatExpiry(cert.validTo, t, i18n.language)})
          </span>
          {cert.isExpired && <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}><span className="badge-dot pulse" />{t('app.certDetails.expired', 'Expired')}</span>}
        </div>

        <div className="details-label">{t('app.certDetails.serialNumber', 'Serial Number')}</div>
        <div className="details-value mono copy-trigger-wrap" onClick={() => copyValue(cert.serialNumber, 'Serial Number')} title="Click to copy">
          <span>{cert.serialNumber}</span>
          <Copy size={12} className="copy-trigger-icon" />
        </div>

        <div className="details-label">{t('app.certDetails.version', 'Version')}</div>
        <div className="details-value">v{cert.version + 1}</div>

        <div className="details-label">{t('app.certDetails.signatureAlgorithm', 'Signature Algorithm')}</div>
        <div className="details-value">{cert.signatureAlgorithm} ({cert.signatureOid})</div>

        <div className="details-label">{t('app.certDetails.publicKey', 'Public Key')}</div>
        <div className="details-value">{cert.publicKeyAlgorithm} {cert.publicKeySize ? `(${cert.publicKeySize} ${t('app.certDetails.bits', 'bits')})` : ''}</div>

        <div className="details-label">{t('app.certDetails.sha1Fingerprint', 'SHA-1 Fingerprint')}</div>
        <div className="details-value mono copy-trigger-wrap" style={{ wordBreak: 'break-all', fontSize: '0.84em' }} onClick={() => copyValue(cert.fingerprintSha1, 'SHA-1 Fingerprint')} title="Click to copy">
          <span>{cert.fingerprintSha1}</span>
          <Copy size={12} className="copy-trigger-icon" />
        </div>

        <div className="details-label">{t('app.certDetails.sha256Fingerprint', 'SHA-256 Fingerprint')}</div>
        <div className="details-value mono copy-trigger-wrap" style={{ wordBreak: 'break-all', fontSize: '0.84em' }} onClick={() => copyValue(cert.fingerprintSha256, 'SHA-256 Fingerprint')} title="Click to copy">
          <span>{cert.fingerprintSha256}</span>
          <Copy size={12} className="copy-trigger-icon" />
        </div>

        <div className="details-label">{t('app.certDetails.purposes', 'Purposes')}</div>
        <div className="details-value">
          {splitPurposes(cert.purposes).map((p: string) => translatePurpose(p, t)).join(', ')}
        </div>
      </div>

      {cert.extensions && cert.extensions.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('app.certDetails.extensions', 'Extensions')} ({cert.extensions.length})</summary>
          <div className="details-grid" style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border-subtle)', padding: '1rem 1.25rem', borderRadius: '10px' }}>
            {cert.extensions.map((ext: any, idx: number) => (
              <div key={idx} style={{ display: 'contents' }}>
                <div className="details-label">
                  {t([`app.winCertStore.extensions.${ext.name.replace(/\s+/g, '')}`, `app.winCertStore.extensions.${ext.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`] as any, ext.name) as string}
                </div>
                <div className="details-value">
                  <div>OID: <span className="mono">{ext.oid}</span> {ext.critical && <span className="badge badge-danger" style={{ fontSize: '0.7em', marginLeft: '0.3rem' }}>{t('app.certDetails.critical', '(Critical)')}</span>}</div>
                  {ext.value && (
                    <div className="mono" style={{ wordBreak: 'break-all', fontSize: '0.82em', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                      {formatExtensionValue(ext.name, ext.oid, ext.value, t)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {cert.pem && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button
              className="btn btn-download-pem"
              onClick={downloadPemFile}
              title={t('app.winCertStore.certCard.downloadPem', 'Download PEM')}
            >
              <Download size={13} /> {t('app.winCertStore.certCard.downloadPem', 'Download PEM')}
            </button>
            <button
              className="btn btn-download-der"
              onClick={downloadDerFile}
              title={t('app.winCertStore.certCard.downloadDer', 'Download DER')}
            >
              <Download size={13} /> {t('app.winCertStore.certCard.downloadDer', 'Download DER')}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={copyPemText}
              title={t('app.winCertStore.certCard.copyPem', 'Copy PEM')}
            >
              {copied ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} />}
              <span>{copied ? t('app.winCertStore.certCard.copied', 'Copied') : t('app.winCertStore.certCard.copyPem', 'Copy PEM')}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPem(!showPem)}
            >
              {showPem ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showPem ? t('app.winCertStore.certCard.hidePem', 'Hide PEM') : t('app.winCertStore.certCard.viewPem', 'View PEM')}</span>
            </button>
          </div>

          {showPem && (
            <pre className="code-block" style={{ marginTop: '0.5rem' }}>
              {cert.pem}
            </pre>
          )}
        </div>
      )}
    </>
  );
}

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
function AppSidebar({ mode, onModeChange, isOpen, onClose }: { mode: AppMode, onModeChange: (m: AppMode) => void, isOpen: boolean, onClose: () => void }) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const activeBtn = navRef.current?.querySelector('.sidebar-nav-btn.active') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [mode]);

  return (
    <>
      <div className={`app-sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="app-sidebar-header">
          <img src="/logo.svg" alt="Logo" className="app-sidebar-logo" />
          <div className="app-sidebar-title">
            <h2>Certificate</h2>
            <span>Manager</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} title={t('app.aria.closeSidebar')}>
            <X size={20} />
          </button>
        </div>

        <nav className="app-sidebar-nav" ref={navRef}>
          {CATEGORIES.map((category, idx) => (
            <div key={idx} className="sidebar-category" data-category={category.id}>
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
                        <Icon size={17} />
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
          <span>v{APP_VERSION}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Secure PKI</span>
        </div>
      </aside>
    </>
  );
}

// ─── Language config ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'id', flag: 'id', label: 'Bahasa Indonesia' },
  { code: 'bs', flag: 'ba', label: 'Bosanski' },
  { code: 'de', flag: 'de', label: 'Deutsch' },
  { code: 'en', flag: 'gb', label: 'English' },
  { code: 'pl', flag: 'pl', label: 'Polski' },
  { code: 'sr-Cyrl', flag: 'rs', label: 'Српски' },
];

// ─── Flag Language Picker ─────────────────────────────────────────────────────
function LanguagePicker({ closeSignal }: { closeSignal?: number }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const normalizedLang = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language) || 'en';
  const current =
    LANGUAGES.find(l => l.code === normalizedLang) ??
    LANGUAGES.find(l => l.code === 'en') ??
    LANGUAGES[0];

  React.useEffect(() => {
    if (closeSignal !== undefined) {
      setOpen(false);
    }
  }, [closeSignal]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="lang-picker" ref={ref} title={t('app.language.switch')}>
      <button className="lang-picker-trigger" onClick={() => setOpen(o => !o)}>
        <img src={`/flags/${current.flag}.png`} alt={current.label} className="lang-flag" />
        <span className="lang-label">{current.label}</span>
        <ChevronDown size={13} className={`lang-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <ul className="lang-picker-menu">
          {LANGUAGES.map(lang => (
            <li key={lang.code}>
              <button
                className={`lang-option ${lang.code === current.code ? 'active' : ''}`}
                onClick={() => {
                  setUserLanguagePreference(lang.code as SupportedLanguage);
                  i18n.changeLanguage(lang.code);
                  setOpen(false);
                }}
              >
                <img src={`/flags/${lang.flag}.png`} alt={lang.label} className="lang-flag" />
                <span>{lang.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Ephemeral Left-Side Header Title (Hides Cleanly Before Content Floats Up) ──
function HeaderLeftTitle({ mode }: { mode: AppMode }) {
  const { t } = useTranslation();
  let title = t('app.title');
  let ActiveIcon: React.ElementType = Shield;
  let categoryName = '';
  let categoryId = 'systemCheck';

  CATEGORIES.forEach(cat => {
    const item = cat.items.find(i => i.id === mode);
    if (item) {
      title = t(`app.nav.${item.id}`);
      ActiveIcon = item.icon;
      categoryName = t(`app.categories.${cat.id}`);
      categoryId = cat.id;
    }
  });

  const renderBadgeAndTitle = () => (
    <div className="header-left-ghost-inner">
      <div className={`metric-icon-wrap header-badge-${categoryId} header-left-ghost-badge`}>
        <ActiveIcon size={17} />
      </div>
      <div className="header-left-ghost-text">
        <span className="header-left-ghost-heading">{title}</span>
        {categoryName && <span className="header-left-ghost-cat">{categoryName}</span>}
      </div>
    </div>
  );

  return (
    <div className="header-left-ghost-wrap" data-category={categoryId} aria-hidden="true">
      <div className="header-left-ghost-stack">
        <div className="title-wind-slice slice-top">{renderBadgeAndTitle()}</div>
        <div className="title-wind-slice slice-mid">{renderBadgeAndTitle()}</div>
        <div className="title-wind-slice slice-bot">{renderBadgeAndTitle()}</div>
      </div>
    </div>
  );
}

// ─── Wind-Swept Glass Shard Spec for Right-Side Controls Capsule ─────────────
const CAPSULE_SHARDS = [
  { idx: 0, driftY: '-9px',  skew: '8deg',   rot: '-3deg',  rotY: '-18deg', delay: '0ms'   },
  { idx: 1, driftY: '11px',  skew: '-9deg',  rot: '4deg',   rotY: '20deg',  delay: '26ms'  },
  { idx: 2, driftY: '-14px', skew: '11deg',  rot: '-5deg',  rotY: '-23deg', delay: '52ms'  },
  { idx: 3, driftY: '16px',  skew: '-12deg', rot: '6deg',   rotY: '26deg',  delay: '78ms'  },
  { idx: 4, driftY: '-18px', skew: '14deg',  rot: '-8deg',  rotY: '-28deg', delay: '104ms' },
  { idx: 5, driftY: '21px',  skew: '-15deg', rot: '9deg',   rotY: '31deg',  delay: '130ms' },
  { idx: 6, driftY: '-23px', skew: '17deg',  rot: '-10deg', rotY: '-34deg', delay: '156ms' },
  { idx: 7, driftY: '25px',  skew: '-18deg', rot: '12deg',  rotY: '36deg',  delay: '182ms' },
];

// ─── Sleek Right-Side Frosted-Glass Controls Capsule (Wind-Mended Motion) ────
function HeaderControlsCapsule({
  mode,
  theme,
  phase,
  repairGen,
  onToggleTheme,
  onInteractEarly,
}: {
  mode: AppMode;
  theme: Theme;
  phase: HeaderPhase;
  repairGen: number;
  onToggleTheme: () => void;
  onInteractEarly: () => void;
}) {
  const { t } = useTranslation();

  let categoryId = 'systemCheck';
  CATEGORIES.forEach(cat => {
    if (cat.items.some(i => i.id === mode)) {
      categoryId = cat.id;
    }
  });

  return (
    <div
      className={`controls-capsule-dock phase-${phase}`}
      data-category={categoryId}
      onPointerDown={onInteractEarly}
      role="region"
      aria-label="Quick settings"
    >
      <div className="controls-capsule-frame">
        {/* Clean, modern rounded frosted-glass pill (not a flag) */}
        <div className="capsule-glass-shell" aria-hidden="true">
          <span className="capsule-glass-sheen" />
        </div>

        {/* Wind-damaged translucent glass ribbons rippling & mending seamlessly together */}
        {(phase === 'shredding' || phase === 'repairing') && (
          <div key={`${phase}-${repairGen}`} className="capsule-mend-loom" aria-hidden="true">
            {CAPSULE_SHARDS.map(s => (
              <span
                key={s.idx}
                className={`capsule-mend-shard shard-${s.idx} ${s.idx % 2 === 0 ? 'shard-even' : 'shard-odd'} ${s.idx === 7 ? 'is-left-edge' : ''}`}
                style={{
                  '--shard-i': s.idx,
                  '--drift-y': s.driftY,
                  '--skew-deg': s.skew,
                  '--rot-deg': s.rot,
                  '--rot-y': s.rotY,
                  '--shard-delay': s.delay,
                } as React.CSSProperties}
              >
                <span className="shard-fold-glint" />
              </span>
            ))}

            {/* Subtle aerodynamic wind-light filaments guiding the mend */}
            <svg className="capsule-wind-svg" viewBox="0 0 260 52" preserveAspectRatio="none">
              <path
                className="capsule-wind-filament wf-1"
                d="M -22,14 C 32,4 92,24 158,11 C 204,3 234,14 258,12"
                vectorEffect="non-scaling-stroke"
              />
              <path
                className="capsule-wind-filament wf-2"
                d="M -28,36 C 28,48 98,22 168,37 C 212,46 238,34 258,36"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}

        {/* Theme & language controls exposed as the glass capsule mends */}
        <div className="capsule-controls-payload">
          <LanguagePicker closeSignal={repairGen} />
          <span className="capsule-controls-divider" aria-hidden="true" />
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={t('app.aria.toggleTheme')}
          >
            {theme === 'dark' ? <Moon size={17} /> : theme === 'light' ? <Sun size={17} /> : <Monitor size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-left">
          <img src="/logo.svg" alt="" style={{ width: 18, height: 18, opacity: 0.6, borderRadius: 4 }} />
          <span>{t('app.title')}</span>
        </div>
        <div className="app-footer-right">
          <span>{t('app.footer.tagline', 'In-Browser Cryptography · Local & Web Ready')}</span>
        </div>
      </div>
    </footer>
  );
}

export default App;

