import { isValidCountryCode } from '@/data/country-codes'
import type {
  CsrFieldErrors,
  CsrTranslateFn,
  CsrValidationOptions,
  CsrValidationResult,
  CsrValidationSubject,
} from '@/types'

import {
  isValidEmail,
  isValidIpv4,
  isValidIpv6,
  translateWithFallback,
  validatePrivateKeyPem,
  validateSanItem,
} from './ip-san-validation'

export { isValidEmail, isValidIpv4, isValidIpv6, validatePrivateKeyPem, validateSanItem }
export type {
  CsrFieldErrors,
  CsrTranslateFn,
  CsrValidationOptions,
  CsrValidationResult,
  CsrValidationSubject,
}

export const PLACEHOLDER_CN_LIST = [
  'example.com',
  'e.g. example.com',
  'www.example.com',
  'beispiel.de',
  'z. b. beispiel.de',
  'primjer.ba',
  'npr. primjer.ba',
  'primer.rs',
  'нпр. primer.rs',
  'mis. example.com',
  'np. example.com',
  'example.org',
  'example.net',
  'test.com',
  'placeholder',
  'example',
]

export const PLACEHOLDER_ORG_LIST = [
  'my company',
  'organization',
  'organisation',
  'organizacija',
  'организација',
  'organisasi',
  'moja firma',
  'e.g. organization',
  'e.g. my company',
  'np. moja firma',
  'npr. moja kompanija',
]

export const PLACEHOLDER_OU_LIST = [
  'it',
  'it dept',
  'it department',
  'it-abteilung',
  'it odjel',
  'ит одељење',
  'dept it',
  'dział it',
]

export const PLACEHOLDER_LOC_LIST = ['city', 'stadt', 'grad', 'град', 'kota', 'miejscowość']

export const PLACEHOLDER_STATE_LIST = [
  'state',
  'bundesland',
  'regija',
  'регион',
  'provinsi',
  'województwo',
]

/**
 * Check if an individual field contains a known generic placeholder value
 */
export function isPlaceholderValue(
  field: 'cn' | 'org' | 'ou' | 'locality' | 'state',
  value: string,
): boolean {
  if (!value) {
    return false
  }
  let clean = value.trim().toLowerCase()
  clean = clean.replace(/^(e\.g\.|z\.\s*b\.|npr\.|np\.|mis\.)\s*/i, '')
  if (!clean) {
    return false
  }

  switch (field) {
    case 'cn':
      return PLACEHOLDER_CN_LIST.includes(clean)
    case 'org':
      return PLACEHOLDER_ORG_LIST.includes(clean)
    case 'ou':
      return PLACEHOLDER_OU_LIST.includes(clean)
    case 'locality':
      return PLACEHOLDER_LOC_LIST.includes(clean)
    case 'state':
      return PLACEHOLDER_STATE_LIST.includes(clean)
    default:
      return false
  }
}

/**
 * Check if the provided subject contains only generic placeholder values
 */
export function isOnlyPlaceholderSubject(subject: CsrValidationSubject): boolean {
  const cleanCn = subject.cn.trim().toLowerCase()
  if (!cleanCn) {
    return true
  }
  if (!isPlaceholderValue('cn', cleanCn)) {
    return false
  }

  const nonCnFields: Array<['org' | 'ou' | 'locality' | 'state', string]> = [
    ['org', subject.org || ''],
    ['ou', subject.ou || ''],
    ['locality', subject.locality || ''],
    ['state', subject.state || ''],
  ]

  return nonCnFields.every(([field, val]) => !val.trim() || isPlaceholderValue(field, val))
}

function applyPlaceholderRules(
  subject: CsrValidationSubject,
  checkPlaceholders: boolean | undefined,
  t: CsrTranslateFn | undefined,
  errors: CsrFieldErrors,
  warnings: string[],
): void {
  const trimmedCn = subject.cn.trim()
  const trimmedLocality = (subject.locality || '').trim()
  const trimmedOrg = (subject.org || '').trim()
  const trimmedOu = (subject.ou || '').trim()
  const trimmedState = (subject.state || '').trim()

  if (checkPlaceholders) {
    if (trimmedCn && isPlaceholderValue('cn', trimmedCn)) {
      errors.cn = translateWithFallback(
        t,
        'app.csr.validation.placeholderCn',
        `Generic placeholder detected for Common Name ("${trimmedCn}"). Please provide a real domain or identity.`,
        { value: trimmedCn },
      )
    }
    if (trimmedLocality && isPlaceholderValue('locality', trimmedLocality)) {
      errors.locality = translateWithFallback(
        t,
        'app.csr.validation.placeholderLoc',
        `Generic placeholder detected for City ("${trimmedLocality}"). Please provide a real locality name or leave blank.`,
        { value: trimmedLocality },
      )
    }
    if (trimmedOrg && isPlaceholderValue('org', trimmedOrg)) {
      errors.org = translateWithFallback(
        t,
        'app.csr.validation.placeholderOrg',
        `Generic placeholder detected for Organization ("${trimmedOrg}"). Please provide a real organization name or leave blank.`,
        { value: trimmedOrg },
      )
    }
    if (trimmedOu && isPlaceholderValue('ou', trimmedOu)) {
      errors.ou = translateWithFallback(
        t,
        'app.csr.validation.placeholderOu',
        `Generic placeholder detected for Organizational Unit ("${trimmedOu}"). Please provide a real unit name or leave blank.`,
        { value: trimmedOu },
      )
    }
    if (trimmedState && isPlaceholderValue('state', trimmedState)) {
      errors.state = translateWithFallback(
        t,
        'app.csr.validation.placeholderState',
        `Generic placeholder detected for State ("${trimmedState}"). Please provide a real state/province or leave blank.`,
        { value: trimmedState },
      )
    }

    if (isOnlyPlaceholderSubject(subject)) {
      if (!trimmedCn) {
        errors.cn = translateWithFallback(
          t,
          'app.csr.validation.cnRequired',
          'Common Name (CN) is required.',
        )
      } else {
        errors.general = translateWithFallback(
          t,
          'app.csr.validation.placeholderSetup',
          'Cannot create a certificate/CSR using only placeholder values. Please provide real subject details.',
        )
      }
    }
    return
  }

  if (trimmedLocality && isPlaceholderValue('locality', trimmedLocality)) {
    warnings.push(
      translateWithFallback(
        t,
        'app.csr.validation.placeholderLocWarning',
        `City contains generic placeholder value ("${trimmedLocality}"). Real geographic details are recommended for production CSRs.`,
        { value: trimmedLocality },
      ),
    )
  }
  if (trimmedOrg && isPlaceholderValue('org', trimmedOrg)) {
    warnings.push(
      translateWithFallback(
        t,
        'app.csr.validation.placeholderOrgWarning',
        `Organization contains generic placeholder value ("${trimmedOrg}").`,
        { value: trimmedOrg },
      ),
    )
  }
  if (trimmedState && isPlaceholderValue('state', trimmedState)) {
    warnings.push(
      translateWithFallback(
        t,
        'app.csr.validation.placeholderStateWarning',
        `State contains generic placeholder value ("${trimmedState}").`,
        { value: trimmedState },
      ),
    )
  }
}

/**
 * Main CSR validation function
 */
export function validateCsr(
  subject: CsrValidationSubject,
  options: CsrValidationOptions = {},
): CsrValidationResult {
  const errors: CsrFieldErrors = {}
  const warnings: string[] = []

  const trimmedCn = subject.cn.trim()
  const trimmedCountry = (subject.country || '').trim().toUpperCase()
  const trimmedState = (subject.state || '').trim()
  const trimmedLocality = (subject.locality || '').trim()
  const trimmedOrg = (subject.org || '').trim()
  const trimmedOu = (subject.ou || '').trim()
  const trimmedEmail = (subject.email || '').trim()

  const sanList = (options.sans || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (options.requireCn) {
    if (!trimmedCn) {
      errors.cn = translateWithFallback(
        options.t,
        'app.csr.validation.cnRequired',
        'Common Name (CN) is required.',
      )
    }
  } else if (!trimmedCn && sanList.length === 0) {
    errors.cn = translateWithFallback(
      options.t,
      'app.csr.validation.cnOrSanRequired',
      'A Common Name (CN) or at least one Subject Alternative Name (SAN) is required.',
    )
  }

  if (trimmedCn.length > 64) {
    errors.cn = translateWithFallback(
      options.t,
      'app.csr.validation.cnTooLong',
      `Common Name exceeds maximum allowable length of 64 characters (current: ${trimmedCn.length}).`,
      { count: trimmedCn.length },
    )
  }
  if (trimmedOrg.length > 64) {
    errors.org = translateWithFallback(
      options.t,
      'app.csr.validation.orgTooLong',
      `Organization exceeds maximum allowable length of 64 characters (current: ${trimmedOrg.length}).`,
      { count: trimmedOrg.length },
    )
  }
  if (trimmedOu.length > 64) {
    errors.ou = translateWithFallback(
      options.t,
      'app.csr.validation.ouTooLong',
      `Organizational Unit exceeds maximum allowable length of 64 characters (current: ${trimmedOu.length}).`,
      { count: trimmedOu.length },
    )
  }
  if (trimmedState.length > 128) {
    errors.state = translateWithFallback(
      options.t,
      'app.csr.validation.stateTooLong',
      `State / Province exceeds maximum allowable length of 128 characters (current: ${trimmedState.length}).`,
      { count: trimmedState.length },
    )
  }
  if (trimmedLocality.length > 128) {
    errors.locality = translateWithFallback(
      options.t,
      'app.csr.validation.localityTooLong',
      `Locality / City exceeds maximum allowable length of 128 characters (current: ${trimmedLocality.length}).`,
      { count: trimmedLocality.length },
    )
  }

  if (trimmedCountry && !isValidCountryCode(trimmedCountry)) {
    errors.country = translateWithFallback(
      options.t,
      'app.csr.validation.countryInvalid',
      `Country Code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, GB). Received "${trimmedCountry}".`,
      { code: trimmedCountry },
    )
  }

  if (trimmedEmail) {
    if (trimmedEmail.length > 255) {
      errors.email = translateWithFallback(
        options.t,
        'app.csr.validation.emailTooLong',
        'Email address exceeds maximum allowable length of 255 characters.',
      )
    } else if (!isValidEmail(trimmedEmail)) {
      errors.email = translateWithFallback(
        options.t,
        'app.csr.validation.emailInvalid',
        `Invalid email address format: "${trimmedEmail}".`,
        { email: trimmedEmail },
      )
    }
  }

  for (const san of sanList) {
    const res = validateSanItem(san, options.t)
    if (!res.valid && res.error) {
      errors.sans = res.error
      break
    }
  }

  if (options.existingKeyPem !== undefined) {
    const keyRes = validatePrivateKeyPem(options.existingKeyPem, options.t)
    if (!keyRes.valid && keyRes.error) {
      errors.existingKey = keyRes.error
    }
  }

  applyPlaceholderRules(subject, options.checkPlaceholders, options.t, errors, warnings)

  if (options.serverAuthEnabled && sanList.length === 0) {
    warnings.push(
      translateWithFallback(
        options.t,
        'app.csr.validation.sanMissingWarning',
        'TLS Server Authentication is selected, but no Subject Alternative Names (SANs) are defined. Modern browsers and TLS clients (RFC 2818) ignore Common Name and will reject this certificate.',
      ),
    )
  }

  if (trimmedCn.startsWith('*.') && !sanList.includes(trimmedCn)) {
    warnings.push(
      translateWithFallback(
        options.t,
        'app.csr.validation.wildcardCnSanWarning',
        `Common Name is a wildcard (${trimmedCn}), but it is not listed in SANs. Make sure to add it to SANs for broad client compatibility.`,
        { cn: trimmedCn },
      ),
    )
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  }
}
