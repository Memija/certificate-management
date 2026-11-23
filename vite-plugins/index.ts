import type { Plugin } from 'vite'

import { certStoreApiPlugin } from './cert-store-plugin.ts'
import { ctSearchApiPlugin } from './ct-search-plugin.ts'
import { ocspApiPlugin } from './ocsp-plugin.ts'
import { secureBootApiPlugin } from './secure-boot-plugin.ts'
import { systemSettingsApiPlugin } from './system-settings-plugin.ts'
import { tlsScannerApiPlugin } from './tls-scanner-plugin.ts'

export {
  certStoreApiPlugin,
  ctSearchApiPlugin,
  ocspApiPlugin,
  secureBootApiPlugin,
  systemSettingsApiPlugin,
  tlsScannerApiPlugin,
}

export function localApiPlugins(): Plugin[] {
  return [
    systemSettingsApiPlugin(),
    secureBootApiPlugin(),
    certStoreApiPlugin(),
    tlsScannerApiPlugin(),
    ocspApiPlugin(),
    ctSearchApiPlugin(),
  ]
}
