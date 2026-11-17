import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Shield } from 'lucide-react'

import { ModuleHeader, useToast } from '@/components/shared'
import type { ExpiryDashboardCertEntry } from '@/types'
import { fetchLocalApiJson } from '@/utils/api-client'

import type { SortColumn } from './expiry-helpers'
import {
  collectFallbackExpiryCerts,
  isWebFallbackError,
  sortIndexedCerts,
  summarizeAndIndexCerts,
} from './expiry-helpers'
import { ExpirySortModal } from './ExpirySortModal'
import { ExpiryTableAndCards } from './ExpiryTableAndCards'

import styles from './ExpiryDashboard.module.css'

async function loadExpiryCerts(refresh: boolean): Promise<ExpiryDashboardCertEntry[]> {
  try {
    const json = await fetchLocalApiJson<{ data?: ExpiryDashboardCertEntry[] }>(
      `/api/certstore?batch=expiry${refresh ? '&refresh=true' : ''}`,
    )
    return json.data ?? []
  } catch (apiErr: unknown) {
    if (isWebFallbackError(apiErr)) {
      const { getWebFallbackCertStore } = await import('@/utils/web-fallbacks')
      return collectFallbackExpiryCerts(getWebFallbackCertStore)
    }
    throw apiErr
  }
}

export function ExpiryDashboard() {
  const [certs, setCerts] = useState<ExpiryDashboardCertEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('expiry')
  const [sortAsc, setSortAsc] = useState(true)
  const [isSortOpen, setIsSortOpen] = useState(false)

  const { t } = useTranslation()
  const { showToast } = useToast()
  const actionHeadingId = useId()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    let active = true

    loadExpiryCerts(false)
      .then((data) => {
        if (active) {
          setCerts(data)
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to scan certificate stores for expiry dashboard:', err)
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      isMountedRef.current = false
    }
  }, [])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    setError('')

    loadExpiryCerts(true)
      .then((data) => {
        if (isMountedRef.current) {
          setCerts(data)
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to refresh certificate stores for expiry dashboard:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setLoading(false)
        }
      })
  }, [])

  const { expiredCount, expiringSoonCount, indexedCerts, isSortable } = useMemo(
    () => summarizeAndIndexCerts(certs),
    [certs],
  )

  const sortedCerts = useMemo(
    () => sortIndexedCerts(indexedCerts, sortCol, sortAsc),
    [indexedCerts, sortCol, sortAsc],
  )

  const handleSortHeader = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortAsc((prev) => !prev)
      } else {
        setSortCol(col)
        setSortAsc(true)
      }
    },
    [sortCol],
  )

  const handleModalSelectColumn = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortAsc((prev) => !prev)
      } else {
        setSortCol(col)
      }
      setIsSortOpen(false)
    },
    [sortCol],
  )

  const handleToggleDirection = useCallback(() => {
    setSortAsc((prev) => !prev)
  }, [])

  const handleToggleSortModal = useCallback(() => {
    setIsSortOpen((prev) => !prev)
  }, [])

  const handleCloseSortModal = useCallback(() => {
    setIsSortOpen(false)
  }, [])

  const handleCopyThumbprint = useCallback(
    (thumbprint: string, certName: string) => {
      void navigator.clipboard
        .writeText(thumbprint)
        .then(() => {
          showToast(
            t('app.dashboard.copiedThumbprint', {
              name: certName,
              defaultValue: `Copied thumbprint for ${certName}`,
            }),
            'success',
          )
        })
        .catch((err: unknown) => {
          console.error('Failed to copy thumbprint to clipboard:', err)
          showToast(t('common.error', 'Error'), 'error')
        })
    },
    [showToast, t],
  )

  const certCountLabel = t(
    certs.length === 1 ? 'app.dashboard.certCount_one' : 'app.dashboard.certCount_other',
    {
      count: certs.length,
      defaultValue: `${certs.length} ${certs.length === 1 ? 'certificate' : 'certificates'}`,
    },
  )

  const totalTooltip = `${t('app.dashboard.totalActionItems', 'Total Action Items')}: ${t('app.dashboard.totalActionItemsSub', 'Expired + Expiring Soon')}`

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="systemCheck"
        icon={<Clock size={26} />}
        eyebrowIcon={<Shield size={14} />}
        eyebrowText={t('app.categories.systemCheck', 'System Check')}
        title={t('app.nav.expiry-dashboard', 'Certificate Expiry Dashboard')}
        description={t(
          'app.dashboard.subtitle',
          'Overview of certificates that are expired or expiring within 30 days in your CurrentUser and LocalMachine stores.',
        )}
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? 'spin' : undefined} />
            <span>
              {loading
                ? t('app.dashboard.scanning', 'Scanning certificate stores...')
                : t('app.winCertStore.refresh', 'Refresh')}
            </span>
          </button>
        }
      />

      {error && (
        <div className={`glass-panel ${styles.errorAlert}`} role="alert">
          {error}
        </div>
      )}

      <div className="metric-cards-grid">
        <div className="metric-card">
          <div
            className={`metric-icon-wrap ${expiredCount > 0 ? 'danger' : 'success'}`}
            aria-hidden="true"
          >
            <AlertCircle size={24} />
          </div>
          <div className={styles.metricInfo}>
            <div
              className={`${styles.metricVal} ${expiredCount > 0 ? styles.metricValDanger : styles.metricValSuccess}`}
            >
              {expiredCount}
            </div>
            <div className={styles.metricLabel}>
              {t('app.dashboard.expiredCount', 'Expired Certificates')}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div
            className={`metric-icon-wrap ${expiringSoonCount > 0 ? 'warning' : 'success'}`}
            aria-hidden="true"
          >
            <Clock size={24} />
          </div>
          <div className={styles.metricInfo}>
            <div
              className={`${styles.metricVal} ${expiringSoonCount > 0 ? styles.metricValWarning : styles.metricValSuccess}`}
            >
              {expiringSoonCount}
            </div>
            <div className={styles.metricLabel}>
              {t('app.dashboard.expiringSoonCount', 'Expiring Soon (<30 days)')}
            </div>
          </div>
        </div>

        <div className="metric-card" title={totalTooltip}>
          <div className="metric-icon-wrap info" aria-hidden="true">
            <Shield size={24} />
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricVal}>{certs.length}</div>
            <div className={styles.metricLabel}>
              {t('app.dashboard.totalActionItems', 'Total Action Items')}
            </div>
          </div>
        </div>
      </div>

      <section className="glass-panel" aria-labelledby={actionHeadingId}>
        <div className={styles.panelHeader}>
          <h2 id={actionHeadingId} className={styles.panelTitle}>
            <Shield size={18} aria-hidden="true" />
            <span>{t('app.dashboard.actionItems', 'Action Items')}</span>
          </h2>
          <span className={`badge ${styles.countBadge}`}>{certCountLabel}</span>
        </div>

        {loading ? (
          <div className={`animate-fade-in ${styles.skeletonList}`} aria-busy="true">
            <div className={`${styles.skeletonRow} ${styles.skeletonHeaderRow}`} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        ) : certs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={`metric-icon-wrap success ${styles.emptyIconWrap}`} aria-hidden="true">
              <CheckCircle2 size={32} />
            </div>
            <h3 className={styles.emptyTitle}>{t('app.dashboard.allClear', 'All Clear!')}</h3>
            <p className={styles.emptyDesc}>
              {t(
                'app.dashboard.noCertsDesc',
                'No expired or expiring certificates found in your CurrentUser or LocalMachine stores.',
              )}
            </p>
          </div>
        ) : (
          <>
            <ExpiryTableAndCards
              certs={sortedCerts}
              isSortable={isSortable}
              sortCol={sortCol}
              sortAsc={sortAsc}
              isSortOpen={isSortOpen}
              onSortHeader={handleSortHeader}
              onToggleDirection={handleToggleDirection}
              onToggleSortModal={handleToggleSortModal}
              onCopyThumbprint={handleCopyThumbprint}
            />
            <ExpirySortModal
              isOpen={isSortOpen}
              sortCol={sortCol}
              sortAsc={sortAsc}
              onSelectColumn={handleModalSelectColumn}
              onToggleDirection={handleToggleDirection}
              onClose={handleCloseSortModal}
            />
          </>
        )}
      </section>
    </div>
  )
}
