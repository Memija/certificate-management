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

const INLINE_TOKEN_REGEX =
  /(['"]-----BEGIN [A-Z0-9 ]+-----['"]|['"]---BEGIN\.\.\.['"]|['"]---END\.\.\.['"]|\bDER-ASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bDER ASN\.1\b|\bASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bBase64(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bS\/MIME(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bASCII(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bCSRs?\b|\bX\.509\b|\bPKCS#10\b|\bSHA-(?:256|384|512)\b|\bchmod 600\b|\bcA:(?:TRUE|FALSE)\b|\bpathLenConstraint\b|\bdigitalSignature\b|\bkeyEncipherment\b|\bkeyCompromise\b|\baffiliationChanged\b|\bthisUpdate\b|\bnextUpdate\b|\bCertificateStatus\b|\bGetFirmwareEnvironmentVariable(?:Ex)?\b|\bCertOpenStore\b|\bVARIABLE_ATTRIBUTE_NON_VOLATILE\b|\bBOOTSERVICE_ACCESS\b|\bRUNTIME_ACCESS\b|\bEFI_CERT_SHA256_GUID\b|\bEFI_VARIABLE_AUTHENTICATION_2\b|\bCVE-\d{4}-\d{4,7}\b|\bRFC \d{3,5}\b|\bCERTIFICATE\b|\bRSA PRIVATE KEY\b|\bbootia32\.efi\b|\bshimx64\.efi\b)/g;

function renderInlineTokens(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(INLINE_TOKEN_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (
      (part.startsWith("'") && part.endsWith("'") && part.includes('BEGIN')) ||
      (part.startsWith('"') && part.endsWith('"') && part.includes('BEGIN')) ||
      (part.startsWith("'") && part.endsWith("'") && part.includes('END')) ||
      (part.startsWith('"') && part.endsWith('"') && part.includes('END'))
    ) {
      const stripped = part.slice(1, -1);
      return (
        <code key={`${keyPrefix}-code-${idx}`} className="edu-code-chip">
          {stripped}
        </code>
      );
    }
    if (INLINE_TOKEN_REGEX.test(part)) {
      INLINE_TOKEN_REGEX.lastIndex = 0;
      return (
        <span key={`${keyPrefix}-tok-${idx}`} className="edu-tech-token">
          {part}
        </span>
      );
    }
    INLINE_TOKEN_REGEX.lastIndex = 0;
    return <React.Fragment key={`${keyPrefix}-txt-${idx}`}>{part}</React.Fragment>;
  });
}

function renderLeadSentence(sentence: string): React.ReactNode {
  // Highlight opening "Term Name (ACRONYM)" definition pattern if present near the start
  const match = sentence.match(/^([^.():]{3,65}?)\s*\(([^()]{2,20})\)(.*)$/);
  if (match) {
    const [, termName, acronym, rest] = match;
    return (
      <>
        <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{termName.trim()}</strong>
        <span className="edu-acronym-badge">{acronym.trim()}</span>
        {renderInlineTokens(rest, 'lead-rest')}
      </>
    );
  }
  return renderInlineTokens(sentence, 'lead');
}

function splitOverviewSentences(overview: string): string[] {
  if (!overview) return [];
  const normalized = overview.trim();
  // Protect common multi-part abbreviations before splitting on sentence periods
  const placeholders: [RegExp, string][] = [
    [/\bz\.\s*B\./g, 'z.\u00A0B.'],
    [/\be\.g\./gi, 'e\u00A0g.'],
    [/\bi\.e\./gi, 'i\u00A0e.'],
    [/\bca\./gi, 'ca\u00A0'],
    [/\bvs\./gi, 'vs\u00A0'],
  ];
  let safe = normalized;
  for (const [rgx, rep] of placeholders) {
    safe = safe.replace(rgx, rep);
  }

  const rawSentences = safe
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜŠĐČĆŽŚŹŻŁА-ЯЉЊЋЂЏЈ0-9])/)
    .map(s => s.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  return rawSentences.length > 0 ? rawSentences : [normalized];
}

function renderKeyPointContent(point: string, idx: number): React.ReactNode {
  const colonIdx = point.indexOf(':');
  if (colonIdx > 0 && colonIdx < 52) {
    const head = point.slice(0, colonIdx + 1);
    const body = point.slice(colonIdx + 1);
    return (
      <div>
        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {renderInlineTokens(head, `kp-h-${idx}`)}
        </strong>
        {renderInlineTokens(body, `kp-b-${idx}`)}
      </div>
    );
  }
  return <div>{renderInlineTokens(point, `kp-${idx}`)}</div>;
}

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

  const overviewSentences = splitOverviewSentences(overview);
  const leadSentence = overviewSentences[0] || '';
  const bodySentences = overviewSentences.slice(1);

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
          gap: '1.25rem',
          '--edu-topic-accent': categoryColor
        } as React.CSSProperties}
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
                topic.standardUrl ? (
                  <a
                    href={topic.standardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge edu-spec-badge-link"
                    title={t('app.educationCenter.modal.viewSpec', 'Open official specification ({{spec}})', { spec: topic.standardRef })}
                  >
                    <span>{topic.standardRef}</span>
                    <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.8 }} />
                  </a>
                ) : (
                  <span className="badge" style={{ fontSize: '0.74rem', background: 'var(--input-bg)' }}>
                    {topic.standardRef}
                  </span>
                )
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
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, var(--card-bg) 100%)',
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
        <div className="glass-card edu-overview-card">
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <BookOpen size={16} style={{ color: categoryColor }} />
            {t('app.educationCenter.modal.overview', 'Technical Overview')}
          </h4>

          {leadSentence && (
            <div className="edu-overview-lead">
              {renderLeadSentence(leadSentence)}
            </div>
          )}

          {bodySentences.length > 0 && (
            <div className="edu-overview-clauses">
              {bodySentences.map((sentence, idx) => (
                <div key={idx} className="edu-overview-clause">
                  <span className="edu-overview-clause-dot" aria-hidden="true" />
                  <span>{renderInlineTokens(sentence, `ov-${idx}`)}</span>
                </div>
              ))}
            </div>
          )}

          {(topicId === 'pem' || topicId === 'csr') && (
            <div className="edu-pem-anatomy" aria-label="PEM structure preview">
              <div className="edu-pem-anatomy-row">
                <span className="edu-pem-anatomy-code">
                  {topicId === 'csr' ? '-----BEGIN CERTIFICATE REQUEST-----' : '-----BEGIN CERTIFICATE-----'}
                </span>
                <span className="edu-pem-anatomy-label">ASCII Header</span>
              </div>
              <div className="edu-pem-anatomy-row">
                <span className="edu-pem-anatomy-code payload">
                  {topicId === 'csr'
                    ? 'MIICvDCCAaQCAQAwdzELMAkGA1UEBhMC...'
                    : 'MIIDXTCCAkWgAwIBAgIJALa8f9x2Mm5K...'}
                </span>
                <span className="edu-pem-anatomy-label">Base64 &larr; DER (ASN.1)</span>
              </div>
              <div className="edu-pem-anatomy-row">
                <span className="edu-pem-anatomy-code">
                  {topicId === 'csr' ? '-----END CERTIFICATE REQUEST-----' : '-----END CERTIFICATE-----'}
                </span>
                <span className="edu-pem-anatomy-label">ASCII Footer</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Key Mechanics & Architecture */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <CategoryIcon size={16} style={{ color: categoryColor }} />
            {t('app.educationCenter.modal.keyMechanics', 'Key Mechanics & Architecture')}
          </h4>
          <ul className="edu-keypoint-list">
            {keyPoints.map((point, idx) => (
              <li key={idx} className="edu-keypoint-item">
                <span className="edu-keypoint-bullet" aria-hidden="true">{idx + 1}</span>
                {renderKeyPointContent(point, idx)}
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
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {renderInlineTokens(securityImpact, 'sec')}
          </p>
        </div>

      </div>
    </div>
  );
}
