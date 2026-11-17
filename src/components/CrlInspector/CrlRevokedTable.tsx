import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Search, ShieldAlert, X } from 'lucide-react'

import { useToast } from '@/components/shared'
import type { ParsedCRL } from '@/types'
import { normalizeForSearch } from '@/utils/text-search'

import type { ReasonTone } from './crl-helpers'
import { formatCrlDate, getReasonKey, REASON_CONFIGS } from './crl-helpers'

import styles from './CrlRevokedTable.module.css'

export interface CrlRevokedTableProps {
  crl: ParsedCRL
}

const PAGE_SIZE = 20

const REASON_TONE_CLASSES: Record<ReasonTone, string> = {
  danger: styles.reasonDanger,
  info: styles.reasonInfo,
  warning: styles.reasonWarning,
  purple: styles.reasonPurple,
  success: styles.reasonSuccess,
  neutral: styles.reasonNeutral,
}

function SerialCopyButton({ serialNumber }: { serialNumber: string }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copyLabel = `${t('common.copyToClipboard', 'Copy to clipboard')}: ${serialNumber}`

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serialNumber)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      setCopied(true)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 1500)
    } catch (err) {
      console.error('Failed to copy serial number:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copyLabel}
      title={t('common.copyToClipboard', 'Copy to clipboard')}
      className={`${styles.copyIconBtn} ${copied ? styles.copyIconBtnSuccess : ''}`}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  )
}

export const CrlRevokedTable = memo(function CrlRevokedTable({ crl }: CrlRevokedTableProps) {
  const { t, i18n } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [currentPage, setCurrentPage] = useState(1)

  const localizedReasonLookup = useMemo(() => {
    const map: Record<string, { lower: string; norm: string }> = {}
    for (const key of Object.keys(REASON_CONFIGS)) {
      const text = t(`app.crl.reasons.${key}`, key).toLowerCase()
      map[key] = { lower: text, norm: normalizeForSearch(text) }
    }
    return map
  }, [t])

  const filteredRevoked = useMemo(() => {
    if (!deferredSearchTerm.trim()) {
      return crl.revokedCertificates
    }
    const rawQ = deferredSearchTerm.trim().toLowerCase()
    const normQ = normalizeForSearch(rawQ)
    const trimmedQ = rawQ.replace(/^0+/, '')

    return crl.revokedCertificates.filter((item) => {
      const serial = item.serialNumber.toLowerCase()
      if (serial.includes(rawQ)) {
        return true
      }
      if (trimmedQ && serial.replace(/^0+/, '').includes(trimmedQ)) {
        return true
      }

      const rawDate = (item.revocationDate || '').toLowerCase()
      if (rawDate.includes(rawQ)) {
        return true
      }

      const reasonKey = getReasonKey(item.reason)
      const locEntry = localizedReasonLookup[reasonKey]
      if (
        locEntry &&
        (locEntry.lower.includes(rawQ) || (Boolean(normQ) && locEntry.norm.includes(normQ)))
      ) {
        return true
      }
      if (
        item.reason.toLowerCase().includes(rawQ) ||
        (Boolean(normQ) && normalizeForSearch(item.reason).includes(normQ))
      ) {
        return true
      }

      if (formatCrlDate(item.revocationDate, i18n.language).toLowerCase().includes(rawQ)) {
        return true
      }

      return false
    })
  }, [crl.revokedCertificates, deferredSearchTerm, localizedReasonLookup, i18n.language])

  const totalPages = Math.max(1, Math.ceil(filteredRevoked.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const currentSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredRevoked.slice(start, start + PAGE_SIZE)
  }, [filteredRevoked, safePage])

  const searchPlaceholder = t('app.crl.searchPlaceholder', 'Search by serial or reason...')
  const clearLabel = t('common.clear', 'Clear')

  return (
    <div className="glass-card">
      <div className={styles.tableTopRow}>
        <h3 className={styles.sectionHeadingInline}>
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            {t('app.crl.revokedEntriesTitle', 'Revoked Certificate Entries')} (
            {filteredRevoked.length})
          </span>
        </h3>

        {crl.revokedCertificates.length > 0 && (
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={`form-input ${styles.searchInput}`}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setCurrentPage(1)
                }}
                title={clearLabel}
                aria-label={clearLabel}
                className={styles.searchClearBtn}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {filteredRevoked.length === 0 ? (
        <div className={styles.emptyTableMsg}>
          {crl.revokedCertificates.length === 0
            ? t('app.crl.noRevokedCerts', 'This CRL currently lists no revoked certificates.')
            : t(
                'app.crl.noMatchingRevokedCerts',
                'No revoked certificates match your search query.',
              )}
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className={styles.crlTable}>
              <thead>
                <tr>
                  <th scope="col">{t('app.crl.serialNumberHex', 'Serial Number (Hex)')}</th>
                  <th scope="col">{t('app.crl.revocationDate', 'Revocation Date')}</th>
                  <th scope="col">{t('app.crl.reasonCode', 'Reason Code')}</th>
                </tr>
              </thead>
              <tbody>
                {currentSlice.map((entry) => {
                  const reasonKey = getReasonKey(entry.reason)
                  const localizedReason = reasonKey
                    ? t(`app.crl.reasons.${reasonKey}`, entry.reason)
                    : entry.reason
                  const config = REASON_CONFIGS[reasonKey] ?? REASON_CONFIGS.unspecified
                  const ReasonIcon = config.Icon

                  return (
                    <tr key={`${entry.serialNumber}-${entry.revocationDate}`}>
                      <td className={styles.serialCell}>
                        <span className={styles.serialRow}>
                          <span>{entry.serialNumber}</span>
                          <SerialCopyButton serialNumber={entry.serialNumber} />
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {formatCrlDate(entry.revocationDate, i18n.language)}
                      </td>
                      <td>
                        <span
                          className={`${styles.reasonBadge} ${REASON_TONE_CLASSES[config.tone]}`}
                        >
                          <ReasonIcon size={12} aria-hidden="true" />
                          <span>{localizedReason}</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationBar}>
              <div>
                {t('app.crl.pageInfo', {
                  current: safePage,
                  total: totalPages,
                  defaultValue: `Page ${safePage} of ${totalPages}`,
                })}
              </div>
              <div className={styles.paginationBtns}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  {t('app.crl.previous', 'Previous')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('app.crl.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
})
