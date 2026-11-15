/**
 * Text Search & Transliteration Utilities
 *
 * Provides bidirectional Cyrillic <-> Latin transliteration and diacritic-insensitive
 * search normalization (supporting Serbian Cyrillic, Latin with diacritics, and ASCII).
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  // Serbian Cyrillic (Azbuka) -> Gaj's Latin
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'ђ': 'đ', 'е': 'e', 'ж': 'ž', 'з': 'z', 'и': 'i',
  'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm',
  'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'ћ': 'ć', 'у': 'u', 'ф': 'f',
  'х': 'h', 'ц': 'c', 'ч': 'č', 'џ': 'dž', 'ш': 'š',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
  'Ђ': 'Đ', 'Е': 'E', 'Ж': 'Ž', 'З': 'Z', 'И': 'I',
  'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'Lj', 'М': 'M',
  'Н': 'N', 'Њ': 'Nj', 'О': 'O', 'П': 'P', 'Р': 'R',
  'С': 'S', 'Т': 'T', 'Ћ': 'Ć', 'У': 'U', 'Ф': 'F',
  'Х': 'H', 'Ц': 'C', 'Ч': 'Č', 'Џ': 'Dž', 'Ш': 'Š',

  // Additional Slavic Cyrillic variations
  'ё': 'e', 'э': 'e', 'ы': 'y', 'ю': 'ju', 'я': 'ja',
  'й': 'j', 'щ': 'sc', 'ь': '', 'ъ': '', 'і': 'i',
  'ї': 'ji', 'є': 'je', 'ў': 'u',
  'Ё': 'E', 'Э': 'E', 'Ы': 'Y', 'Ю': 'Ju', 'Я': 'Ja',
  'Й': 'J', 'Щ': 'Sc', 'І': 'I', 'Ї': 'Ji', 'Є': 'Je', 'Ў': 'U',
};

const LATIN_DIGRAPHS: [string, string][] = [
  ['dž', 'џ'], ['Dž', 'Џ'], ['DŽ', 'Џ'],
  ['lj', 'љ'], ['Lj', 'Љ'], ['LJ', 'Љ'],
  ['nj', 'њ'], ['Nj', 'Њ'], ['NJ', 'Њ'],
  ['dj', 'ђ'], ['Dj', 'Ђ'], ['DJ', 'Ђ'],
];

const LATIN_TO_CYRILLIC: Record<string, string> = {
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'đ': 'ђ', 'e': 'е', 'ž': 'ж', 'z': 'з', 'i': 'и',
  'j': 'ј', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н',
  'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т',
  'ć': 'ћ', 'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'ц',
  'č': 'ч', 'š': 'ш',
  'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д',
  'Đ': 'Ђ', 'E': 'Е', 'Ž': 'Ž', 'Z': 'З', 'I': 'И',
  'J': 'Ј', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н',
  'O': 'О', 'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т',
  'Ć': 'Ћ', 'U': 'У', 'F': 'Ф', 'H': 'Х', 'C': 'Ц',
  'Č': 'Ч', 'Š': 'Ш',
};

/**
 * Transliterates Cyrillic text to Latin.
 */
export function cyrillicToLatin(text: string): string {
  if (!text) return '';
  return text.split('').map(ch => CYRILLIC_TO_LATIN[ch] || ch).join('');
}

/**
 * Transliterates Latin text to Serbian Cyrillic.
 */
export function latinToCyrillic(text: string): string {
  if (!text) return '';
  let res = text;
  for (const [from, to] of LATIN_DIGRAPHS) {
    res = res.split(from).join(to);
  }
  return res.split('').map(ch => LATIN_TO_CYRILLIC[ch] || ch).join('');
}

/**
 * Strips combining diacritics and converts non-combining accented letters
 * (č, ć, ž, š, đ) to base ASCII characters.
 */
export function stripDiacritics(text: string): string {
  if (!text) return '';
  return text
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .replace(/dž/g, 'dz')
    .replace(/Dž/g, 'Dz')
    .replace(/DŽ/g, 'DZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Normalizes text for search indexing/comparison:
 * Converts Cyrillic to Latin, lowercases, and strips diacritics and extra whitespace.
 */
export function normalizeForSearch(text: string): string {
  if (!text) return '';
  const latin = cyrillicToLatin(text);
  const stripped = stripDiacritics(latin.toLowerCase());
  return stripped.trim();
}

/**
 * Secondary normalization that also maps 'dj' -> 'd' to handle varied South Slavic keyboard habits.
 */
function normalizeUltra(text: string): string {
  return normalizeForSearch(text).replace(/dj/g, 'd');
}

/**
 * Checks whether a single token matches inside the target text, allowing for
 * common Slavic inflection variations (case endings like -a, -u, -e, -i, -om, etc.).
 */
function tokenMatches(targetText: string, token: string): boolean {
  if (targetText.includes(token)) return true;
  if (token.length >= 4) {
    // Strip trailing vowel (e.g. 'razmena' -> 'razmen' matches 'razmenu')
    if (/[aeiou]$/.test(token) && targetText.includes(token.slice(0, -1))) {
      return true;
    }
    // Strip common inflection suffixes
    const strippedSuffix = token.replace(/(ma|ima|ama|om|em|og|eg|im|ih|ov|ev)$/, '');
    if (strippedSuffix.length >= 3 && targetText.includes(strippedSuffix)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether target text(s) match a search query.
 *
 * Handles:
 * - Direct substring matches (case-insensitive)
 * - Cyrillic content matched by Latin query (e.g. searching "baza" matches "База")
 * - Latin content matched by Cyrillic query (e.g. searching "база" matches "baza")
 * - Accent/diacritic insensitivity (e.g. "kljuc" matches "ključ" and "кључ")
 * - Multi-word / token search (all query words must match somewhere in targets)
 * - Inflection-tolerant matching for Slavic grammar
 */
export function matchesSearch(
  targets: string | null | undefined | (string | null | undefined)[],
  searchQuery: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const targetList = Array.isArray(targets) ? targets : [targets];
  const combinedTarget = targetList.filter(Boolean).join(' ');
  if (!combinedTarget.trim()) return false;

  const rawTargetLower = combinedTarget.toLowerCase();
  const rawQueryLower = searchQuery.toLowerCase().trim();

  // 1. Direct standard substring match
  if (rawTargetLower.includes(rawQueryLower)) return true;

  // 2. Normalized Cyrillic->Latin + diacritic-stripped comparison
  const normTarget = normalizeForSearch(combinedTarget);
  const normQuery = normalizeForSearch(searchQuery);

  if (tokenMatches(normTarget, normQuery)) return true;

  // 3. Multi-word search in normalized form
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.every(tok => tokenMatches(normTarget, tok))) {
    return true;
  }

  // 4. Ultra-normalized comparison ('dj' <-> 'd')
  const ultraTarget = normalizeUltra(combinedTarget);
  const ultraQuery = normalizeUltra(searchQuery);

  if (tokenMatches(ultraTarget, ultraQuery)) return true;

  const ultraTokens = ultraQuery.split(/\s+/).filter(Boolean);
  if (ultraTokens.every(tok => tokenMatches(ultraTarget, tok))) {
    return true;
  }

  // 5. Latin -> Cyrillic transliteration of query
  const cyrillicQuery = latinToCyrillic(searchQuery).toLowerCase().trim();
  if (tokenMatches(rawTargetLower, cyrillicQuery)) return true;

  const cyrillicTokens = cyrillicQuery.split(/\s+/).filter(Boolean);
  if (cyrillicTokens.every(tok => tokenMatches(rawTargetLower, tok))) {
    return true;
  }

  return false;
}
