import type { Plugin } from 'vite'

import { certStoreApiPlugin } from './cert-store-plugin'
import { ctSearchApiPlugin } from './ct-search-plugin'
import { ocspApiPlugin } from './ocsp-plugin'
import { secureBootApiPlugin } from './secure-boot-plugin'
import { systemSettingsApiPlugin } from './system-settings-plugin'
import { tlsScannerApiPlugin } from './tls-scanner-plugin'

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
