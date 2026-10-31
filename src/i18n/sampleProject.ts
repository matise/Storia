import { Project } from '../types/storia';
import { recalculateProjectTimeline } from '../core/pacing/pacingCalculator';

export function createSampleProject(): Project {
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
    researchNotebook: [
      {
        id: 'res_sample_1',
        speakerId: 'spk_marko',
        query: 'Kakve je pištolje koristila zagrebačka policija 1938. godine?',
        personaResponse:
          'Službeni pištolji? Krajem tridesetih redarstvo je nosilo FN M1922... teški, pouzdani, kalibar 9mm kratki. Dovoljno malen da stane u džep balonera, dovoljno glasan da probudi pola Gornjeg grada.',
        objectiveSummary:
          'Yugoslav and Zagreb police authorities in the late 1930s primarily issued the FN Model 1922 (Browning) chambered in 9×17mm (.380 ACP).',
        sources: [
          {
            uri: 'https://www.hpm.hr',
            title: 'Hrvatski povijesni muzej (hpm.hr) — Zbirka oružja',
          },
        ],
        timestamp: 1730000500000,
      },
    ],
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
 * Returns the starter studio library of 3 diverse bilingual episodes.
 */
export function createInitialProjectLibrary(): Project[] {
  return [
    createSampleProject(),
    createSecondSampleProject(),
    createThirdSampleProject(),
  ];
}
