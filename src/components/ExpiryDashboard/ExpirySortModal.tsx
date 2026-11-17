import { memo, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, Check, ChevronDown, ChevronUp, X } from 'lucide-react'

import type { SortColumn } from './expiry-helpers'
import { SORT_COLUMNS } from './expiry-helpers'

import styles from './ExpirySortModal.module.css'

export interface ExpirySortModalProps {
  isOpen: boolean
  sortCol: SortColumn
  sortAsc: boolean
  onSelectColumn: (col: SortColumn) => void
  onToggleDirection: () => void
  onClose: () => void
}

export const ExpirySortModal = memo(function ExpirySortModal({
  isOpen,
  sortCol,
  sortAsc,
  onSelectColumn,
  onToggleDirection,
  onClose,
}: ExpirySortModalProps) {
  const { t } = useTranslation()
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const closeLabel = t('app.educationCenter.modal.close', 'Close')
  const directionTitle = sortAsc
    ? t('app.dashboard.sortAscending', 'Ascending order')
    : t('app.dashboard.sortDescending', 'Descending order')
  const directionLabel = sortAsc
    ? t('app.dashboard.orderAsc', 'Ascending')
    : t('app.dashboard.orderDesc', 'Descending')

  return createPortal(
    <>
      <div className={styles.sortBackdrop} role="presentation" onClick={onClose} />
      <div className={styles.sortSheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.sortSheetHandle} aria-hidden="true" />

        <div className={styles.sortSheetHeader}>
          <div className={styles.sortSheetTitleWrap}>
            <div className={styles.sortSheetTitleIcon} aria-hidden="true">
              <ArrowUpDown size={15} />
            </div>
            <h2 id={titleId} className={styles.sortSheetTitle}>
              {t('app.dashboard.selectSortField', 'Sort Certificates')}
            </h2>
          </div>

          <div className={styles.sortSheetActions}>
            <button
              type="button"
              className={styles.sortSheetDirBtn}
              onClick={onToggleDirection}
              title={directionTitle}
            >
              {sortAsc ? (
                <ChevronUp size={13} aria-hidden="true" />
              ) : (
                <ChevronDown size={13} aria-hidden="true" />
              )}
              <span>{directionLabel}</span>
            </button>

            <button
              type="button"
              className={styles.sortSheetCloseBtn}
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <ul className={styles.sortSheetOptions} role="listbox" aria-labelledby={titleId}>
          {SORT_COLUMNS.map((item) => {
            const Icon = item.icon
            const isActive = sortCol === item.col
            const label = t(item.labelKey, item.defaultLabel)

            return (
              <li key={item.col} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.sortSheetOption} ${isActive ? styles.sortSheetOptionActive : ''}`}
                  onClick={() => onSelectColumn(item.col)}
                >
                  <span className={styles.sortSheetOptLeft}>
                    <span
                      className={`${styles.sortSheetOptIcon} ${isActive ? styles.sortSheetOptIconActive : ''}`}
                      aria-hidden="true"
                    >
                      <Icon size={16} />
                    </span>
                    <span className={styles.sortSheetOptDetails}>
                      <span className={styles.sortSheetOptLabel}>{label}</span>
                      {isActive && (
                        <span className={styles.sortSheetOptHint}>{directionLabel}</span>
                      )}
                    </span>
                  </span>

                  {isActive && (
                    <span className={styles.sortSheetActivePill} aria-hidden="true">
                      <span>{sortAsc ? '↑' : '↓'}</span>
                      <Check size={14} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>,
    document.body,
  )
})
