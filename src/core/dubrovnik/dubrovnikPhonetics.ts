import {
  STANDARD_TO_DUBROVNIK_MAP,
  DUBROVNIK_PHRASE_MAPPINGS,
} from './dubrovnikDictionary';

export type DubrovnikRegister = 'classical' | 'traditional' | 'contemporary';

/**
 * Known male names ending in -o that strictly follow the a-declension in Dubrovnik speech:
 * N: Vlaho, Maro, Baldo, Đuro, Niko, Šiško, Jozo, Luko, Antun/Antunko, Ivo
 * G: Vlaha, Mara, Balda, Đura, Nika... (NEVER Mari, Đuri, Vlahi)
 * D/L: Vlahu, Maru, Baldu, Đuru...
 * Possessive: Matov, Đurov, Vlahov, Nikov (NEVER Matin, Đurin)
 */
export const DUBROVNIK_MALE_NAMES = [
  'Vlaho',
  'Maro',
  'Baldo',
  'Đuro',
  'Niko',
  'Šiško',
  'Jozo',
  'Luko',
  'Miho',
  'Đivo',
  'Frano',
  'Pero',
  'Vido',
  'Cvijeto',
];

/**
 * Contracts diphthongs -ao and -uo into long -ō / -o (rekō, gledō, poslō).
 */
export function contractDiphthongs(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])(\p{L}+)ao(?=[^\p{L}]|$)/gu, '$1ō')
    .replace(/(?<=^|[^\p{L}])(\p{L}+)uo(?=[^\p{L}]|$)/gu, '$1ō');
}

/**
 * Inserts epenthetic /j/ between /i/ and /o/ (bijo, vidijo, mirijo, činijo).
 */
export function insertEpentheticJ(text: string): string {
  if (!text) return '';
  // Avoid replacing words like "radio" or "kino" where -io is lexical/international
  return text.replace(
    /(?<=^|[^\p{L}])(bio|vidio|mjerio|činio|učinio|kupio|stavio|ostavio|tražio|mislio|platio|molio|lovio|skočio|nosio|živio|volio)(?=[^\p{L}]|$)/giu,
    (match) => {
      const lower = match.toLowerCase();
      let res = lower.replace(/io$/, 'ijo');
      if (lower === 'bio') res = 'bijo';
      if (lower === 'mjerio') res = 'mírijo';
      if (match[0] === match[0].toUpperCase()) {
        return res.charAt(0).toUpperCase() + res.slice(1);
      }
      return res;
    }
  );
}

/**
 * Replaces cluster /hv/ with /f/ (fála, fálit, pofalit, zafalit).
 */
export function replaceHvWithF(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])hval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'H' ? `Fál${end}` : `fál${end}`))
    .replace(/(?<=^|[^\p{L}])pohval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'P' ? `Pofal${end}` : `pofal${end}`))
    .replace(/(?<=^|[^\p{L}])zahval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'Z' ? `Zafal${end}` : `zafal${end}`));
}

/**
 * Shifts final -m to -n in 1st person past/present forms and instrumental (sam -> san, vidio sam -> vidijo san).
 */
export function shiftFinalMtoN(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])sam(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'San' : 'san'))
    .replace(/(?<=^|[^\p{L}])bih(?=[^\p{L}]|$)/giu, 'bi')
    .replace(/(?<=^|[^\p{L}])joj(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'J' ? 'Jon' : 'jon'));
}

/**
 * Simplifies dental cluster endings: bolest -> boles, čist -> čis, deset -> dese, mast -> mas.
 */
export function simplifyDentalClusters(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])bolest(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'B' ? 'Boles' : 'boles'))
    .replace(/(?<=^|[^\p{L}])čist(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'Č' ? 'Čis' : 'čis'))
    .replace(/(?<=^|[^\p{L}])deset(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'D' ? 'Dese' : 'dese'))
    .replace(/(?<=^|[^\p{L}])mast(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'M' ? 'Mas' : 'mas'));
}

/**
 * Validates and corrects male name declensions according to Ragusan a-declension.
 * (e.g. "kod Mare" -> "kod Mara", "idemo s Marom" -> "idemo s Marom", "rekao sam Mati" -> "rekao sam Matu").
 */
export function enforceMaleNameDeclensions(text: string): string {
  if (!text) return '';
  let res = text;

  // Dative/Locative: male names on -o take -u instead of -i (Mari -> Maru, Đuri -> Đuru, Vlahi -> Vlahu)
  res = res
    .replace(/(?<=^|[^\p{L}])Mari(?=[^\p{L}]|$)/gu, 'Maru')
    .replace(/(?<=^|[^\p{L}])mari(?=[^\p{L}]|$)/gu, 'maru')
    .replace(/(?<=^|[^\p{L}])Đuri(?=[^\p{L}]|$)/gu, 'Đuru')
    .replace(/(?<=^|[^\p{L}])đuri(?=[^\p{L}]|$)/gu, 'đuru')
    .replace(/(?<=^|[^\p{L}])Vlahi(?=[^\p{L}]|$)/gu, 'Vlahu')
    .replace(/(?<=^|[^\p{L}])vlahi(?=[^\p{L}]|$)/gu, 'vlahu')
    .replace(/(?<=^|[^\p{L}])Niki(?=[^\p{L}]|$)/gu, 'Niku')
    .replace(/(?<=^|[^\p{L}])niki(?=[^\p{L}]|$)/gu, 'niku')
    .replace(/(?<=^|[^\p{L}])Baldi(?=[^\p{L}]|$)/gu, 'Baldu')
    .replace(/(?<=^|[^\p{L}])baldi(?=[^\p{L}]|$)/gu, 'baldu')
    .replace(/(?<=^|[^\p{L}])Luki(?=[^\p{L}]|$)/gu, 'Luku')
    .replace(/(?<=^|[^\p{L}])luki(?=[^\p{L}]|$)/gu, 'luku');

  // Genitive: kod Mare -> kod Mara (when referring to male names)
  res = res
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza)\s+Mare(?=[^\p{L}]|$)/giu, '$1 Mara')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza)\s+Đure(?=[^\p{L}]|$)/giu, '$1 Đura')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza)\s+Vlahe(?=[^\p{L}]|$)/giu, '$1 Vlaha');

  // Fix improper possessives "Matin" -> "Matov", "Đurin" -> "Đurov", "Vlahin" -> "Vlahov"
  res = res
    .replace(/(?<=^|[^\p{L}])Matin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'M' ? `Matov${end}` : `matov${end}`))
    .replace(/(?<=^|[^\p{L}])Đurin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'Đ' ? `Đurov${end}` : `đurov${end}`))
    .replace(/(?<=^|[^\p{L}])Vlahin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'V' ? `Vlahov${end}` : `vlahov${end}`));

  return res;
}

/**
 * 3rd Person Plural Verbs ending in -u instead of -e in Dubrovnik idiom:
 * oni govoru, vidu, stoju, činu, živu, mislu, nosu, dadu, znadu, imadu
 */
const THIRD_PERSON_PLURAL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+govore(?=[^\p{L}]|$)/giu, '$1 govoru'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+vide(?=[^\p{L}]|$)/giu, '$1 vidu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+stoje(?=[^\p{L}]|$)/giu, '$1 stoju'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+čine(?=[^\p{L}]|$)/giu, '$1 činu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+žive(?=[^\p{L}]|$)/giu, '$1 živu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+misle(?=[^\p{L}]|$)/giu, '$1 mislu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+nose(?=[^\p{L}]|$)/giu, '$1 nosu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+daju(?=[^\p{L}]|$)/giu, '$1 dadu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+znaju(?=[^\p{L}]|$)/giu, '$1 znadu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+imaju(?=[^\p{L}]|$)/giu, '$1 imadu'],
  // Standalone frequent 3rd-person forms
  [/(?<=^|[^\p{L}])govore(?=[^\p{L}]|$)/giu, 'govoru'],
  [/(?<=^|[^\p{L}])vide(?=[^\p{L}]|$)/giu, 'vidu'],
  [/(?<=^|[^\p{L}])čine(?=[^\p{L}]|$)/giu, 'činu'],
  [/(?<=^|[^\p{L}])misle(?=[^\p{L}]|$)/giu, 'mislu'],
];

/**
 * Applies 3rd-person plural verb substitutions (govore -> govoru, vide -> vidu, etc.).
 */
export function applyThirdPersonPlural(text: string): string {
  if (!text) return '';
  let res = text;
  for (const [pattern, replacement] of THIRD_PERSON_PLURAL_REPLACEMENTS) {
    res = res.replace(pattern, replacement);
  }
  return res;
}

/**
 * Transforms standard Croatian text into authentic Dubrovnik vernacular dialogue.
 * Preserves punctuation, diacritics, and case formatting.
 */
export function transformToDubrovnikDialect(
  text: string,
  register: DubrovnikRegister = 'contemporary'
): string {
  if (!text) return '';

  let transformed = text;

  // 1. Apply multi-word phrase mappings first
  for (const [pattern, replacement] of DUBROVNIK_PHRASE_MAPPINGS) {
    transformed = transformed.replace(pattern, replacement);
  }

  // 2. Apply single-word dictionary replacements with case preservation
  transformed = transformed.replace(/(?<=^|[^\p{L}])(\p{L}+)(?=[^\p{L}]|$)/gu, (word) => {
    const lower = word.toLowerCase();
    const mapped = STANDARD_TO_DUBROVNIK_MAP.get(lower);
    if (!mapped) return word;

    // Preserve ALL CAPS
    if (word.length > 1 && word === word.toUpperCase()) {
      return mapped.toUpperCase();
    }
    // Preserve Title Case
    if (word[0] === word[0].toUpperCase()) {
      return mapped.charAt(0).toUpperCase() + mapped.slice(1);
    }
    return mapped;
  });

  // 3. Apply phonological transformations
  transformed = insertEpentheticJ(transformed);
  transformed = contractDiphthongs(transformed);
  transformed = replaceHvWithF(transformed);
  transformed = shiftFinalMtoN(transformed);
  transformed = simplifyDentalClusters(transformed);
  transformed = enforceMaleNameDeclensions(transformed);
  transformed = applyThirdPersonPlural(transformed);

  // 4. Register-specific nuances
  if (register === 'classical') {
    // Gundulić / Držić style: ensure archaisms like "sluga van se" and "drage voje"
    transformed = transformed
      .replace(/\buistinu\b/gi, 'čertamente')
      .replace(/\bnaravno\b/gi, 'čertamente')
      .replace(/\bmišljenje\b/gi, 'parer');
  }

  return transformed;
}

/**
 * Phonetically optimizes Dubrovnik text for TTS synthesis (Gemini 2.5 TTS & Web Speech API).
 * Replaces orthographic special characters (like ō) with natural phonetic expansions
 * and ensures punctuation creates theatrical breath pauses.
 */
export function prepareDubrovnikTtsText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Expand contracted long ō into natural spoken o for TTS engines
      .replace(/ō/g, 'o')
      .replace(/ô/g, 'o')
      .replace(/ộ/g, 'o')
      // Ensure pauses after Dubrovnik exclamations and vocatives
      .replace(/\b(gosparu|gospar|Mare|Ane|Kate|Vlaho|Maro|bona|dušo),\s*/gi, '$1, ... ')
      .replace(/\b(muči|adio|fála|čertamente),\s*/gi, '$1, ... ')
      // Normalize double spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}
