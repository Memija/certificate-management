import { create } from 'zustand'

import type { EffectiveTheme, SystemSettingsPayload, ThemePreference } from '@/types'
import {
  getInitialThemePreference,
  resolveEffectiveTheme,
  setUserThemePreference,
} from '@/utils/system-settings'

export interface ThemeState {
  theme: ThemePreference
  effectiveTheme: EffectiveTheme
  setTheme: (theme: ThemePreference) => void
  cycleTheme: () => void
  syncWithSystem: (sys?: SystemSettingsPayload) => void
}

function applyThemeToDocument(effectiveTheme: EffectiveTheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }
}

const initialTheme = getInitialThemePreference()
const initialEffectiveTheme = resolveEffectiveTheme(initialTheme)
applyThemeToDocument(initialEffectiveTheme)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  effectiveTheme: initialEffectiveTheme,
  setTheme: (theme: ThemePreference) => {
    setUserThemePreference(theme)
    const effectiveTheme = resolveEffectiveTheme(theme)
    applyThemeToDocument(effectiveTheme)
    set({ theme, effectiveTheme })
  },
  cycleTheme: () => {
    const current = get().theme
    const next: ThemePreference =
      current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark'
    get().setTheme(next)
  },
  syncWithSystem: (sys?: SystemSettingsPayload) => {
    const current = get().theme
    const effectiveTheme = resolveEffectiveTheme(current, sys)
    applyThemeToDocument(effectiveTheme)
    set({ effectiveTheme })
  },
}))
