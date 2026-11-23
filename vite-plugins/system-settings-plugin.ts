import type { IndexHtmlTransformContext, Plugin, PreviewServer, ViteDevServer } from 'vite'

import { createAsyncCache } from './async-cache.ts'
import {
  getErrorMessage,
  parseRequestUrl,
  registerApiMiddleware,
  sendJson,
  sendOperationalError,
} from './http-helpers.ts'
import { execFileAsync } from './powershell.ts'

export type SupportedAppLanguage = 'en' | 'de' | 'bs' | 'sr-Cyrl' | 'id' | 'pl'

export interface SystemSettingsData {
  userLanguages: string[]
  uiLanguages: string[]
  locale: string
  region: string
  preferredAppLanguage: SupportedAppLanguage
  colorScheme: 'light' | 'dark' | null
}

async function queryRegValueAsync(keyPath: string, valueName: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', keyPath, '/v', valueName], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1500,
    })
    return stdout
  } catch {
    return ''
  }
}

function parseMultiSz(raw: string): string[] {
  const match = raw.match(/REG_MULTI_SZ\s+([^\r\n]+)/i)
  if (!match || !match[1]) {
    return []
  }
  return match[1]
    .trim()
    .split('\\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseSz(raw: string): string {
  const match = raw.match(/REG_SZ\s+([^\r\n]+)/i)
  if (!match || !match[1]) {
    return ''
  }
  return match[1].trim()
}

function parseDword(raw: string): number | null {
  const match = raw.match(/REG_DWORD\s+(0x[0-9a-fA-F]+|\d+)/i)
  if (!match || !match[1]) {
    return null
  }
  const val = match[1].trim()
  const radix = val.toLowerCase().startsWith('0x') ? 16 : 10
  const parsed = Number.parseInt(val, radix)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeSupportedLang(tag: string): SupportedAppLanguage | null {
  if (!tag) {
    return null
  }
  const lower = tag.trim().replace(/_/g, '-').toLowerCase()
  if (lower === 'sr-cyrl' || lower.startsWith('sr-cyrl-')) {
    return 'sr-Cyrl'
  }
  if (lower === 'sr-latn' || lower.startsWith('sr-latn-')) {
    return 'bs'
  }
  const primary = lower.split('-')[0]
  switch (primary) {
    case 'de':
      return 'de'
    case 'bs':
    case 'hr':
      return 'bs'
    case 'sr':
      return 'sr-Cyrl'
    case 'id':
    case 'in':
      return 'id'
    case 'pl':
      return 'pl'
    case 'en':
      return 'en'
    default:
      return null
  }
}

function resolveColorScheme(rawAppsLight: string, rawSysLight: string): 'light' | 'dark' | null {
  const appsLight = parseDword(rawAppsLight)
  if (appsLight === 1) {
    return 'light'
  }
  if (appsLight === 0) {
    return 'dark'
  }
  const sysLight = parseDword(rawSysLight)
  if (sysLight === 1) {
    return 'light'
  }
  if (sysLight === 0) {
    return 'dark'
  }
  return null
}

function resolveFallbackLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || ''
  } catch {
    return process.env.LANG || process.env.LC_ALL || 'en-US'
  }
}

export function systemSettingsApiPlugin(): Plugin {
  const cache = createAsyncCache<SystemSettingsData>(15_000)

  const readSystemSettings = (bypassCache = false): Promise<SystemSettingsData> =>
    cache.getOrLoad('system-settings', bypassCache, async () => {
      let userLanguages: string[] = []
      let uiLanguages: string[] = []
      let locale = ''
      let region = ''
      let colorScheme: 'light' | 'dark' | null = null

      if (process.platform === 'win32') {
        const personalizeKey =
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
        const [rawUserLangs, rawUiLangs, rawLocale, rawRegion, rawAppsLight, rawSysLight] =
          await Promise.all([
            queryRegValueAsync('HKCU\\Control Panel\\International\\User Profile', 'Languages'),
            queryRegValueAsync('HKCU\\Control Panel\\Desktop', 'PreferredUILanguages'),
            queryRegValueAsync('HKCU\\Control Panel\\International', 'LocaleName'),
            queryRegValueAsync('HKCU\\Control Panel\\International\\Geo', 'Name'),
            queryRegValueAsync(personalizeKey, 'AppsUseLightTheme'),
            queryRegValueAsync(personalizeKey, 'SystemUsesLightTheme'),
          ])

        userLanguages = parseMultiSz(rawUserLangs)
        uiLanguages = parseMultiSz(rawUiLangs)
        locale = parseSz(rawLocale)
        region = parseSz(rawRegion)
        colorScheme = resolveColorScheme(rawAppsLight, rawSysLight)
      }

      if (!locale) {
        locale = resolveFallbackLocale()
      }

      if (userLanguages.length === 0 && locale) {
        userLanguages = [locale]
      }

      let preferredAppLanguage: SupportedAppLanguage = 'en'
      const candidates = [...userLanguages, ...uiLanguages, locale]
      for (const candidate of candidates) {
        const normalized = normalizeSupportedLang(candidate)
        if (normalized) {
          preferredAppLanguage = normalized
          break
        }
      }

      return {
        userLanguages,
        uiLanguages,
        locale,
        region,
        preferredAppLanguage,
        colorScheme,
      }
    })

  const handleRequest = async (
    req: Parameters<Parameters<typeof registerApiMiddleware>[2]>[0],
    res: Parameters<Parameters<typeof registerApiMiddleware>[2]>[1],
  ): Promise<void> => {
    try {
      const url = parseRequestUrl(req)
      const refresh = url.searchParams.get('refresh') === 'true'
      const settings = await readSystemSettings(refresh)
      sendJson(res, 200, { ok: true, data: settings })
    } catch (error: unknown) {
      sendOperationalError(res, getErrorMessage(error), 500)
    }
  }

  return {
    name: 'system-settings-api',
    async transformIndexHtml(html: string, ctx: IndexHtmlTransformContext): Promise<string> {
      if (!ctx.server) {
        return html
      }
      try {
        const settings = await readSystemSettings()
        const safeJson = JSON.stringify(settings).replace(/</g, '\\u003c')
        const scriptTag = `<script>window.__SYSTEM_SETTINGS__ = ${safeJson};</script>`
        return html.replace('</head>', `  ${scriptTag}\n  </head>`)
      } catch {
        return html
      }
    },
    configureServer(server: ViteDevServer): void {
      registerApiMiddleware(server, '/api/system-settings', handleRequest)
    },
    configurePreviewServer(server: PreviewServer): void {
      registerApiMiddleware(server, '/api/system-settings', handleRequest)
    },
  }
}
