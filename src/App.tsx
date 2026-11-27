import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

import { AppFooter, AppHeader, AppSidebar } from '@/components/layout'
import { SecureBootInspector } from '@/components/SecureBootInspector'
import { ErrorBoundary, ToastProvider } from '@/components/shared'
import { getCategoryForMode } from '@/config'
import { useAppStore, useThemeStore } from '@/store'
import type { AppMode } from '@/types'
import {
  detectSystemLanguage,
  isLanguageCustomized,
  isThemeCustomized,
  normalizeLanguageTag,
  syncSystemSettingsFromApi,
} from '@/utils/system-settings'

import styles from './App.module.css'

if (typeof window !== 'undefined') {
  window.__store = useAppStore
}

const loadTrustStoreInspector = () => import('@/components/TrustStoreInspector')
const loadCsrInspector = () => import('@/components/CsrInspector')
const loadWinCertStoreInspector = () => import('@/components/WinCertStoreInspector')
const loadCrlInspector = () => import('@/components/CrlInspector')
const loadChainValidator = () => import('@/components/ChainValidator')
const loadKeyPairMatcher = () => import('@/components/KeyPairMatcher')
const loadKeyGenerator = () => import('@/components/KeyGenerator')
const loadFormatConverter = () => import('@/components/FormatConverter')
const loadTlsScanner = () => import('@/components/TlsScanner')
const loadOcspChecker = () => import('@/components/OcspChecker')
const loadExpiryDashboard = () => import('@/components/ExpiryDashboard')
const loadCtLogSearch = () => import('@/components/CtLogSearch')
const loadEducationCenter = () => import('@/components/EducationCenter')

const TrustStoreInspector = lazy(loadTrustStoreInspector)
const CsrInspector = lazy(loadCsrInspector)
const WinCertStoreInspector = lazy(loadWinCertStoreInspector)
const CrlInspector = lazy(loadCrlInspector)
const ChainValidator = lazy(loadChainValidator)
const KeyPairMatcher = lazy(loadKeyPairMatcher)
const KeyGenerator = lazy(loadKeyGenerator)
const FormatConverter = lazy(loadFormatConverter)
const TlsScanner = lazy(loadTlsScanner)
const OcspChecker = lazy(loadOcspChecker)
const ExpiryDashboard = lazy(loadExpiryDashboard)
const CtLogSearch = lazy(loadCtLogSearch)
const EducationCenter = lazy(loadEducationCenter)

const MODE_PRELOADERS: Partial<Record<AppMode, () => Promise<unknown>>> = {
  'trust-store': loadTrustStoreInspector,
  'csr-inspector': loadCsrInspector,
  'win-cert-store': loadWinCertStoreInspector,
  'crl-inspector': loadCrlInspector,
  'chain-validator': loadChainValidator,
  'key-matcher': loadKeyPairMatcher,
  'key-generator': loadKeyGenerator,
  'format-converter': loadFormatConverter,
  'tls-scanner': loadTlsScanner,
  'ocsp-checker': loadOcspChecker,
  'expiry-dashboard': loadExpiryDashboard,
  'ct-log-search': loadCtLogSearch,
  'education-center': loadEducationCenter,
}

function preloadMode(targetMode: AppMode): void {
  const loader = MODE_PRELOADERS[targetMode]
  if (loader) {
    loader().catch((err: unknown) => {
      console.warn(`Failed to preload view chunk "${targetMode}":`, err)
    })
  }
}

function ViewLoadingFallback({ mode }: { mode: AppMode }) {
  const { t } = useTranslation()
  return (
    <div className={styles.loadingFallback} role="status" aria-live="polite">
      <RefreshCw size={38} className={`spin ${styles.loadingSpinner}`} aria-hidden="true" />
      <span className={styles.loadingLabel}>{t(`app.nav.${mode}`)}</span>
    </div>
  )
}

interface ActiveModeViewProps {
  mode: AppMode
  onNavigate: (nextMode: AppMode) => void
}

function ActiveModeView({ mode, onNavigate }: ActiveModeViewProps) {
  switch (mode) {
    case 'trust-store':
      return <TrustStoreInspector onNavigate={onNavigate} />
    case 'csr-inspector':
      return <CsrInspector onNavigate={onNavigate} />
    case 'win-cert-store':
      return <WinCertStoreInspector onNavigate={onNavigate} />
    case 'crl-inspector':
      return <CrlInspector onNavigate={onNavigate} />
    case 'chain-validator':
      return <ChainValidator onNavigate={onNavigate} />
    case 'key-matcher':
      return <KeyPairMatcher onNavigate={onNavigate} />
    case 'key-generator':
      return <KeyGenerator onNavigate={onNavigate} />
    case 'format-converter':
      return <FormatConverter onNavigate={onNavigate} />
    case 'tls-scanner':
      return <TlsScanner />
    case 'ocsp-checker':
      return <OcspChecker onNavigate={onNavigate} />
    case 'expiry-dashboard':
      return <ExpiryDashboard />
    case 'ct-log-search':
      return <CtLogSearch onNavigate={onNavigate} />
    case 'education-center':
      return <EducationCenter onNavigate={onNavigate} />
    case 'secure-boot':
      return <SecureBootInspector onNavigate={onNavigate} />
  }
}

export function App() {
  const { i18n } = useTranslation()
  const mode = useAppStore((state) => state.mode)
  const setMode = useAppStore((state) => state.setMode)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const syncModeFromUrl = useAppStore((state) => state.syncModeFromUrl)

  const theme = useThemeStore((state) => state.theme)
  const syncWithSystem = useThemeStore((state) => state.syncWithSystem)

  const mainContentAreaRef = useRef<HTMLElement>(null)
  const activeCategoryId = getCategoryForMode(mode)

  useEffect(() => {
    window.addEventListener('popstate', syncModeFromUrl)
    return () => {
      window.removeEventListener('popstate', syncModeFromUrl)
    }
  }, [syncModeFromUrl])

  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') {
      return
    }

    syncWithSystem()
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (!mediaQuery) {
      return
    }
    const handleColorSchemeChange = (event: MediaQueryListEvent): void => {
      if (window.__SYSTEM_SETTINGS__) {
        window.__SYSTEM_SETTINGS__.colorScheme = event.matches ? 'dark' : 'light'
      }
      syncWithSystem()
    }

    mediaQuery.addEventListener('change', handleColorSchemeChange)
    return () => {
      mediaQuery.removeEventListener('change', handleColorSchemeChange)
    }
  }, [theme, syncWithSystem])

  useEffect(() => {
    let cancelled = false
    void syncSystemSettingsFromApi()
      .then((sys) => {
        if (cancelled || !sys) {
          return
        }
        const isAutomatedBrowser = typeof navigator !== 'undefined' && Boolean(navigator.webdriver)
        if (!isLanguageCustomized() && !isAutomatedBrowser) {
          const detected = detectSystemLanguage(sys)
          if (detected && normalizeLanguageTag(i18n.language) !== detected) {
            void i18n.changeLanguage(detected)
          }
        }
        if (!isThemeCustomized() && !isAutomatedBrowser) {
          syncWithSystem(sys)
        }
      })
      .catch((err: unknown) => {
        console.warn('Failed to sync system settings:', err)
      })

    return () => {
      cancelled = true
    }
  }, [i18n, syncWithSystem])

  useEffect(() => {
    if (mainContentAreaRef.current) {
      mainContentAreaRef.current.scrollTop = 0
    }
  }, [mode])

  const handleModeChange = useCallback(
    (nextMode: AppMode) => {
      setMode(nextMode)
    },
    [setMode],
  )

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true)
  }, [setSidebarOpen])

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [setSidebarOpen])

  return (
    <ToastProvider>
      <div className={styles.appLayout}>
        <AppSidebar
          mode={mode}
          onModeChange={handleModeChange}
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
          onPreloadMode={preloadMode}
        />

        <div className={styles.appMainWrapper} data-mode={mode} data-category={activeCategoryId}>
          <AppHeader mode={mode} onOpenSidebar={handleOpenSidebar} />

          <main className={styles.mainContentArea} ref={mainContentAreaRef}>
            <ErrorBoundary key={mode}>
              <Suspense fallback={<ViewLoadingFallback mode={mode} />}>
                <ActiveModeView mode={mode} onNavigate={handleModeChange} />
              </Suspense>
            </ErrorBoundary>
          </main>

          <AppFooter mode={mode} />
        </div>
      </div>
    </ToastProvider>
  )
}

export default App
