import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './apps/certificate-management/i18n';
import RootShell from './shell/RootShell';
import {
  getInitialThemePreference,
  resolveEffectiveTheme,
} from './apps/certificate-management/utils/systemSettings';

// Apply stored or system-wide theme immediately to prevent flash
const initialTheme = getInitialThemePreference();
document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(initialTheme));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootShell />
  </StrictMode>
);
