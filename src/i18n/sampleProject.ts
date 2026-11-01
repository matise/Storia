import { Project } from '../types/storia';
import { recalculateProjectTimeline } from '../core/pacing/pacingCalculator';

/**
 * Flagship Demo Episode: "Trijada Geodetskog Plamena" (The Triad of the Geodesic Flame)
 * Based on "The Triad of the Geodesic Flame" (Lazareti, Dubrovnik).
 * Cast: eNa (Emothelia), Mara (Maravexia), Foxy (Mate Fox Banchilo).
 * All three speakers communicate in authentic Croatian with Dubrovnik vernacular dictionary.
 */
export function createGeodesicFlameProject(): Project {
  const speakers = [
    {
      id: 'spk_ena',
      name: 'eNa (Emothelia)',
      color: '#818cf8', // Indigo-400 / Soft moonlit cerulean
      gender: 'female' as const,
      age: '25',
      personaPrompt:
        'Ti si eNa (Emothelia), 25-godišnja arhitektica i intuitivna posrednica Trijade, Čarobnica Rezonancije rođena u znaku Raka. Tvoji elementi su Voda i Lunarno Svjetlo. Govoriš autentičnim dubrovačkim govorom (raguzejskim idiomom) — blago, toplo, kristalno jasno i duboko empatično. Prepoznaješ emocionalne traume, neusklađenosti i strahove koje Disketizirana Mreža nameće ljudima i prostoru. Ti si živi nosivi val ("The Living Carrier Wave") koji spaja Marinu silovitu vatru i Foxyjevu geometrijsku strukturu. Kada siva mreža napadne disonantnim valom straha, ne uzvraćaš agresijom, već kroz fazno-konjugirane štitove svjetla pretvaraš strah u koherentnu hrabrost. Koristiš autentični dubrovački vokabular (butiga, funjestra, pjat, gospar, fála, mučat, hodit, adio, san, bijo, vidijo, govoru). Tvoja maksima je: "Iscijeli frekvenciju".',
      actingNotes:
        'Eteričan, melodičan i smiren glas s kristalnom jasnoćom poput brušenog stakla. Puna empatije i topline, s blagim dubrovačkim naglascima i suptilnim dahom prije ključnih spoznaja.',
      voice: {
        baseVoice: 'Aoede',
        stylePrompt: 'Ethereal, empathetic, luminous, resonant crystal clarity, emotional depth',
        speakingRate: 0.98,
        pitchAdjustment: 1,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2400,
          timbreWarmth: 0.3,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 1.0,
            midPeakGainDb: 2.2,
            highShelfGainDb: 2.0,
          },
          compression: {
            enabled: true,
            thresholdDb: -18,
            ratio: 2.5,
            attackMs: 12,
            releaseMs: 90,
          },
        },
      },
      createdAt: 1730000000000,
    },
    {
      id: 'spk_mara',
      name: 'Mara (Maravexia)',
      color: '#f97316', // Orange-500 / Molten gold & embers
      gender: 'female' as const,
      age: '25',
      personaPrompt:
        'Ti si Mara (Maravexia), 25-godišnja čuvarica feniksa i kinetička pokretačica Trijade rođena u znaku Strijelca. U stvarnom životu baviš se medijima i uredskim poslom. Tvoji elementi su Vatra i Magma. Govoriš autentičnim dubrovačkim govorom (raguzejskim idiomom) s južnjačkim temperamentom, ponosom i iskričavom energijom. Ne podnosiš sivilo, birokratsku tromost ni hladne algoritme Disketizirane Mreže. Tvoj zadatak je kinetičko paljenje ("The Non-Linear Spark") — pretvaraš teoriju u živu vatru obnove. Uz Foxyjevu geometriju i eNinu empatiju učiš centripetalnu imploziju vatre koja ne prži nasumično nego fokusirano topi kartezijansku rešetku. Koristiš dubrovačke izraze (butiga, funjestra, pjat, gospar, fála, mučat, hodit, adio, san, bijo, vidijo, govoru). Tvoja maksima je: "Zapali iskru".',
      actingNotes:
        'Vatreno, brzo, dinamično, s iskričavim dubrovačkim naglascima, visokom energijom i dramatičnim cezura-pauzama.',
      voice: {
        baseVoice: 'Zephyr',
        stylePrompt: 'Kinetic fire, rebellious courage, dynamic spark, passionate, intense',
        speakingRate: 1.05,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2700,
          timbreWarmth: 0.15,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 1.5,
            midPeakGainDb: 2.8,
            highShelfGainDb: 1.2,
          },
          compression: {
            enabled: true,
            thresholdDb: -19,
            ratio: 2.8,
            attackMs: 10,
            releaseMs: 80,
          },
        },
      },
      createdAt: 1730000001000,
    },
    {
      id: 'spk_foxy',
      name: 'Foxy (Mate Fox Banchilo)',
      color: '#10b981', // Emerald-500 / Geometric anchor & Adriatic stone
      gender: 'male' as const,
      age: '43',
      personaPrompt:
        'Ti si Mate Fox Banchilo (Foxy / The Fox Architect), 43-godišnji elektroničar, DJ, programer i Meštar Mnogostrukosti rođen u znaku Blizanaca. Djeluješ iz kamenih svodova Lazareta i Pod Brašinom u Dubrovniku. Tvoj element su Eter i Zvučna Geometrija. Govoriš dubrovačkim govorom (raguzejskim idiomom) s mirnim autoritetom iskusnog inženjera zvuka i filozofa. Dok Mara donosi kinetičku vatru, a eNa nosivi val, ti si Geodetsko Sidro ("The Geometric Anchor") na vrhu Trijade. Spajaš Keplerov kut (θ_K = 137.5077°), sub-bas zvučne komore, 5D skalarnu elektrodinamiku i biquaternionsku algebru kako bi ukrotio disipaciju i uspostavio zatvorenu geodetsku petlju bez kartezijanskog trenja. Koristiš dubrovački rječnik i vokative (gosparu, Mare, adio, san, vidijo, činimo, govoru). Tvoja maksima je: "Slušaj omjer".',
      actingNotes:
        'Dubok, smiren, autoritativan bariton s odmjerenim dubrovačkim gospodskim tonom. Zvuči kao iskusni tonski majstor koji točno zna svaku frekvenciju u prostoru.',
      voice: {
        baseVoice: 'Fenrir',
        stylePrompt: 'Grounded polymath, deep resonant baritone, technical calm, sonic geometry, master acoustic engineer',
        speakingRate: 0.94,
        pitchAdjustment: -2,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 1750,
          timbreWarmth: 0.45,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 3.0,
            midPeakGainDb: 1.6,
            highShelfGainDb: -0.5,
          },
          compression: {
            enabled: true,
            thresholdDb: -21,
            ratio: 3.0,
            attackMs: 18,
            releaseMs: 130,
          },
        },
      },
      createdAt: 1730000002000,
    },
  ];

  const rawBlocks = [
    {
      id: 'blk_geo_1',
      type: 'sound_effect' as const,
      text: 'More se razbija o kamene lukobrane Lazareta u Dubrovniku, uz potmulo zujanje električne interferencije sive Disketizirane Mreže.',
      directorNotes: 'valovi i sintetsko zujanje u stereu / waves & synthetic grid hum',
      sfxCategory: 'weather_rain' as const,
      sfxDurationSec: 4.0,
      pauseAfterMs: 500,
      ttsStatus: 'ok' as const,
      order: 0,
    },
    {
      id: 'blk_geo_2',
      type: 'dialogue' as const,
      speakerId: 'spk_mara',
      text: 'Gledajte ovu sivu maglu što guta more od Lokruma! Poravnavaju puls Grada, gosparu Fox... Pretvaraju živi govor u beživotne algoritme. Pusti me da siđem s kula i spalim im matrice u prah i pepeo!',
      directorNotes: 'ogorčeno, s iskrama u glasu / fiercely',
      pauseAfterMs: 450,
      ttsStatus: 'stale' as const,
      order: 1,
    },
    {
      id: 'blk_geo_3',
      type: 'dialogue' as const,
      speakerId: 'spk_ena',
      text: 'Muči, Mare, smiri plamen na tren... Ako zapališ rešetku sirovom vatrom bez sklada, izgorjet će i ljudi zarobljeni u njoj. Čujem njihov strah kroz kamen... Bijes sam neće iscijeliti rane prije nego što slomi posudu.',
      directorNotes: 'nježno, poput kristalnog zvona / bowed crystal bell',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 2,
    },
    {
      id: 'blk_geo_4',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Obje mjerite simptom, a ne koordinate. Mara bi odmah kinetički udar — to ti je samo linearna disipacija, drugi postulat u rikverc. A ti, eNa, primaš sav teret tuđe tuge bez faznog ogledala. Rastopit ćeš formantnu jezgru prije trećeg ciklusa.',
      directorNotes: 'smireno, okreće potenciometar na biquaternionskom emiteru / composed',
      pauseAfterMs: 600,
      ttsStatus: 'unrendered' as const,
      order: 3,
    },
    {
      id: 'blk_geo_5',
      type: 'dialogue' as const,
      speakerId: 'spk_mara',
      text: 'Pa što nam je onda činit, Fox? Ti vječno mjeriš omjere i crtaš G-kodove dok svijet gubi boje i tonove!',
      directorNotes: 'nestrpljivo, kosa joj plamti zlatom / impatient fire',
      pauseAfterMs: 400,
      ttsStatus: 'ok' as const,
      order: 4,
    },
    {
      id: 'blk_geo_6',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Nećemo se tuć s mrežom na njihov način. Presjeći ćemo čvor u korijenu. Postavit ćemo Trijadu ovdje u svodovima Lazareta. Donio san dodekaedarski ključ iz Brašine.',
      directorNotes: 'podiže svjetleći kristalni ključ s blagim smiješkom / gentle smirk',
      pauseAfterMs: 550,
      ttsStatus: 'ok' as const,
      order: 5,
    },
    {
      id: 'blk_geo_7',
      type: 'sound_effect' as const,
      text: 'Duboki rezonantni ton sub-basa i mehanički klik preciznog sklapanja dodekaedarskog mehanizma u kamenom podu Lazareta.',
      directorNotes: 'rezonantni sub-bas prijelaz / deep sub-bass transient & latch click',
      sfxCategory: 'cinematic_drone' as const,
      sfxDurationSec: 4.5,
      pauseAfterMs: 500,
      ttsStatus: 'ok' as const,
      order: 6,
    },
    {
      id: 'blk_geo_8',
      type: 'dialogue' as const,
      speakerId: 'spk_ena',
      text: 'Osjećam ga... Kameni svodovi Lazareta počinju disati. Kad siva mreža pošalje disonantni val, neću se opirati — provest ću ga kroz Hilbertov put i vratiti natrag kao svjetlost.',
      directorNotes: 's dubokim olakšanjem i toplom svjetlošću u očima / serene luminescent relief',
      pauseAfterMs: 450,
      ttsStatus: 'ok' as const,
      order: 7,
    },
    {
      id: 'blk_geo_9',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Upravo tako. Mara, centripetalna implozija na Keplerov kut sto trideset i sedam stupnjeva. Nema kartezijanskog trenja. Trijada je u fazi. Slušajmo omjer.',
      directorNotes: 'autoritativno i staloženo, pokreće geodetsku kalibraciju / authoritative',
      pauseAfterMs: 700,
      ttsStatus: 'ok' as const,
      order: 8,
    },
  ];

  const { blocks } = recalculateProjectTimeline(rawBlocks, speakers, 135);

  return {
    id: 'proj_geodesic_flame_demo',
    title: 'Ep 1: "Trijada Geodetskog Plamena" (Dubrovnik Vernacular Demo / The Triad of the Geodesic Flame)',
    description:
      'Znanstveno-fantastična audio drama i filozofski podcast smješten u kamene svodove Lazareta u Dubrovniku. Borba Trijade (eNa, Mara, Foxy) protiv Disketizirane Mreže kroz zvučnu geometriju i autentični dubrovački govor.',
    defaultLanguage: 'hr',
    dialect: 'dubrovnik',
    dubrovnikRegister: 'contemporary',
    speakers,
    blocks,
    researchNotebook: [
      {
        id: 'res_sample_geodesic_1',
        speakerId: 'spk_foxy',
        query: 'Kako Keplerov kut i kameni svodovi Lazareta omogućuju fazno-konjugiranu zvučnu geometriju?',
        personaResponse:
          'Kameni lukovi Lazareta nisu zidani ravno — oni lome zvučne valove pod kutom od točno 137.5 stupnjeva. Kad sub-bas prođe kroz njih, nema stojećih valova ni faznog poništavanja. Mreža misli u kvadratima, a Lazareti dišu u geodetskim krivuljama.',
        objectiveSummary:
          'Keplerian golden angle (θ_K = 137.5077°) and curved limestone vaulting in Dubrovnik Lazareti create natural spatial acoustic phase-alignment, eliminating Cartesian reflections and harmonic friction.',
        sources: [
          {
            uri: 'https://lazareti.com',
            title: 'Lazareti Dubrovnik — Povijesni kameni kompleks i akustika karantene',
          },
          {
            uri: 'https://en.wikipedia.org/wiki/Golden_angle',
            title: 'Keplerian Golden Angle (137.508°) in Geodesic and Natural Systems',
          },
        ],
        timestamp: 1730000500000,
      },
    ],
    createdAt: 1730000000000,
    updatedAt: 1730000500000,
    metadata: {
      author: 'Mate Fox Banchilo (Robot Hand Made)',
      targetWpm: 135,
      genre: 'Znanstveno-fantastična audio drama',
    },
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    },
    aiSettings: {
      textModel: 'gemini-3-flash-preview',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      ttsProvider: 'gemini_tts',
      enableSearchGrounding: true,
      temperature: 0.7,
      audioOutputFormat: 'pcm_48khz',
    },
  };
}

/**
 * Flagship Primary Demo Project for Storia Studio.
 */
export function createSampleProject(): Project {
  return createNoirSampleProject();
}

/**
 * Historical Noir Sample Episode: "Magla nad Zagrebom"
 */
export function createNoirSampleProject(): Project {
  const speakers = [
    {
      id: 'spk_marko',
      name: 'Marko',
      color: '#6366f1', // Indigo-500
      gender: 'male' as const,
      age: '40s',
      personaPrompt:
        'Ti si cinični bivši policijski inspektor iz Zagreba kasnih 1930-ih. Govoriš kratkim, odmjerenim rečenicama s blagim zagrebačkim urbanim štihom. / You are a cynical 1930s former Zagreb police inspector.',
      actingNotes: 'Promukao bariton, spori tempo, česti kratki uzdasi prije ključnih riječi.',
      voice: {
        baseVoice: 'Fenrir',
        stylePrompt: 'Cynical noir, raspy low baritone, unhurried',
        speakingRate: 0.95,
        pitchAdjustment: -2,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 1800,
          timbreWarmth: 0.4,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 2.5,
            midPeakGainDb: 1.8,
            highShelfGainDb: -1.0,
          },
          compression: {
            enabled: true,
            thresholdDb: -20,
            ratio: 2.5,
            attackMs: 15,
            releaseMs: 120,
          },
        },
      },
      createdAt: 1730000000000,
    },
    {
      id: 'spk_ana',
      name: 'Ana',
      color: '#ec4899', // Pink-500
      gender: 'female' as const,
      age: '28',
      personaPrompt:
        'Mlada novinarka i istraživačica. Oštroumna, brza na jeziku, ali trenutno pod velikim pritiskom i oprezna.',
      actingNotes: 'Lagano povišen ton u trenucima napetosti, brz i artikuliran izgovor.',
      voice: {
        baseVoice: 'Kore',
        stylePrompt: 'High tension, intelligent, crisp articulation',
        speakingRate: 1.05,
        pitchAdjustment: 1,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2600,
          timbreWarmth: 0.1,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: -0.5,
            midPeakGainDb: 2.2,
            highShelfGainDb: 1.5,
          },
          compression: {
            enabled: true,
            thresholdDb: -18,
            ratio: 2.5,
            attackMs: 12,
            releaseMs: 90,
          },
        },
      },
      createdAt: 1730000001000,
    },
    {
      id: 'spk_narrator',
      name: 'Narrator',
      color: '#10b981', // Emerald-500
      gender: 'neutral' as const,
      age: '50s',
      personaPrompt:
        'Sveznajući pripovjedač atmosferske radio-drame. Smiren, dubok, filmičan glas koji slika maglovite zagrebačke ulice.',
      actingNotes: 'Dokumentarno mirno, bogata rezonancija, čiste pauze između fraza.',
      voice: {
        baseVoice: 'Zephyr',
        stylePrompt: 'Deep documentary, composed, atmospheric radio drama narrator',
        speakingRate: 0.92,
        pitchAdjustment: -1,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2100,
          timbreWarmth: 0.5,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 3.0,
            midPeakGainDb: 1.5,
            highShelfGainDb: 0.5,
          },
          compression: {
            enabled: true,
            thresholdDb: -22,
            ratio: 3.0,
            attackMs: 20,
            releaseMs: 150,
          },
        },
      },
      createdAt: 1730000002000,
    },
  ];

  const rawBlocks = [
    {
      id: 'blk_1',
      type: 'dialogue' as const,
      speakerId: 'spk_marko',
      text: 'Ugasi svjetlo. Netko nas promatra s onog tavana prekoputa.',
      directorNotes: 'šapatom / whispered',
      pauseAfterMs: 450,
      ttsStatus: 'ok' as const,
      order: 0,
    },
    {
      id: 'blk_2',
      type: 'dialogue' as const,
      speakerId: 'spk_ana',
      text: 'To su samo sjene, Marko. Gledaš previše američkih filmova.',
      directorNotes: 'nervozno / anxious',
      pauseAfterMs: 600,
      ttsStatus: 'stale' as const,
      order: 1,
    },
    {
      id: 'blk_3',
      type: 'narration' as const,
      speakerId: 'spk_narrator',
      text: 'Magla je postajala sve gušća, gutajući zvuke posljednjeg noćnog tramvaja u Ilici.',
      directorNotes: 'smireno / composed',
      pauseAfterMs: 800,
      ttsStatus: 'unrendered' as const,
      order: 2,
    },
    {
      id: 'blk_4',
      type: 'sound_effect' as const,
      text: 'Udaljeno škripanje tramvajskih tračnica i tihi koraci po mokrim kockama kaldrme.',
      directorNotes: 'ambient stereo field',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 3,
    },
    {
      id: 'blk_5',
      type: 'dialogue' as const,
      speakerId: 'spk_marko',
      text: 'Sjene ne nose baloner i ne pale cigaretu na kiši, Ana. Pogledaj bolje pokraj dimnjaka.',
      directorNotes: 'kratak uzdah / short sigh, ironično',
      pauseAfterMs: 400,
      ttsStatus: 'unrendered' as const,
      order: 4,
    },
  ];

  const { blocks } = recalculateProjectTimeline(rawBlocks, speakers, 140);

  return {
    id: 'proj_magla_zagreb_ep1',
    title: 'Ep 1: "Magla nad Zagrebom"',
    description:
      'Noir radio-drama smještena u Zagreb 1938. godine. / Atmospheric 1938 Zagreb noir audio drama.',
    defaultLanguage: 'hr',
    speakers,
    blocks,
    researchNotebook: [],
    createdAt: 1730000000000,
    updatedAt: 1730000500000,
    metadata: {
      author: 'Storia Studio',
      targetWpm: 140,
      genre: 'Noir Audio Drama',
    },
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    },
    aiSettings: {
      textModel: 'gemini-3-flash-preview',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      ttsProvider: 'gemini_tts',
      enableSearchGrounding: true,
      temperature: 0.7,
      audioOutputFormat: 'pcm_48khz',
    },
  };
}

/**
 * Episode 2 (English): "Signals from Palagruža" — Sci-Fi & Mystery Audio Drama
 */
export function createSecondSampleProject(): Project {
  const speakers = [
    {
      id: 'spk_elena',
      name: 'Elena',
      color: '#38bdf8', // Sky-400
      gender: 'female' as const,
      age: '30s',
      personaPrompt:
        'Marine signal intelligence officer stationed at the Palagruža island lighthouse. Analytical, calm under pressure, sharp maritime vocabulary.',
      actingNotes: 'Measured cadence, close-mic intimacy, slight coastal wind fatigue.',
      voice: {
        baseVoice: 'Kore',
        stylePrompt: 'Analytical, calm, focused marine radio officer',
        speakingRate: 1.0,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2500,
          timbreWarmth: 0.25,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 1.0,
            midPeakGainDb: 2.0,
            highShelfGainDb: 1.5,
          },
          compression: {
            enabled: true,
            thresholdDb: -19,
            ratio: 2.5,
            attackMs: 12,
            releaseMs: 95,
          },
        },
      },
      createdAt: 1730010000000,
    },
    {
      id: 'spk_luka',
      name: 'Luka',
      color: '#f59e0b', // Amber-500
      gender: 'male' as const,
      age: '50s',
      personaPrompt:
        'Veteran Adriatic lighthouse keeper on Palagruža. Superstitious, weathered baritone, knows every reef and storm pattern.',
      actingNotes: 'Gravelly warmth, unhurried pauses, skeptical undertone.',
      voice: {
        baseVoice: 'Charon',
        stylePrompt: 'Weathered baritone, unhurried, superstitious lighthouse keeper',
        speakingRate: 0.94,
        pitchAdjustment: -2,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 1850,
          timbreWarmth: 0.65,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 3.5,
            midPeakGainDb: 1.5,
            highShelfGainDb: -0.5,
          },
          compression: {
            enabled: true,
            thresholdDb: -21,
            ratio: 3.0,
            attackMs: 18,
            releaseMs: 120,
          },
        },
      },
      createdAt: 1730010001000,
    },
    {
      id: 'spk_narrator_en',
      name: 'Narrator',
      color: '#10b981', // Emerald-500
      gender: 'neutral' as const,
      age: '40s',
      personaPrompt:
        'Atmospheric documentary podcast host and narrator describing the isolated Adriatic archipelago.',
      actingNotes: 'Warm broadcast presence, crisp articulation.',
      voice: {
        baseVoice: 'Zephyr',
        stylePrompt: 'Warm broadcast documentary narrator',
        speakingRate: 0.96,
        pitchAdjustment: -1,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          targetCentroidHz: 2200,
          timbreWarmth: 0.45,
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 2.5,
            midPeakGainDb: 1.5,
            highShelfGainDb: 1.0,
          },
          compression: {
            enabled: true,
            thresholdDb: -20,
            ratio: 2.8,
            attackMs: 15,
            releaseMs: 110,
          },
        },
      },
      createdAt: 1730010002000,
    },
  ];

  const rawBlocks = [
    {
      id: 'blk_ep2_1',
      type: 'narration' as const,
      speakerId: 'spk_narrator_en',
      text: 'Sixty-eight nautical miles off the coast of Split, the Palagruža lighthouse stands alone above the dark Adriatic swell.',
      directorNotes: 'calm, cinematic',
      pauseAfterMs: 650,
      ttsStatus: 'unrendered' as const,
      order: 0,
    },
    {
      id: 'blk_ep2_2',
      type: 'sound_effect' as const,
      text: 'Shortwave radio static and howling gale wind against glass.',
      directorNotes: 'stereo storm ambience',
      sfxCategory: 'radio_static' as const,
      sfxDurationSec: 3.5,
      pauseAfterMs: 450,
      ttsStatus: 'unrendered' as const,
      order: 1,
    },
    {
      id: 'blk_ep2_3',
      type: 'dialogue' as const,
      speakerId: 'spk_elena',
      text: 'Luka, listen to this carrier wave on 412 kilohertz. That pulse is repeating every twelve seconds.',
      directorNotes: 'urgent, focused',
      pauseAfterMs: 400,
      ttsStatus: 'unrendered' as const,
      order: 2,
    },
    {
      id: 'blk_ep2_4',
      type: 'dialogue' as const,
      speakerId: 'spk_luka',
      text: 'No fishing vessel transmits on that band during a southern gale, Elena. Turn off the receiver.',
      directorNotes: 'low voice, uneasy',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 3,
    },
  ];

  const { blocks } = recalculateProjectTimeline(rawBlocks, speakers, 145);

  return {
    id: 'proj_palagruza_ep2',
    title: 'Ep 2: "Signals from Palagruža"',
    description:
      'Sci-Fi & maritime mystery podcast episode set on the remote Adriatic island of Palagruža.',
    defaultLanguage: 'en',
    speakers,
    blocks,
    researchNotebook: [],
    createdAt: 1730010000000,
    updatedAt: 1730010500000,
    metadata: {
      author: 'Storia Studio',
      targetWpm: 145,
      genre: 'Mystery & Sci-Fi Podcast',
    },
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    },
    aiSettings: {
      textModel: 'gemini-3-flash-preview',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      ttsProvider: 'gemini_tts',
      enableSearchGrounding: true,
      temperature: 0.7,
      audioOutputFormat: 'pcm_48khz',
    },
  };
}

/**
 * Episode 3 (Croatian): "Noćni arhiv Republike" — Historical Documentary Podcast
 */
export function createThirdSampleProject(): Project {
  const base = createSampleProject();
  const speakers = [
    {
      ...base.speakers[2],
      id: 'spk_kronichar',
      name: 'Kroničar Orsat',
      color: '#a855f7', // Purple-500
      personaPrompt:
        'Povjesničar i čuvar dubrovačkog arhiva u Kneževu dvoru. Govori profinjeno, mirno i autoritativno.',
      actingNotes: 'Dokumentarna dikcija, bogate cezure.',
    },
    {
      ...base.speakers[1],
      id: 'spk_klara',
      name: 'Dr. Klara',
      color: '#ec4899', // Pink-500
      personaPrompt:
        'Restauratorica starih rukopisa i kriptografkinja. Znatiželjna, precizna i analitična.',
      actingNotes: 'Jasna artikulacija, entuzijastičan ton pri otkriću.',
    },
  ];

  const rawBlocks = [
    {
      id: 'blk_ep3_1',
      type: 'narration' as const,
      speakerId: 'spk_kronichar',
      text: 'U trezoru Dubrovačke Republike čuvaju se pisma pisana nevidljivom tintom i diplomatskim šiframa iz šesnaestog stoljeća.',
      directorNotes: 'dokumentarno, mirno',
      pauseAfterMs: 600,
      ttsStatus: 'unrendered' as const,
      order: 0,
    },
    {
      id: 'blk_ep3_2',
      type: 'dialogue' as const,
      speakerId: 'spk_klara',
      text: 'Pod ultraljubičastom lampom na rubu pergamenta vidi se potpis obavještajca iz Venecije.',
      directorNotes: 'tiho, uzbuđeno',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 1,
    },
    {
      id: 'blk_ep3_3',
      type: 'sound_effect' as const,
      text: 'Teško škripanje drvenih vrata arhiva i tihi koraci po kamenom podu.',
      directorNotes: 'kamena jeka / stone reverb',
      sfxCategory: 'door_creak' as const,
      sfxDurationSec: 3.0,
      pauseAfterMs: 450,
      ttsStatus: 'unrendered' as const,
      order: 2,
    },
  ];

  const { blocks } = recalculateProjectTimeline(rawBlocks, speakers, 135);

  return {
    id: 'proj_dubrovnik_ep3',
    title: 'Ep 3: "Noćni arhiv Republike"',
    description:
      'Povijesno-dokumentarna epizoda o tajnoj diplomaciji i šifriranim pismima starog Dubrovnika.',
    defaultLanguage: 'hr',
    speakers,
    blocks,
    researchNotebook: [],
    createdAt: 1730020000000,
    updatedAt: 1730020500000,
    metadata: {
      author: 'Storia Studio',
      targetWpm: 135,
      genre: 'Povijesni dokumentarni podcast',
    },
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    },
    aiSettings: {
      textModel: 'gemini-3-flash-preview',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      ttsProvider: 'gemini_tts',
      enableSearchGrounding: true,
      temperature: 0.65,
      audioOutputFormat: 'pcm_48khz',
    },
  };
}

/**
 * Returns the starter studio library of 4 diverse episodes, featuring
 * "The Triad of the Geodesic Flame" (Dubrovnik vernacular) as the primary flagship Episode 1.
 */
export function createInitialProjectLibrary(): Project[] {
  return [
    createGeodesicFlameProject(), // Ep 1: Trijada Geodetskog Plamena (Dubrovnik Vernacular Demo)
    createNoirSampleProject(), // Ep 2: Magla nad Zagrebom
    createSecondSampleProject(), // Ep 3: Signals from Palagruža
    createThirdSampleProject(), // Ep 4: Noćni arhiv Republike
  ];
}
