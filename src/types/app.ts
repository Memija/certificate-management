import type { TFunction } from 'i18next'

export type AppMode =
  | 'secure-boot'
  | 'trust-store'
  | 'csr-inspector'
  | 'win-cert-store'
  | 'crl-inspector'
  | 'chain-validator'
  | 'key-matcher'
  | 'key-generator'
  | 'format-converter'
  | 'tls-scanner'
  | 'ocsp-checker'
  | 'expiry-dashboard'
  | 'ct-log-search'
  | 'education-center'

export type ThemePreference = 'dark' | 'light' | 'system'
export type Theme = ThemePreference
export type EffectiveTheme = 'dark' | 'light'

export type SupportedLanguage = 'en' | 'de' | 'bs' | 'sr-Cyrl' | 'id' | 'pl'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

export type Toast = ToastItem

export const ALL_LEARNING_TERMS = [
  'nvram',
  'db',
  'dbx',
  'kek',
  'pk',
  'x509',
  'efi',
  'uac',
  'rootCa',
  'intermediateCa',
  'leafCert',
  'crl',
  'csr',
  'ocsp',
  'ocspStapling',
  'ctlog',
  'pem',
  'der',
] as const

export type TermId = (typeof ALL_LEARNING_TERMS)[number]

export type NavCategoryId =
  'systemCheck' | 'inspectionValidation' | 'keyManagement' | 'networkStatus' | 'learning'

export type NavIconName =
  | 'Shield'
  | 'Monitor'
  | 'LayoutDashboard'
  | 'FolderOpen'
  | 'ShieldAlert'
  | 'Link'
  | 'FileKey'
  | 'Key'
  | 'Zap'
  | 'FileArchive'
  | 'Globe'
  | 'Activity'
  | 'Search'
  | 'BookOpen'

export interface NavItemMeta {
  id: AppMode
  iconName: NavIconName
}

export interface NavCategoryMeta {
  id: NavCategoryId
  modes: readonly AppMode[]
  items: readonly NavItemMeta[]
}

export interface LanguageMeta {
  code: SupportedLanguage
  label: string
  flag: string
  flagCode: string
}

export interface SystemSettingsPayload {
  /** Ordered list of preferred language tags from OS User Profile (e.g. ["de-DE", "en-US", "bs"]) */
  userLanguages?: string[]
  /** OS UI display language(s) */
  uiLanguages?: string[]
  /** OS regional locale name (e.g. "de-DE", "en-US") */
  locale?: string
  /** OS Geo region ISO code (e.g. "DE", "BA") */
  region?: string
  /** Resolved primary supported app language from OS settings */
  preferredAppLanguage?: SupportedLanguage | string
  /** OS app color scheme preference ("light" | "dark") */
  colorScheme?: EffectiveTheme | null
}

export type EducationCategory = 'secure-boot' | 'certificates' | 'protocols' | 'formats'

export interface TopicDetail {
  id: TermId
  title: string
  subtitle: string
  category: EducationCategory
  standardRef?: string
  standardUrl?: string
  overview: string
  keyPoints: string[]
  securityImpact: string
  cliCommand?: {
    tool: string
    command: string
    explanation: string
  }
  relatedAppMode?: {
    mode: AppMode
    label: string
  }
}

export interface SimpleTranslateFn {
  (key: string, defaultValue?: string): string
  (key: string, options?: Record<string, unknown>): string
  (key: string, defaultValue: string, options?: Record<string, unknown>): string
}

export type TranslateFn = TFunction | SimpleTranslateFn
