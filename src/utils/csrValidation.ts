import forge from 'node-forge';

const pki = forge.pki || (forge as any).default?.pki;

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
  'example'
];

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
  'npr. moja kompanija'
];

export const PLACEHOLDER_OU_LIST = [
  'it',
  'it dept',
  'it department',
  'it-abteilung',
  'it odjel',
  'ит одељење',
  'dept it',
  'dział it'
];

export const PLACEHOLDER_LOC_LIST = [
  'city',
  'stadt',
  'grad',
  'град',
  'kota',
  'miejscowość'
];

export const PLACEHOLDER_STATE_LIST = [
  'state',
  'bundesland',
  'regija',
  'регион',
  'provinsi',
  'województwo'
];

export interface CsrValidationSubject {
  cn: string;
  country?: string;
  state?: string;
  locality?: string;
  org?: string;
  ou?: string;
  email?: string;
}

export type CsrTranslateFn = any;

export interface CsrValidationOptions {
  /** If true, cn cannot be empty. If false, either cn OR at least one SAN must be present. */
  requireCn?: boolean;
  /** Whether to validate SAN items syntax */
  sans?: string;
  /** Whether TLS Server Authentication is requested (triggers SAN advisory warning if missing) */
  serverAuthEnabled?: boolean;
  /** Validate an existing private key PEM */
  existingKeyPem?: string;
  /** Check for placeholder-only subject values */
  checkPlaceholders?: boolean;
  /** Optional i18next translation function */
  t?: CsrTranslateFn;
}

function tr(t: CsrTranslateFn | undefined, key: string, fallback: string, params?: Record<string, any>): string {
  if (t) {
    return t(key, { defaultValue: fallback, ...params });
  }
  let msg = fallback;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }
  }
  return msg;
}

export interface CsrFieldErrors {
  cn?: string;
  country?: string;
  state?: string;
  locality?: string;
  org?: string;
  ou?: string;
  email?: string;
  sans?: string;
  existingKey?: string;
  general?: string;
}

export interface CsrValidationResult {
  isValid: boolean;
  errors: CsrFieldErrors;
  warnings: string[];
}

/**
 * Validate an IPv4 address string (e.g. 192.168.1.1)
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return false;
    if (part.length > 1 && part.startsWith('0')) return false; // no leading zeros
  }
  return true;
}

/**
 * Validate an IPv6 address string
 */
export function isValidIpv6(ip: string): boolean {
  if (!ip.includes(':')) return false;
  // Match standard and compressed IPv6
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
  return ipv6Regex.test(ip.trim());
}

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate individual SAN items
 */
export function validateSanItem(item: string, t?: CsrTranslateFn): { valid: boolean; error?: string } {
  const trimmed = item.trim();
  if (!trimmed) return { valid: true };

  // Detect IP address
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    if (!isValidIpv4(trimmed)) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanInvalidIpv4', `Invalid IPv4 address: "${trimmed}" (octets must be 0-255 with no leading zeros).`, { san: trimmed })
      };
    }
    return { valid: true };
  }

  if (trimmed.includes(':') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('urn:')) {
    if (!isValidIpv6(trimmed)) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanInvalidIpv6', `Invalid IPv6 address: "${trimmed}".`, { san: trimmed })
      };
    }
    return { valid: true };
  }

  // Detect URI
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('urn:')) {
    try {
      new URL(trimmed);
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanInvalidUri', `Invalid URI: "${trimmed}".`, { san: trimmed })
      };
    }
  }

  // Detect Email
  if (trimmed.includes('@') && !trimmed.includes('/')) {
    if (!isValidEmail(trimmed)) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanInvalidEmail', `Invalid email address in SAN: "${trimmed}".`, { san: trimmed })
      };
    }
    return { valid: true };
  }

  // DNS Name / FQDN validation
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      error: tr(t, 'app.csr.validation.sanDnsSpaces', `DNS name cannot contain spaces: "${trimmed}".`, { san: trimmed })
    };
  }

  if (trimmed.length > 253) {
    return {
      valid: false,
      error: tr(t, 'app.csr.validation.sanDnsTooLong', `DNS name exceeds maximum length of 253 characters: "${trimmed}".`, { san: trimmed })
    };
  }

  // Wildcard checks (RFC 6125)
  if (trimmed.includes('*')) {
    if (!trimmed.startsWith('*.')) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanWildcardNotFirst', `Invalid wildcard in "${trimmed}". Wildcards must only appear as the first label (e.g. *.example.com).`, { san: trimmed })
      };
    }
    const afterWildcard = trimmed.substring(2);
    if (afterWildcard.includes('*')) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanMultipleWildcards', `Multiple wildcards are not permitted: "${trimmed}".`, { san: trimmed })
      };
    }
    if (!afterWildcard.includes('.')) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanWildcardTld', `Wildcards directly on TLDs are not permitted: "${trimmed}".`, { san: trimmed })
      };
    }
  }

  // Check labels
  const labels = trimmed.split('.');
  for (const label of labels) {
    if (!label) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanConsecutiveDots', `DNS name contains empty label or consecutive dots: "${trimmed}".`, { san: trimmed })
      };
    }
    if (label === '*') continue; // top wildcard label is allowed
    if (label.length > 63) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanLabelTooLong', `DNS label "${label}" exceeds maximum length of 63 characters.`, { label })
      };
    }
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.sanInvalidLabelChars', `Invalid DNS label "${label}". Labels must contain only letters, numbers, and hyphens (cannot start or end with a hyphen).`, { label })
      };
    }
  }

  return { valid: true };
}

/**
 * Validate an existing RSA private key PEM
 */
export function validatePrivateKeyPem(pem: string, t?: CsrTranslateFn): { valid: boolean; bitLength?: number; error?: string } {
  const trimmed = pem.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: tr(t, 'app.csr.validation.keyRequired', 'Private key is required.')
    };
  }

  try {
    const privKey = pki.privateKeyFromPem(trimmed);
    if (!privKey || !privKey.n) {
      return {
        valid: false,
        error: tr(t, 'app.csr.validation.keyNotRsa', 'The provided key is not a recognized RSA private key.')
      };
    }
    const bitLength = privKey.n.bitLength();
    if (bitLength < 2048) {
      return {
        valid: false,
        bitLength,
        error: tr(t, 'app.csr.validation.keyTooSmall', `RSA key size (${bitLength} bits) is insecure. Modern PKI and Certificate Authorities require at least 2048 bits.`, { bits: bitLength })
      };
    }
    return { valid: true, bitLength };
  } catch (err: any) {
    return {
      valid: false,
      error: tr(t, 'app.csr.validation.keyInvalid', err.message || 'Invalid private key PEM format or corrupted key data.')
    };
  }
}

/**
 * Check if an individual field contains a known generic placeholder value
 */
export function isPlaceholderValue(
  field: 'cn' | 'org' | 'ou' | 'locality' | 'state',
  value: string
): boolean {
  if (!value) return false;
  let clean = value.trim().toLowerCase();
  clean = clean.replace(/^(e\.g\.|z\.\s*b\.|npr\.|np\.|mis\.)\s*/i, '');
  if (!clean) return false;

  switch (field) {
    case 'cn':
      return PLACEHOLDER_CN_LIST.includes(clean);
    case 'org':
      return PLACEHOLDER_ORG_LIST.includes(clean);
    case 'ou':
      return PLACEHOLDER_OU_LIST.includes(clean);
    case 'locality':
      return PLACEHOLDER_LOC_LIST.includes(clean);
    case 'state':
      return PLACEHOLDER_STATE_LIST.includes(clean);
    default:
      return false;
  }
}

/**
 * Check if the provided subject contains only generic placeholder values
 */
export function isOnlyPlaceholderSubject(subject: CsrValidationSubject): boolean {
  const cleanCn = subject.cn.trim().toLowerCase();
  if (!cleanCn) return true;
  if (!isPlaceholderValue('cn', cleanCn)) return false;

  const nonCnFields: Array<['org' | 'ou' | 'locality' | 'state', string]> = [
    ['org', subject.org || ''],
    ['ou', subject.ou || ''],
    ['locality', subject.locality || ''],
    ['state', subject.state || ''],
  ];

  const allFilledArePlaceholders = nonCnFields.every(
    ([field, val]) => !val.trim() || isPlaceholderValue(field, val)
  );

  return allFilledArePlaceholders;
}

/**
 * Main CSR validation function
 */
export function validateCsr(
  subject: CsrValidationSubject,
  options: CsrValidationOptions = {}
): CsrValidationResult {
  const errors: CsrFieldErrors = {};
  const warnings: string[] = [];

  const trimmedCn = subject.cn.trim();
  const trimmedCountry = (subject.country || '').trim().toUpperCase();
  const trimmedState = (subject.state || '').trim();
  const trimmedLocality = (subject.locality || '').trim();
  const trimmedOrg = (subject.org || '').trim();
  const trimmedOu = (subject.ou || '').trim();
  const trimmedEmail = (subject.email || '').trim();

  // Parse SANs
  const sanList = (options.sans || '')
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);

  // 1. Identity validation (CN / SAN)
  if (options.requireCn) {
    if (!trimmedCn) {
      errors.cn = tr(options.t, 'app.csr.validation.cnRequired', 'Common Name (CN) is required.');
    }
  } else {
    // Either CN or at least one SAN must be provided
    if (!trimmedCn && sanList.length === 0) {
      errors.cn = tr(options.t, 'app.csr.validation.cnOrSanRequired', 'A Common Name (CN) or at least one Subject Alternative Name (SAN) is required.');
    }
  }

  // 2. Field length limits (RFC 5280)
  if (trimmedCn.length > 64) {
    errors.cn = tr(options.t, 'app.csr.validation.cnTooLong', `Common Name exceeds maximum allowable length of 64 characters (current: ${trimmedCn.length}).`, { count: trimmedCn.length });
  }
  if (trimmedOrg.length > 64) {
    errors.org = tr(options.t, 'app.csr.validation.orgTooLong', `Organization exceeds maximum allowable length of 64 characters (current: ${trimmedOrg.length}).`, { count: trimmedOrg.length });
  }
  if (trimmedOu.length > 64) {
    errors.ou = tr(options.t, 'app.csr.validation.ouTooLong', `Organizational Unit exceeds maximum allowable length of 64 characters (current: ${trimmedOu.length}).`, { count: trimmedOu.length });
  }
  if (trimmedState.length > 128) {
    errors.state = tr(options.t, 'app.csr.validation.stateTooLong', `State / Province exceeds maximum allowable length of 128 characters (current: ${trimmedState.length}).`, { count: trimmedState.length });
  }
  if (trimmedLocality.length > 128) {
    errors.locality = tr(options.t, 'app.csr.validation.localityTooLong', `Locality / City exceeds maximum allowable length of 128 characters (current: ${trimmedLocality.length}).`, { count: trimmedLocality.length });
  }

  // 3. Country Code (C) - strictly 2 letters ISO 3166-1 alpha-2
  if (trimmedCountry) {
    if (!/^[A-Za-z]{2}$/.test(trimmedCountry)) {
      errors.country = tr(options.t, 'app.csr.validation.countryInvalid', `Country Code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, GB). Received "${trimmedCountry}".`, { code: trimmedCountry });
    }
  }

  // 4. Email validation
  if (trimmedEmail) {
    if (trimmedEmail.length > 255) {
      errors.email = tr(options.t, 'app.csr.validation.emailTooLong', 'Email address exceeds maximum allowable length of 255 characters.');
    } else if (!isValidEmail(trimmedEmail)) {
      errors.email = tr(options.t, 'app.csr.validation.emailInvalid', `Invalid email address format: "${trimmedEmail}".`, { email: trimmedEmail });
    }
  }

  // 5. SANs validation
  for (const san of sanList) {
    const res = validateSanItem(san, options.t);
    if (!res.valid && res.error) {
      errors.sans = res.error;
      break; // Stop at first invalid SAN error
    }
  }

  // 6. Existing private key validation (if provided)
  if (options.existingKeyPem !== undefined) {
    const keyRes = validatePrivateKeyPem(options.existingKeyPem, options.t);
    if (!keyRes.valid && keyRes.error) {
      errors.existingKey = keyRes.error;
    }
  }

  // 7. Placeholder checks
  if (options.checkPlaceholders) {
    if (trimmedCn && isPlaceholderValue('cn', trimmedCn)) {
      errors.cn = tr(options.t, 'app.csr.validation.placeholderCn', `Generic placeholder detected for Common Name ("${trimmedCn}"). Please provide a real domain or identity.`, { value: trimmedCn });
    }
    if (trimmedLocality && isPlaceholderValue('locality', trimmedLocality)) {
      errors.locality = tr(options.t, 'app.csr.validation.placeholderLoc', `Generic placeholder detected for City ("${trimmedLocality}"). Please provide a real locality name or leave blank.`, { value: trimmedLocality });
    }
    if (trimmedOrg && isPlaceholderValue('org', trimmedOrg)) {
      errors.org = tr(options.t, 'app.csr.validation.placeholderOrg', `Generic placeholder detected for Organization ("${trimmedOrg}"). Please provide a real organization name or leave blank.`, { value: trimmedOrg });
    }
    if (trimmedOu && isPlaceholderValue('ou', trimmedOu)) {
      errors.ou = tr(options.t, 'app.csr.validation.placeholderOu', `Generic placeholder detected for Organizational Unit ("${trimmedOu}"). Please provide a real unit name or leave blank.`, { value: trimmedOu });
    }
    if (trimmedState && isPlaceholderValue('state', trimmedState)) {
      errors.state = tr(options.t, 'app.csr.validation.placeholderState', `Generic placeholder detected for State ("${trimmedState}"). Please provide a real state/province or leave blank.`, { value: trimmedState });
    }

    if (isOnlyPlaceholderSubject(subject)) {
      if (!trimmedCn) {
        errors.cn = tr(options.t, 'app.csr.validation.cnRequired', 'Common Name (CN) is required.');
      } else {
        errors.general = tr(options.t, 'app.csr.validation.placeholderSetup', 'Cannot create a certificate/CSR using only placeholder values. Please provide real subject details.');
      }
    }
  } else {
    // If not strictly blocking, provide advisory warnings
    if (trimmedLocality && isPlaceholderValue('locality', trimmedLocality)) {
      warnings.push(tr(options.t, 'app.csr.validation.placeholderLocWarning', `City contains generic placeholder value ("${trimmedLocality}"). Real geographic details are recommended for production CSRs.`, { value: trimmedLocality }));
    }
    if (trimmedOrg && isPlaceholderValue('org', trimmedOrg)) {
      warnings.push(tr(options.t, 'app.csr.validation.placeholderOrgWarning', `Organization contains generic placeholder value ("${trimmedOrg}").`, { value: trimmedOrg }));
    }
    if (trimmedState && isPlaceholderValue('state', trimmedState)) {
      warnings.push(tr(options.t, 'app.csr.validation.placeholderStateWarning', `State contains generic placeholder value ("${trimmedState}").`, { value: trimmedState }));
    }
  }

  // 8. Advisories & Warnings
  // If TLS Server Authentication (serverAuth) is enabled, SAN is mandatory in modern Web PKI
  if (options.serverAuthEnabled && sanList.length === 0) {
    warnings.push(
      tr(options.t, 'app.csr.validation.sanMissingWarning', 'TLS Server Authentication is selected, but no Subject Alternative Names (SANs) are defined. Modern browsers and TLS clients (RFC 2818) ignore Common Name and will reject this certificate.')
    );
  }

  // If CN is a wildcard but SAN doesn't include it
  if (trimmedCn.startsWith('*.') && !sanList.includes(trimmedCn)) {
    warnings.push(
      tr(options.t, 'app.csr.validation.wildcardCnSanWarning', `Common Name is a wildcard (${trimmedCn}), but it is not listed in SANs. Make sure to add it to SANs for broad client compatibility.`, { cn: trimmedCn })
    );
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
