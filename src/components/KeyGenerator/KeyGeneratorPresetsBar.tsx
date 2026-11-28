import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { type SamplePresetItem, SamplePresetsBar } from '@/components/shared'

import { KEY_GENERATOR_PRESETS, type KeyGeneratorPreset } from './key-generator-helpers'

export interface KeyGeneratorPresetsBarProps {
  activePresetId: KeyGeneratorPreset['id'] | null
  onSelectPreset: (preset: KeyGeneratorPreset) => void
}

export const KeyGeneratorPresetsBar = memo(function KeyGeneratorPresetsBar({
  activePresetId,
  onSelectPreset,
}: KeyGeneratorPresetsBarProps) {
  const { t } = useTranslation()

  const items = useMemo<SamplePresetItem[]>(
    () =>
      KEY_GENERATOR_PRESETS.map((preset) => ({
        id: preset.id,
        label: t(preset.nameKey, preset.defaultName),
        badge: t(preset.badgeKey, preset.defaultBadge),
        badgeTone: 'purple',
        isActive: activePresetId === preset.id,
        onSelect: () => onSelectPreset(preset),
      })),
    [activePresetId, onSelectPreset, t],
  )

  return <SamplePresetsBar items={items} />
})
