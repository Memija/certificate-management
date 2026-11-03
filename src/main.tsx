import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { getInitialThemePreference, resolveEffectiveTheme } from './utils/systemSettings'

// Apply stored or system-wide theme immediately to prevent flash
const initialTheme = getInitialThemePreference();
document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(initialTheme));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
