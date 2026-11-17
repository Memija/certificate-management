import React, { memo, useCallback, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, BookOpen, ExternalLink, X } from 'lucide-react'

import { EDUCATION_TOPICS } from '@/data'
import { useAppStore } from '@/store'
import type { AppMode, TermId } from '@/types'

import type { TextSegment } from './education-helpers'
import {
  getEducationCategoryMeta,
  parseLeadSentence,
  parseModalInlineTokens,
  splitKeyPointHeading,
  splitOverviewSentences,
} from './education-helpers'

import styles from './EducationTopicModal.module.css'

export interface EducationTopicModalProps {
  topicId: TermId | null
  onClose: () => void
  onNavigate?: (mode: AppMode) => void
  onSelectTopic?: (id: TermId) => void
}

function renderSegments(segments: readonly TextSegment[], keyPrefix: string): React.ReactNode {
  return segments.map((seg, idx) => {
    const key = `${keyPrefix}-${seg.kind}-${idx}`
    if (seg.kind === 'code') {
      return (
        <code key={key} className={styles.codeChip}>
          {seg.value}
        </code>
      )
    }
    if (seg.kind === 'token') {
      return (
        <span key={key} className={styles.techToken}>
          {seg.value}
        </span>
      )
    }
    return <React.Fragment key={key}>{seg.value}</React.Fragment>
  })
}

function renderLeadSentenceContent(sentence: string): React.ReactNode {
  const parsed = parseLeadSentence(sentence)
  if (parsed) {
    return (
      <>
        <strong className={styles.leadStrong}>{parsed.termName}</strong>
        <span className={styles.acronymBadge}>{parsed.acronym}</span>
        {renderSegments(parseModalInlineTokens(parsed.rest), 'lead-rest')}
      </>
    )
  }
  return renderSegments(parseModalInlineTokens(sentence), 'lead')
}

function renderKeyPointBody(point: string, keyPrefix: string): React.ReactNode {
  const split = splitKeyPointHeading(point)
  if (split) {
    return (
      <div>
        <strong className={styles.keyPointHead}>
          {renderSegments(parseModalInlineTokens(split.head), `${keyPrefix}-h`)}
        </strong>
        {renderSegments(parseModalInlineTokens(split.body), `${keyPrefix}-b`)}
      </div>
    )
  }
  return <div>{renderSegments(parseModalInlineTokens(point), keyPrefix)}</div>
}

export const EducationTopicModal = memo(function EducationTopicModal({
  topicId,
  onClose,
  onNavigate,
}: EducationTopicModalProps) {
  const { t } = useTranslation()
  const storeSetMode = useAppStore((state) => state.setMode)
  const navigate = onNavigate ?? storeSetMode
  const titleId = useId()

  useEffect(() => {
    if (!topicId) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [topicId, onClose])

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  const topic = topicId ? EDUCATION_TOPICS[topicId] : null
  if (!topic || !topicId) {
    return null
  }

  const { icon: CategoryIcon, translationKey: catTranslationKey } = getEducationCategoryMeta(
    topic.category,
  )

  const title = t(`app.educationCenter.topicDetails.${topicId}.title`, topic.title)
  const subtitle = t(`app.educationCenter.topicDetails.${topicId}.subtitle`, topic.subtitle)
  const overview = t(`app.educationCenter.topicDetails.${topicId}.overview`, topic.overview)
  const rawKeyPoints: unknown = t(`app.educationCenter.topicDetails.${topicId}.keyPoints`, {
    returnObjects: true,
  })
  const keyPoints: readonly string[] =
    Array.isArray(rawKeyPoints) &&
    rawKeyPoints.length > 0 &&
    rawKeyPoints.every((item): item is string => typeof item === 'string')
      ? rawKeyPoints
      : topic.keyPoints
  const securityImpact = t(
    `app.educationCenter.topicDetails.${topicId}.securityImpact`,
    topic.securityImpact,
  )
  const relatedMode = topic.relatedAppMode
  const toolLabel = relatedMode
    ? t(`app.educationCenter.modal.toolLabels.${relatedMode.mode}`, relatedMode.label)
    : ''
  const closeLabel = t('app.educationCenter.modal.close', 'Close')

  const overviewSentences = splitOverviewSentences(overview)
  const leadSentence = overviewSentences[0] ?? ''
  const bodySentences = overviewSentences.slice(1)

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleBackdropClick}>
      <div
        className={styles.dialog}
        data-category={topic.category}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.badgeRow}>
              <span className={`badge ${styles.categoryBadge}`}>
                <CategoryIcon size={12} aria-hidden="true" />
                <span>{t(`app.learningCategories.${catTranslationKey}`, topic.category)}</span>
              </span>

              {topic.standardRef &&
                (topic.standardUrl ? (
                  <a
                    href={topic.standardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`badge ${styles.specBadgeLink}`}
                    title={t(
                      'app.educationCenter.modal.viewSpec',
                      'Open official specification ({{spec}})',
                      { spec: topic.standardRef },
                    )}
                  >
                    <span>{topic.standardRef}</span>
                    <ExternalLink
                      size={11}
                      aria-hidden="true"
                      className={styles.specExternalIcon}
                    />
                  </a>
                ) : (
                  <span className={`badge ${styles.specBadgeStatic}`}>{topic.standardRef}</span>
                ))}
            </div>

            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {relatedMode && (
          <div className={`glass-panel ${styles.toolCallout}`}>
            <div>
              <div className={styles.toolEyebrow}>
                {t('app.educationCenter.modal.interactiveDemo', 'Hands-on Inspection Tool')}
              </div>
              <div className={styles.toolDesc}>
                {t(
                  'app.educationCenter.modal.tryInAppDesc',
                  'Inspect and test {{topic}} in the application',
                  { topic: title },
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                navigate(relatedMode.mode)
                onClose()
              }}
            >
              <span>{toolLabel}</span>
              <ExternalLink size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className={`glass-card ${styles.overviewCard}`}>
          <h3 className={styles.sectionTitle}>
            <BookOpen size={16} aria-hidden="true" className={styles.sectionIcon} />
            <span>{t('app.educationCenter.modal.overview', 'Technical Overview')}</span>
          </h3>

          {leadSentence && (
            <div className={styles.overviewLead}>{renderLeadSentenceContent(leadSentence)}</div>
          )}

          {bodySentences.length > 0 && (
            <div className={styles.overviewClauses}>
              {bodySentences.map((sentence, idx) => (
                <div
                  key={`${topicId}-clause-${sentence.slice(0, 20)}-${idx}`}
                  className={styles.overviewClause}
                >
                  <span className={styles.clauseDot} aria-hidden="true" />
                  <span>{renderSegments(parseModalInlineTokens(sentence), `ov-${idx}`)}</span>
                </div>
              ))}
            </div>
          )}

          {(topicId === 'pem' || topicId === 'csr') && (
            <div className={styles.pemAnatomy}>
              <div className={styles.pemAnatomyRow}>
                <span className={styles.pemAnatomyCode}>
                  {topicId === 'csr'
                    ? '-----BEGIN CERTIFICATE REQUEST-----'
                    : '-----BEGIN CERTIFICATE-----'}
                </span>
                <span className={styles.pemAnatomyLabel}>ASCII</span>
              </div>
              <div className={styles.pemAnatomyRow}>
                <span className={styles.pemAnatomyPayload}>
                  {topicId === 'csr'
                    ? 'MIICvDCCAaQCAQAwdzELMAkGA1UEBhMC...'
                    : 'MIIDXTCCAkWgAwIBAgIJALa8f9x2Mm5K...'}
                </span>
                <span className={styles.pemAnatomyLabel}>Base64 &larr; DER (ASN.1)</span>
              </div>
              <div className={styles.pemAnatomyRow}>
                <span className={styles.pemAnatomyCode}>
                  {topicId === 'csr'
                    ? '-----END CERTIFICATE REQUEST-----'
                    : '-----END CERTIFICATE-----'}
                </span>
                <span className={styles.pemAnatomyLabel}>ASCII</span>
              </div>
            </div>
          )}
        </div>

        <div className={`glass-card ${styles.sectionCard}`}>
          <h3 className={styles.sectionTitleSpaced}>
            <CategoryIcon size={16} aria-hidden="true" className={styles.sectionIcon} />
            <span>
              {t('app.educationCenter.modal.keyMechanics', 'Key Mechanics & Architecture')}
            </span>
          </h3>
          <ul className={styles.keyPointList}>
            {keyPoints.map((point, idx) => (
              <li
                key={`${topicId}-kp-${point.slice(0, 20)}-${idx}`}
                className={styles.keyPointItem}
              >
                <span className={styles.keyPointBullet} aria-hidden="true">
                  {idx + 1}
                </span>
                {renderKeyPointBody(point, `kp-${idx}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className={`glass-card ${styles.securityCard}`}>
          <h3 className={styles.dangerTitle}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              {t(
                'app.educationCenter.modal.securityImpact',
                'Security Considerations & Failure Modes',
              )}
            </span>
          </h3>
          <p className={styles.securityText}>
            {renderSegments(parseModalInlineTokens(securityImpact), 'sec')}
          </p>
        </div>
      </div>
    </div>
  )
})
