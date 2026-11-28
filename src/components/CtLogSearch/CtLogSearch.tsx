import type React from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, RefreshCw, Search, Trash2, XCircle } from 'lucide-react'

import { ModuleHeader, type SamplePresetItem, SamplePresetsBar } from '@/components/shared'
import { CT_LOG_PRESETS } from '@/data/ct-log-samples'
import type { AppMode, CtEntry, CtLogPreset, CtLogProvider } from '@/types'
import { fetchLocalApiJson } from '@/utils/api-client'

import {
  CT_PAGE_SIZE,
  type CtFilterStatus,
  type CtProviderInfo,
  deduplicateAndSortCtEntries,
  isWebFallbackError,
} from './ct-log-helpers'
import { CtLogResultsTable } from './CtLogResultsTable'

import styles from './CtLogSearch.module.css'

export interface CtLogSearchProps {
  onNavigate?: (mode: AppMode) => void
}

interface LocalCtApiResponse {
  data?: CtEntry[]
  provider?: CtLogProvider
  rateLimited?: boolean
}

export function CtLogSearch(_props: CtLogSearchProps = {}) {
  const { t } = useTranslation()
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<CtEntry[] | null>(null)
  const [searchedDomain, setSearchedDomain] = useState('')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<CtFilterStatus>('all')
  const [filterQuery, setFilterQuery] = useState('')
  const [isSampleData, setIsSampleData] = useState(false)
  const [providerInfo, setProviderInfo] = useState<CtProviderInfo | null>(null)
  const [visibleCount, setVisibleCount] = useState(CT_PAGE_SIZE)
  const [referenceTimeMs, setReferenceTimeMs] = useState<number>(() => Date.now())

  const executeSearch = useCallback(
    async (targetDomain: string, preset?: CtLogPreset): Promise<void> => {
      const trimmed = targetDomain.trim()
      if (!trimmed) {
        setError(
          t(
            'app.ctLog.emptyDomainError',
            'Please enter a valid domain name (e.g. google.com or github.com).',
          ),
        )
        return
      }

      setLoading(true)
      setError('')
      setSearchedDomain(trimmed)
      setVisibleCount(CT_PAGE_SIZE)
      setReferenceTimeMs(Date.now())

      try {
        let response: LocalCtApiResponse
        try {
          response = await fetchLocalApiJson<LocalCtApiResponse>(
            `/api/ctsearch?domain=${encodeURIComponent(trimmed)}`,
          )
        } catch (apiErr: unknown) {
          if (isWebFallbackError(apiErr)) {
            const { searchCtLogsClientSide } = await import('@/utils/web-fallbacks')
            response = await searchCtLogsClientSide(trimmed, preset)
          } else {
            throw apiErr
          }
        }

        const sorted = deduplicateAndSortCtEntries(response.data ?? [], preset?.sampleData)
        const resolvedProvider: CtLogProvider = response.provider ?? 'crt.sh'

        setResults(sorted)
        setIsSampleData(resolvedProvider === 'sample')
        setProviderInfo({
          provider: resolvedProvider,
          rateLimited: Boolean(response.rateLimited),
        })
      } catch (err: unknown) {
        console.warn('CT log search failed, checking sample fallback:', err)
        if (preset && preset.sampleData.length > 0) {
          setResults(deduplicateAndSortCtEntries([], preset.sampleData))
          setIsSampleData(true)
          setProviderInfo({
            provider: 'sample',
            rateLimited: true,
          })
          setError('')
        } else {
          const fallbackError = t(
            'app.ctLog.searchFailedError',
            'Failed to fetch CT logs from crt.sh. The service may be experiencing high traffic.',
          )
          const errMsg = err instanceof Error && err.message ? err.message : fallbackError
          setError(errMsg)
          setResults(null)
          setIsSampleData(false)
          setProviderInfo(null)
        }
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  const searchLogs = (): void => {
    const matchedPreset = CT_LOG_PRESETS.find(
      (p) => p.domain.toLowerCase() === domain.trim().toLowerCase(),
    )
    void executeSearch(domain, matchedPreset)
  }

  const handleSelectPreset = (preset: CtLogPreset): void => {
    setDomain(preset.domain)
    setActivePresetId(preset.id)
    setFilterStatus('all')
    setFilterQuery('')
    void executeSearch(preset.domain, preset)
  }

  const handleClear = (): void => {
    setDomain('')
    setActivePresetId(null)
    setResults(null)
    setSearchedDomain('')
    setError('')
    setIsSampleData(false)
    setProviderInfo(null)
    setFilterQuery('')
    setFilterStatus('all')
    setVisibleCount(CT_PAGE_SIZE)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      searchLogs()
    }
  }

  const handleFilterStatusChange = useCallback((status: CtFilterStatus): void => {
    setFilterStatus(status)
    setVisibleCount(CT_PAGE_SIZE)
  }, [])

  const handleFilterQueryChange = useCallback((query: string): void => {
    setFilterQuery(query)
    setVisibleCount(CT_PAGE_SIZE)
  }, [])

  const handleLoadMore = useCallback((): void => {
    setVisibleCount((prev) => prev + CT_PAGE_SIZE)
  }, [])

  const clearLabel = t('app.ctLog.clearBtn', 'Clear')
  const queryTitle = t('app.ctLog.queryTitle', 'Domain / Subdomain Query')
  const hasDomainOrResults = Boolean(domain || results)

  const presetItems: SamplePresetItem[] = CT_LOG_PRESETS.map((preset) => {
    const isActive =
      activePresetId === preset.id || domain.toLowerCase() === preset.domain.toLowerCase()
    const presetName = preset.isSpecial
      ? preset.domain
      : t(`app.ctLog.presets.${preset.id}.name`, preset.domain)
    const presetBadge = preset.isSpecial
      ? undefined
      : t(`app.ctLog.presets.${preset.id}.badge`, preset.domain)
    const presetDesc = t(
      `app.ctLog.presets.${preset.id}.desc`,
      `Search CT logs for ${preset.domain}`,
    )

    return {
      id: preset.id,
      buttonId: `ct-preset-${preset.domain.replace(/[^a-zA-Z0-9]/g, '-')}`,
      label: presetName,
      badge: presetBadge,
      badgeTone: preset.badgeType ?? 'info',
      title: presetDesc,
      isActive,
      isSpecial: preset.isSpecial,
      isMonoLabel: Boolean(preset.isSpecial),
      onSelect: () => handleSelectPreset(preset),
    }
  })

  return (
    <div className={styles.wrapper}>
      <ModuleHeader
        category="networkStatus"
        eyebrowIcon={<Globe size={14} />}
        eyebrowText={t('app.ctLog.eyebrow', 'Public Audit & RFC 6962')}
        title={t('app.ctLog.title', 'Certificate Transparency (CT) Log Search')}
        description={t(
          'app.ctLog.subtitle',
          'Search public Certificate Transparency (CT) logs to discover all certificates ever issued for a specific domain name or wildcard.',
        )}
        icon={<Search size={26} />}
      >
        <span className="badge badge-info">
          {t('app.learningCategories.protocols', 'Protocols & Infrastructure')}
        </span>
      </ModuleHeader>

      <SamplePresetsBar
        items={presetItems}
        showClear={hasDomainOrResults}
        clearLabel={clearLabel}
        clearTitle={clearLabel}
        onClear={handleClear}
      />

      <div className={`glass-panel ${styles.queryPanel}`}>
        <h2 className={styles.queryTitle}>
          <Globe size={18} className={styles.accentIcon} aria-hidden="true" />
          <span>{queryTitle}</span>
        </h2>

        <div className={styles.queryRow}>
          <div className={styles.queryInputWrap}>
            <input
              id="ct-domain-query-input"
              type="text"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value)
                setActivePresetId(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder={t(
                'app.ctLog.placeholder',
                'e.g. google.com, github.com, or *.wikipedia.org',
              )}
              aria-label={queryTitle}
              className={`form-input ${domain ? styles.queryInputHasValue : ''}`}
            />
            {domain && (
              <button
                type="button"
                onClick={() => setDomain('')}
                className={styles.inlineClearBtn}
                aria-label={clearLabel}
                title={clearLabel}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`btn btn-primary ${styles.searchActionBtn}`}
            onClick={searchLogs}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={16} className="spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
            <span>
              {loading
                ? t('app.ctLog.searchingBtn', 'Searching Logs...')
                : t('app.ctLog.searchBtn', 'Search CT Logs')}
            </span>
          </button>
        </div>

        {error && (
          <div role="alert" className={`glass-panel ${styles.errorAlert}`}>
            <XCircle size={16} className={styles.shrinkZero} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {results && (
        <CtLogResultsTable
          results={results}
          searchedDomain={searchedDomain}
          isSampleData={isSampleData}
          providerInfo={providerInfo}
          filterStatus={filterStatus}
          filterQuery={filterQuery}
          visibleCount={visibleCount}
          referenceTimeMs={referenceTimeMs}
          onFilterStatusChange={handleFilterStatusChange}
          onFilterQueryChange={handleFilterQueryChange}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  )
}
