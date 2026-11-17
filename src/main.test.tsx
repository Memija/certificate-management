import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SupportedLanguage, ThemePreference } from '@/types'

const mockRender = vi.fn()
const mockCreateRoot = vi.fn(() => ({
  render: mockRender,
}))
const mockHasResourceBundle = vi.fn<(lng: string, ns: string) => boolean>(() => true)
const mockGetInitialThemePreference = vi.fn<() => ThemePreference>(() => 'dark')
const mockResolveEffectiveTheme = vi.fn<(theme: ThemePreference) => 'dark' | 'light'>(() => 'dark')

let mockInitialLanguage: SupportedLanguage = 'en'
let mockInitialI18nReady: Promise<void> = Promise.resolve()

vi.mock('react-dom/client', () => ({
  createRoot: mockCreateRoot,
}))

vi.mock('@/App', () => ({
  default: () => <div data-testid="app-root" />,
}))

vi.mock('@/i18n', () => ({
  default: {
    hasResourceBundle: (lng: string, ns: string) => mockHasResourceBundle(lng, ns),
  },
  get initialLanguage() {
    return mockInitialLanguage
  },
  get initialI18nReady() {
    return mockInitialI18nReady
  },
}))

vi.mock('@/utils/system-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/system-settings')>()
  return {
    ...actual,
    getInitialThemePreference: () => mockGetInitialThemePreference(),
    resolveEffectiveTheme: (theme: ThemePreference) => mockResolveEffectiveTheme(theme),
  }
})

describe('main entry point', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
    mockInitialLanguage = 'en'
    mockInitialI18nReady = Promise.resolve()
    mockHasResourceBundle.mockReturnValue(true)
    mockGetInitialThemePreference.mockReturnValue('dark')
    mockResolveEffectiveTheme.mockReturnValue('dark')
  })

  it('applies initial theme and mounts App inside StrictMode and ErrorBoundary synchronously for English', async () => {
    await import('./main')

    const rootElement = document.getElementById('root')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(mockCreateRoot).toHaveBeenCalledTimes(1)
    expect(mockCreateRoot).toHaveBeenCalledWith(rootElement)
    expect(mockRender).toHaveBeenCalledTimes(1)

    const mountedTree = mockRender.mock.calls[0]?.[0] as ReactElement
    render(mountedTree)
    expect(screen.getByTestId('app-root')).toBeInTheDocument()
  })

  it('waits for initialI18nReady before mounting when non-English bundle is not yet loaded', async () => {
    let resolveReady: (() => void) | undefined
    mockInitialLanguage = 'de'
    mockHasResourceBundle.mockReturnValue(false)
    mockGetInitialThemePreference.mockReturnValue('light')
    mockResolveEffectiveTheme.mockReturnValue('light')
    mockInitialI18nReady = new Promise<void>((resolve) => {
      resolveReady = resolve
    })

    await import('./main')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(mockCreateRoot).not.toHaveBeenCalled()

    resolveReady?.()
    await mockInitialI18nReady
    await Promise.resolve()

    expect(mockCreateRoot).toHaveBeenCalledTimes(1)
    expect(mockRender).toHaveBeenCalledTimes(1)
  })

  it('throws a descriptive error when the #root element is missing from the DOM', async () => {
    document.body.innerHTML = ''

    await expect(import('./main')).rejects.toThrow(
      'Root element "#root" was not found in the document.',
    )
    expect(mockCreateRoot).not.toHaveBeenCalled()
  })
})
