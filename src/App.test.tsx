import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ALL_APP_MODES, APP_MODE_STORAGE_KEY } from '@/config'
import i18n from '@/i18n'
import { useAppStore, useThemeStore } from '@/store'
import type { AppMode, SystemSettingsPayload } from '@/types'

import App from './App'

const mockSyncSystemSettingsFromApi = vi.fn<() => Promise<SystemSettingsPayload | null>>(() =>
  Promise.resolve(null),
)

let shouldSecureBootThrow = false

vi.mock('@/utils/system-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/system-settings')>()
  return {
    ...actual,
    syncSystemSettingsFromApi: () => mockSyncSystemSettingsFromApi(),
  }
})

vi.mock('@/components/SecureBootInspector', () => ({
  SecureBootInspector: ({ onNavigate }: { onNavigate?: (mode: AppMode) => void }) => {
    if (shouldSecureBootThrow) {
      throw new Error('Simulated SecureBoot render crash')
    }
    return (
      <div data-testid="view-secure-boot">
        <button type="button" onClick={() => onNavigate?.('chain-validator')}>
          Navigate to Chain Validator
        </button>
      </div>
    )
  },
  default: () => <div data-testid="view-secure-boot" />,
}))

vi.mock('@/components/TrustStoreInspector', () => ({
  default: ({ onNavigate }: { onNavigate?: (mode: AppMode) => void }) => (
    <div data-testid="view-trust-store">
      <button type="button" onClick={() => onNavigate?.('ocsp-checker')}>
        Go OCSP
      </button>
    </div>
  ),
}))

vi.mock('@/components/CsrInspector', () => ({
  default: () => <div data-testid="view-csr-inspector" />,
}))

vi.mock('@/components/WinCertStoreInspector', () => ({
  default: () => <div data-testid="view-win-cert-store" />,
}))

vi.mock('@/components/CrlInspector', () => ({
  default: () => <div data-testid="view-crl-inspector" />,
}))

vi.mock('@/components/ChainValidator', () => ({
  default: () => <div data-testid="view-chain-validator" />,
}))

vi.mock('@/components/KeyPairMatcher', () => ({
  default: () => <div data-testid="view-key-matcher" />,
}))

vi.mock('@/components/KeyGenerator', () => ({
  default: () => <div data-testid="view-key-generator" />,
}))

vi.mock('@/components/FormatConverter', () => ({
  default: () => <div data-testid="view-format-converter" />,
}))

vi.mock('@/components/TlsScanner', () => ({
  default: () => <div data-testid="view-tls-scanner" />,
}))

vi.mock('@/components/OcspChecker', () => ({
  default: () => <div data-testid="view-ocsp-checker" />,
}))

vi.mock('@/components/ExpiryDashboard', () => ({
  default: () => <div data-testid="view-expiry-dashboard" />,
}))

vi.mock('@/components/CtLogSearch', () => ({
  default: () => <div data-testid="view-ct-log-search" />,
}))

vi.mock('@/components/EducationCenter', () => ({
  default: () => <div data-testid="view-education-center" />,
}))

describe('App root shell', () => {
  beforeEach(() => {
    shouldSecureBootThrow = false
    mockSyncSystemSettingsFromApi.mockResolvedValue(null)
    useAppStore.setState({ mode: 'secure-boot', sidebarOpen: false })
    useThemeStore.setState({ theme: 'system', effectiveTheme: 'dark' })
  })

  it('registers useAppStore on window.__store and renders SecureBootInspector inside a main landmark', () => {
    render(<App />)

    expect(window.__store).toBe(useAppStore)
    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByTestId('view-secure-boot'))
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders every AppMode view via window.__store, updates URL/localStorage, and resets main scrollTop', async () => {
    useAppStore.setState({ mode: 'education-center', sidebarOpen: false })
    render(<App />)
    expect(await screen.findByTestId('view-education-center')).toBeInTheDocument()
    const main = screen.getByRole('main')

    for (const targetMode of ALL_APP_MODES) {
      main.scrollTop = 180
      act(() => {
        window.__store?.getState().setMode(targetMode)
      })

      expect(await screen.findByTestId(`view-${targetMode}`)).toBeInTheDocument()
      expect(new URLSearchParams(window.location.search).get('mode')).toBe(targetMode)
      expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).toBe(targetMode)
      expect(main.scrollTop).toBe(0)
    }
  })

  it('supports sidebar open/close, sidebar mode navigation, preload hover/focus, and child onNavigate', async () => {
    render(<App />)

    const openBtn = screen.getByRole('button', { name: /open sidebar/i })
    fireEvent.click(openBtn)
    expect(useAppStore.getState().sidebarOpen).toBe(true)

    const closeBtn = screen.getByRole('button', { name: /close sidebar/i })
    fireEvent.click(closeBtn)
    expect(useAppStore.getState().sidebarOpen).toBe(false)

    // Open again and select a mode from the sidebar
    fireEvent.click(openBtn)
    expect(useAppStore.getState().sidebarOpen).toBe(true)

    const trustStoreNavBtn = screen.getByRole('button', { name: 'Trust Store' })
    fireEvent.mouseEnter(trustStoreNavBtn)
    fireEvent.focus(trustStoreNavBtn)
    fireEvent.click(trustStoreNavBtn)

    expect(await screen.findByTestId('view-trust-store')).toBeInTheDocument()
    expect(useAppStore.getState().mode).toBe('trust-store')
    expect(useAppStore.getState().sidebarOpen).toBe(false)

    // Child component onNavigate callback
    fireEvent.click(screen.getByRole('button', { name: 'Go OCSP' }))
    expect(await screen.findByTestId('view-ocsp-checker')).toBeInTheDocument()
    expect(useAppStore.getState().mode).toBe('ocsp-checker')
  })

  it('syncs mode from URL query parameter when popstate event fires', async () => {
    render(<App />)
    expect(screen.getByTestId('view-secure-boot')).toBeInTheDocument()

    window.history.pushState(null, '', '/?mode=tls-scanner')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(await screen.findByTestId('view-tls-scanner')).toBeInTheDocument()
    expect(useAppStore.getState().mode).toBe('tls-scanner')
  })

  it('syncs prefers-color-scheme media query changes when theme is system', () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined
    const removeListenerSpy = vi.fn()
    const matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query: string): MediaQueryList => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
          changeListener = cb as (event: MediaQueryListEvent) => void
        }),
        removeEventListener: removeListenerSpy,
        dispatchEvent: vi.fn(() => false),
      }))

    window.__SYSTEM_SETTINGS__ = { colorScheme: 'dark' }
    const { unmount } = render(<App />)
    expect(changeListener).toBeDefined()

    act(() => {
      changeListener?.({ matches: false } as MediaQueryListEvent)
    })
    expect(window.__SYSTEM_SETTINGS__?.colorScheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Switching to explicit dark removes the system listener
    act(() => {
      useThemeStore.getState().setTheme('dark')
    })
    expect(removeListenerSpy).toHaveBeenCalled()

    unmount()
    matchMediaSpy.mockRestore()
  })

  it('applies OS language and theme from syncSystemSettingsFromApi when not user-customized', async () => {
    mockSyncSystemSettingsFromApi.mockResolvedValueOnce({
      userLanguages: ['de-DE'],
      colorScheme: 'light',
    })

    render(<App />)

    await waitFor(() => {
      expect(i18n.language).toBe('de')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  it('logs a warning without crashing when syncSystemSettingsFromApi rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSyncSystemSettingsFromApi.mockRejectedValueOnce(new Error('API offline'))

    render(<App />)

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Failed to sync system settings:', expect.any(Error))
    })
    warnSpy.mockRestore()
  })

  it('isolates view crashes inside ErrorBoundary keyed by mode and recovers on mode switch', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldSecureBootThrow = true

    render(<App />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Simulated SecureBoot render crash')).toBeInTheDocument()

    act(() => {
      window.__store?.getState().setMode('education-center')
    })

    expect(await screen.findByTestId('view-education-center')).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('logs a warning without crashing when a lazy view chunk preload fails', async () => {
    vi.resetModules()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.doMock('@/components/CtLogSearch', () => Promise.reject(new Error('Chunk preload failed')))

    const { default: IsolatedApp } = await import('./App')
    render(<IsolatedApp />)

    const ctNavBtn = screen.getByRole('button', { name: 'CT Log Search' })
    fireEvent.mouseEnter(ctNavBtn)

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to preload view chunk "ct-log-search":',
        expect.any(Error),
      )
    })
    warnSpy.mockRestore()
  })
})
