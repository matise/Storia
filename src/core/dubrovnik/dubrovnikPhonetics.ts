import {
  STANDARD_TO_DUBROVNIK_MAP,
  DUBROVNIK_PHRASE_MAPPINGS,
} from './dubrovnikDictionary';

export type DubrovnikRegister = 'classical' | 'traditional' | 'contemporary';

/**
 * Male proper names ending in -o that strictly follow the Ragusan a-declension:
 * N: Vlaho, Maro, Baldo, Đuro, Niko, Šiško, Jozo, Luko, Miho, Đivo, Frano, Mato, Pero, Sabo...
 * G: Vlaha, Mara, Balda, Đura, Nika, Šiška, Joza, Luka, Miha, Điva, Frana, Mata (NEVER Mari, Đuri, Vlahi)
 * D/L: Vlahu, Maru, Baldu, Đuru, Niku, Luku, Franu, Matu...
 * Possessive: Vlahov, Marov, Baldov, Đurov, Nikov, Matov (NEVER Matin, Đurin, Vlahin)
 */
export const DUBROVNIK_MALE_NAMES = [
  'Vlaho',
  'Maro',
  'Maroje',
  'Baldo',
  'Đuro',
  'Niko',
  'Nikša',
  'Šiško',
  'Jozo',
  'Luko',
  'Miho',
  'Đivo',
  'Dživo',
  'Frano',
  'Pero',
  'Vido',
  'Cvijeto',
  'Mato',
  'Sabo',
  'Baro',
  'Ilar',
  'Andro',
  'Andriko',
  'Antun',
  'Vice',
  'Jako',
  'Jero',
  'Joso',
  'Lukan',
  'Lukša',
  'Pepo',
  'Rado',
  'Santo',
  'Stijepo',
  'Uđo',
];

/**
 * Traditional female proper names with characteristic -e endings and declension:
 */
export const DUBROVNIK_FEMALE_NAMES = [
  'Mare',
  'Jele',
  'Kate',
  'Luce',
  'Frane',
  'Pave',
  'Tere',
  'Nike',
  'Džive',
  'Đive',
  'Đide',
  'Klare',
  'Lukre',
  'Made',
  'Mara',
  'Nina',
  'Siđe',
  'Uđe',
  'Vica',
];

/**
 * Contracts final and stem diphthongs -ao and -uo into long -ō / -o (rekō, gledō, poslō, umbō).
 * Documented in Tolja (2020) and Ligorio (2009).
 */
export function contractDiphthongs(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])(\p{L}+)ao(?=[^\p{L}]|$)/gu, '$1ō')
    .replace(/(?<=^|[^\p{L}])(\p{L}+)uo(?=[^\p{L}]|$)/gu, '$1ō');
}

/**
 * Inserts epenthetic /j/ between /i/ and /o/ in past participles and verb stems
 * (bijo, vidijo, mirijo, učinijo, udrījo, kupijo).
 * Excludes internationalisms like radio, studio, trio, kino.
 */
export function insertEpentheticJ(text: string): string {
  if (!text) return '';
  const TARGET_VERBS = [
    'bio', 'vidio', 'mjerio', 'činio', 'učinio', 'kupio', 'stavio', 'ostavio',
    'tražio', 'mislio', 'platio', 'molio', 'lovio', 'skočio', 'nosio', 'živio',
    'volio', 'otvorio', 'zatvorio', 'izvadio', 'donio', 'odnio', 'spasio',
    'popio', 'udario', 'osjetio', 'izgubio', 'bacio', 'uhitio', 'učijo',
  ];

  const pattern = new RegExp(
    `(?<=^|[^\\p{L}])(${TARGET_VERBS.join('|')})(?=[^\\p{L}]|$)`,
    'giu'
  );

  return text.replace(pattern, (match) => {
    const lower = match.toLowerCase();
    let res: string;
    if (lower === 'bio') {
      res = 'bijo';
    } else if (lower === 'mjerio') {
      res = 'mírijo';
    } else if (lower === 'donio') {
      res = 'donijo';
    } else if (lower === 'odnio') {
      res = 'odnijo';
    } else {
      res = lower.replace(/io$/, 'ijo');
    }

    if (match[0] === match[0].toUpperCase()) {
      return res.charAt(0).toUpperCase() + res.slice(1);
    }
    return res;
  });
}

/**
 * Replaces consonant cluster /hv/ with /f/ (fála, fálit, pofalit, zafalit).
 */
export function replaceHvWithF(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])hval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'H' ? `Fál${end}` : `fál${end}`))
    .replace(/(?<=^|[^\p{L}])pohval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'P' ? `Pofal${end}` : `pofal${end}`))
    .replace(/(?<=^|[^\p{L}])zahval(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'Z' ? `Zafal${end}` : `zafal${end}`))
    .replace(/(?<=^|[^\p{L}])hvat(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'H' ? `Fat${end}` : `fat${end}`));
}

/**
 * Shifts final -m to -n in 1st person past/present forms and instrumental endings:
 * sam -> san, gledao sam -> gledō san, nožem -> nožon, s gosparom -> s gosparon.
 * Documented in Tolja (2020: 22) and Brajčić (2022).
 */
export function shiftFinalMtoN(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])sam(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'San' : 'san'))
    .replace(/(?<=^|[^\p{L}])nisam(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'N' ? 'Nisan' : 'nisan'))
    .replace(/(?<=^|[^\p{L}])bih(?=[^\p{L}]|$)/giu, 'bi')
    .replace(/(?<=^|[^\p{L}])joj(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'J' ? 'Jon' : 'jon'))
    .replace(/(?<=^|[^\p{L}])sa\s+mnom(?=[^\p{L}]|$)/giu, 'sa mnon')
    .replace(/(?<=^|[^\p{L}])sobom(?=[^\p{L}]|$)/giu, 'sobon');
}

/**
 * Simplifies dental cluster endings:
 * -st -> -s (bolest -> boles, čist -> čis, mast -> mas, krst -> krs)
 * -et -> -e (deset -> dese)
 * -st -> -s in loanword adjectives (disposto -> dispos)
 * Documented in Tolja (2020: 85) and Ljubičić & Kovačić (2019: 38).
 */
export function simplifyDentalClusters(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])bolest(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'B' ? 'Boles' : 'boles'))
    .replace(/(?<=^|[^\p{L}])čist(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'Č' ? 'Čis' : 'čis'))
    .replace(/(?<=^|[^\p{L}])čista(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'Č' ? 'Čista' : 'čista'))
    .replace(/(?<=^|[^\p{L}])deset(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'D' ? 'Dese' : 'dese'))
    .replace(/(?<=^|[^\p{L}])mast(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'M' ? 'Mas' : 'mas'))
    .replace(/(?<=^|[^\p{L}])mladost(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'M' ? 'Mlados' : 'mlados'))
    .replace(/(?<=^|[^\p{L}])starost(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'Staros' : 'staros'))
    .replace(/(?<=^|[^\p{L}])svijest(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'Svis' : 'svis'))
    .replace(/(?<=^|[^\p{L}])lakomost(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'L' ? 'Lakomos' : 'lakomos'))
    .replace(/(?<=^|[^\p{L}])disposto(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'D' ? 'Dispos' : 'dispos'));
}

/**
 * Vocalization of Romance and Slavic final -l to -o in masculine singular nominatives:
 * gentile -> džintio, crudele -> krudeo, stomacale -> stomakao, papagallo -> papagao,
 * stol -> sto, sokol -> soko.
 * Documented in Ljubičić & Kovačić (2019: 39) and Ligorio & Kapović (2011).
 */
export function vocalizeFinalL(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])gentil(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'G' ? 'Džintio' : 'džintio'))
    .replace(/(?<=^|[^\p{L}])đentil(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'Đ' ? 'Džintio' : 'džintio'))
    .replace(/(?<=^|[^\p{L}])sokol(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'Soko' : 'soko'))
    .replace(/(?<=^|[^\p{L}])stol(?=[^\p{L}]|$)/giu, (m) => (m[0] === 'S' ? 'Sto' : 'sto'));
}

/**
 * Elision of epenthetic /l/ in vernacular tokens:
 * čeljad -> čejad, biljet -> bijet, divlji -> divji, ljubica -> jubica.
 * Documented in Tolja (2020: 79).
 */
export function elideVernacularL(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?<=^|[^\p{L}])biljet(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'B' ? `Bijet${end}` : `bijet${end}`))
    .replace(/(?<=^|[^\p{L}])divlj(\p{L}+)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'D' ? `Divj${end}` : `divj${end}`))
    .replace(/(?<=^|[^\p{L}])ljubic(\p{L}+)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'L' ? `Jubic${end}` : `jubic${end}`));
}

/**
 * Validates and strictly corrects male name declensions according to Ragusan a-declension.
 * (e.g., "kod Mare" -> "kod Mara", "dao sam Mati" -> "dao sam Matu", "Matin sin" -> "Matov sin").
 */
export function enforceMaleNameDeclensions(text: string): string {
  if (!text) return '';
  let res = text;

  // 1. Dative/Locative: male names ending in -o take -u instead of standard -i
  const namesForDative = [
    ['Maro', 'Mari', 'Maru'],
    ['Đuro', 'Đuri', 'Đuru'],
    ['Vlaho', 'Vlahi', 'Vlahu'],
    ['Niko', 'Niki', 'Niku'],
    ['Baldo', 'Baldi', 'Baldu'],
    ['Luko', 'Luki', 'Luku'],
    ['Mato', 'Mati', 'Matu'],
    ['Pero', 'Peri', 'Peru'],
    ['Sabo', 'Sabi', 'Sabu'],
    ['Baro', 'Bari', 'Baru'],
    ['Miho', 'Mihi', 'Mihu'],
    ['Frano', 'Frani', 'Franu'],
    ['Jozo', 'Jozi', 'Jozu'],
    ['Šiško', 'Šiški', 'Šišku'],
  ];

  for (const [, wrongDat, rightDat] of namesForDative) {
    const regUpper = new RegExp(`(?<=^|[^\\p{L}])${wrongDat}(?=[^\\p{L}]|$)`, 'gu');
    const regLower = new RegExp(`(?<=^|[^\\p{L}])${wrongDat.toLowerCase()}(?=[^\\p{L}]|$)`, 'gu');
    res = res.replace(regUpper, rightDat).replace(regLower, rightDat.toLowerCase());
  }

  // 2. Genitive with spatial prepositions for male names: "kod Mare" -> "kod Mara"
  res = res
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Mare(?=[^\p{L}]|$)/gu, '$1 Mara')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Đure(?=[^\p{L}]|$)/gu, '$1 Đura')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Vlahe(?=[^\p{L}]|$)/gu, '$1 Vlaha')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Luke(?=[^\p{L}]|$)/gu, '$1 Luka')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Mate(?=[^\p{L}]|$)/gu, '$1 Mata')
    .replace(/(?<=^|[^\p{L}])(kod|od|do|iz|ispred|iza|prije|blizu)\s+Pere(?=[^\p{L}]|$)/gu, '$1 Pera');

  // 3. Possessives: -ov instead of standard -in
  res = res
    .replace(/(?<=^|[^\p{L}])Matin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'M' ? `Matov${end}` : `matov${end}`))
    .replace(/(?<=^|[^\p{L}])Đurin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'Đ' ? `Đurov${end}` : `đurov${end}`))
    .replace(/(?<=^|[^\p{L}])Vlahin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'V' ? `Vlahov${end}` : `vlahov${end}`))
    .replace(/(?<=^|[^\p{L}])Nikin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'N' ? `Nikov${end}` : `nikov${end}`))
    .replace(/(?<=^|[^\p{L}])Lukin(\p{L}*)(?=[^\p{L}]|$)/giu, (m, end) => (m[0] === 'L' ? `Lukov${end}` : `lukov${end}`));

  return res;
}

/**
 * 3rd Person Plural Verbs ending in -u instead of -e:
 * oni govoru, vidu, stoju, činu, živu, mislu, nosu, dadu, znadu, imadu, radu.
 * Documented in Tolja (2020: 86) and Ligorio & Kapović (2011).
 */
const THIRD_PERSON_PLURAL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+govore(?=[^\p{L}]|$)/giu, '$1 govoru'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+vide(?=[^\p{L}]|$)/giu, '$1 vidu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+stoje(?=[^\p{L}]|$)/giu, '$1 stoju'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+čine(?=[^\p{L}]|$)/giu, '$1 činu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+žive(?=[^\p{L}]|$)/giu, '$1 živu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+misle(?=[^\p{L}]|$)/giu, '$1 mislu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+nose(?=[^\p{L}]|$)/giu, '$1 nosu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+rade(?=[^\p{L}]|$)/giu, '$1 radu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+daju(?=[^\p{L}]|$)/giu, '$1 dadu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+znaju(?=[^\p{L}]|$)/giu, '$1 znadu'],
  [/(?<=^|[^\p{L}])(oni|one|ona)\s+imaju(?=[^\p{L}]|$)/giu, '$1 imadu'],
  // Standalone frequent 3rd-person plural forms
  [/(?<=^|[^\p{L}])govore(?=[^\p{L}]|$)/giu, 'govoru'],
  [/(?<=^|[^\p{L}])vide(?=[^\p{L}]|$)/giu, 'vidu'],
  [/(?<=^|[^\p{L}])čine(?=[^\p{L}]|$)/giu, 'činu'],
  [/(?<=^|[^\p{L}])misle(?=[^\p{L}]|$)/giu, 'mislu'],
  [/(?<=^|[^\p{L}])nose(?=[^\p{L}]|$)/giu, 'nosu'],
];

/**
 * Applies 3rd-person plural verb substitutions.
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
 * Drops the final -i in standard Croatian infinitives (čitat, hodit, doć, ispeć).
 * Documented in Tolja (2020: 86).
 */
export function truncateInfinitives(text: string): string {
  if (!text) return '';
  return text.replace(/(?<=^|[^\p{L}])(\p{L}+(?:va|iva|ira|ova|i|a|e))ti(?=[^\p{L}]|$)/gu, '$1t');
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
  transformed = vocalizeFinalL(transformed);
  transformed = elideVernacularL(transformed);
  transformed = truncateInfinitives(transformed);
  transformed = enforceMaleNameDeclensions(transformed);
  transformed = applyThirdPersonPlural(transformed);

  // 4. Register-specific nuances
  if (register === 'classical') {
    // Držić / Gundulić 16th/17th Century style
    transformed = transformed
      .replace(/\buistinu\b/gi, 'čertamente')
      .replace(/\bnaravno\b/gi, 'čertamente')
      .replace(/\bmišljenje\b/gi, 'parer')
      .replace(/\bbarem\b/gi, 'almanko')
      .replace(/\biznenada\b/gi, "all' improvviso")
      .replace(/\bodmah\b/gi, 'subito')
      .replace(/\bvrlo\b/gi, 'vele');
  } else if (register === 'traditional') {
    // Late 19th / early 20th Century urban vernacular (Bojanić & Trivunac)
    transformed = transformed
      .replace(/\bdanas\b/gi, 'danaske')
      .replace(/\bkut\b/gi, 'kantun');
  }

  return transformed;
}

/**
 * Phonetically optimizes Dubrovnik text for TTS synthesis (Gemini 2.5 TTS, ElevenLabs, Web Speech API).
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
      .replace(/ā/g, 'a')
      .replace(/ē/g, 'e')
      .replace(/ī/g, 'i')
      .replace(/ū/g, 'u')
      // Ensure theatrical pauses after Dubrovnik exclamations and vocatives
      .replace(/\b(gosparu|gospar|Mare|Ane|Kate|Vlaho|Maro|bona|dušo|čeljadi),\s*/gi, '$1, ... ')
      .replace(/\b(muči|adio|fála|čertamente|bogme),\s*/gi, '$1, ... ')
      // Normalize double spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}