import { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Shield, 
  FileKey, 
  Globe, 
  Code, 
  Layers, 
  Copy, 
  FileText, 
  Zap, 
  Activity, 
  ArrowRight 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TermId } from './LearningTerm';
import { useToast } from './ToastContext';

interface CategoryDef {
  id: string;
  translationKey: string;
  icon: React.ElementType;
  keys: TermId[];
  color: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'secure-boot',
    translationKey: 'secureBoot',
    icon: Shield,
    keys: ['nvram', 'db', 'dbx', 'kek', 'pk', 'efi', 'uac'],
    color: 'var(--cat-secureboot)'
  },
  {
    id: 'certificates',
    translationKey: 'certificates',
    icon: FileKey,
    keys: ['rootCa', 'intermediateCa', 'leafCert', 'csr', 'crl'],
    color: 'var(--cat-inspection)'
  },
  {
    id: 'protocols',
    translationKey: 'protocols',
    icon: Globe,
    keys: ['ocsp', 'crl', 'ocspStapling', 'ctlog'],
    color: 'var(--cat-network)'
  },
  {
    id: 'formats',
    translationKey: 'formats',
    icon: Code,
    keys: ['x509', 'pem', 'der'],
    color: 'var(--cat-tools)'
  }
];

export function EducationCenter({ onNavigate }: { onNavigate?: (mode: any) => void }) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const { t } = useTranslation();
  const { showToast } = useToast();

  const filterTerms = (keys: TermId[]) => {
    if (!search.trim()) return keys;
    const lowerSearch = search.toLowerCase();
    return keys.filter(key => {
      const termDef = t(`app.learningTerms.${key}`);
      return key.toLowerCase().includes(lowerSearch) || termDef.toLowerCase().includes(lowerSearch);
    });
  };

  const visibleCategories = CATEGORIES.filter(c => selectedCat === 'all' || c.id === selectedCat);

  const totalVisibleCount = visibleCategories.reduce((acc, cat) => {
    return acc + filterTerms(cat.keys).length;
  }, 0);

  const copyDefinition = (title: string, def: string) => {
    navigator.clipboard.writeText(`${title}\n${def}`);
    showToast(`Copied definition for ${title}`, 'success');
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="metric-icon-wrap" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 1rem auto', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(14, 165, 233, 0.05) 100%)', color: 'var(--cat-learning)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
            <BookOpen size={28} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{t('app.nav.education-center')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto' }}>
            Learn the core concepts behind PKI, digital certificates, and Secure Boot. 
            Browse the glossary below to understand the terminology used throughout the application.
          </p>
        </div>

        {/* Search Bar */}
        <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input 
            type="text" 
            placeholder="Search topics, acronyms, or concepts..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ 
              border: 'none', 
              background: 'transparent',
              padding: '0.4rem 0',
              boxShadow: 'none'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="edu-filter-bar">
          <button
            className={`edu-filter-pill ${selectedCat === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCat('all')}
          >
            <Layers size={14} />
            <span>All Topics</span>
          </button>
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`edu-filter-pill ${selectedCat === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCat(c.id)}
              >
                <Icon size={14} />
                <span>{t(`app.learningCategories.${c.translationKey}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Counter Badge */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <span className="badge" style={{ fontSize: '0.78rem' }}>
            {totalVisibleCount} {totalVisibleCount === 1 ? 'topic' : 'topics'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {visibleCategories.map(category => {
            const visibleKeys = filterTerms(category.keys);
            const isProtocols = category.id === 'protocols';
            const matchesRevocationGuide = !search.trim() || 
              'understanding online revocation protocols ocsp crl stapling rfc 6960 5280 6066 soft-fail hard-fail'
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              t('app.ocsp.eduTitle', 'Understanding Online Revocation Protocols').toLowerCase().includes(search.toLowerCase());
            
            const showRevocationGuide = isProtocols && matchesRevocationGuide;

            if (visibleKeys.length === 0 && !showRevocationGuide) return null;

            const Icon = category.icon;

            return (
              <div key={category.id} className="animate-fade-in">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border-subtle)', paddingBottom: '0.6rem', marginBottom: '1.25rem' }}>
                  <Icon size={20} style={{ color: category.color }} />
                  {t(`app.learningCategories.${category.translationKey}`)}
                </h3>
                
                {visibleKeys.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.1rem' }}>
                    {visibleKeys.map(key => {
                      const text = t(`app.learningTerms.${key}`);
                      const firstPeriodIdx = text.indexOf('.');
                      let termTitle = text;
                      let termDef = '';
                      
                      if (firstPeriodIdx > 0 && firstPeriodIdx < 60) {
                        termTitle = text.substring(0, firstPeriodIdx);
                        termDef = text.substring(firstPeriodIdx + 1).trim();
                      } else {
                        termTitle = key.toUpperCase();
                        termDef = text;
                      }

                      return (
                        <div
                          key={key}
                          className="glass-card edu-card-hover"
                          style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', position: 'relative' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0, color: category.color, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
                              {termTitle}
                            </h4>
                            <button
                              className="toast-close-btn"
                              style={{ opacity: 0.6 }}
                              onClick={() => copyDefinition(termTitle, termDef)}
                              title="Copy definition"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, flex: 1 }}>
                            {termDef}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Deep Dive Guide: Understanding Online Revocation Protocols */}
                {showRevocationGuide && (
                  <div 
                    className="glass-panel" 
                    style={{ 
                      marginTop: '1.5rem', 
                      padding: '1.75rem', 
                      borderRadius: 16, 
                      border: '1px solid rgba(14, 165, 233, 0.3)', 
                      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cat-network)', marginBottom: '0.4rem' }}>
                          <Globe size={13} />
                          <span>PKI Architecture Guide</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {t('app.ocsp.eduTitle', 'Understanding Online Revocation Protocols')}
                        </h4>
                        <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', lineHeight: 1.5 }}>
                          {t('app.ocsp.eduSubtitle', 'How modern PKI systems verify that a certificate has not been revoked before expiration.')}
                        </p>
                      </div>

                      {onNavigate && (
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('ocsp-checker')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem' }}
                            title={t('app.ocsp.launchOcspChecker', 'Open Online Revocation Checker')}
                          >
                            <Activity size={13} style={{ color: 'var(--cat-network)' }} />
                            <span>{t('app.ocsp.launchOcspChecker', 'Online Revocation Checker')}</span>
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('crl-inspector')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem' }}
                            title={t('app.ocsp.launchCrlInspector', 'Open CRL Inspector')}
                          >
                            <FileText size={13} style={{ color: 'var(--warning-color)' }} />
                            <span>{t('app.ocsp.launchCrlInspector', 'CRL Inspector')}</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1.1rem' }}>
                      {/* OCSP Card */}
                      <div className="glass-card edu-card-hover" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--info-bg)', color: 'var(--cat-network)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Globe size={18} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t('app.ocsp.eduOcspTitle', 'OCSP (RFC 6960)')}
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: 'var(--cat-network)', fontWeight: 600 }}>Real-Time Verification</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                          {t('app.ocsp.eduOcspDesc', 'Online Certificate Status Protocol queries the CA in real time for a specific certificate serial number. Provides instantaneous status but requires high-availability responder infrastructure.')}
                        </p>
                      </div>

                      {/* CRL Card */}
                      <div className="glass-card edu-card-hover" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--warning-bg)', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={18} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t('app.ocsp.eduCrlTitle', 'CRL (RFC 5280)')}
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: 'var(--warning-color)', fontWeight: 600 }}>Periodic Distribution Lists</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                          {t('app.ocsp.eduCrlDesc', 'Certificate Revocation Lists are signed, timestamped lists published periodically by the CA. Many modern CAs (like Let\'s Encrypt) rely on CRL distributions to provide scalable revocation without per-handshake OCSP overhead.')}
                        </p>
                      </div>

                      {/* OCSP Stapling Card */}
                      <div className="glass-card edu-card-hover" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Zap size={18} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t('app.ocsp.eduStaplingTitle', 'OCSP Stapling (RFC 6066)')}
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: 'var(--success-color)', fontWeight: 600 }}>Zero-Latency TLS Caching</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                          {t('app.ocsp.eduStaplingDesc', 'The web server periodically queries the OCSP responder and caches the signed response, attaching it directly to the TLS handshake. This eliminates client lookup latency and protects user privacy by avoiding direct client-to-CA connections.')}
                        </p>
                      </div>

                      {/* Testing Strategy Card */}
                      <div className="glass-card edu-card-hover" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--purple-bg)', color: 'var(--purple-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Activity size={18} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t('app.ocsp.eduTestingTitle', 'Testing Strategy & Failure Modes')}
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: 'var(--purple-color)', fontWeight: 600 }}>Soft-Fail vs. Hard-Fail</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                          {t('app.ocsp.eduTestingDesc', 'Most modern browsers employ soft-fail (proceeding if a revocation check times out) to prevent broken browsing experiences. Use the test examples in the Online Revocation Checker to verify how applications respond to revoked, EV/DV, and internal certificates.')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {totalVisibleCount === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <Search size={44} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.05rem', margin: 0 }}>No terms found matching "{search}"</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
