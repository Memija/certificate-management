import type React from 'react'
import { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Search,
  Shield,
  X,
  XCircle,
} from 'lucide-react'

import type { WinCertEntry } from '@/types'

import { computeCertStoreStats, type SortOption, type TimelineFilterType } from './win-cert-helpers'

import styles from './WinCertFilterBar.module.css'

export interface WinCertFilterBarProps {
  certs: readonly WinCertEntry[]
  filteredCount: number
  timelineFilter: TimelineFilterType
  onTimelineFilterChange: (filter: TimelineFilterType) => void
  search: string
  onSearchChange: (value: string) => void
  sortBy: SortOption
  onSortByChange: (sort: SortOption) => void
  sortAsc: boolean
  onToggleSortAsc: () => void
}

interface SortMeta {
  id: SortOption
  labelKey: string
  defaultLabel: string
  renderIcon: (size: number, className?: string) => React.ReactNode
}

const SORT_OPTIONS: readonly SortMeta[] = [
  {
    id: 'default',
    labelKey: 'app.winCertStore.filters.sortDefault',
    defaultLabel: 'Default Store Order',
    renderIcon: (size, className) => (
      <Layers size={size} className={className} aria-hidden="true" />
    ),
  },
  {
    id: 'expiry',
    labelKey: 'app.dashboard.colExpiryDate',
    defaultLabel: 'Expiry Date',
    renderIcon: (size, className) => <Clock size={size} className={className} aria-hidden="true" />,
  },
  {
    id: 'name',
    labelKey: 'app.dashboard.colCertificate',
    defaultLabel: 'Subject Name',
    renderIcon: (size, className) => <Award size={size} className={className} aria-hidden="true" />,
  },
]

export const WinCertFilterBar = memo(function WinCertFilterBar({
  certs,
  filteredCount,
  timelineFilter,
  onTimelineFilterChange,
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortAsc,
  onToggleSortAsc,
}: WinCertFilterBarProps) {
  const { t } = useTranslation()
  const [isSortOpen, setIsSortOpen] = useState(false)

  const stats = useMemo(() => computeCertStoreStats(certs), [certs])

  useEffect(() => {
    if (!isSortOpen) {
      return undefined
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsSortOpen(false)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSortOpen])

  const isFilterDisabled = certs.length <= 1
  const isSortDisabled = certs.length <= 1 || filteredCount <= 1

  const statItems: readonly {
    id: TimelineFilterType
    label: string
    value: number
    tone: string
    icon: React.ReactNode
  }[] = [
    {
      id: 'all',
      label: t('app.winCertStore.stats.total', 'Total In Store'),
      value: stats.total,
      tone: 'info',
      icon: <Shield size={22} aria-hidden="true" />,
    },
    {
      id: 'valid',
      label: t('app.winCertStore.stats.valid', 'Valid Certificates'),
      value: stats.valid,
      tone: 'success',
      icon: <CheckCircle size={22} aria-hidden="true" />,
    },
    {
      id: '30days',
      label: t('app.winCertStore.stats.expiringSoon', 'Expiring Soon (<30d)'),
      value: stats.expiringSoon,
      tone: 'warning',
      icon: <AlertTriangle size={22} aria-hidden="true" />,
    },
    {
      id: 'expired',
      label: t('app.winCertStore.stats.expired', 'Expired Certificates'),
      value: stats.expired,
      tone: 'danger',
      icon: <XCircle size={22} aria-hidden="true" />,
    },
  ]

  const activeSortMeta = SORT_OPTIONS.find((opt) => opt.id === sortBy) ?? SORT_OPTIONS[0]!
  const sortDirectionTitle = sortAsc
    ? t('app.dashboard.sortAscending', 'Ascending order')
    : t('app.dashboard.sortDescending', 'Descending order')
  const searchPlaceholder = t(
    'app.winCertStore.filters.searchPlaceholder',
    'Filter by subject, issuer, or thumbprint…',
  )
  const sortDialogLabel = t('app.dashboard.selectSortField', 'Sort Certificates')
  const closeLabel = t('common.cancel', 'Cancel')

  return (
    <>
      <div className={`metric-cards-grid ${styles.statsGrid}`}>
        {statItems.map((item) => {
          const active = !isFilterDisabled && timelineFilter === item.id
          return (
            <button
              key={item.id}
              type="button"
              disabled={isFilterDisabled}
              aria-pressed={active}
              onClick={() => onTimelineFilterChange(item.id)}
              className={`metric-card ${styles.statBtn} ${active ? styles.statBtnActive : ''}`}
            >
              <div className={`metric-icon-wrap ${item.tone}`}>{item.icon}</div>
              <div className={styles.metricInfo}>
                <div className={styles.metricVal}>{item.value}</div>
                <div className={styles.metricLabel}>{item.label}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search
            size={15}
            className={`${styles.searchIcon} ${isFilterDisabled ? styles.searchIconDisabled : ''}`}
            aria-hidden="true"
          />
          <input
            id="wincert-search-input"
            type="search"
            className={`form-input ${styles.searchInput}`}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isFilterDisabled}
          />
        </div>

        <div className={styles.sortDesktop}>
          <label
            htmlFor="wincert-sort-select"
            className={`${styles.sortLabel} ${isSortDisabled ? styles.sortLabelDisabled : ''}`}
          >
            {t('app.winCertStore.filters.sortBy', 'Sort by:')}
          </label>
          <select
            id="wincert-sort-select"
            className={`form-select ${styles.sortSelect}`}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
            disabled={isSortDisabled}
          >
            <option value="default">
              {t('app.winCertStore.filters.sortDefault', 'Default Store Order')}
            </option>
            <option value="expiry">
              {t('app.winCertStore.filters.sortExpiry', 'Expiry Date (Soonest first)')}
            </option>
            <option value="name">
              {t('app.winCertStore.filters.sortName', 'Subject Name (Alphabetical)')}
            </option>
          </select>
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${styles.sortDirBtn}`}
            onClick={onToggleSortAsc}
            disabled={isSortDisabled}
            title={sortDirectionTitle}
          >
            {sortAsc ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
            <span>{sortAsc ? 'ASC' : 'DESC'}</span>
          </button>
        </div>

        <div className={styles.sortMobile}>
          <span className={`${styles.sortLabel} ${isSortDisabled ? styles.sortLabelDisabled : ''}`}>
            {t('app.winCertStore.filters.sortBy', 'Sort by:')}
          </span>
          <div className={styles.sortActions}>
            <button
              type="button"
              className={`${styles.sortTrigger} ${isSortOpen ? styles.sortTriggerActive : ''}`}
              onClick={() => setIsSortOpen((prev) => !prev)}
              disabled={isSortDisabled}
              aria-expanded={isSortOpen}
              aria-haspopup="dialog"
              title={t('app.winCertStore.filters.sortBy', 'Sort by')}
            >
              {activeSortMeta.renderIcon(13, styles.sortTriggerIcon)}
              <span className={styles.sortTriggerText}>
                {t(activeSortMeta.labelKey, activeSortMeta.defaultLabel)}
              </span>
              <ChevronDown
                size={13}
                className={`${styles.sortChevron} ${isSortOpen ? styles.sortChevronOpen : ''}`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className={`btn btn-secondary btn-sm ${styles.sortDirBtn}`}
              onClick={onToggleSortAsc}
              disabled={isSortDisabled}
              title={sortDirectionTitle}
            >
              {sortAsc ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
              <span>{sortAsc ? 'ASC' : 'DESC'}</span>
            </button>
          </div>
        </div>
      </div>

      {isSortOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              role="presentation"
              className={styles.sortBackdrop}
              onClick={() => setIsSortOpen(false)}
            />
            <div
              className={styles.sortSheet}
              role="dialog"
              aria-modal="true"
              aria-label={sortDialogLabel}
            >
              <div className={styles.sheetHandle} aria-hidden="true" />

              <div className={styles.sheetHeader}>
                <div className={styles.sheetTitleWrap}>
                  <div className={styles.sheetTitleIcon}>
                    <ArrowUpDown size={15} aria-hidden="true" />
                  </div>
                  <span className={styles.sheetTitle}>{sortDialogLabel}</span>
                </div>

                <div className={styles.sheetHeaderActions}>
                  <button
                    type="button"
                    className={styles.sheetDirBtn}
                    onClick={onToggleSortAsc}
                    title={sortDirectionTitle}
                  >
                    {sortAsc ? (
                      <ChevronUp size={13} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={13} aria-hidden="true" />
                    )}
                    <span>{sortAsc ? 'ASC' : 'DESC'}</span>
                  </button>

                  <button
                    type="button"
                    className={styles.sheetCloseBtn}
                    onClick={() => setIsSortOpen(false)}
                    aria-label={closeLabel}
                    title={closeLabel}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className={styles.sheetOptions} role="listbox" aria-label={sortDialogLabel}>
                {SORT_OPTIONS.map((item) => {
                  const isActive = sortBy === item.id
                  const label = t(item.labelKey, item.defaultLabel)
                  const dirText = sortAsc
                    ? t('app.dashboard.orderAsc', 'Ascending')
                    : t('app.dashboard.orderDesc', 'Descending')

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`${styles.sheetOption} ${isActive ? styles.sheetOptionActive : ''}`}
                      onClick={() => {
                        if (isActive) {
                          onToggleSortAsc()
                        } else {
                          onSortByChange(item.id)
                        }
                        setIsSortOpen(false)
                      }}
                    >
                      <div className={styles.sheetOptLeft}>
                        <div
                          className={`${styles.sheetOptIcon} ${isActive ? styles.sheetOptIconActive : ''}`}
                        >
                          {item.renderIcon(16)}
                        </div>
                        <div className={styles.sheetOptDetails}>
                          <span className={styles.sheetOptLabel}>{label}</span>
                          {isActive && <span className={styles.sheetOptHint}>{dirText}</span>}
                        </div>
                      </div>

                      {isActive && (
                        <div className={styles.sheetActivePill}>
                          <span>{sortAsc ? '↑' : '↓'}</span>
                          <Check size={14} aria-hidden="true" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
})
