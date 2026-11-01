/**
 * Authentic Dubrovnik Vernacular Dictionary (Raguzejski idiom / Dubrovačka gradska štokavština)
 * Based on historical Ragusan archives, Marin Držić, Ivan Gundulić, Bojanić-Trivunac, and Pero Budmani.
 */

export interface DubrovnikLexicalEntry {
  standard: string;
  dubrovnik: string;
  category:
  | 'household_food'
  | 'clothing_personal'
  | 'society_people'
  | 'verbs_expressions'
  | 'adjectives';
  notes?: string;
}

/**
 * Core bidirectional dictionary between Standard Croatian and Dubrovnik idiom.
 */
export const DUBROVNIK_DICTIONARY: DubrovnikLexicalEntry[] = [
  // 1. Household, food & everyday objects
  { standard: 'vilica', dubrovnik: 'pantaruo', category: 'household_food', notes: 'tal. pantarola' },
  { standard: 'žlica', dubrovnik: 'ožica', category: 'household_food' },
  { standard: 'tanjur', dubrovnik: 'pjat', category: 'household_food', notes: 'tal. piatto' },
  { standard: 'lonac', dubrovnik: 'teća', category: 'household_food', notes: 'plitki lonac' },
  { standard: 'tava', dubrovnik: 'prosuja', category: 'household_food' },
  { standard: 'vrč', dubrovnik: 'broka', category: 'household_food', notes: 'vrč za vodu' },
  { standard: 'lavor', dubrovnik: 'kadin', category: 'household_food', notes: 'umivaonik za pranje' },
  { standard: 'umivaonik', dubrovnik: 'pilo', category: 'household_food', notes: 'kameni sudoper / umivaonik' },
  { standard: 'sudoper', dubrovnik: 'pilo', category: 'household_food' },
  { standard: 'ručnik', dubrovnik: 'šugaman', category: 'household_food', notes: 'tal. asciugamano' },
  { standard: 'jastuk', dubrovnik: 'kušin', category: 'household_food', notes: 'tal. cuscino' },
  { standard: 'plahta', dubrovnik: 'lincuo', category: 'household_food', notes: 'tal. lenzuolo' },
  { standard: 'soba', dubrovnik: 'kamara', category: 'household_food', notes: 'tal. camera' },
  { standard: 'dnevni boravak', dubrovnik: 'tinel', category: 'household_food', notes: 'ili saloča' },
  { standard: 'salon', dubrovnik: 'saloča', category: 'household_food' },
  { standard: 'kamin', dubrovnik: 'komin', category: 'household_food', notes: 'ognjište' },
  { standard: 'ognjište', dubrovnik: 'komin', category: 'household_food' },
  { standard: 'prozor', dubrovnik: 'funjestra', category: 'household_food', notes: 'tal. finestra' },
  { standard: 'zavjesa', dubrovnik: 'koltrina', category: 'household_food', notes: 'tal. coltrina' },
  { standard: 'krumpir', dubrovnik: 'patata', category: 'household_food', notes: 'tal. patata' },
  { standard: 'krumpire', dubrovnik: 'patate', category: 'household_food' },
  { standard: 'krumpira', dubrovnik: 'patata', category: 'household_food' },
  { standard: 'rajčica', dubrovnik: 'pomadora', category: 'household_food', notes: 'tal. pomodoro' },
  { standard: 'rajčice', dubrovnik: 'pomadore', category: 'household_food' },
  { standard: 'rajčicu', dubrovnik: 'pomadoru', category: 'household_food' },
  { standard: 'luk', dubrovnik: 'kapula', category: 'household_food', notes: 'crveni luk' },
  { standard: 'crveni luk', dubrovnik: 'kapula', category: 'household_food' },
  { standard: 'patlidžan', dubrovnik: 'balančana', category: 'household_food', notes: 'tal. melanzana' },
  { standard: 'patlidžani', dubrovnik: 'balančane', category: 'household_food' },
  { standard: 'lubenica', dubrovnik: 'dinja', category: 'household_food', notes: 'U Dubrovniku "dinja" je crvena lubenica!' },
  { standard: 'lubenice', dubrovnik: 'dinje', category: 'household_food' },
  { standard: 'dinja', dubrovnik: 'pipun', category: 'household_food', notes: 'Žuta dinja je "pipun"' },
  { standard: 'dinje', dubrovnik: 'pipuni', category: 'household_food' },
  { standard: 'šećer', dubrovnik: 'cukar', category: 'household_food', notes: 'tal. zucchero' },
  { standard: 'keks', dubrovnik: 'beškotin', category: 'household_food', notes: 'dvopek, suhi keks' },
  { standard: 'keksi', dubrovnik: 'beškotini', category: 'household_food' },
  { standard: 'dvopek', dubrovnik: 'beškotin', category: 'household_food' },
  { standard: 'trgovina', dubrovnik: 'butiga', category: 'household_food', notes: 'dućan' },
  { standard: 'trgovine', dubrovnik: 'butige', category: 'household_food' },
  { standard: 'trgovini', dubrovnik: 'butigi', category: 'household_food' },
  { standard: 'trgovinu', dubrovnik: 'butigu', category: 'household_food' },
  { standard: 'dućan', dubrovnik: 'butiga', category: 'household_food' },
  { standard: 'dućanu', dubrovnik: 'butizi', category: 'household_food' },
  { standard: 'tržnica', dubrovnik: 'placa', category: 'household_food', notes: 'također i Stradun' },
  { standard: 'tržnici', dubrovnik: 'placi', category: 'household_food' },
  { standard: 'tržnicu', dubrovnik: 'placu', category: 'household_food' },
  { standard: 'vrećica', dubrovnik: 'saket', category: 'household_food', notes: 'papirnata ili plastična' },
  { standard: 'stepenica', dubrovnik: 'skalin', category: 'household_food', notes: 'kamena stepenica' },
  { standard: 'stube', dubrovnik: 'skalini', category: 'household_food' },
  { standard: 'žarulja', dubrovnik: 'bumbeta', category: 'household_food', notes: 'električna žarulja' },
  { standard: 'šibica', dubrovnik: 'sumporin', category: 'household_food' },
  { standard: 'slavina', dubrovnik: 'rubinet', category: 'household_food' },

  // 2. Clothing, body & personal belongings
  { standard: 'hlače', dubrovnik: 'gaće', category: 'clothing_personal', notes: 'U Dubrovniku "gaće" uvijek označavaju duge hlače!' },
  { standard: 'donje rublje', dubrovnik: 'mudante', category: 'clothing_personal', notes: 'ili gaćice' },
  { standard: 'gaćice', dubrovnik: 'mudante', category: 'clothing_personal' },
  { standard: 'čarapa', dubrovnik: 'bječva', category: 'clothing_personal', notes: 'ili škapin' },
  { standard: 'čarape', dubrovnik: 'bječve', category: 'clothing_personal' },
  { standard: 'cipele', dubrovnik: 'crevlje', category: 'clothing_personal' },
  { standard: 'odijelo', dubrovnik: 'vestit', category: 'clothing_personal', notes: 'tal. vestito' },
  { standard: 'kaput', dubrovnik: 'paletun', category: 'clothing_personal', notes: 'ili sako' },
  { standard: 'sako', dubrovnik: 'paletun', category: 'clothing_personal' },
  { standard: 'remen', dubrovnik: 'kajiš', category: 'clothing_personal', notes: 'kožni pojas' },
  { standard: 'vezica', dubrovnik: 'špigeta', category: 'clothing_personal', notes: 'vezica za cipele' },
  { standard: 'tregeri', dubrovnik: 'tirake', category: 'clothing_personal', notes: 'naramenice za hlače' },
  { standard: 'naramenice', dubrovnik: 'tirake', category: 'clothing_personal' },
  { standard: 'novčanik', dubrovnik: 'takujin', category: 'clothing_personal', notes: 'tal. taccuino' },
  { standard: 'olovka', dubrovnik: 'lapis', category: 'clothing_personal', notes: 'tal. lapis' },
  { standard: 'naočale', dubrovnik: 'očale', category: 'clothing_personal', notes: 'ili oćali' },
  { standard: 'ogrlica', dubrovnik: 'kolana', category: 'clothing_personal', notes: 'tal. collana' },
  { standard: 'mašna', dubrovnik: 'fjoka', category: 'clothing_personal', notes: 'leptir-mašna' },
  { standard: 'kišobran', dubrovnik: 'ombrela', category: 'clothing_personal', notes: 'tal. ombrello' },

  // 3. People, kinship & society
  { standard: 'ljudi', dubrovnik: 'čeljad', category: 'society_people', notes: 'ukućani, narod' },
  { standard: 'ukućani', dubrovnik: 'čeljad', category: 'society_people' },
  { standard: 'domaći', dubrovnik: 'našjenac', category: 'society_people', notes: 'Dubrovčanin' },
  { standard: 'stranci', dubrovnik: 'furesti', category: 'society_people', notes: 'turisti' },
  { standard: 'turisti', dubrovnik: 'furesti', category: 'society_people' },
  { standard: 'pas', dubrovnik: 'kučak', category: 'society_people' },
  { standard: 'djevojka', dubrovnik: 'manjgura', category: 'society_people', notes: 'mlada cura' },
  { standard: 'cura', dubrovnik: 'manjgura', category: 'society_people' },
  { standard: 'baka', dubrovnik: 'baba', category: 'society_people', notes: 'ili nona' },
  { standard: 'djed', dubrovnik: 'nono', category: 'society_people' },
  { standard: 'bratić', dubrovnik: 'bratučed', category: 'society_people', notes: 'prvi rođak' },
  { standard: 'rođak', dubrovnik: 'bratučed', category: 'society_people' },
  { standard: 'nećak', dubrovnik: 'neput', category: 'society_people' },
  { standard: 'nećakinja', dubrovnik: 'nepuća', category: 'society_people' },
  { standard: 'vragolan', dubrovnik: 'huncut', category: 'society_people', notes: 'ili džilit' },
  { standard: 'mangup', dubrovnik: 'džilit', category: 'society_people' },
  { standard: 'lopov', dubrovnik: 'lupež', category: 'society_people' },
  { standard: 'kradljivac', dubrovnik: 'lupež', category: 'society_people' },
  { standard: 'gospodin', dubrovnik: 'gospar', category: 'society_people', notes: 'uglednik / vlastelin' },
  { standard: 'gospođa', dubrovnik: 'sinjora', category: 'society_people' },

  // 4. Verbs, movement & expressions
  { standard: 'šutjeti', dubrovnik: 'mučat', category: 'verbs_expressions', notes: '"Muči, ne govori ništa!"' },
  { standard: 'šuti', dubrovnik: 'muči', category: 'verbs_expressions' },
  { standard: 'ići', dubrovnik: 'hodit', category: 'verbs_expressions', notes: 'ili adit' },
  { standard: 'hodati', dubrovnik: 'hodit', category: 'verbs_expressions' },
  { standard: 'proći', dubrovnik: 'pasat', category: 'verbs_expressions', notes: '"Pasalo je podne."' },
  { standard: 'prošlo', dubrovnik: 'pasalo', category: 'verbs_expressions' },
  { standard: 'zaustaviti', dubrovnik: 'fermat', category: 'verbs_expressions' },
  { standard: 'stati', dubrovnik: 'fermat se', category: 'verbs_expressions' },
  { standard: 'stići', dubrovnik: 'arivat', category: 'verbs_expressions', notes: 'dospjeti' },
  { standard: 'stigao', dubrovnik: 'arivō', category: 'verbs_expressions' },
  { standard: 'uživati', dubrovnik: 'guštat', category: 'verbs_expressions' },
  { standard: 'plesati', dubrovnik: 'balat', category: 'verbs_expressions' },
  { standard: 'pjevati', dubrovnik: 'kantat', category: 'verbs_expressions' },
  { standard: 'častiti', dubrovnik: 'tratat', category: 'verbs_expressions', notes: 'pogostiti' },
  { standard: 'lutati', dubrovnik: 'skitat', category: 'verbs_expressions' },
  { standard: 'šala', dubrovnik: 'škerac', category: 'verbs_expressions', notes: 'dosjetka' },
  { standard: 'potajno', dubrovnik: 'šotokuco', category: 'verbs_expressions', notes: 'ispod ruke' },
  { standard: 'ravno', dubrovnik: 'drito', category: 'verbs_expressions', notes: 'pravo' },
  { standard: 'skladan', dubrovnik: 'šesan', category: 'verbs_expressions', notes: 'lijep, naočit' },
  { standard: 'lijep', dubrovnik: 'šesan', category: 'verbs_expressions' },
  { standard: 'čačkalica', dubrovnik: 'štikadenat', category: 'verbs_expressions', notes: 'tal. stuzzicadenti' },
  { standard: 'pijesak', dubrovnik: 'pržina', category: 'verbs_expressions' },
  { standard: 'doviđenja', dubrovnik: 'adio', category: 'verbs_expressions' },
  { standard: 'zbogom', dubrovnik: 'adio', category: 'verbs_expressions' },
  { standard: 'hvala', dubrovnik: 'fála', category: 'verbs_expressions' },

  // 5. Romance Adjectives & Derived Stems
  { standard: 'star', dubrovnik: 'antik', category: 'adjectives', notes: 'tal. antico' },
  { standard: 'stara', dubrovnik: 'antika', category: 'adjectives' },
  { standard: 'staro', dubrovnik: 'antiko', category: 'adjectives' },
  { standard: 'oprezan', dubrovnik: 'akort', category: 'adjectives', notes: 'pametan, pažljiv' },
  { standard: 'oprezna', dubrovnik: 'akorta', category: 'adjectives' },
  { standard: 'lukav', dubrovnik: 'astut', category: 'adjectives', notes: 'tal. astuto' },
  { standard: 'škrt', dubrovnik: 'avar', category: 'adjectives', notes: 'tal. avaro' },
  { standard: 'zadovoljan', dubrovnik: 'kontent', category: 'adjectives', notes: 'ili kontenat' },
  { standard: 'uglađen', dubrovnik: 'galant', category: 'adjectives', notes: 'tal. galante' },
  { standard: 'slobodan', dubrovnik: 'liber', category: 'adjectives', notes: 'tal. libero' },
  { standard: 'siguran', dubrovnik: 'sikur', category: 'adjectives', notes: 'tal. sicuro' },
  { standard: 'sigurna', dubrovnik: 'sikura', category: 'adjectives' },
  { standard: 'najsigurniji', dubrovnik: 'sikurisim', category: 'adjectives', notes: 'superlativ na -isim' },
  { standard: 'sposoban', dubrovnik: 'valent', category: 'adjectives' },
  { standard: 'ljubomoran', dubrovnik: 'džiljoz', category: 'adjectives', notes: 'tal. geloso' },
  { standard: 'dosadan', dubrovnik: 'fastidijoz', category: 'adjectives', notes: 'mučan' },
  { standard: 'oštrouman', dubrovnik: 'indženjoz', category: 'adjectives', notes: 'tal. ingenioso' },
  { standard: 'ponosan', dubrovnik: 'zdenjoz', category: 'adjectives', notes: 'otresit, dostojanstven' },
  { standard: 'otresit', dubrovnik: 'zdenjoz', category: 'adjectives' },
  { standard: 'tvrdoglav', dubrovnik: 'kapricijoz', category: 'adjectives', notes: 'tal. capriccioso' },
  { standard: 'zaljubljen', dubrovnik: 'namuran', category: 'adjectives' },
  { standard: 'zahvalan', dubrovnik: 'oblegan', category: 'adjectives', notes: 'obvezan' },
  { standard: 'napušten', dubrovnik: 'pjantan', category: 'adjectives', notes: 'ostavljen na cjedilu' },
  { standard: 'očajan', dubrovnik: 'desperan', category: 'adjectives', notes: 'tal. disperato' },
  { standard: 'namirisan', dubrovnik: 'profuman', category: 'adjectives' },
  { standard: 'nakinđuren', dubrovnik: 'frapan', category: 'adjectives' },
  { standard: 'uništen', dubrovnik: 'spačan', category: 'adjectives', notes: 'sređen, gotov' },
  { standard: 'upropašten', dubrovnik: 'ruinan', category: 'adjectives', notes: 'tal. rovinato' },
  { standard: 'svjež', dubrovnik: 'fresak', category: 'adjectives', notes: 'tal. fresco' },
  { standard: 'svježa', dubrovnik: 'freska', category: 'adjectives' },
  { standard: 'svježe', dubrovnik: 'fresko', category: 'adjectives' },
];

/**
 * Fast lookup map for word-level replacement (case-insensitive).
 */
export const STANDARD_TO_DUBROVNIK_MAP: Map<string, string> = new Map(
  DUBROVNIK_DICTIONARY.map((e) => [e.standard.toLowerCase(), e.dubrovnik])
);

/**
 * Common authentic Dubrovnik phrases and greetings.
 */
export const DUBROVNIK_PHRASE_MAPPINGS: Array<[RegExp, string]> = [
  [/\bu dubrovnik\b/gi, 'u Grad'],
  [/\bu dubrovniku\b/gi, 'u Gradu'],
  [/\biz dubrovnika\b/gi, 'iz Grada'],
  [/\bna stradun\b/gi, 'na placu'],
  [/\bna stradunu\b/gi, 'na placi'],
  [/\bkako si\b/gi, 'kako si mi'],
  [/\bdobar dan\b/gi, 'sluga van se'],
  [/\bdoviđenja\b/gi, 'adio ti'],
  [/\blaku noć\b/gi, 'laku noć, u tišini Grada'],
  [/\bnema na čemu\b/gi, 'za ništa'],
  [/\bhvala lijepa\b/gi, 'fála van vele'],
  [/\bšto radiš\b/gi, 'što činiš'],
  [/\bšto radi\b/gi, 'što čini'],
  [/\bšto rade\b/gi, 'što činu'],
];
