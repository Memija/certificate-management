import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import i18n, { registerAllLocalesForTests } from '@/i18n'
import { useAppStore, useThemeStore, useToastStore } from '@/store'

import '@testing-library/jest-dom/vitest'

class MockResizeObserver implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = MockResizeObserver
}

function createMatchMediaMock(): (query: string) => MediaQueryList {
  return (query: string): MediaQueryList => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: globalThis.ResizeObserver,
  })

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: createMatchMediaMock(),
    })
  }
}

await registerAllLocalesForTests()

afterEach(async () => {
  if (typeof document !== 'undefined') {
    cleanup()
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.lang = 'en'
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  } catch {
    // ignore storage errors in restricted environments
  }

  if (typeof window !== 'undefined') {
    delete window.__SYSTEM_SETTINGS__
    try {
      window.history.replaceState(null, '', '/')
    } catch {
      // ignore history errors
    }
  }

  useToastStore.getState().clearToasts()
  useAppStore.setState({ mode: 'secure-boot', sidebarOpen: false })
  useThemeStore.setState({ theme: 'system', effectiveTheme: 'dark' })

  if (i18n.language !== 'en') {
    await i18n.changeLanguage('en')
  }
})
