export const SUPPORTED_LANGUAGES = ['en', 'de', 'bs', 'sr-Cyrl', 'id', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ThemePreference = 'dark' | 'light' | 'system';

export interface SystemSettingsPayload {
  /** Ordered list of preferred language tags from OS User Profile (e.g. ["de-DE", "en-US", "bs"]) */
  userLanguages?: string[];
  /** OS UI display language(s) */
  uiLanguages?: string[];
  /** OS regional locale name (e.g. "de-DE", "en-US") */
  locale?: string;
  /** OS Geo region ISO code (e.g. "DE", "BA") */
  region?: string;
  /** Resolved primary supported app language from OS settings */
  preferredAppLanguage?: SupportedLanguage | string;
  /** OS app color scheme preference ("light" | "dark") */
  colorScheme?: 'light' | 'dark' | null;
}

declare global {
  interface Window {
    __SYSTEM_SETTINGS__?: SystemSettingsPayload;
  }
}

export const THEME_STORAGE_KEY = 'app-theme';
export const THEME_CUSTOMIZED_KEY = 'app-theme-customized';
export const LANG_STORAGE_KEY = 'i18nextLng';
export const LANG_CUSTOMIZED_KEY = 'app-language-customized';

/**
 * Maps any BCP-47 language tag or ISO region code to one of the supported application languages.
 */
export function normalizeLanguageTag(tag: string | null | undefined): SupportedLanguage | null {
  if (!tag || typeof tag !== 'string') return null;
  const cleaned = tag.trim().replace(/_/g, '-');
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  if (lower === 'sr-cyrl' || lower.startsWith('sr-cyrl-')) {
    return 'sr-Cyrl';
  }
  if (lower === 'sr-latn' || lower.startsWith('sr-latn-')) {
    return 'bs';
  }

  const primary = lower.split('-')[0];
  switch (primary) {
    case 'de':
      return 'de';
    case 'bs':
    case 'hr':
      return 'bs';
    case 'sr':
      return 'sr-Cyrl';
    case 'id':
    case 'in':
      return 'id';
    case 'pl':
      return 'pl';
    case 'en':
      return 'en';
    default:
      return null;
  }
}

function mapRegionToLanguage(region: string | null | undefined): SupportedLanguage | null {
  if (!region) return null;
  switch (region.trim().toUpperCase()) {
    case 'DE':
    case 'AT':
    case 'CH':
    case 'LI':
    case 'LU':
      return 'de';
    case 'BA':
    case 'HR':
      return 'bs';
    case 'RS':
    case 'ME':
      return 'sr-Cyrl';
    case 'ID':
      return 'id';
    case 'PL':
      return 'pl';
    case 'GB':
    case 'US':
    case 'CA':
    case 'AU':
    case 'NZ':
    case 'IE':
      return 'en';
    default:
      return null;
  }
}

/**
 * Resolves the user's system-wide language preference by inspecting OS-level settings
 * (provided by the local backend / injected HTML) alongside browser/ICU locale settings.
 */
export function detectSystemLanguage(sys?: SystemSettingsPayload): SupportedLanguage {
  const settings = sys ?? (typeof window !== 'undefined' ? window.__SYSTEM_SETTINGS__ : undefined);

  // 1. OS Preferred Languages list (Windows Settings -> Time & language -> Language & region -> Preferred languages)
  if (settings?.userLanguages && settings.userLanguages.length > 0) {
    const firstOsLang = normalizeLanguageTag(settings.userLanguages[0]);
    if (firstOsLang && firstOsLang !== 'en') {
      return firstOsLang;
    }
  }

  // 2. If browser's primary language is explicitly set to a non-English supported language
  if (typeof navigator !== 'undefined') {
    const browserPrimary =
      (Array.isArray(navigator.languages) && navigator.languages[0]) || navigator.language;
    const normBrowserPrimary = normalizeLanguageTag(browserPrimary);
    if (normBrowserPrimary && normBrowserPrimary !== 'en') {
      return normBrowserPrimary;
    }
  }

  // 3. Check full OS userLanguages list in order
  if (settings?.userLanguages) {
    for (const tag of settings.userLanguages) {
      const matched = normalizeLanguageTag(tag);
      if (matched) return matched;
    }
  }

  // 4. Check pre-resolved OS language if provided
  if (settings?.preferredAppLanguage) {
    const matched = normalizeLanguageTag(settings.preferredAppLanguage);
    if (matched) return matched;
  }

  // 5. Check OS regional locale and UI languages
  if (settings?.locale) {
    const matched = normalizeLanguageTag(settings.locale);
    if (matched && matched !== 'en') return matched;
  }
  if (settings?.uiLanguages) {
    for (const tag of settings.uiLanguages) {
      const matched = normalizeLanguageTag(tag);
      if (matched && matched !== 'en') return matched;
    }
  }

  // 6. Check all browser languages and Intl resolved locale
  if (typeof navigator !== 'undefined') {
    const navList = Array.isArray(navigator.languages)
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
    for (const tag of navList) {
      const matched = normalizeLanguageTag(tag);
      if (matched) return matched;
    }
  }

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    const matched = normalizeLanguageTag(intlLocale);
    if (matched) return matched;
  } catch {
    // ignore
  }

  // 7. Check OS geographic region
  if (settings?.region) {
    const regionLang = mapRegionToLanguage(settings.region);
    if (regionLang) return regionLang;
  }

  return 'en';
}

export function isLanguageCustomized(): boolean {
  try {
    return localStorage.getItem(LANG_CUSTOMIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isThemeCustomized(): boolean {
  try {
    return localStorage.getItem(THEME_CUSTOMIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Determines the initial language on app startup.
 * Uses the user's explicit selection if they previously customized it in the app;
 * otherwise uses the system-wide language.
 */
export function getInitialLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryLang = normalizeLanguageTag(params.get('lng') || params.get('lang'));
      if (queryLang) return queryLang;
    } catch {
      // ignore
    }

    try {
      if (isLanguageCustomized()) {
        const saved = normalizeLanguageTag(localStorage.getItem(LANG_STORAGE_KEY));
        if (saved) return saved;
      }
    } catch {
      // ignore
    }
  }

  const detected = detectSystemLanguage();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_STORAGE_KEY, detected);
    }
  } catch {
    // ignore
  }
  return detected;
}

export function setUserLanguagePreference(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(LANG_CUSTOMIZED_KEY, 'true');
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

/**
 * Determines the initial theme preference on app startup.
 * Defaults to 'system' on first start so system-wide dark/light mode is used automatically.
 */
export function getInitialThemePreference(): ThemePreference {
  try {
    if (isThemeCustomized()) {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    }
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
  } catch {
    // ignore
  }
  return 'system';
}

export function setUserThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_CUSTOMIZED_KEY, 'true');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

/**
 * Resolves a ThemePreference ('dark' | 'light' | 'system') to the active 'dark' or 'light' theme,
 * honoring OS-level system settings and prefers-color-scheme media query.
 */
export function resolveEffectiveTheme(
  theme: ThemePreference,
  sys?: SystemSettingsPayload
): 'dark' | 'light' {
  if (theme === 'dark' || theme === 'light') {
    return theme;
  }

  const settings = sys ?? (typeof window !== 'undefined' ? window.__SYSTEM_SETTINGS__ : undefined);
  if (settings?.colorScheme === 'light' || settings?.colorScheme === 'dark') {
    return settings.colorScheme;
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'dark';
}

/**
 * Fetches system settings from the local backend `/api/system-settings` endpoint if available,
 * updating `window.__SYSTEM_SETTINGS__`.
 */
export async function syncSystemSettingsFromApi(): Promise<SystemSettingsPayload | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/system-settings');
    if (!res.ok) return window.__SYSTEM_SETTINGS__ ?? null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return window.__SYSTEM_SETTINGS__ ?? null;
    }
    const json = await res.json();
    if (json && json.data) {
      window.__SYSTEM_SETTINGS__ = json.data;
      return json.data as SystemSettingsPayload;
    }
  } catch {
    // Static web fallback — ignore network/API errors
  }
  return window.__SYSTEM_SETTINGS__ ?? null;
}

