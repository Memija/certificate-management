export { fetchLocalApiJson, WebApiUnavailableError } from '../api-client'
export { type FallbackCertStoreEntry, getWebFallbackCertStore } from './cert-store-fallback'
export {
  buildDerAndPemCert,
  getFallbackKeyPair,
  type SynthCertSpec,
  type SynthesizedCert,
} from './cert-synth'
export { searchCtLogsClientSide, verifyOcspClientSide } from './ocsp-ct-fallback'
export { getWebFallbackSecureBootVars } from './secure-boot-fallback'
export { scanTlsClientSide } from './tls-fallback'
