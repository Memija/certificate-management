import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Monitor, RefreshCw, Shield, ShieldCheck } from 'lucide-react'

import { ModuleHeader } from '@/components/shared'
import type { AppMode, StoreLocation, StoreName, WinCertEntry } from '@/types'
import { fetchLocalApiJson } from '@/utils/api-client'

import {
  classifyWinStoreError,
  filterAndSortWinCerts,
  indexWinCerts,
  type SortOption,
  STORES,
  type TimelineFilterType,
} from './win-cert-helpers'
import { WinCertFilterBar } from './WinCertFilterBar'
import { WinCertListCard } from './WinCertListCard'
import { StoreIcon, WinCertStoreTabs } from './WinCertStoreTabs'

import styles from './WinCertStoreInspector.module.css'

export interface WinCertStoreInspectorProps {
  onNavigate?: (mode: AppMode) => void
}

const SKELETON_IDS = ['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const

export function WinCertStoreInspector(_props?: WinCertStoreInspectorProps) {
  const { t } = useTranslation()
  const [location, setLocation] = useState<StoreLocation>('CurrentUser')
  const [activeStore, setActiveStore] = useState<StoreName>('Root')
  const [certs, setCerts] = useState<WinCertEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsElevation, setNeedsElevation] = useState(false)
  const [isElevating, setElevating] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [sortAsc, setSortAsc] = useState(true)
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterType>('all')
  const hasLoadedRef = useRef(false)
  const sessionCacheRef = useRef<Map<string, WinCertEntry[]>>(new Map())

  const fetchStore = useCallback(
    async (store: StoreName, loc: StoreLocation, elevate = false, refresh = false) => {
      const cacheKey = `${loc}:${store}`
      if (refresh || elevate) {
        sessionCacheRef.current.clear()
      } else {
        const cached = sessionCacheRef.current.get(cacheKey)
        if (cached) {
          setError('')
          setNeedsElevation(false)
          setCerts(cached)
          setLoading(false)
          setElevating(false)
          return
        }
      }

      setError('')
      if (!elevate) {
        setNeedsElevation(false)
      }
      if (elevate) {
        setElevating(true)
      } else {
        setLoading(true)
      }

      try {
        const url = `/api/certstore?store=${store}&location=${loc}${elevate ? '&elevate=true' : ''}${refresh ? '&refresh=true' : ''}`
        const json = await fetchLocalApiJson<{ data: WinCertEntry[] }>(url)
        const loaded = json.data ?? []
        sessionCacheRef.current.set(cacheKey, loaded)
        setNeedsElevation(false)
        setCerts(loaded)
      } catch (err: unknown) {
        const classified = classifyWinStoreError(err, elevate)
        if (classified.isFallback) {
          const { getWebFallbackCertStore } =
            await import('@/utils/web-fallbacks/cert-store-fallback')
          const fallbackCerts = getWebFallbackCertStore(store, loc)
          sessionCacheRef.current.set(cacheKey, fallbackCerts)
          setNeedsElevation(false)
          setCerts(fallbackCerts)
        } else if (classified.needsElevation) {
          console.warn('Certificate store read requires Administrator elevation:', err)
          setNeedsElevation(true)
        } else {
          console.error('Certificate store read failed:', err)
          setError(classified.errorKeyOrMessage)
        }
      } finally {
        setLoading(false)
        setElevating(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      void fetchStore('Root', 'CurrentUser')
    }
  }, [fetchStore])

  const handleLocationChange = useCallback(
    (nextLoc: StoreLocation) => {
      if (nextLoc === location) {
        return
      }
      setLocation(nextLoc)
      setSearch('')
      if (!sessionCacheRef.current.has(`${nextLoc}:${activeStore}`)) {
        setCerts([])
      }
      void fetchStore(activeStore, nextLoc)
    },
    [activeStore, fetchStore, location],
  )

  const handleStoreChange = useCallback(
    (nextStore: StoreName) => {
      if (nextStore === activeStore) {
        return
      }
      setActiveStore(nextStore)
      setSearch('')
      if (!sessionCacheRef.current.has(`${location}:${nextStore}`)) {
        setCerts([])
      }
      void fetchStore(nextStore, location)
    },
    [activeStore, fetchStore, location],
  )

  const deferredSearch = useDeferredValue(search)

  const indexedCerts = useMemo(() => indexWinCerts(certs), [certs])

  const filtered = useMemo(
    () => filterAndSortWinCerts(indexedCerts, deferredSearch, timelineFilter, sortBy, sortAsc),
    [indexedCerts, deferredSearch, timelineFilter, sortBy, sortAsc],
  )

  const handleSortByChange = useCallback((nextSort: SortOption) => {
    setSortBy(nextSort)
    setSortAsc(true)
  }, [])

  const handleToggleSortAsc = useCallback(() => {
    setSortAsc((prev) => !prev)
  }, [])

  const storeInfo = STORES.find((item) => item.name === activeStore) ?? STORES[0]!
  const storeLabel = t(`app.winCertStore.stores.${storeInfo.name}.label`, storeInfo.defaultLabel)
  const storeDesc = t(`app.winCertStore.stores.${storeInfo.name}.desc`, storeInfo.defaultDesc)
  const resolvedErrorText = error === 'userCanceled' ? t('app.adminAccess.userCanceled') : error

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <ModuleHeader
          category="systemCheck"
          icon={<Monitor size={26} />}
          eyebrowIcon={<ShieldCheck size={14} />}
          eyebrowText={t('app.categories.systemCheck', 'System Check')}
          title={t('app.header.winCertTitle', 'Windows Certificate Store Inspector')}
          description={t(
            'app.header.winCertSubtitle',
            'Browse, filter, and inspect certificates installed in CurrentUser and LocalMachine stores.',
          )}
          actions={
            !needsElevation ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void fetchStore(activeStore, location, false, true)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin' : undefined} aria-hidden="true" />
                <span>{t('app.winCertStore.refresh', 'Refresh')}</span>
              </button>
            ) : undefined
          }
        />

        <WinCertStoreTabs
          location={location}
          activeStore={activeStore}
          onLocationChange={handleLocationChange}
          onStoreChange={handleStoreChange}
        />

        {needsElevation ? (
          <div className={`glass-panel ${styles.elevationPanel}`}>
            {isElevating ? (
              <>
                <Loader2 size={56} className={`spin ${styles.elevatingIcon}`} aria-hidden="true" />
                <h2 className={styles.elevatingTitle}>{t('app.adminAccess.waiting')}</h2>
                <p>{t('app.adminAccess.checkTaskbar')}</p>
              </>
            ) : (
              <>
                <AlertTriangle size={56} className={styles.dangerBannerIcon} aria-hidden="true" />
                <h2>{t('app.adminAccess.title')}</h2>
                <p className={styles.elevationDesc}>
                  <Trans
                    i18nKey="app.adminAccess.localMachineDesc"
                    components={[<strong key="localmachine" />]}
                  />
                </p>
                {Boolean(error) && (
                  <p className={styles.elevationError} role="alert">
                    {resolvedErrorText}
                  </p>
                )}
                <button
                  type="button"
                  className={`btn ${styles.unlockBtn}`}
                  onClick={() => void fetchStore(activeStore, location, true)}
                >
                  <Shield size={16} aria-hidden="true" />
                  <span>{t('app.adminAccess.unlockLocalMachine')}</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <section className={`glass-panel ${styles.storeInfoPanel}`}>
              <div className={`metric-icon-wrap info ${styles.storeInfoIconWrap}`}>
                <StoreIcon storeName={storeInfo.name} tone={storeInfo.tone} size={18} />
              </div>
              <div className={styles.storeInfoText}>
                <h2 className={styles.storeInfoTitle}>{storeLabel}</h2>
                <p className={styles.storeInfoDesc}>{storeDesc}</p>
              </div>
            </section>

            {loading && (
              <div
                className={`animate-fade-in ${styles.skeletonWrap}`}
                role="status"
                aria-live="polite"
              >
                <div className="metric-cards-grid">
                  {SKELETON_IDS.map((id) => (
                    <div key={id} className={`${styles.skeletonPulse} ${styles.skeletonStat}`} />
                  ))}
                </div>
                {SKELETON_IDS.map((id) => (
                  <div
                    key={`card-${id}`}
                    className={`${styles.skeletonPulse} ${styles.skeletonCard}`}
                  />
                ))}
              </div>
            )}

            {!loading && Boolean(error) && (
              <div className={`glass-panel ${styles.errorPanel}`} role="alert">
                <AlertTriangle size={40} className={styles.dangerBannerIcon} aria-hidden="true" />
                <h3 className={styles.errorHeading}>{t('common.error', 'Error')}</h3>
                <p>{resolvedErrorText}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                <WinCertFilterBar
                  certs={certs}
                  filteredCount={filtered.length}
                  timelineFilter={timelineFilter}
                  onTimelineFilterChange={setTimelineFilter}
                  search={search}
                  onSearchChange={setSearch}
                  sortBy={sortBy}
                  onSortByChange={handleSortByChange}
                  sortAsc={sortAsc}
                  onToggleSortAsc={handleToggleSortAsc}
                />

                {certs.length === 0 ? (
                  <div className={`glass-panel ${styles.emptyPanel}`}>
                    <ShieldCheck size={44} className={styles.emptyIcon} aria-hidden="true" />
                    <h3 className={styles.emptyTitle}>
                      {t('app.winCertStore.emptyTitle', 'No Certificates Found')}
                    </h3>
                    <p>
                      <Trans i18nKey="app.winCertStore.emptyDesc" values={{ storeLabel, location }}>
                        The <strong>{'{{storeLabel}}'}</strong> store is empty for {'{{location}}'}.
                      </Trans>
                    </p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className={`glass-panel ${styles.emptyPanel}`}>
                    {t('app.winCertStore.filters.noMatch', 'No certificates match your filter.')}
                  </div>
                ) : (
                  <div>
                    {filtered.map((cert) => (
                      <WinCertListCard
                        key={cert.thumbprint}
                        entry={cert}
                        search={deferredSearch}
                        activeStore={activeStore}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
