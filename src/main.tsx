import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { initialLanguage, initialI18nReady } from './i18n';
import App from './App';
import {
  getInitialThemePreference,
  resolveEffectiveTheme,
} from './utils/systemSettings';

// Apply stored or system-wide theme immediately to prevent flash
const initialTheme = getInitialThemePreference();
document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(initialTheme));

const mount = () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

if (initialLanguage === 'en' || i18n.hasResourceBundle(initialLanguage, 'translation')) {
  mount();
} else {
  initialI18nReady.finally(mount);
}
