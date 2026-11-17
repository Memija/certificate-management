import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { ErrorBoundary } from '@/components/shared'
import i18n, { initialI18nReady, initialLanguage } from '@/i18n'
import { getInitialThemePreference, resolveEffectiveTheme } from '@/utils/system-settings'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/index.css'

const ROOT_ELEMENT_ID = 'root'

/**
 * Applies the initial theme attribute to prevent FOUC and mounts the React application root.
 */
function bootstrapApp(): void {
  const rootElement = document.getElementById(ROOT_ELEMENT_ID)
  if (!rootElement) {
    throw new Error(`Root element "#${ROOT_ELEMENT_ID}" was not found in the document.`)
  }

  const initialTheme = getInitialThemePreference()
  document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(initialTheme))

  const mount = (): void => {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  }

  if (initialLanguage === 'en' || i18n.hasResourceBundle(initialLanguage, 'translation')) {
    mount()
  } else {
    void initialI18nReady.finally(mount)
  }
}

bootstrapApp()
