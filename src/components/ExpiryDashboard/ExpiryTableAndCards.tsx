import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpDown,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Fingerprint,
  Folder,
  Monitor,
  User,
} from 'lucide-react'

import type { ExpiryDashboardCertEntry } from '@/types'
import { formatExpiry, formatExpiryTooltip } from '@/utils/expiry-formatter'

import type { CertSortability, SortColumn } from './expiry-helpers'
import { extractCertCommonName, getDaysDiff, SORT_COLUMNS } from './expiry-helpers'

import styles from './ExpiryDashboard.module.css'

export interface ExpiryTableAndCardsProps {
  certs: readonly ExpiryDashboardCertEntry[]
  isSortable: CertSortability
  sortCol: SortColumn
  sortAsc: boolean
  isSortOpen: boolean
  onSortHeader: (col: SortColumn) => void
  onToggleDirection: () => void
  onToggleSortModal: () => void
  onCopyThumbprint: (thumbprint: string, certName: string) => void
}

interface SortHeaderCellProps {
  col: SortColumn
  label: string
  widthClass: string
  sortable: boolean
  activeCol: SortColumn
  sortAsc: boolean
  onSort: (col: SortColumn) => void
}

function SortHeaderCell({
  col,
  label,
  widthClass,
  sortable,
  activeCol,
  sortAsc,
  onSort,
}: SortHeaderCellProps) {
  if (!sortable) {
    return (
      <th scope="col" className={widthClass}>
        <span className={styles.thStatic}>{label}</span>
      </th>
    )
  }

  const isActive = activeCol === col
  const ariaSort = isActive ? (sortAsc ? 'ascending' : 'descending') : 'none'

  return (
    <th scope="col" className={widthClass} aria-sort={ariaSort}>
      <button type="button" className={styles.sortHeaderBtn} onClick={() => onSort(col)}>
        <span>{label}</span>
        {!isActive ? (
          <ArrowUpDown size={13} aria-hidden="true" className={styles.sortIconIdle} />
        ) : sortAsc ? (
          <ChevronUp size={13} aria-hidden="true" className={styles.sortIconActive} />
        ) : (
          <ChevronDown size={13} aria-hidden="true" className={styles.sortIconActive} />
        )}
      </button>
    </th>
  )
}

export const ExpiryTableAndCards = memo(function ExpiryTableAndCards({
  certs,
  isSortable,
  sortCol,
  sortAsc,
  isSortOpen,
  onSortHeader,
  onToggleDirection,
  onToggleSortModal,
  onCopyThumbprint,
}: ExpiryTableAndCardsProps) {
  const { t, i18n } = useTranslation()

  const activeColConfig = SORT_COLUMNS.find((item) => item.col === sortCol) ?? SORT_COLUMNS[0]
  const ActiveSortIcon = activeColConfig.icon

  const copyTooltip = t('app.dashboard.copyThumbprint', 'Click to copy thumbprint')
  const expiredLabel = t('app.winCertStore.certCard.expired', 'Expired')
  const expiringSoonLabel = t('app.winCertStore.certCard.expiringSoon', 'Expiring Soon')
  const directionTitle = sortAsc
    ? t('app.dashboard.sortAscending', 'Ascending order')
    : t('app.dashboard.sortDescending', 'Descending order')
  const directionLabel = sortAsc
    ? t('app.dashboard.orderAsc', 'Ascending')
    : t('app.dashboard.orderDesc', 'Descending')

  return (
    <>
      <div className={`table-responsive ${styles.desktopTable}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortHeaderCell
                col="subject"
                label={t('app.dashboard.colCertificate', 'Certificate')}
                widthClass={styles.colCert}
                sortable={isSortable.subject}
                activeCol={sortCol}
                sortAsc={sortAsc}
                onSort={onSortHeader}
              />
              <SortHeaderCell
                col="store"
                label={t('app.dashboard.colStore', 'Store')}
                widthClass={styles.colStore}
                sortable={isSortable.store}
                activeCol={sortCol}
                sortAsc={sortAsc}
                onSort={onSortHeader}
              />
              <SortHeaderCell
                col="expiry"
                label={t('app.dashboard.colExpiryDate', 'Expiry Date')}
                widthClass={styles.colExpiry}
                sortable={isSortable.expiry}
                activeCol={sortCol}
                sortAsc={sortAsc}
                onSort={onSortHeader}
              />
              <SortHeaderCell
                col="status"
                label={t('app.dashboard.colStatus', 'Status')}
                widthClass={styles.colStatus}
                sortable={isSortable.status}
                activeCol={sortCol}
                sortAsc={sortAsc}
                onSort={onSortHeader}
              />
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => {
              const cn = extractCertCommonName(cert.subject)
              const diffDays = getDaysDiff(cert.notAfter)
              const isDanger = diffDays < 0 || cert.isExpired

              return (
                <tr key={`${cert.location}-${cert.storeName}-${cert.thumbprint}`}>
                  <td className={styles.certCell}>
                    <div className={styles.certNameRow}>
                      <Award size={15} aria-hidden="true" className={styles.certAwardIcon} />
                      <strong className={styles.certName}>{cn}</strong>
                    </div>
                    <button
                      type="button"
                      className={styles.copyThumbprintBtn}
                      onClick={() => onCopyThumbprint(cert.thumbprint, cn)}
                      title={copyTooltip}
                    >
                      <Fingerprint size={12} aria-hidden="true" className={styles.thumbprintIcon} />
                      <span className="mono">{cert.thumbprint}</span>
                      <Copy size={11} aria-hidden="true" className={styles.copyIcon} />
                    </button>
                  </td>
                  <td>
                    <div className={styles.storePrimaryRow}>
                      {cert.location === 'LocalMachine' ? (
                        <Monitor size={14} aria-hidden="true" className={styles.storeLocIcon} />
                      ) : (
                        <User size={14} aria-hidden="true" className={styles.storeLocIcon} />
                      )}
                      <span>{t(`app.winCertStore.locations.${cert.location}`, cert.location)}</span>
                    </div>
                    <div className={styles.storeSubRow}>
                      <Folder size={12} aria-hidden="true" className={styles.thumbprintIcon} />
                      <span>
                        {t(`app.winCertStore.stores.${cert.storeName}.label`, cert.storeName)}
                      </span>
                    </div>
                  </td>
                  <td className={styles.expiryCell}>
                    <div className={styles.expiryDate}>
                      {new Date(cert.notAfter).toLocaleDateString(i18n.language)}
                    </div>
                    <div
                      className={`${styles.expiryRelative} ${isDanger ? styles.expiryDanger : styles.expiryWarning}`}
                      title={formatExpiryTooltip(cert.notAfter, t, i18n.language)}
                    >
                      {formatExpiry(cert.notAfter, t, i18n.language)}
                    </div>
                  </td>
                  <td>
                    {cert.isExpired ? (
                      <span className="badge badge-danger">
                        <span className="badge-dot pulse" aria-hidden="true" />
                        {expiredLabel}
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        <span className="badge-dot" aria-hidden="true" />
                        {expiringSoonLabel}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileCardList}>
        <div className={styles.mobileSortBar}>
          <div className={styles.sortLabelGroup}>
            <ArrowUpDown size={14} aria-hidden="true" className={styles.sortLabelIcon} />
            <span className={styles.sortLabel}>
              {t('app.winCertStore.filters.sortBy', 'Sort by:')}
            </span>
          </div>

          <div className={styles.sortActions}>
            <button
              type="button"
              className={`${styles.sortTrigger} ${isSortOpen ? styles.sortTriggerActive : ''}`}
              onClick={onToggleSortModal}
              aria-expanded={isSortOpen}
              aria-haspopup="dialog"
              title={t('app.winCertStore.filters.sortBy', 'Sort by:')}
            >
              <ActiveSortIcon size={13} aria-hidden="true" className={styles.certAwardIcon} />
              <span className={styles.sortTriggerText}>
                {t(activeColConfig.labelKey, activeColConfig.defaultLabel)}
              </span>
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={`${styles.sortChevron} ${isSortOpen ? styles.sortChevronOpen : ''}`}
              />
            </button>

            <button
              type="button"
              className={`btn btn-secondary btn-sm ${styles.sortDirBtn}`}
              onClick={onToggleDirection}
              title={directionTitle}
            >
              {sortAsc ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
              <span>{directionLabel}</span>
            </button>
          </div>
        </div>

        {certs.map((cert) => {
          const cn = extractCertCommonName(cert.subject)
          const diffDays = getDaysDiff(cert.notAfter)
          const isDanger = diffDays < 0 || cert.isExpired
          const expiryColorClass = isDanger ? styles.expiryDanger : styles.expiryWarning

          return (
            <article
              key={`mobile-${cert.location}-${cert.storeName}-${cert.thumbprint}`}
              className={`glass-card ${styles.mobileCard}`}
            >
              <div className={styles.mobileCardTop}>
                <div className={styles.mobileCardTitleWrap}>
                  <Award size={16} aria-hidden="true" className={styles.certAwardIcon} />
                  <strong className={styles.mobileCardTitle}>{cn}</strong>
                </div>
                {cert.isExpired ? (
                  <span className="badge badge-danger">
                    <span className="badge-dot pulse" aria-hidden="true" />
                    {expiredLabel}
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <span className="badge-dot" aria-hidden="true" />
                    {expiringSoonLabel}
                  </span>
                )}
              </div>

              <div className={styles.mobileCardMetaBox}>
                <div className={styles.mobileStoreGroup}>
                  {cert.location === 'LocalMachine' ? (
                    <Monitor size={13} aria-hidden="true" className={styles.storeLocIcon} />
                  ) : (
                    <User size={13} aria-hidden="true" className={styles.storeLocIcon} />
                  )}
                  <span className={styles.mobileStoreLoc}>
                    {t(`app.winCertStore.locations.${cert.location}`, cert.location)}
                  </span>
                  <span className={styles.mobileStoreSep} aria-hidden="true">
                    /
                  </span>
                  <span className={styles.mobileStoreName}>
                    {t(`app.winCertStore.stores.${cert.storeName}.label`, cert.storeName)}
                  </span>
                </div>

                <div className={`${styles.mobileExpiryGroup} ${expiryColorClass}`}>
                  <Clock size={13} aria-hidden="true" />
                  <span>{new Date(cert.notAfter).toLocaleDateString(i18n.language)}</span>
                  <span>({formatExpiry(cert.notAfter, t, i18n.language)})</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.mobileCopyBtn}
                onClick={() => onCopyThumbprint(cert.thumbprint, cn)}
                title={copyTooltip}
              >
                <span className={styles.mobileThumbprintLeft}>
                  <Fingerprint size={12} aria-hidden="true" className={styles.thumbprintIcon} />
                  <span className={`mono ${styles.mobileThumbprintText}`}>{cert.thumbprint}</span>
                </span>
                <span className={styles.mobileCopyRight}>
                  <span>{t('common.copy', 'Copy')}</span>
                  <Copy size={11} aria-hidden="true" />
                </span>
              </button>
            </article>
          )
        })}
      </div>
    </>
  )
})
