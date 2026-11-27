import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

import { KEY_GENERATOR_PRESETS, type KeyGeneratorPreset } from './key-generator-helpers'

import styles from './KeyGeneratorPresetsBar.module.css'

export interface KeyGeneratorPresetsBarProps {
  activePresetId: KeyGeneratorPreset['id'] | null
  onSelectPreset: (preset: KeyGeneratorPreset) => void
}

export const KeyGeneratorPresetsBar = memo(function KeyGeneratorPresetsBar({
  activePresetId,
  onSelectPreset,
}: KeyGeneratorPresetsBarProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.presetsBar}>
      <span className={styles.presetsLabel}>
        <Sparkles size={14} className={styles.iconAccent} aria-hidden="true" />
        <span>{t('app.keyGenerator.tryExamples', 'Try Test Examples:')}</span>
      </span>
      <div className={styles.presetsList}>
        {KEY_GENERATOR_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ''}`}
              aria-pressed={isActive}
              onClick={() => onSelectPreset(preset)}
            >
              <span>{t(preset.nameKey, preset.defaultName)}</span>
              <span className={styles.presetBadge}>{t(preset.badgeKey, preset.defaultBadge)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
