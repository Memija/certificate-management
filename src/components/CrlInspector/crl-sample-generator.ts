import type { ParsedCRL } from '@/types'
import { parseCrlText, SAMPLE_CRL_PEM } from '@/utils/crl-parser'

export const SAMPLE_CRL_FILENAME = 'sample_revocation_list.crl'

export interface LoadedCRL {
  id: string
  name: string
  crl: ParsedCRL
  isSample?: boolean
}

export function createSampleLoadedCrl(): LoadedCRL {
  const parsed = parseCrlText(SAMPLE_CRL_PEM)
  return {
    id: `sample-crl-${Date.now()}`,
    name: SAMPLE_CRL_FILENAME,
    crl: parsed,
    isSample: true,
  }
}
