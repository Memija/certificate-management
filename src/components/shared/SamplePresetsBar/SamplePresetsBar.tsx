import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Home, Sparkles, Trash2 } from 'lucide-react'

import styles from './SamplePresetsBar.module.css'

export type SamplePresetBadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'purple'

export interface SamplePresetItem {
  id: string
  buttonId?: string
  label: string
  badge?: string
  badgeTone?: SamplePresetBadgeTone
  title?: string
  isActive?: boolean
  isLoaded?: boolean
  isSpecial?: boolean
  isMonoLabel?: boolean
  onSelect: () => void
}

export interface SamplePresetsBarProps {
  label?: string
  items: readonly SamplePresetItem[]
  showClear?: boolean
  clearLabel?: string
  clearTitle?: string
  onClear?: () => void
}

const BADGE_TONE_CLASS: Record<SamplePresetBadgeTone, string> = {
  info: styles.badgeInfo,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  purple: styles.badgePurple,
}

export const SamplePresetsBar = memo(function SamplePresetsBar({
  label,
  items,
  showClear = false,
  clearLabel,
  clearTitle,
  onClear,
}: SamplePresetsBarProps) {
  const { t } = useTranslation()

  const resolvedLabel = label ?? t('common.tryExamples', 'Try Test Examples:')
  const resolvedClearLabel = clearLabel ?? t('common.clear', 'Clear')
  const resolvedClearTitle = clearTitle ?? resolvedClearLabel

  return (
    <div className={`glass-panel animate-fade-in ${styles.presetsBar}`}>
      <div className={styles.presetsHeader}>
        <Sparkles size={15} className={styles.sparkleIcon} aria-hidden="true" />
        <span>{resolvedLabel}</span>
      </div>

      <div className={styles.presetsList}>
        {items.map((item) => {
          const isActive = Boolean(item.isActive)
          const isLoaded = Boolean(item.isLoaded)

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                id={item.buttonId}
                type="button"
                className={`${styles.presetSpecial} ${isActive ? styles.presetSpecialActive : ''}`}
                onClick={item.onSelect}
                title={item.title}
                aria-pressed={isActive}
              >
                <span className={styles.specialIcon} aria-hidden="true">
                  <Home size={13} />
                </span>
                <span className={item.isMonoLabel ? 'mono' : styles.presetLabel}>{item.label}</span>
                <span className={styles.specialSparkle} aria-hidden="true">
                  <Sparkles size={11} />
                </span>
              </button>
            )
          }

          const pillStateClass = isActive
            ? styles.presetPillActive
            : isLoaded
              ? styles.presetPillLoaded
              : ''

          return (
            <button
              key={item.id}
              id={item.buttonId}
              type="button"
              className={`${styles.presetPill} ${pillStateClass}`}
              onClick={item.onSelect}
              title={item.title}
              aria-pressed={isActive}
            >
              {(isActive || isLoaded) && (
                <Check
                  size={12}
                  className={isActive ? styles.activeCheckIcon : styles.loadedCheckIcon}
                  aria-hidden="true"
                />
              )}
              <span className={item.isMonoLabel ? 'mono' : styles.presetLabel}>{item.label}</span>
              {item.badge && (
                <span
                  className={`${styles.presetBadge} ${BADGE_TONE_CLASS[item.badgeTone ?? 'info']}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {showClear && onClear && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          title={resolvedClearTitle}
        >
          <Trash2 size={13} aria-hidden="true" />
          <span>{resolvedClearLabel}</span>
        </button>
      )}
    </div>
  )
})
