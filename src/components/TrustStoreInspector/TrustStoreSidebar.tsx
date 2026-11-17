import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileKey, Lock, Search, Shield, X } from 'lucide-react'

import type { TrustStoreEntry } from '@/types'
import { formatExpiry } from '@/utils/expiry-formatter'
import { matchesSearch } from '@/utils/text-search'

import { getEntryKey, isSameEntry } from './trust-store-helpers'

import styles from './TrustStoreEntry.module.css'

export interface TrustStoreSidebarProps {
  entries: TrustStoreEntry[]
  selectedEntry: TrustStoreEntry | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectEntry: (entry: TrustStoreEntry) => void
}

export const TrustStoreSidebar = memo(function TrustStoreSidebar({
  entries,
  selectedEntry,
  searchQuery,
  onSearchChange,
  onSelectEntry,
}: TrustStoreSidebarProps) {
  const { t, i18n } = useTranslation()

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return entries
    }
    return entries.filter((entry) =>
      matchesSearch(
        [
          entry.alias,
          entry.certificate.subject,
          entry.certificate.issuer,
          entry.certificate.serialNumber,
          entry.certificate.fingerprintSha1,
          entry.certificate.fingerprintSha256,
        ],
        searchQuery,
      ),
    )
  }, [entries, searchQuery])

  const searchPlaceholder = t(
    'app.winCertStore.filters.searchPlaceholder',
    'Filter by subject, issuer, or thumbprint…',
  )
  const clearLabel = t('common.clear', 'Clear')

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarSearchWrap}>
        <Search size={14} className={styles.sidebarSearchIcon} aria-hidden="true" />
        <input
          type="text"
          className={`form-input ${styles.sidebarSearchInput}`}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            className={styles.sidebarSearchClear}
            onClick={() => onSearchChange('')}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {filteredEntries.length === 0 ? (
        <div className={styles.sidebarNoMatch}>
          {t('app.winCertStore.filters.noMatch', 'No certificates match your filter.')}
        </div>
      ) : (
        <div className={styles.sidebarList}>
          {filteredEntries.map((entry) => {
            const isSelected = isSameEntry(selectedEntry, entry)
            const expiryText = formatExpiry(entry.certificate.validTo, t, i18n.language)

            return (
              <button
                key={getEntryKey(entry)}
                type="button"
                className={`${styles.certListItem} ${isSelected ? styles.certListItemActive : ''}`}
                onClick={() => onSelectEntry(entry)}
              >
                <div className={styles.certItemTop}>
                  <Shield
                    size={14}
                    className={isSelected ? styles.iconAccent : styles.iconMuted}
                    aria-hidden="true"
                  />
                  <span className={styles.certItemAlias}>{entry.alias}</span>
                  {Boolean(entry.privateKeyPem) && (
                    <FileKey size={13} className={styles.iconDanger} aria-hidden="true" />
                  )}
                  {Boolean(entry.isEncryptedJksKey && !entry.privateKeyPem) && (
                    <Lock size={13} className={styles.iconWarning} aria-hidden="true" />
                  )}
                </div>
                <div className={styles.certItemMeta}>
                  {entry.certificate.isExpired ? (
                    <span className={styles.certItemExpired}>
                      {t('app.certDetails.expired', 'Expired')} ({expiryText})
                    </span>
                  ) : (
                    <span>
                      {t('app.trustStore.inspector.validTo', 'Valid to {{date}}', {
                        date: new Date(entry.certificate.validTo).toLocaleDateString(i18n.language),
                      })}{' '}
                      ({expiryText})
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
