/**
 * Utility functions for parsing, splitting, and localizing certificate purposes
 * and Key Usage extension values.
 */

// Mapping of normalized aliases to canonical translation keys
const PURPOSE_ALIASES: Record<string, string> = {
  certificatesigning: 'certificatesigning',
  certificatesign: 'certificatesign',
  keycertsign: 'certificatesigning',
  crlsigning: 'crlsigning',
  crlsign: 'crlsign',
  offlinecrlsigning: 'offlinecrlsigning',
  digitalsignature: 'digitalsignature',
  nonrepudiation: 'nonrepudiation',
  keyencipherment: 'keyencipherment',
  dataencipherment: 'dataencipherment',
  keyagreement: 'keyagreement',
  encipheronly: 'encipheronly',
  decipheronly: 'decipheronly',
  serverauth: 'serverauthentication',
  serverauthentication: 'serverauthentication',
  clientauth: 'clientauthentication',
  clientauthentication: 'clientauthentication',
  codesigning: 'codesigning',
  emailprotection: 'emailprotection',
  secureemail: 'secureemail',
  timestamping: 'timestamping',
  ocspsigning: 'ocspsigning',
  smartcardlogon: 'smartcardlogon',
  ipsecendsystem: 'ipsecendsystem',
  ipsectunnel: 'ipsectunnel',
  ipsecuser: 'ipsecuser',
  anypurpose: 'anypurpose',
  generalpurpose: 'generalpurpose',
  generalpurposenotspecified: 'generalpurposenotspecified',
  notspecified: 'notspecified',
  nonespecified: 'nonespecified',
};

/**
 * Splits a list of purposes that may contain comma-separated values,
 * bitmasks in parentheses like '(86)', or extra whitespace.
 */
export function splitPurposes(purposes: string[] = []): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of purposes) {
    if (!raw) continue;
    // Remove trailing/embedded bitmasks like (86) or (a0)
    const withoutBitmask = raw.replace(/\s*\([0-9a-fA-F]+\)/g, '').trim();
    // If it contains commas, split it
    const parts = withoutBitmask.includes(',')
      ? withoutBitmask.split(',').map(s => s.trim()).filter(Boolean)
      : [withoutBitmask];

    for (const p of parts) {
      if (!p) continue;
      const key = p.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
  }

  return result.length > 0 ? result : ['General Purpose'];
}

/**
 * Translates an individual purpose string using react-i18next `t`.
 */
export function translatePurpose(
  p: string,
  t: (key: string, fallback?: any) => string
): string {
  if (!p) return '';
  const clean = p.replace(/\s*\([0-9a-fA-F]+\)/g, '').trim();
  const norm = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Try direct key, canonical alias, or fallback
  const alias = PURPOSE_ALIASES[norm] || norm;
  const translationKey = `app.winCertStore.purposes.${alias}`;
  const translated = t(translationKey, t(`app.winCertStore.purposes.${norm}`, clean));

  return translated || clean;
}

/**
 * Formats and localizes a Key Usage extension value string, such as:
 * "Digital Signature, Certificate Signing, Off-line CRL Signing, CRL Signing (86)"
 * Preserves the trailing hex bitmask e.g. "(86)" while translating each individual purpose.
 */
export function formatKeyUsageValue(
  val: string,
  t: (key: string, fallback?: any) => string
): string {
  if (!val) return '';
  // Check for trailing bitmask in parentheses like (86)
  const bitmaskMatch = val.match(/\s*(\([0-9a-fA-F]+\))\s*$/);
  const bitmask = bitmaskMatch ? bitmaskMatch[1] : '';
  const clean = val.replace(/\s*\([0-9a-fA-F]+\)\s*$/, '').trim();

  if (!clean.includes(',') && !PURPOSE_ALIASES[clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()]) {
    // If it's not a comma-separated list or recognized purpose, return with bitmask if any
    return val;
  }

  const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
  const translatedParts = parts.map(p => translatePurpose(p, t));
  const joined = translatedParts.join(', ');

  return bitmask ? `${joined} ${bitmask}` : joined;
}

/**
 * Joins a list of purposes into a comma-separated localized string.
 */
export function formatPurposesList(
  purposes: string[] = [],
  t: (key: string, fallback?: any) => string
): string {
  const list = splitPurposes(purposes);
  return list.map(p => translatePurpose(p, t)).join(', ');
}

/**
 * Formats an extension value (e.g. Key Usage, Basic Constraints, EKU, SCTs) into a readable, localized representation.
 */
export function formatExtensionValue(
  name: string = '',
  oid: string = '',
  value: string = '',
  t: (key: string, fallback?: any) => string
): string {
  if (!value) return '';
  const normName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Key Usage (2.5.29.15)
  if (normName === 'keyusage' || oid === '2.5.29.15') {
    return formatKeyUsageValue(value, t);
  }

  // 2. Extended Key Usage / Enhanced Key Usage (2.5.29.37)
  if (normName === 'extkeyusage' || normName === 'extendedkeyusage' || normName === 'enhancedkeyusage' || oid === '2.5.29.37') {
    const parts = value.split(',').map(s => s.trim()).filter(Boolean);
    const translatedParts = parts.map(part => {
      const match = part.match(/^([^()]+?)(?:\s*\(([\d\.]+)\))?$/);
      if (match) {
        const purposeName = match[1].trim();
        const oidSuffix = match[2];
        const translated = translatePurpose(purposeName, t);
        return oidSuffix ? `${translated} (${oidSuffix})` : translated;
      }
      return translatePurpose(part, t);
    });
    return translatedParts.join(', ');
  }

  // 3. Basic Constraints (2.5.29.19)
  if (normName === 'basicconstraints' || oid === '2.5.29.19') {
    let formatted = value;
    if (formatted.includes('Is CA: Yes')) {
      formatted = formatted.replace('Is CA: Yes', t('app.chain.isCaYes', 'Is CA: Yes'));
    } else if (formatted.includes('Is CA: No')) {
      formatted = formatted.replace('Is CA: No', t('app.chain.isCaNo', 'Is CA: No'));
    } else if (formatted.includes('01 01 FF') || formatted.includes('01 01 ff')) {
      formatted = `${t('app.chain.isCaYes', 'Is CA: Yes')} (${value})`;
    } else if (formatted.includes('01 01 00') || formatted.trim() === '30 00') {
      formatted = `${t('app.chain.isCaNo', 'Is CA: No')} (${value})`;
    }

    if (formatted.includes('Path Length Constraint:')) {
      const label = t('app.chain.pathLenConstraint', 'Path Length Constraint');
      formatted = formatted.replace('Path Length Constraint:', `${label}:`);
    }

    return formatted;
  }

  // 4. Timestamp List / SCTs (1.3.6.1.4.1.11129.2.4.2)
  if (normName === 'timestamplist' || normName === 'certificatetransparencyscts' || oid === '1.3.6.1.4.1.11129.2.4.2') {
    const bytesMatch = value.match(/Embedded Signed Certificate Timestamps\s*(?:\((\d+)\s*bytes\))?/i);
    if (bytesMatch) {
      const baseLabel = t('app.tlsScanner.embeddedSct', 'Embedded Signed Certificate Timestamps');
      return bytesMatch[1] ? `${baseLabel} (${bytesMatch[1]} bytes)` : baseLabel;
    }
  }

  // Fallback: If value contains non-printable binary characters, format as uppercase hex pairs
  if (/[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(value)) {
    return Array.from(value)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  return value;
}
