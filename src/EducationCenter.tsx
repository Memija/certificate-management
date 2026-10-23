import { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Shield, 
  FileKey, 
  Globe, 
  Code, 
  Layers, 
  ArrowRight 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TermId } from './LearningTerm';
import { EDUCATION_TOPICS } from './educationTopicsData';
import { EducationTopicModal } from './EducationTopicModal';
import { matchesSearch } from './utils/textSearch';

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
    keys: ['rootCa', 'intermediateCa', 'leafCert', 'csr'],
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
  const [selectedTopicId, setSelectedTopicId] = useState<TermId | null>(null);
  const { t } = useTranslation();

  const filterTerms = (keys: TermId[]) => {
    if (!search.trim()) return keys;
    return keys.filter(key => {
      const topicTitle = t(`app.educationCenter.topicDetails.${key}.title`, EDUCATION_TOPICS[key]?.title || '');
      const defaultTitle = EDUCATION_TOPICS[key]?.title || '';
      
      const text = t(`app.learningTerms.${key}`, '');
      let altTitle = '';
      if (key === 'x509') {
        altTitle = 'X.509';
      } else {
        const firstPeriodIdx = text.indexOf('.');
        if (firstPeriodIdx > 0 && firstPeriodIdx < 60) {
          altTitle = text.substring(0, firstPeriodIdx);
        }
      }

      return matchesSearch(
        [key, topicTitle, defaultTitle, altTitle],
        search
      );
    });
  };

  const visibleCategories = CATEGORIES.filter(c => selectedCat === 'all' || c.id === selectedCat);

  const totalVisibleCount = visibleCategories.reduce((acc, cat) => {
    return acc + filterTerms(cat.keys).length;
  }, 0);

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="metric-icon-wrap" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 1rem auto', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(14, 165, 233, 0.05) 100%)', color: 'var(--cat-learning)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
            <BookOpen size={28} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            {t('app.educationCenter.title', t('app.nav.education-center', 'Education Center'))}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto' }}>
            {t(
              'app.educationCenter.subtitle',
              'Learn the core concepts behind PKI, digital certificates, and Secure Boot. Browse the glossary below to understand the terminology used throughout the application.'
            )}
          </p>
        </div>

        {/* Search Bar */}
        <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input 
            type="text" 
            placeholder={t('app.educationCenter.searchPlaceholder', 'Search topics, acronyms, or concepts...')} 
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
              {t('app.educationCenter.clearSearch', t('app.common.clear', 'Clear'))}
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
            <span>{t('app.educationCenter.allTopics', 'All Topics')}</span>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginTop: '1.5rem' }}>
          {visibleCategories.map(category => {
            const visibleKeys = filterTerms(category.keys);
            if (visibleKeys.length === 0) return null;

            const Icon = category.icon;

            return (
              <div key={category.id} className="animate-fade-in">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border-subtle)', paddingBottom: '0.6rem', marginBottom: '1.25rem' }}>
                  <Icon size={20} style={{ color: category.color }} />
                  {t(`app.learningCategories.${category.translationKey}`)}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.1rem' }}>
                  {visibleKeys.map(key => {
                    const text = t(`app.learningTerms.${key}`);
                    const firstPeriodIdx = text.indexOf('.');
                    let termTitle = text;
                    let termDef = '';
                    
                    if (key === 'x509') {
                      termTitle = t('app.educationCenter.topicDetails.x509.title', 'X.509 Standard');
                      termDef = text;
                    } else if (firstPeriodIdx > 0 && firstPeriodIdx < 60) {
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
                        onClick={() => setSelectedTopicId(key)}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          padding: '1.25rem', 
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div style={{ marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, color: category.color, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
                            {termTitle}
                          </h4>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, flex: 1 }}>
                          {termDef}
                        </p>

                        <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--glass-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: category.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{t('app.educationCenter.learnMore', 'Learn more & deep dive')}</span>
                            <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {totalVisibleCount === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <Search size={44} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.05rem', margin: 0 }}>
                {t('app.educationCenter.noTermsFound', 'No terms found matching "{{search}}"', { search })}
              </p>
            </div>
          )}
        </div>

        {/* Detailed Topic Modal */}
        <EducationTopicModal
          topicId={selectedTopicId}
          onClose={() => setSelectedTopicId(null)}
          onNavigate={onNavigate}
        />

      </div>
    </div>
  );
}
