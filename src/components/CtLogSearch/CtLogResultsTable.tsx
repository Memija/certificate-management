import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Search,
  Shield,
} from 'lucide-react'

import { useToast } from '@/components/shared'
import type { CtEntry } from '@/types'
import { formatExpiry, formatExpiryTooltip } from '@/utils/expiry-formatter'

import {
  type CtFilterStatus,
  type CtProviderInfo,
  formatCtIssuer,
  isCtEntryExpired,
} from './ct-log-helpers'

import styles from './CtLogSearch.module.css'

export interface CtLogResultsTableProps {
  results: CtEntry[]
  searchedDomain: string
  isSampleData: boolean
  providerInfo: CtProviderInfo | null
  filterStatus: CtFilterStatus
  filterQuery: string
  visibleCount: number
  referenceTimeMs: number
  onFilterStatusChange: (status: CtFilterStatus) => void
  onFilterQueryChange: (query: string) => void
  onLoadMore: () => void
}

export function CtLogResultsTable({
  results,
  searchedDomain,
  isSampleData,
  providerInfo,
  filterStatus,
  filterQuery,
  visibleCount,
  referenceTimeMs,
  onFilterStatusChange,
  onFilterQueryChange,
  onLoadMore,
}: CtLogResultsTableProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deferredFilterQuery = useDeferredValue(filterQuery)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async (text: string, key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopiedKey(null)
        copiedTimerRef.current = null
      }, 1800)
    } catch (err: unknown) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const counts = useMemo(() => {
    let valid = 0
    let expired = 0
    for (const entry of results) {
      if (isCtEntryExpired(entry.not_after, referenceTimeMs)) {
        expired += 1
      } else {
        valid += 1
      }
    }
    return { all: results.length, valid, expired }
  }, [results, referenceTimeMs])

  const filteredResults = useMemo(() => {
    const query = deferredFilterQuery.trim().toLowerCase()

    return results.filter((entry) => {
      const expired = isCtEntryExpired(entry.not_after, referenceTimeMs)
      if (filterStatus === 'valid' && expired) {
        return false
      }
      if (filterStatus === 'expired' && !expired) {
        return false
      }

      if (query) {
        const matchesCn = entry.common_name?.toLowerCase().includes(query)
        const matchesSan = entry.name_value?.toLowerCase().includes(query)
        const matchesIssuer = entry.issuer_name?.toLowerCase().includes(query)
        const matchesSerial = entry.serial_number?.toLowerCase().includes(query)
        if (!matchesCn && !matchesSan && !matchesIssuer && !matchesSerial) {
          return false
        }
      }

      return true
    })
  }, [results, filterStatus, deferredFilterQuery, referenceTimeMs])

  const visibleResults = useMemo(
    () => filteredResults.slice(0, visibleCount),
    [filteredResults, visibleCount],
  )

  const copyCnLabel = t('app.ctLog.copyCnTooltip', 'Copy Common Name')
  const copySerialLabel = t('app.ctLog.copySerialTooltip', 'Copy Serial Number')
  const filterPlaceholder = t(
    'app.ctLog.filterPlaceholder',
    'Filter results by domain, SAN, or issuer...',
  )

  return (
    <div className="animate-fade-in">
      <div className={styles.resultsHeader}>
        <div>
          <h2 className={styles.resultsTitle}>
            <Trans
              i18nKey="app.ctLog.foundCount"
              values={{ count: filteredResults.length, domain: searchedDomain }}
              components={[<span key="0" className={styles.countAccent} />, <span key="1" />]}
            />
          </h2>

          {isSampleData && (
            <div id="ct-rate-limit-banner" className={styles.statusBannerWarn}>
              <AlertTriangle size={12} className={styles.shrinkZero} aria-hidden="true" />
              <span>
                {t(
                  'app.ctLog.showingCachedSnapshot',
                  'Live CT log services are currently rate-limited (429/502). Displaying bundled verified sample snapshot.',
                )}
              </span>
            </div>
          )}

          {!isSampleData && providerInfo?.rateLimited && (
            <div id="ct-rate-limit-notice" className={styles.statusBannerWarn}>
              <AlertTriangle size={12} className={styles.shrinkZero} aria-hidden="true" />
              <span>
                {t(
                  'app.ctLog.rateLimitFallbackNotice',
                  'Primary log server (crt.sh) rate-limited (429/502). Retrieved via fallback CT provider (CertSpotter).',
                )}
              </span>
            </div>
          )}

          {!isSampleData && providerInfo && !providerInfo.rateLimited && (
            <div id="ct-live-status-pill" className={styles.statusBannerLive}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span>{t('app.ctLog.liveFromCrtSh', 'Live from crt.sh log monitor')}</span>
            </div>
          )}
        </div>

        <div className={styles.filterControls}>
          <div className="segmented-tabs-group">
            <button
              type="button"
              className={`segmented-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => onFilterStatusChange('all')}
            >
              <span>{t('app.ctLog.filterAll', 'All')}</span>
              <span className={styles.tabCountPill}>{counts.all}</span>
            </button>
            <button
              type="button"
              className={`segmented-tab-btn ${
                filterStatus === 'valid' ? `active ${styles.tabAccentValid}` : ''
              }`}
              onClick={() => onFilterStatusChange('valid')}
            >
              <span>{t('app.ctLog.filterValid', 'Active / Valid')}</span>
              <span className={styles.tabCountPill}>{counts.valid}</span>
            </button>
            <button
              type="button"
              className={`segmented-tab-btn ${
                filterStatus === 'expired' ? `active ${styles.tabAccentExpired}` : ''
              }`}
              onClick={() => onFilterStatusChange('expired')}
            >
              <span>{t('app.ctLog.filterExpired', 'Expired')}</span>
              <span className={styles.tabCountPill}>{counts.expired}</span>
            </button>
          </div>

          <div className={styles.filterSearchWrap}>
            <Search size={14} className={styles.filterSearchIcon} aria-hidden="true" />
            <input
              id="ct-results-filter-input"
              type="text"
              value={filterQuery}
              onChange={(e) => onFilterQueryChange(e.target.value)}
              placeholder={filterPlaceholder}
              aria-label={filterPlaceholder}
              className={`form-input ${styles.filterSearchInput}`}
            />
          </div>
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className={`glass-panel ${styles.emptyState}`}>
          <FileText size={38} className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyText}>
            {results.length === 0
              ? t('app.ctLog.emptyResults', 'No transparency logs recorded for this domain.')
              : t('app.ctLog.noFilterMatches', 'No certificates match your search filter.')}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {visibleResults.map((entry) => {
              const expired = isCtEntryExpired(entry.not_after, referenceTimeMs)
              const isCnCopied = copiedKey === `cn-${entry.id}`
              const isSerialCopied = copiedKey === `serial-${entry.id}`

              return (
                <div
                  key={entry.id}
                  className={`glass-card ${styles.entryCard} ${
                    expired ? styles.entryCardExpired : styles.entryCardValid
                  }`}
                >
                  <div className={styles.entryTopRow}>
                    <div className={styles.entryTitleBlock}>
                      <div className={styles.entryCnRow}>
                        <span className={styles.entryCnText}>{entry.common_name}</span>
                        <button
                          type="button"
                          className={`btn btn-secondary btn-sm ${styles.copyCnBtn}`}
                          onClick={() => void handleCopy(entry.common_name, `cn-${entry.id}`)}
                          aria-label={isCnCopied ? undefined : copyCnLabel}
                          title={copyCnLabel}
                        >
                          {isCnCopied ? (
                            <Check size={11} className={styles.copiedIcon} aria-hidden="true" />
                          ) : (
                            <Copy size={11} aria-hidden="true" />
                          )}
                          {isCnCopied && <span>{t('app.ctLog.copied', 'Copied!')}</span>}
                        </button>
                      </div>

                      <div className={styles.issuerRow}>
                        <Shield size={13} className={styles.accentIcon} aria-hidden="true" />
                        <span className={styles.issuerText}>
                          {formatCtIssuer(entry.issuer_name)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.entryBadgesCol}>
                      <span
                        className={`badge ${expired ? 'badge-danger' : 'badge-success'} ${
                          styles.compactBadge
                        }`}
                      >
                        <span className="badge-dot" aria-hidden="true" />
                        <span>
                          {expired
                            ? t('app.ctLog.expiredBadge', 'Expired')
                            : t('app.ctLog.validBadge', 'Valid')}
                        </span>
                      </span>

                      <a
                        href={`https://crt.sh/?id=${entry.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`badge ${styles.crtShLink}`}
                        title={t(
                          'app.ctLog.certIdTooltip',
                          'View complete public certificate log record on crt.sh',
                        )}
                      >
                        <span>#{entry.id}</span>
                        <ExternalLink size={10} aria-hidden="true" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <div className={styles.sanLabel}>
                      {t(
                        'app.ctLog.identityLabel',
                        'Identities & Subject Alternative Names (SANs)',
                      )}
                    </div>
                    <div className={`mono ${styles.sanBox}`}>
                      {entry.name_value.split('\n').join(', ')}
                    </div>
                  </div>

                  <div className={styles.serialRow}>
                    <span className={`mono ${styles.serialText}`}>
                      {t('app.certDetails.serialNumber', 'Serial Number')}: {entry.serial_number}
                    </span>
                    <button
                      type="button"
                      className={styles.copySerialBtn}
                      onClick={() => void handleCopy(entry.serial_number, `serial-${entry.id}`)}
                      aria-label={copySerialLabel}
                      title={copySerialLabel}
                    >
                      {isSerialCopied ? (
                        <Check size={11} className={styles.copiedIcon} aria-hidden="true" />
                      ) : (
                        <Copy size={11} aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  <div className={styles.datesFooter}>
                    <div className={styles.dateItem}>
                      <Calendar size={12} aria-hidden="true" />
                      <span>
                        {t('app.ctLog.issuedLabel', 'Issued')}:{' '}
                        {new Date(entry.not_before).toLocaleDateString(i18n.language)}
                      </span>
                    </div>

                    <div
                      className={styles.dateExpiryItem}
                      title={formatExpiryTooltip(entry.not_after, t, i18n.language)}
                    >
                      <span>
                        {t('app.ctLog.expiresLabel', 'Expires')}:{' '}
                        {new Date(entry.not_after).toLocaleDateString(i18n.language)}
                      </span>
                      <span className={expired ? styles.expiryExpired : styles.expiryValid}>
                        ({formatExpiry(entry.not_after, t, i18n.language)})
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredResults.length > visibleCount && (
            <div className={styles.loadMoreRow}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.loadMoreBtn}`}
                onClick={onLoadMore}
              >
                <ChevronDown size={16} aria-hidden="true" />
                <span>
                  {t('common.loadMore', 'Show More')} ({visibleResults.length} /{' '}
                  {filteredResults.length})
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
