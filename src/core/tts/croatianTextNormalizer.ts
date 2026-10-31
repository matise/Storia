import { SupportedLanguage } from '../../types/storia';

/**
 * Dictionary of common Croatian words frequently typed without diacritics (č, ć, ž, š, đ)
 * mapped to their canonical Croatian spelling.
 */
const CROATIAN_DIACRITIC_WORD_MAP: Record<string, string> = {
  sto: 'što',
  zasto: 'zašto',
  nesto: 'nešto',
  nista: 'ništa',
  jos: 'još',
  vec: 'već',
  covjek: 'čovjek',
  covjeka: 'čovjeka',
  covjece: 'čovječe',
  noc: 'noć',
  noci: 'noći',
  nocni: 'noćni',
  nocnog: 'noćnog',
  nocnom: 'noćnom',
  nocna: 'noćna',
  nocne: 'noćne',
  nocas: 'noćas',
  kaze: 'kaže',
  kazem: 'kažem',
  kazes: 'kažeš',
  kazu: 'kažu',
  vecer: 'večer',
  veceri: 'večeri',
  veceras: 'večeras',
  jucer: 'jučer',
  gledas: 'gledaš',
  gledam: 'gledam',
  previse: 'previše',
  vise: 'više',
  americkih: 'američkih',
  americki: 'američki',
  americke: 'američke',
  gusca: 'gušća',
  gusce: 'gušće',
  gusci: 'gušći',
  gutajuci: 'gutajući',
  kisa: 'kiša',
  kisi: 'kiši',
  kise: 'kiše',
  kisu: 'kišu',
  kisom: 'kišom',
  skripanje: 'škripanje',
  tracnica: 'tračnica',
  tracnice: 'tračnice',
  tracnicama: 'tračnicama',
  sapat: 'šapat',
  sapatom: 'šapatom',
  sapce: 'šapće',
  sapcuci: 'šapćući',
  ironicno: 'ironično',
  zvucna: 'zvučna',
  zvucni: 'zvučni',
  zvucno: 'zvučno',
  rijec: 'riječ',
  rijeci: 'riječi',
  recenica: 'rečenica',
  recenice: 'rečenice',
  recenicama: 'rečenicama',
  medutim: 'međutim',
  izmedu: 'između',
  takoder: 'također',
  mozda: 'možda',
  moze: 'može',
  mozes: 'možeš',
  mozemo: 'možemo',
  zelim: 'želim',
  zelis: 'želiš',
  zeli: 'želi',
  zivot: 'život',
  zivota: 'života',
  zivotu: 'životu',
  kuca: 'kuća',
  kuci: 'kući',
  kucu: 'kuću',
  kuce: 'kuće',
  pricati: 'pričati',
  pricam: 'pričam',
  pricas: 'pričaš',
  prica: 'priča',
  price: 'priče',
  pricu: 'priču',
  cuti: 'čuti',
  cujem: 'čujem',
  cujes: 'čuješ',
  cuje: 'čuje',
  osjecaj: 'osjećaj',
  osjecam: 'osjećam',
  osjecas: 'osjećaš',
  sreca: 'sreća',
  srece: 'sreće',
  pocetak: 'početak',
  pocetku: 'početku',
  kronicar: 'kroničar',
  povjesnicar: 'povjesničar',
  palagruza: 'Palagruža',
  palagruzi: 'Palagruži',
  palagruze: 'Palagruže',
  kovac: 'Kovač',
  kovaca: 'Kovača',
  kovacu: 'Kovaču',
  zagrebacki: 'zagrebački',
  zagrebackim: 'zagrebačkim',
  zagrebacke: 'zagrebačke',
  zagrebacka: 'zagrebačka',
  zagrebackoj: 'zagrebačkoj',
  dubrovacke: 'Dubrovačke',
  dubrovacki: 'dubrovački',
  dubrovackog: 'dubrovačkog',
  sluzbeni: 'službeni',
  sluzbena: 'službena',
  sluzbenih: 'službenih',
  pistolj: 'pištolj',
  pistolja: 'pištolja',
  pistolje: 'pištolje',
  pistolji: 'pištolji',
  oruzje: 'oružje',
  oruzja: 'oružja',
  dzep: 'džep',
  dzepu: 'džepu',
  tisina: 'tišina',
  tisini: 'tišini',
  tisinu: 'tišinu',
  sifra: 'šifra',
  sifre: 'šifre',
  siframa: 'šiframa',
  sifriranim: 'šifriranim',
  sesnaestog: 'šesnaestog',
  stoljece: 'stoljeće',
  stoljeca: 'stoljeća',
  stoljecu: 'stoljeću',
  knezevu: 'Kneževu',
  cuvaju: 'čuvaju',
  cuvar: 'čuvar',
  obavjestajca: 'obavještajca',
  obavjestajac: 'obavještajac',
  uzbudeno: 'uzbuđeno',
  uzbuden: 'uzbuđen',
  uzbudena: 'uzbuđena',
  tesko: 'teško',
  teska: 'teška',
  teski: 'teški',
  ultraljubicastom: 'ultraljubičastom',
  cinicni: 'cinični',
  bivsi: 'bivši',
  stihom: 'štihom',
  cesti: 'česti',
  kljucnih: 'ključnih',
  istrazivacica: 'istraživačica',
  ostroumna: 'oštroumna',
  povisen: 'povišen',
  sveznajuci: 'sveznajući',
  pripovjedac: 'pripovjedač',
  filmicna: 'filmična',
  filmican: 'filmičan',
  ciste: 'čiste',
  izmedju: 'između',
  medju: 'među',
  rodjen: 'rođen',
  rodjena: 'rođena',
  dodji: 'dođi',
  dodjite: 'dođite',
  prodji: 'prođi',
  udji: 'uđi',
  izadji: 'izađi',
  nadji: 'nađi',
};

/**
 * Common Croatian abbreviations expanded into full spoken words for natural TTS reading.
 */
const CROATIAN_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bdr\.\s*/gi, 'doktor '],
  [/\bmr\.\s*/gi, 'magistar '],
  [/\bprof\.\s*/gi, 'profesor '],
  [/\bgđa\.\s*/gi, 'gospođa '],
  [/\bgđica\.\s*/gi, 'gospođica '],
  [/\bvlč\.\s*/gi, 'velečasni '],
  [/\bnpr\.\s*/gi, 'na primjer '],
  [/\bitd\.\s*/gi, 'i tako dalje '],
  [/\btzv\.\s*/gi, 'takozvani '],
  [/\bbr\.\s+(?=\d)/gi, 'broj '],
];

/**
 * Checks whether a text string contains Croatian diacritics (č, ć, ž, š, đ)
 * or unmistakable Croatian vocabulary.
 */
export function containsCroatianCharacters(text: string): boolean {
  if (!text) return false;
  if (/[čćžšđČĆŽŠĐ]/.test(text)) return true;
  return /\b(što|zašto|nije|jesam|jesi|nego|prekoputa|svjetlo|sjene|magla|tramvaj)\b/i.test(
    text
  );
}

/**
 * Normalizes Unicode combining marks into precomposed NFC Croatian characters
 * (č, ć, ž, š, đ, Č, Ć, Ž, Š, Đ) and cleans typographic quotes/dashes.
 */
export function normalizeCroatianUnicode(text: string): string {
  if (!text) return '';

  return (
    text
      .normalize('NFC')
      // Explicit combining caron / acute / stroke fallbacks
      .replace(/c\u030C/g, 'č')
      .replace(/C\u030C/g, 'Č')
      .replace(/c\u0301/g, 'ć')
      .replace(/C\u0301/g, 'Ć')
      .replace(/z\u030C/g, 'ž')
      .replace(/Z\u030C/g, 'Ž')
      .replace(/s\u030C/g, 'š')
      .replace(/S\u030C/g, 'Š')
      .replace(/d\u0335/g, 'đ')
      .replace(/D\u0335/g, 'Đ')
      // Normalize typographic quotation marks that can confuse TTS tokenizers
      .replace(/[„“”«»]/g, '"')
      .replace(/[’‘]/g, "'")
  );
}

/**
 * Restores missing Croatian diacritics (č, ć, ž, š, đ) in ASCII-typed Croatian text
 * while preserving original capitalization (Title Case, UPPERCASE, lowercase).
 */
export function restoreCroatianDiacritics(text: string): string {
  if (!text) return '';
  const unicodeClean = normalizeCroatianUnicode(text);

  return unicodeClean.replace(
    /\b([A-Za-zČĆŽŠĐčćžšđ]+)\b/g,
    (word) => {
      const lower = word.toLowerCase();
      const mapped = CROATIAN_DIACRITIC_WORD_MAP[lower];
      if (!mapped) return word;

      // Preserve ALL CAPS
      if (word.length > 1 && word === word.toUpperCase()) {
        return mapped.toUpperCase();
      }
      // Preserve Initial Capital
      if (word[0] === word[0].toUpperCase()) {
        return mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return mapped.toLowerCase();
    }
  );
}

/**
 * Strips bilingual English suffixes from Croatian director notes
 * (e.g., "šapatom / whispered" -> "šapatom") so TTS engines don't switch phonology.
 */
export function localizeDirectorCueForLanguage(
  cue: string,
  language: SupportedLanguage
): string {
  if (!cue) return '';
  const parts = cue
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return language === 'hr' ? restoreCroatianDiacritics(cue.trim()) : cue.trim();
  }
  return language === 'hr'
    ? restoreCroatianDiacritics(parts[0])
    : parts[parts.length - 1];
}

/**
 * Prepares spoken text for TTS synthesis (Gemini 2.5 TTS or Browser Web Speech API):
 * - Normalizes Unicode NFC Croatian characters (č, ć, ž, š, đ)
 * - Restores missing Croatian diacritics when language is 'hr'
 * - Expands Croatian abbreviations (Dr. -> doktor, npr. -> na primjer) for natural speech
 */
export function prepareTextForTts(
  rawText: string,
  language: SupportedLanguage
): string {
  if (!rawText) return '';
  let text = normalizeCroatianUnicode(rawText);

  const isCroatian = language === 'hr' || containsCroatianCharacters(text);
  if (isCroatian) {
    text = restoreCroatianDiacritics(text);
    for (const [pattern, replacement] of CROATIAN_ABBREVIATIONS) {
      text = text.replace(pattern, replacement);
    }
  }

  return text.replace(/\s+/g, ' ').trim();
}
