import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Server, Shield, ShieldCheck, User, XCircle } from 'lucide-react'

import type { StoreLocation, StoreName } from '@/types'

import { STORE_LOCATIONS, STORES, type StoreTone } from './win-cert-helpers'

import styles from './WinCertStoreInspector.module.css'

export interface StoreIconProps {
  storeName: StoreName
  tone: StoreTone
  active?: boolean
  size?: number
}

const TONE_CLASS_MAP: Record<StoreTone, string> = {
  success: styles.toneIconSuccess,
  cyan: styles.toneIconCyan,
  purple: styles.toneIconPurple,
  warning: styles.toneIconWarning,
  danger: styles.toneIconDanger,
}

export const StoreIcon = memo(function StoreIcon({
  storeName,
  tone,
  active = false,
  size = 16,
}: StoreIconProps) {
  const className = active ? styles.toneIconActive : TONE_CLASS_MAP[tone]

  switch (storeName) {
    case 'Root':
      return <Shield size={size} className={className} aria-hidden="true" />
    case 'CA':
      return <ShieldCheck size={size} className={className} aria-hidden="true" />
    case 'My':
      return <User size={size} className={className} aria-hidden="true" />
    case 'TrustedPublisher':
      return <CheckCircle size={size} className={className} aria-hidden="true" />
    case 'Disallowed':
      return <XCircle size={size} className={className} aria-hidden="true" />
  }
})

export interface WinCertStoreTabsProps {
  location: StoreLocation
  activeStore: StoreName
  onLocationChange: (location: StoreLocation) => void
  onStoreChange: (store: StoreName) => void
}

export const WinCertStoreTabs = memo(function WinCertStoreTabs({
  location,
  activeStore,
  onLocationChange,
  onStoreChange,
}: WinCertStoreTabsProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.topSection}>
      <div className={styles.locationBar}>
        <span className={styles.locationLabel}>
          <Shield size={14} className={styles.accentIcon} aria-hidden="true" />
          <span>{t('app.winCertStore.storeLocation', 'Store Location:')}</span>
        </span>
        <div
          className={styles.locationSegmented}
          role="group"
          aria-label={t('app.winCertStore.storeLocation', 'Store Location')}
        >
          {STORE_LOCATIONS.map((loc) => {
            const locLabel = t(`app.winCertStore.locations.${loc}`, loc)
            const isActive = location === loc
            return (
              <button
                key={loc}
                type="button"
                aria-pressed={isActive}
                className={`${styles.locationBtn} ${isActive ? styles.locationBtnActive : ''}`}
                onClick={() => onLocationChange(loc)}
                title={locLabel}
              >
                {loc === 'CurrentUser' ? (
                  <User size={13} aria-hidden="true" />
                ) : (
                  <Server size={13} aria-hidden="true" />
                )}
                <span>{locLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={styles.storeTabsContainer}
        role="group"
        aria-label={t('app.nav.win-cert-store', 'Win Cert Store')}
      >
        {STORES.map((store) => {
          const active = activeStore === store.name
          const storeLabel = t(`app.winCertStore.stores.${store.name}.label`, store.defaultLabel)

          return (
            <button
              key={store.name}
              type="button"
              data-store={store.name}
              aria-pressed={active}
              onClick={() => onStoreChange(store.name)}
              className={`${styles.storeTabBtn} ${active ? styles.storeTabBtnActive : ''}`}
              title={storeLabel}
            >
              <StoreIcon storeName={store.name} tone={store.tone} active={active} size={16} />
              <span className={styles.storeTabLabel}>{storeLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
