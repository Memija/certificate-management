import type {
  AppMode,
  LanguageMeta,
  NavCategoryId,
  NavCategoryMeta,
  SupportedLanguage,
} from '@/types'

export const APP_VERSION = '1.0.0'

export const APP_MODE_STORAGE_KEY = 'app-mode'
export const THEME_STORAGE_KEY = 'app-theme'
export const THEME_CUSTOMIZED_KEY = 'app-theme-customized'
export const THEME_CHANGED_EVENT = 'app-theme-preference-changed'
export const LANG_STORAGE_KEY = 'i18nextLng'
export const LANG_CUSTOMIZED_KEY = 'app-language-customized'

export const ALL_APP_MODES = [
  'secure-boot',
  'trust-store',
  'csr-inspector',
  'win-cert-store',
  'crl-inspector',
  'chain-validator',
  'key-matcher',
  'key-generator',
  'format-converter',
  'tls-scanner',
  'ocsp-checker',
  'expiry-dashboard',
  'ct-log-search',
  'education-center',
] as const satisfies readonly AppMode[]

const APP_MODE_SET: ReadonlySet<string> = new Set<string>(ALL_APP_MODES)

export function isValidAppMode(value: unknown): value is AppMode {
  return typeof value === 'string' && APP_MODE_SET.has(value)
}

export const NAV_CATEGORIES: readonly NavCategoryMeta[] = [
  {
    id: 'systemCheck',
    modes: ['secure-boot', 'win-cert-store', 'expiry-dashboard'],
    items: [
      { id: 'secure-boot', iconName: 'Shield' },
      { id: 'win-cert-store', iconName: 'Monitor' },
      { id: 'expiry-dashboard', iconName: 'LayoutDashboard' },
    ],
  },
  {
    id: 'inspectionValidation',
    modes: ['trust-store', 'crl-inspector', 'chain-validator', 'csr-inspector'],
    items: [
      { id: 'trust-store', iconName: 'FolderOpen' },
      { id: 'crl-inspector', iconName: 'ShieldAlert' },
      { id: 'chain-validator', iconName: 'Link' },
      { id: 'csr-inspector', iconName: 'FileKey' },
    ],
  },
  {
    id: 'keyManagement',
    modes: ['key-matcher', 'key-generator', 'format-converter'],
    items: [
      { id: 'key-matcher', iconName: 'Key' },
      { id: 'key-generator', iconName: 'Zap' },
      { id: 'format-converter', iconName: 'FileArchive' },
    ],
  },
  {
    id: 'networkStatus',
    modes: ['tls-scanner', 'ocsp-checker', 'ct-log-search'],
    items: [
      { id: 'tls-scanner', iconName: 'Globe' },
      { id: 'ocsp-checker', iconName: 'Activity' },
      { id: 'ct-log-search', iconName: 'Search' },
    ],
  },
  {
    id: 'learning',
    modes: ['education-center'],
    items: [{ id: 'education-center', iconName: 'BookOpen' }],
  },
]

export function getCategoryForMode(mode: AppMode): NavCategoryId {
  for (const category of NAV_CATEGORIES) {
    if (category.modes.includes(mode)) {
      return category.id
    }
  }
  return 'systemCheck'
}

export const SUPPORTED_LANGUAGES = [
  'en',
  'de',
  'bs',
  'sr-Cyrl',
  'id',
  'pl',
] as const satisfies readonly SupportedLanguage[]

export const LANGUAGE_META: readonly LanguageMeta[] = [
  { code: 'id', label: 'Bahasa Indonesia', flag: '/flags/id.png', flagCode: 'id' },
  { code: 'bs', label: 'Bosanski', flag: '/flags/ba.png', flagCode: 'ba' },
  { code: 'de', label: 'Deutsch', flag: '/flags/de.png', flagCode: 'de' },
  { code: 'en', label: 'English', flag: '/flags/gb.png', flagCode: 'gb' },
  { code: 'pl', label: 'Polski', flag: '/flags/pl.png', flagCode: 'pl' },
  { code: 'sr-Cyrl', label: 'Српски', flag: '/flags/rs.png', flagCode: 'rs' },
]
