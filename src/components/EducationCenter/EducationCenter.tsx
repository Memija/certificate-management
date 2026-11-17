import React, { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpen, Layers, Search, X } from 'lucide-react'

import { ModuleHeader } from '@/components/shared'
import { EDUCATION_TOPICS } from '@/data'
import { useAppStore } from '@/store'
import type { AppMode, EducationCategory, TermId } from '@/types'
import { matchesSearch } from '@/utils/text-search'

import type { TextSegment } from './education-helpers'
import { EDUCATION_CATEGORIES, extractTermCardContent, parseCardTokens } from './education-helpers'
import { EducationTopicModal } from './EducationTopicModal'

import styles from './EducationCenter.module.css'

export interface EducationCenterProps {
  onNavigate?: (mode: AppMode) => void
}

type FilterCategory = 'all' | EducationCategory

function renderCardSegments(segments: readonly TextSegment[], keyPrefix: string): React.ReactNode {
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

export function EducationCenter({ onNavigate }: EducationCenterProps = {}) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<FilterCategory>('all')
  const [selectedTopicId, setSelectedTopicId] = useState<TermId | null>(null)

  const { t } = useTranslation()
  const storeSetMode = useAppStore((state) => state.setMode)
  const navigate = onNavigate ?? storeSetMode

  const deferredSearch = useDeferredValue(search)

  const filterTerms = useMemo(() => {
    return (keys: readonly TermId[]): TermId[] => {
      if (!deferredSearch.trim()) {
        return [...keys]
      }
      return keys.filter((key) => {
        const defaultTitle = EDUCATION_TOPICS[key]?.title ?? ''
        const topicTitle = t(`app.educationCenter.topicDetails.${key}.title`, defaultTitle)
        const text = t(`app.learningTerms.${key}`, '')
        let altTitle = ''

        if (key === 'x509') {
          altTitle = 'X.509'
        } else {
          const firstPeriodIdx = text.indexOf('.')
          if (firstPeriodIdx > 0 && firstPeriodIdx < 60) {
            altTitle = text.slice(0, firstPeriodIdx)
          }
        }

        return matchesSearch([key, topicTitle, defaultTitle, altTitle, text], deferredSearch)
      })
    }
  }, [deferredSearch, t])

  const visibleCategories = useMemo(
    () =>
      EDUCATION_CATEGORIES.filter(
        (category) => selectedCat === 'all' || category.id === selectedCat,
      ),
    [selectedCat],
  )

  const totalVisibleCount = useMemo(
    () =>
      visibleCategories.reduce((acc, category) => {
        return acc + filterTerms(category.keys).length
      }, 0),
    [filterTerms, visibleCategories],
  )

  const handleCloseModal = useCallback(() => {
    setSelectedTopicId(null)
  }, [])

  const searchPlaceholder = t(
    'app.educationCenter.searchPlaceholder',
    'Search topics, acronyms, or concepts...',
  )
  const clearLabel = t('app.educationCenter.clearSearch', t('common.clear', 'Clear'))
  const x509Title = t('app.educationCenter.topicDetails.x509.title', 'X.509 Standard')
  const learnMoreLabel = t('app.educationCenter.learnMore', 'Learn more & deep dive')

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="learning"
        icon={<BookOpen size={26} />}
        eyebrowIcon={<BookOpen size={14} />}
        eyebrowText={t('app.categories.learning', 'Education & Learning')}
        title={t('app.educationCenter.title', t('app.nav.education-center', 'Education Center'))}
        description={t(
          'app.educationCenter.subtitle',
          'Learn the core concepts behind PKI, digital certificates, and Secure Boot. Browse the glossary below to understand the terminology used throughout the application.',
        )}
      />

      <div className={`glass-panel ${styles.searchBar}`}>
        <Search size={18} aria-hidden="true" className={styles.searchIcon} />
        <input
          type="text"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`form-input ${styles.searchInput}`}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className={styles.searchClearBtn}
            title={clearLabel}
          >
            <X size={14} aria-hidden="true" />
            <span>{clearLabel}</span>
          </button>
        )}
      </div>

      <div className={styles.filterBar}>
        <button
          type="button"
          aria-pressed={selectedCat === 'all'}
          className={`${styles.filterPill} ${selectedCat === 'all' ? styles.filterPillActive : ''}`}
          data-category="all"
          onClick={() => setSelectedCat('all')}
        >
          <Layers size={14} aria-hidden="true" className={styles.filterPillIcon} />
          <span>{t('app.educationCenter.allTopics', 'All Topics')}</span>
        </button>

        {EDUCATION_CATEGORIES.map((category) => {
          const Icon = category.icon
          const isActive = selectedCat === category.id
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isActive}
              className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
              data-category={category.id}
              onClick={() => setSelectedCat(category.id)}
            >
              <Icon size={14} aria-hidden="true" className={styles.filterPillIcon} />
              <span>{t(`app.learningCategories.${category.translationKey}`)}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.categoriesStack}>
        {visibleCategories.map((category) => {
          const visibleKeys = filterTerms(category.keys)
          if (visibleKeys.length === 0) {
            return null
          }

          const Icon = category.icon
          const headingId = `edu-cat-${category.id}`

          return (
            <section
              key={category.id}
              className={`animate-fade-in ${styles.categorySection}`}
              data-category={category.id}
              aria-labelledby={headingId}
            >
              <h2 id={headingId} className={styles.categoryHeading}>
                <Icon size={20} aria-hidden="true" className={styles.categoryIcon} />
                <span>{t(`app.learningCategories.${category.translationKey}`)}</span>
              </h2>

              <div className={styles.cardsGrid}>
                {visibleKeys.map((key) => {
                  const rawText = t(`app.learningTerms.${key}`, '')
                  const { title: termTitle, definition: termDef } = extractTermCardContent(
                    key,
                    rawText,
                    x509Title,
                  )
                  const cardTitleId = `edu-topic-${key}`

                  return (
                    <article key={key} className={`glass-card ${styles.topicCard}`}>
                      <h3 id={cardTitleId} className={styles.cardHeading}>
                        <button
                          type="button"
                          className={styles.cardTitleBtn}
                          onClick={() => setSelectedTopicId(key)}
                        >
                          {termTitle}
                        </button>
                      </h3>

                      <p className={styles.cardDef}>
                        {renderCardSegments(parseCardTokens(termDef), key)}
                      </p>

                      <div className={styles.cardFooter}>
                        <button
                          type="button"
                          className={styles.learnMoreBtn}
                          aria-describedby={cardTitleId}
                          onClick={() => setSelectedTopicId(key)}
                        >
                          <span>{learnMoreLabel}</span>
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}

        {totalVisibleCount === 0 && (
          <div className={`glass-panel ${styles.emptyState}`}>
            <Search size={44} aria-hidden="true" className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {t('app.educationCenter.noTermsFound', 'No terms found matching "{{search}}"', {
                search,
              })}
            </p>
          </div>
        )}
      </div>

      <EducationTopicModal
        topicId={selectedTopicId}
        onClose={handleCloseModal}
        onNavigate={navigate}
        onSelectTopic={setSelectedTopicId}
      />
    </div>
  )
}
