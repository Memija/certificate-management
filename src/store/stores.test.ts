import { describe, expect, it, vi } from 'vitest'

import { APP_MODE_STORAGE_KEY, THEME_STORAGE_KEY } from '@/config'

import { resolveInitialAppMode, useAppStore, useThemeStore, useToastStore } from './index'

describe('Zustand stores', () => {
  it('manages mode, URL query sync, localStorage, sidebar, and window.__store in useAppStore', () => {
    expect(window.__store).toBe(useAppStore)
    expect(useAppStore.getState().mode).toBe('secure-boot')

    useAppStore.getState().setSidebarOpen(true)
    expect(useAppStore.getState().sidebarOpen).toBe(true)

    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(false)

    useAppStore.getState().setSidebarOpen(true)
    useAppStore.getState().setMode('chain-validator')
    expect(useAppStore.getState().mode).toBe('chain-validator')
    expect(useAppStore.getState().sidebarOpen).toBe(false)
    expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).toBe('chain-validator')
    expect(window.location.search).toContain('mode=chain-validator')

    window.history.replaceState(null, '', '/?mode=csr-inspector')
    expect(resolveInitialAppMode()).toBe('csr-inspector')
    useAppStore.getState().syncModeFromUrl()
    expect(useAppStore.getState().mode).toBe('csr-inspector')
  })

  it('cycles themes (dark -> light -> system -> dark) and updates data-theme attribute', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(useThemeStore.getState().effectiveTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    useThemeStore.getState().cycleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    expect(useThemeStore.getState().effectiveTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    useThemeStore.getState().cycleTheme()
    expect(useThemeStore.getState().theme).toBe('system')

    useThemeStore.getState().syncWithSystem({ colorScheme: 'light' })
    expect(useThemeStore.getState().effectiveTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    useThemeStore.getState().cycleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('adds, auto-removes, and clears toast notifications in useToastStore', () => {
    vi.useFakeTimers()
    try {
      const id = useToastStore.getState().showToast('Saved certificate', 'success', 1500)
      expect(useToastStore.getState().toasts).toHaveLength(1)
      expect(useToastStore.getState().toasts[0].id).toBe(id)

      vi.advanceTimersByTime(1600)
      expect(useToastStore.getState().toasts).toHaveLength(0)

      useToastStore.getState().showToast('Persistent info', 'info', 0)
      useToastStore.getState().showToast('Warning item', 'warning', 5000)
      expect(useToastStore.getState().toasts).toHaveLength(2)

      useToastStore.getState().clearToasts()
      expect(useToastStore.getState().toasts).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
