import type { LucideIcon } from 'lucide-react'
import { BookOpen, Code, FileKey, Globe, Shield } from 'lucide-react'

import type { EducationCategory, TermId } from '@/types'

export interface EducationCategoryConfig {
  id: EducationCategory
  translationKey: 'secureBoot' | 'certificates' | 'protocols' | 'formats'
  icon: LucideIcon
  keys: readonly TermId[]
}

export const EDUCATION_CATEGORIES: readonly EducationCategoryConfig[] = [
  {
    id: 'secure-boot',
    translationKey: 'secureBoot',
    icon: Shield,
    keys: ['nvram', 'db', 'dbx', 'kek', 'pk', 'efi', 'uac'],
  },
  {
    id: 'certificates',
    translationKey: 'certificates',
    icon: FileKey,
    keys: ['rootCa', 'intermediateCa', 'leafCert', 'csr'],
  },
  {
    id: 'protocols',
    translationKey: 'protocols',
    icon: Globe,
    keys: ['ocsp', 'crl', 'ocspStapling', 'ctlog'],
  },
  {
    id: 'formats',
    translationKey: 'formats',
    icon: Code,
    keys: ['x509', 'pem', 'der'],
  },
]

const CATEGORY_MAP: Readonly<Record<EducationCategory, EducationCategoryConfig>> = {
  'secure-boot': EDUCATION_CATEGORIES[0],
  certificates: EDUCATION_CATEGORIES[1],
  protocols: EDUCATION_CATEGORIES[2],
  formats: EDUCATION_CATEGORIES[3],
}

export function getEducationCategoryMeta(category: EducationCategory): {
  icon: LucideIcon
  translationKey: string
} {
  const found = CATEGORY_MAP[category]
  if (!found) {
    return { icon: BookOpen, translationKey: category }
  }
  return { icon: found.icon, translationKey: found.translationKey }
}

export interface TextSegment {
  kind: 'text' | 'code' | 'token'
  value: string
}

const CARD_SPLIT_REGEX =
  /(['"]---BEGIN\.\.\.['"]|['"]---END\.\.\.['"]|\bBase64(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bX\.509\b|\bPKCS#10\b|\bSHA-(?:256|384|512)\b|\bcrt\.sh\b)/

const CARD_EXACT_REGEX =
  /^(?:['"]---BEGIN\.\.\.['"]|['"]---END\.\.\.['"]|\bBase64(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bX\.509\b|\bPKCS#10\b|\bSHA-(?:256|384|512)\b|\bcrt\.sh\b)$/

const MODAL_SPLIT_REGEX =
  /(['"]-----BEGIN [A-Z0-9 ]+-----['"]|['"]---BEGIN\.\.\.['"]|['"]---END\.\.\.['"]|\bDER-ASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bDER ASN\.1\b|\bASN\.1(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bBase64(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bS\/MIME(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bASCII(?:-[A-Za-zÄÖÜäöüß]+)?\b|\bCSRs?\b|\bX\.509\b|\bPKCS#10\b|\bSHA-(?:256|384|512)\b|\bchmod 600\b|\bcA:(?:TRUE|FALSE)\b|\bpathLenConstraint\b|\bdigitalSignature\b|\bkeyEncipherment\b|\bkeyCompromise\b|\baffiliationChanged\b|\bthisUpdate\b|\bnextUpdate\b|\bCertificateStatus\b|\bGetFirmwareEnvironmentVariable(?:Ex)?\b|\bCertOpenStore\b|\bVARIABLE_ATTRIBUTE_NON_VOLATILE\b|\bBOOTSERVICE_ACCESS\b|\bRUNTIME_ACCESS\b|\bEFI_CERT_SHA256_GUID\b|\bEFI_VARIABLE_AUTHENTICATION_2\b|\bCVE-\d{4}-\d{4,7}\b|\bRFC \d{3,5}\b|\bCERTIFICATE\b|\bRSA PRIVATE KEY\b|\bbootia32\.efi\b|\bshimx64\.efi\b)/

const MODAL_EXACT_REGEX = new RegExp(`^(?:${MODAL_SPLIT_REGEX.source.slice(1, -1)})$`)

function isQuotedBoundaryMarker(part: string): boolean {
  const hasSingleQuotes = part.startsWith("'") && part.endsWith("'")
  const hasDoubleQuotes = part.startsWith('"') && part.endsWith('"')
  if (!hasSingleQuotes && !hasDoubleQuotes) {
    return false
  }
  return part.includes('BEGIN') || part.includes('END')
}

function tokenizeByRegex(text: string, splitRegex: RegExp, exactRegex: RegExp): TextSegment[] {
  if (!text) {
    return []
  }
  const parts = text.split(splitRegex)
  const segments: TextSegment[] = []

  for (const part of parts) {
    if (!part) {
      continue
    }
    if (isQuotedBoundaryMarker(part)) {
      segments.push({ kind: 'code', value: part.slice(1, -1) })
    } else if (exactRegex.test(part)) {
      segments.push({ kind: 'token', value: part })
    } else {
      segments.push({ kind: 'text', value: part })
    }
  }

  return segments
}

export function parseCardTokens(text: string): TextSegment[] {
  return tokenizeByRegex(text, CARD_SPLIT_REGEX, CARD_EXACT_REGEX)
}

export function parseModalInlineTokens(text: string): TextSegment[] {
  return tokenizeByRegex(text, MODAL_SPLIT_REGEX, MODAL_EXACT_REGEX)
}

export interface LeadSentenceParts {
  termName: string
  acronym: string
  rest: string
}

export function parseLeadSentence(sentence: string): LeadSentenceParts | null {
  const match = sentence.match(/^([^.():]{3,65}?)\s*\(([^()]{2,20})\)(.*)$/)
  if (!match) {
    return null
  }
  const [, termName, acronym, rest] = match
  return {
    termName: termName.trim(),
    acronym: acronym.trim(),
    rest,
  }
}

export function splitOverviewSentences(overview: string): string[] {
  if (!overview) {
    return []
  }
  const normalized = overview.trim()
  if (!normalized) {
    return []
  }

  const safe = normalized
    .replace(/\bz\.\s*B\./g, 'z\uE000 B\uE000')
    .replace(/\b(e\.g|i\.e|ca|vs)\./gi, '$1\uE000')

  const rawSentences = safe
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜŠĐČĆŽŚŹŻŁА-ЯЉЊЋЂЏЈ0-9])/)
    .map((sentence) => sentence.replace(/\uE000/g, '.').trim())
    .filter(Boolean)

  return rawSentences.length > 0 ? rawSentences : [normalized]
}

export function splitKeyPointHeading(point: string): { head: string; body: string } | null {
  const colonIdx = point.indexOf(':')
  if (colonIdx > 0 && colonIdx < 52) {
    return {
      head: point.slice(0, colonIdx + 1),
      body: point.slice(colonIdx + 1),
    }
  }
  return null
}

export function extractTermCardContent(
  key: TermId,
  rawText: string,
  x509Title: string,
): { title: string; definition: string } {
  if (key === 'x509') {
    return { title: x509Title, definition: rawText }
  }
  const firstPeriodIdx = rawText.indexOf('.')
  if (firstPeriodIdx > 0 && firstPeriodIdx < 60) {
    return {
      title: rawText.slice(0, firstPeriodIdx),
      definition: rawText.slice(firstPeriodIdx + 1).trim(),
    }
  }
  return {
    title: key.toUpperCase(),
    definition: rawText,
  }
}
