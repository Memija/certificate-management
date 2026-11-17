import { create } from 'zustand'

import { APP_MODE_STORAGE_KEY, isValidAppMode } from '@/config'
import type { AppMode } from '@/types'

export interface AppState {
  mode: AppMode
  sidebarOpen: boolean
  setMode: (mode: AppMode) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  syncModeFromUrl: () => void
}

export function resolveInitialAppMode(): AppMode {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search)
      const queryMode = params.get('mode')
      if (isValidAppMode(queryMode)) {
        return queryMode
      }
    } catch {
      // ignore URL parsing issues
    }

    try {
      const savedMode = localStorage.getItem(APP_MODE_STORAGE_KEY)
      if (isValidAppMode(savedMode)) {
        return savedMode
      }
    } catch {
      // ignore localStorage issues
    }
  }
  return 'secure-boot'
}

export const useAppStore = create<AppState>((set) => ({
  mode: resolveInitialAppMode(),
  sidebarOpen: false,
  setMode: (mode: AppMode) => {
    if (!isValidAppMode(mode)) {
      return
    }
    set({ mode, sidebarOpen: false })
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(APP_MODE_STORAGE_KEY, mode)
      }
    } catch {
      // ignore storage quota/privacy errors
    }
    if (typeof window !== 'undefined') {
      try {
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('mode', mode)
        window.history.replaceState(window.history.state, '', nextUrl)
      } catch {
        // ignore history API errors
      }
    }
  },
  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open })
  },
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },
  syncModeFromUrl: () => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const params = new URLSearchParams(window.location.search)
      const queryMode = params.get('mode')
      if (isValidAppMode(queryMode)) {
        set((state) => (state.mode === queryMode ? state : { mode: queryMode }))
        localStorage.setItem(APP_MODE_STORAGE_KEY, queryMode)
      }
    } catch {
      // ignore URL/storage errors
    }
  },
}))

declare global {
  interface Window {
    __store?: typeof useAppStore
  }
}

if (typeof window !== 'undefined') {
  window.__store = useAppStore
}
