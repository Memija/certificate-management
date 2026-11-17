/**
 * Text Search & Transliteration Utilities
 *
 * Provides bidirectional Cyrillic <-> Latin transliteration and diacritic-insensitive
 * search normalization (supporting Serbian Cyrillic, Latin with diacritics, and ASCII).
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  // Serbian Cyrillic (Azbuka) -> Gaj's Latin
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'đ',
  е: 'e',
  ж: 'ž',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'ć',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'č',
  џ: 'dž',
  ш: 'š',
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Ђ: 'Đ',
  Е: 'E',
  Ж: 'Ž',
  З: 'Z',
  И: 'I',
  Ј: 'J',
  К: 'K',
  Л: 'L',
  Љ: 'Lj',
  М: 'M',
  Н: 'N',
  Њ: 'Nj',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  Ћ: 'Ć',
  У: 'U',
  Ф: 'F',
  Х: 'H',
  Ц: 'C',
  Ч: 'Č',
  Џ: 'Dž',
  Ш: 'Š',

  // Additional Slavic Cyrillic variations
  ё: 'e',
  э: 'e',
  ы: 'y',
  ю: 'ju',
  я: 'ja',
  й: 'j',
  щ: 'sc',
  ь: '',
  ъ: '',
  і: 'i',
  ї: 'ji',
  є: 'je',
  ў: 'u',
  Ё: 'E',
  Э: 'E',
  Ы: 'Y',
  Ю: 'Ju',
  Я: 'Ja',
  Й: 'J',
  Щ: 'Sc',
  І: 'I',
  Ї: 'Ji',
  Є: 'Je',
  Ў: 'U',
}

const LATIN_DIGRAPHS: [string, string][] = [
  ['dž', 'џ'],
  ['Dž', 'Џ'],
  ['DŽ', 'Џ'],
  ['lj', 'љ'],
  ['Lj', 'Љ'],
  ['LJ', 'Љ'],
  ['nj', 'њ'],
  ['Nj', 'Њ'],
  ['NJ', 'Њ'],
  ['dj', 'ђ'],
  ['Dj', 'Ђ'],
  ['DJ', 'Ђ'],
]

const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а',
  b: 'б',
  v: 'в',
  g: 'г',
  d: 'д',
  đ: 'ђ',
  e: 'е',
  ž: 'ж',
  z: 'з',
  i: 'и',
  j: 'ј',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  r: 'р',
  s: 'с',
  t: 'т',
  ć: 'ћ',
  u: 'у',
  f: 'ф',
  h: 'х',
  c: 'ц',
  č: 'ч',
  š: 'ш',
  A: 'А',
  B: 'Б',
  V: 'В',
  G: 'Г',
  D: 'Д',
  Đ: 'Ђ',
  E: 'Е',
  Ž: 'Ж',
  Z: 'З',
  I: 'И',
  J: 'Ј',
  K: 'К',
  L: 'Л',
  M: 'М',
  N: 'Н',
  O: 'О',
  P: 'П',
  R: 'Р',
  S: 'С',
  T: 'Т',
  Ć: 'Ћ',
  U: 'У',
  F: 'Ф',
  H: 'Х',
  C: 'Ц',
  Č: 'Ч',
  Š: 'Ш',
}

const NON_ASCII_RE = /[\u0080-\uFFFF]/

interface NormalizedEntry {
  rawLower: string
  norm: string
  ultra: string
}

const normCache = new Map<string, NormalizedEntry>()
const MAX_NORM_CACHE = 4096

/**
 * Transliterates Cyrillic text to Latin.
 */
export function cyrillicToLatin(text: string): string {
  if (!text) {
    return ''
  }
  if (!NON_ASCII_RE.test(text)) {
    return text
  }
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    out += CYRILLIC_TO_LATIN[ch] ?? ch
  }
  return out
}

/**
 * Transliterates Latin text to Serbian Cyrillic.
 */
export function latinToCyrillic(text: string): string {
  if (!text) {
    return ''
  }
  let res = text
  for (const [from, to] of LATIN_DIGRAPHS) {
    if (res.includes(from)) {
      res = res.split(from).join(to)
    }
  }
  let out = ''
  for (let i = 0; i < res.length; i++) {
    const ch = res[i]
    out += LATIN_TO_CYRILLIC[ch] ?? ch
  }
  return out
}

/**
 * Strips combining diacritics and converts non-combining accented letters
 * (č, ć, ž, š, đ) to base ASCII characters.
 */
export function stripDiacritics(text: string): string {
  if (!text) {
    return ''
  }
  if (!NON_ASCII_RE.test(text) && !/d[zZ]/i.test(text)) {
    return text
  }
  return text
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .replace(/dž/g, 'dz')
    .replace(/Dž/g, 'Dz')
    .replace(/DŽ/g, 'DZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function getNormalizedEntry(text: string): NormalizedEntry {
  const cached = normCache.get(text)
  if (cached) {
    return cached
  }

  const rawLower = text.toLowerCase()
  let norm: string
  let ultra: string

  if (!NON_ASCII_RE.test(rawLower)) {
    norm = rawLower.trim()
    ultra = norm.includes('dj') ? norm.replace(/dj/g, 'd') : norm
  } else {
    const latin = cyrillicToLatin(text)
    norm = stripDiacritics(latin.toLowerCase()).trim()
    ultra = norm.includes('dj') ? norm.replace(/dj/g, 'd') : norm
  }

  const entry: NormalizedEntry = { rawLower, norm, ultra }
  if (normCache.size >= MAX_NORM_CACHE) {
    normCache.clear()
  }
  normCache.set(text, entry)
  return entry
}

/**
 * Normalizes text for search indexing/comparison:
 * Converts Cyrillic to Latin, lowercases, and strips diacritics and extra whitespace.
 */
export function normalizeForSearch(text: string): string {
  if (!text) {
    return ''
  }
  return getNormalizedEntry(text).norm
}

function tokenMatches(targetText: string, token: string): boolean {
  if (targetText.includes(token)) {
    return true
  }
  if (token.length >= 4) {
    if (/[aeiou]$/.test(token) && targetText.includes(token.slice(0, -1))) {
      return true
    }
    const strippedSuffix = token.replace(/(ma|ima|ama|om|em|og|eg|im|ih|ov|ev)$/, '')
    if (strippedSuffix.length >= 3 && targetText.includes(strippedSuffix)) {
      return true
    }
  }
  return false
}

export interface PreparedSearchQuery {
  empty: boolean
  rawQueryLower: string
  normQuery: string
  queryTokens: string[]
  ultraQuery: string
  ultraTokens: string[]
  cyrillicQuery: string
  cyrillicTokens: string[]
}

let lastQueryRaw = ''
let lastPreparedQuery: PreparedSearchQuery | null = null

/**
 * Pre-computes all transliterated/normalized forms of a search query once so
 * filtering hundreds of items avoids re-normalizing the query on every item.
 */
export function prepareSearchQuery(searchQuery: string): PreparedSearchQuery {
  if (!searchQuery || !searchQuery.trim()) {
    return {
      empty: true,
      rawQueryLower: '',
      normQuery: '',
      queryTokens: [],
      ultraQuery: '',
      ultraTokens: [],
      cyrillicQuery: '',
      cyrillicTokens: [],
    }
  }

  if (searchQuery === lastQueryRaw && lastPreparedQuery) {
    return lastPreparedQuery
  }

  const rawQueryLower = searchQuery.toLowerCase().trim()
  const qEntry = getNormalizedEntry(searchQuery)
  const normQuery = qEntry.norm
  const queryTokens = normQuery.split(/\s+/).filter(Boolean)
  const ultraQuery = qEntry.ultra
  const ultraTokens = ultraQuery.split(/\s+/).filter(Boolean)
  const cyrillicQuery = latinToCyrillic(searchQuery).toLowerCase().trim()
  const cyrillicTokens = cyrillicQuery.split(/\s+/).filter(Boolean)

  const prepared: PreparedSearchQuery = {
    empty: false,
    rawQueryLower,
    normQuery,
    queryTokens,
    ultraQuery,
    ultraTokens,
    cyrillicQuery,
    cyrillicTokens,
  }

  lastQueryRaw = searchQuery
  lastPreparedQuery = prepared
  return prepared
}

export function matchesPreparedSearch(combinedTarget: string, q: PreparedSearchQuery): boolean {
  if (q.empty) {
    return true
  }
  if (!combinedTarget) {
    return false
  }

  const tEntry = getNormalizedEntry(combinedTarget)
  if (!tEntry.norm) {
    return false
  }

  if (tEntry.rawLower.includes(q.rawQueryLower)) {
    return true
  }

  if (tokenMatches(tEntry.norm, q.normQuery)) {
    return true
  }

  if (q.queryTokens.length > 0 && q.queryTokens.every((tok) => tokenMatches(tEntry.norm, tok))) {
    return true
  }

  if (q.ultraQuery !== q.normQuery || tEntry.ultra !== tEntry.norm) {
    if (tokenMatches(tEntry.ultra, q.ultraQuery)) {
      return true
    }
    if (q.ultraTokens.length > 0 && q.ultraTokens.every((tok) => tokenMatches(tEntry.ultra, tok))) {
      return true
    }
  }

  if (NON_ASCII_RE.test(tEntry.rawLower)) {
    if (tokenMatches(tEntry.rawLower, q.cyrillicQuery)) {
      return true
    }
    if (
      q.cyrillicTokens.length > 0 &&
      q.cyrillicTokens.every((tok) => tokenMatches(tEntry.rawLower, tok))
    ) {
      return true
    }
  }

  return false
}

/**
 * Checks whether target text(s) match a search query.
 */
export function matchesSearch(
  targets: string | null | undefined | (string | null | undefined)[],
  searchQuery: string,
): boolean {
  const prepared = prepareSearchQuery(searchQuery)
  if (prepared.empty) {
    return true
  }

  const combinedTarget = Array.isArray(targets) ? targets.filter(Boolean).join(' ') : targets || ''

  return matchesPreparedSearch(combinedTarget, prepared)
}
