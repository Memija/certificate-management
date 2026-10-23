import React, { useEffect } from 'react';
import { 
  X, 
  Shield, 
  FileKey, 
  Globe, 
  Code, 
  AlertTriangle, 
  BookOpen, 
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TermId } from './LearningTerm';
import { EDUCATION_TOPICS } from './educationTopicsData';

export interface EducationTopicModalProps {
  topicId: TermId | null;
  onClose: () => void;
  onNavigate?: (mode: any) => void;
  onSelectTopic?: (id: TermId) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'secure-boot': Shield,
  'certificates': FileKey,
  'protocols': Globe,
  'formats': Code,
};

const CATEGORY_COLORS: Record<string, string> = {
  'secure-boot': 'var(--cat-secureboot)',
  'certificates': 'var(--cat-inspection)',
  'protocols': 'var(--cat-network)',
  'formats': 'var(--cat-tools)',
};

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  'secure-boot': 'secureBoot',
  'certificates': 'certificates',
  'protocols': 'protocols',
  'formats': 'formats',
};

export function EducationTopicModal({
  topicId,
  onClose,
  onNavigate,
}: EducationTopicModalProps) {
  const { t } = useTranslation();

  const topic = topicId ? EDUCATION_TOPICS[topicId] : null;

  // Escape key listener to close modal
  useEffect(() => {
    if (!topicId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topicId, onClose]);

  if (!topic || !topicId) return null;

  const CategoryIcon = CATEGORY_ICONS[topic.category] || BookOpen;
  const categoryColor = CATEGORY_COLORS[topic.category] || 'var(--accent-color)';
  const catTranslationKey = CATEGORY_TRANSLATION_KEYS[topic.category];

  // Localized topic attributes with fallback to default english data
  const title = t(`app.educationCenter.topicDetails.${topicId}.title`, topic.title);
  const subtitle = t(`app.educationCenter.topicDetails.${topicId}.subtitle`, topic.subtitle);
  const overview = t(`app.educationCenter.topicDetails.${topicId}.overview`, topic.overview);
  const rawKeyPoints = t(`app.educationCenter.topicDetails.${topicId}.keyPoints`, { returnObjects: true });
  const keyPoints: string[] = Array.isArray(rawKeyPoints) && rawKeyPoints.length > 0
    ? (rawKeyPoints as string[])
    : topic.keyPoints;
  const securityImpact = t(`app.educationCenter.topicDetails.${topicId}.securityImpact`, topic.securityImpact);
  const toolLabel = topic.relatedAppMode
    ? t(`app.educationCenter.modal.toolLabels.${topic.relatedAppMode.mode}`, topic.relatedAppMode.label)
    : '';

  return (
    <div className="chain-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="chain-modal-dialog" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '780px', 
          width: '92%', 
          maxHeight: '88vh', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border-subtle)', paddingBottom: '1rem', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span 
                className="badge" 
                style={{ 
                  background: 'rgba(14, 165, 233, 0.1)', 
                  color: categoryColor, 
                  borderColor: categoryColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.74rem'
                }}
              >
                <CategoryIcon size={12} />
                {t(`app.learningCategories.${catTranslationKey}`, topic.category)}
              </span>

              {topic.standardRef && (
                <span className="badge" style={{ fontSize: '0.74rem', background: 'var(--input-bg)' }}>
                  {topic.standardRef}
                </span>
              )}
            </div>

            <h3 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {title}
            </h3>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <button
              className="toast-close-btn"
              onClick={onClose}
              title={t('app.educationCenter.modal.close', 'Close')}
              style={{ padding: '0.4rem', borderRadius: 8 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Interactive In-App Tool Callout */}
        {topic.relatedAppMode && onNavigate && (
          <div 
            className="glass-panel" 
            style={{ 
              padding: '1rem 1.25rem', 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0.4) 100%)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cat-network)', marginBottom: '0.2rem' }}>
                {t('app.educationCenter.modal.interactiveDemo', 'Hands-on Inspection Tool')}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {t('app.educationCenter.modal.tryInAppDesc', 'Inspect and test {{topic}} in the application', { topic: title })}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onNavigate(topic.relatedAppMode!.mode);
                onClose();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}
            >
              <span>{toolLabel}</span>
              <ExternalLink size={13} />
            </button>
          </div>
        )}

        {/* Section 1: Detailed Overview */}
        <div>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <BookOpen size={16} style={{ color: categoryColor }} />
            {t('app.educationCenter.modal.overview', 'Technical Overview')}
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {overview}
          </p>
        </div>

        {/* Section 2: Key Mechanics & Architecture */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <CategoryIcon size={16} style={{ color: categoryColor }} />
            {t('app.educationCenter.modal.keyMechanics', 'Key Mechanics & Architecture')}
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {keyPoints.map((point, idx) => (
              <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 3: Security & Real-World Impact */}
        <div 
          className="glass-card" 
          style={{ 
            padding: '1.25rem', 
            background: 'rgba(239, 68, 68, 0.04)', 
            borderColor: 'rgba(239, 68, 68, 0.2)' 
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <AlertTriangle size={16} />
            {t('app.educationCenter.modal.securityImpact', 'Security Considerations & Failure Modes')}
          </h4>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {securityImpact}
          </p>
        </div>

      </div>
    </div>
  );
}
