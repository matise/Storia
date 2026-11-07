import {
  AudioEffectConfig,
  BlockType,
  CroatianDialect,
  DubrovnikRegister,
  EpisodeAiBlueprint,
  GeminiBaseVoice,
  GeminiTextModelId,
  Gender,
  normalizeGeminiVoiceName,
  ScriptBlock,
  SfxCategoryPreset,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';

const SPEAKER_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
];

function createDefaultSpeakerDspStack(
  speakerId: string,
  lowGain = 1.5,
  midGain = 2.0,
  highGain = 1.5,
  thresholdDb = -20,
  ratio = 2.8
): AudioEffectConfig[] {
  return [
    {
      id: `fx_eq_${speakerId}`,
      name: '3-Band Biquad EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: lowGain,
      midPeakFreqHz: 2600,
      midPeakGainDb: midGain,
      midPeakQ: 1.1,
      highShelfFreqHz: 8000,
      highShelfGainDb: highGain,
    },
    {
      id: `fx_dyn_${speakerId}`,
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb,
      ratio,
      attackMs: 14,
      releaseMs: 95,
      kneeDb: 3,
    },
  ];
}

export function buildEpisodeArchitectSystemPrompt(
  language: SupportedLanguage,
  dialect?: CroatianDialect,
  dubrovnikRegister?: DubrovnikRegister,
  episodeNumber = 1
): string {
  const langLabel = language === 'hr' ? 'Croatian (Hrvatski)' : 'English';
  const dubrovnikRules =
    language === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  return [
    `You are an Executive Audio Drama Showrunner, Podcast Producer, and Broadcast Sound Designer for the Storia Studio.`,
    `Design a complete episode blueprint (#${episodeNumber}) based on the user's premise or concept.`,
    `Target Language: ${langLabel}.`,
    `Return ONLY valid JSON matching:`,
    `{`,
    `  "title": "Ep ${episodeNumber}: \\"Compelling Title\\"",`,
    `  "description": "2-sentence rich dramatic or investigative synopsis",`,
    `  "genre": "Genre / Format label (e.g. Investigative Podcast, Historical Noir, Sci-Fi Audio Drama)",`,
    `  "author": "Storia AI Studio",`,
    `  "targetWpm": 135..155,`,
    `  "targetLufs": -16 or -18,`,
    `  "rationale": "1-2 sentences explaining the cast dynamic, acoustic staging, and pacing",`,
    `  "speakers": [`,
    `    {`,
    `      "name": "Character or Host Name",`,
    `      "gender": "female"|"male"|"neutral",`,
    `      "age": "string",`,
    `      "baseVoice": "Aoede"|"Fenrir"|"Zephyr"|"Charon"|"Kore"|"Puck"|"Orus"|"Leda"|"Sadaltager"|"Algenib"|"Enceladus"|"Gacrux"|"Iapetus"|"Sulafat"|"Achernar"|"Despina"|"Schedar"|"Umbriel",`,
    `      "speakingRate": 0.9..1.15,`,
    `      "pitchAdjustment": -3..3,`,
    `      "stylePrompt": "Vocal delivery & timbre style",`,
    `      "personaPrompt": "Character psychology, rhythm, and role",`,
    `      "actingNotes": "Microphone proximity and breathing cues",`,
    `      "lowShelfGainDb": -4..4,`,
    `      "midPeakGainDb": 0..4,`,
    `      "highShelfGainDb": -2..4`,
    `    }`,
    `  ],`,
    `  "blocks": [`,
    `    {`,
    `      "type": "sound_effect"|"narration"|"dialogue",`,
    `      "speakerIndex": 0,`,
    `      "text": "Spoken dialogue, narration, or SFX description",`,
    `      "directorNotes": "Delivery cue (e.g. whispered, analytical, urgent)",`,
    `      "sfxCategory": "weather_rain"|"wind_storm"|"footsteps"|"door_creak"|"cinematic_drone"|"radio_static"|"auto",`,
    `      "pauseAfterMs": 350..900`,
    `    }`,
    `  ]`,
    `}`,
    `Include 2 to 3 distinct speakers and 4 to 6 opening script blocks (starting with an atmospheric sound_effect or narration, followed by engaging dialogue).`,
    dubrovnikRules,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildFallbackEpisodeBlueprint(params: {
  prompt: string;
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  episodeNumber?: number;
}): EpisodeAiBlueprint {
  const {
    prompt,
    language,
    dialect = 'standard',
    dubrovnikRegister = 'contemporary',
    episodeNumber = 1,
  } = params;

  const isHr = language === 'hr';
  const isDubrovnik = isHr && dialect === 'dubrovnik';
  const lower = prompt.toLowerCase();
  const now = Date.now();

  const isPodcast =
    /podcast|interview|intervju|debate|debata|analiza|voditelj|host|talk|razgovor|ekonomija|dron|tehnologij/.test(
      lower
    );
  const isSciFi =
    /sci-fi|scifi|space|svemir|signal|station|orbital|ai|cyber|future|budućnost|palagru/.test(
      lower
    );

  const cleanTopic = prompt.trim();

  if (isPodcast) {
    const spk1Id = `spk_${now}_0`;
    const spk2Id = `spk_${now}_1`;

    const speakers: Speaker[] = [
      {
        id: spk1Id,
        name: isHr ? 'Voditelj 1 (Nikola)' : 'Host 1 (Elena)',
        color: SPEAKER_COLORS[0],
        gender: isHr ? 'male' : 'female',
        age: '36',
        personaPrompt: isHr
          ? 'Glavni voditelj analitičkog podcasta. Postavlja prodorna pitanja, strukturira temu i povezuje teoriju s praksom.'
          : 'Lead investigative podcast host. Structures complex topics clearly and challenges assumptions with sharp questions.',
        actingNotes: isHr
          ? 'Topao studijski glas blizu mikrofona, prirodan konverzacijski ritam.'
          : 'Warm close-mic broadcast tone, natural conversational cadence.',
        voice: {
          baseVoice: isHr ? 'Fenrir' : 'Aoede',
          stylePrompt: isHr
            ? 'Artikuliran i topao voditeljski glas'
            : 'Warm, articulate investigative podcast host',
          speakingRate: 1.03,
          pitchAdjustment: 0,
          enableDirectorNotes: true,
          ssmlEnabled: true,
          acoustics: {
            biquadEq: {
              enabled: true,
              lowShelfGainDb: 2.0,
              midPeakGainDb: 2.5,
              highShelfGainDb: 1.5,
            },
            compression: {
              enabled: true,
              thresholdDb: -20,
              ratio: 3.0,
              attackMs: 12,
              releaseMs: 90,
            },
            effectStack: createDefaultSpeakerDspStack(spk1Id, 2.0, 2.5, 1.5, -20, 3.0),
          },
        },
        createdAt: now,
      },
      {
        id: spk2Id,
        name: isHr ? 'Voditelj 2 (Klara)' : 'Host 2 (Marcus)',
        color: SPEAKER_COLORS[1],
        gender: isHr ? 'female' : 'male',
        age: '34',
        personaPrompt: isHr
          ? 'Suvoditeljica i tehnička analitičarka. Razlaže složene sustave kroz konkretne primjere, ironiju i dubinsku sintezu.'
          : 'Co-host and technical systems analyst. Breaks down complex architectures with vivid analogies and dry wit.',
        actingNotes: isHr
          ? 'Bistar, energičan ton s naglašenom dikcijom na ključnim pojmovima.'
          : 'Crisp, energetic studio delivery with clear emphasis on technical insights.',
        voice: {
          baseVoice: isHr ? 'Zephyr' : 'Charon',
          stylePrompt: isHr
            ? 'Analitičan, živahan i jasan studijski glas'
            : 'Crisp, analytical co-host delivery',
          speakingRate: 1.05,
          pitchAdjustment: 0,
          enableDirectorNotes: true,
          ssmlEnabled: true,
          acoustics: {
            biquadEq: {
              enabled: true,
              lowShelfGainDb: 1.0,
              midPeakGainDb: 3.0,
              highShelfGainDb: 2.0,
            },
            compression: {
              enabled: true,
              thresholdDb: -19,
              ratio: 2.8,
              attackMs: 14,
              releaseMs: 95,
            },
            effectStack: createDefaultSpeakerDspStack(spk2Id, 1.0, 3.0, 2.0, -19, 2.8),
          },
        },
        createdAt: now + 1,
      },
    ];

    const blocks: ScriptBlock[] = [
      {
        id: `blk_${now}_1`,
        type: 'sound_effect',
        text: isHr
          ? 'Topla analogna uvodna špica podcasta s dubokim sub-bas pulsom'
          : 'Warm analog podcast intro theme with subtle sub-bass pulse',
        sfxCategory: 'cinematic_drone',
        sfxDurationSec: 3.5,
        sfxIntensity: 0.65,
        pauseAfterMs: 400,
        ttsStatus: 'unrendered',
        order: 0,
      },
      {
        id: `blk_${now}_2`,
        type: 'dialogue',
        speakerId: spk1Id,
        text: isHr
          ? `Dobrodošli u novu epizodu! Danas ulazimo u dubinsku analizu teme: ${cleanTopic || 'skrivena arhitektura modernih sustava'}.`
          : `Welcome back to the studio! Today we are diving deep into ${cleanTopic || 'the hidden architecture of modern systems'}.`,
        directorNotes: isHr ? 'toplo i angažirano' : 'warm and engaging',
        pauseAfterMs: 450,
        ttsStatus: 'unrendered',
        order: 1,
      },
      {
        id: `blk_${now}_3`,
        type: 'dialogue',
        speakerId: spk2Id,
        text: isHr
          ? `Upravo tako. Kad god govorimo o ovoj temi, većina ljudi gleda samo površinu, dok se prava prekretnica krije u samim temeljima sustava.`
          : `Exactly. Whenever this topic comes up, most people only look at the surface, whereas the real paradigm shift is happening right under the hood.`,
        directorNotes: isHr ? 'analitično, s blagim naglaskom' : 'analytical, emphatic',
        pauseAfterMs: 500,
        ttsStatus: 'unrendered',
        order: 2,
      },
      {
        id: `blk_${now}_4`,
        type: 'dialogue',
        speakerId: spk1Id,
        text: isHr
          ? `Krenimo onda od samog početka — što je prvi detalj koji mijenja cijelu sliku?`
          : `Let's start right at the foundation—what is the first detail that changes the entire picture?`,
        directorNotes: isHr ? 'znatiželjno' : 'curious, conversational',
        pauseAfterMs: 450,
        ttsStatus: 'unrendered',
        order: 3,
      },
    ];

    return {
      title: isHr
        ? `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : 'Dubinska Analiza u Studiju'}"`
        : `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : 'Deep Studio Analysis'}"`,
      description: isHr
        ? `Analitička podcast epizoda s dva voditelja posvećena temi: ${cleanTopic || 'suvremena tehnologija, akustika i strategija'}.`
        : `Two-host investigative podcast episode exploring: ${cleanTopic || 'modern technology, acoustics, and strategy'}.`,
      defaultLanguage: language,
      dialect,
      dubrovnikRegister,
      genre: isHr ? 'Analitički Podcast / Intervju' : 'Investigative Podcast',
      author: 'Storia AI Studio',
      targetWpm: 145,
      targetLufs: -16,
      speakers,
      blocks,
      rationale: isHr
        ? 'Kreirana su dva kontrastna voditeljska glasa s Broadcast EQ i kompresijom (-16 LUFS) te dinamičnim uvodom.'
        : 'Designed two contrasting podcast hosts with Broadcast EQ & compression (-16 LUFS) and an engaging cold open.',
    };
  }

  if (isSciFi) {
    const spk1Id = `spk_${now}_0`;
    const spk2Id = `spk_${now}_1`;

    const speakers: Speaker[] = [
      {
        id: spk1Id,
        name: isHr ? 'Kapetanica Vega' : 'Commander Vega',
        color: SPEAKER_COLORS[4],
        gender: 'female',
        age: '38',
        personaPrompt: isHr
          ? 'Zapovjednica udaljene postaje. Smirena pod pritiskom, precizna i odlučna.'
          : 'Deep-range station commander. Calm under pressure, observant, and decisive.',
        actingNotes: isHr
          ? 'Kontroliran dah, fokusirana dikcija kroz komunikacijski kanal.'
          : 'Controlled breathing, crisp articulation over station comms.',
        voice: {
          baseVoice: 'Aoede',
          stylePrompt: isHr
            ? 'Smiren zapovjedni glas s dozom napetosti'
            : 'Calm, authoritative sci-fi commander',
          speakingRate: 0.98,
          pitchAdjustment: -1,
          enableDirectorNotes: true,
          ssmlEnabled: true,
          acoustics: {
            biquadEq: {
              enabled: true,
              lowShelfGainDb: 1.5,
              midPeakGainDb: 2.5,
              highShelfGainDb: 2.0,
            },
            compression: {
              enabled: true,
              thresholdDb: -21,
              ratio: 3.2,
              attackMs: 10,
              releaseMs: 85,
            },
            effectStack: createDefaultSpeakerDspStack(spk1Id, 1.5, 2.5, 2.0, -21, 3.2),
          },
        },
        createdAt: now,
      },
      {
        id: spk2Id,
        name: isHr ? 'Operater Orlov' : 'Telemetry Officer Kael',
        color: SPEAKER_COLORS[2],
        gender: 'male',
        age: '31',
        personaPrompt: isHr
          ? 'Specijalist za dubinsku telemetriju i dekodiranje anomalija.'
          : 'Specialist in deep-spectrum telemetry and signal anomalies.',
        actingNotes: isHr
          ? 'Brži tempo, napetost u glasu pri otkrivanju signala.'
          : 'Slightly faster tempo, rising urgency as the signal locks in.',
        voice: {
          baseVoice: 'Puck',
          stylePrompt: isHr
            ? 'Napet, fokusiran glas operatera za konzolom'
            : 'Focused, urgent telemetry specialist',
          speakingRate: 1.06,
          pitchAdjustment: 0,
          enableDirectorNotes: true,
          ssmlEnabled: true,
          acoustics: {
            biquadEq: {
              enabled: true,
              lowShelfGainDb: -4.0,
              midPeakGainDb: 4.0,
              highShelfGainDb: 1.0,
            },
            compression: {
              enabled: true,
              thresholdDb: -22,
              ratio: 4.0,
              attackMs: 8,
              releaseMs: 75,
            },
            effectStack: createDefaultSpeakerDspStack(spk2Id, -4.0, 4.0, 1.0, -22, 4.0),
          },
        },
        createdAt: now + 1,
      },
    ];

    const blocks: ScriptBlock[] = [
      {
        id: `blk_${now}_1`,
        type: 'sound_effect',
        text: isHr
          ? 'Šum radio-statike i niskofrekventni puls telemetrijskog terminala'
          : 'Crackling radio static and low-frequency telemetry terminal hum',
        sfxCategory: 'radio_static',
        sfxDurationSec: 4.0,
        sfxIntensity: 0.7,
        pauseAfterMs: 450,
        ttsStatus: 'unrendered',
        order: 0,
      },
      {
        id: `blk_${now}_2`,
        type: 'narration',
        speakerId: spk1Id,
        text: isHr
          ? `Sektor 9. Tri sata nakon što je vanjski odašiljač uhvatio nepoznatu frekvenciju (${cleanTopic || 'anomalija na horizontu'}).`
          : `Sector 9. Three hours after the outer array locked onto an unindexed carrier wave (${cleanTopic || 'horizon anomaly'}).`,
        directorNotes: isHr ? 'hladno i atmosferično' : 'cold and atmospheric',
        pauseAfterMs: 550,
        ttsStatus: 'unrendered',
        order: 1,
      },
      {
        id: `blk_${now}_3`,
        type: 'dialogue',
        speakerId: spk2Id,
        text: isHr
          ? `Kapetanice, ovo nije atmosferska smetnja. Fazna modulacija ponavlja se točno svakih dvanaest sekundi.`
          : `Commander, this isn't atmospheric noise. The phase modulation repeats every twelve seconds on the mark.`,
        directorNotes: isHr ? 'hitno, tiho' : 'urgent, hushed',
        pauseAfterMs: 450,
        ttsStatus: 'unrendered',
        order: 2,
      },
      {
        id: `blk_${now}_4`,
        type: 'dialogue',
        speakerId: spk1Id,
        text: isHr
          ? `Izoliraj nosivi val i pusti ga kroz glavni kanal. Želim čuti što je zapisano ispod šuma.`
          : `Isolate the carrier wave and patch it to the main bus. I want to hear what's buried underneath that static.`,
        directorNotes: isHr ? 'odlučno' : 'commanding, steady',
        pauseAfterMs: 500,
        ttsStatus: 'unrendered',
        order: 3,
      },
    ];

    return {
      title: isHr
        ? `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : 'Frekvencija s Horizonta'}"`
        : `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : 'Carrier Wave Anomaly'}"`,
      description: isHr
        ? `Znanstveno-fantastična audio-drama o dekodiranju tajanstvenog signala: ${cleanTopic || 'izolirana postaja i nepoznata prijetnja'}.`
        : `Sci-fi audio thriller following the decoding of an anomalous transmission: ${cleanTopic || 'isolated station and deep-spectrum mystery'}.`,
      defaultLanguage: language,
      dialect,
      dubrovnikRegister,
      genre: isHr ? 'Sci-Fi Audio-Triler' : 'Sci-Fi Audio Thriller',
      author: 'Storia AI Studio',
      targetWpm: 138,
      targetLufs: -16,
      speakers,
      blocks,
      rationale: isHr
        ? 'Postavljena je napeta sci-fi zvučna kulisa s radio-statikom i dva kontrastna lika (Zapovjednica + Telemetrija).'
        : 'Constructed a tense sci-fi soundstage with radio static SFX and contrasting Commander vs. Telemetry DSP chains.',
    };
  }

  // Default: Atmospheric Audio Drama / Dubrovnik or Noir Mystery
  const spk1Id = `spk_${now}_0`;
  const spk2Id = `spk_${now}_1`;

  const speakers: Speaker[] = [
    {
      id: spk1Id,
      name: isDubrovnik ? 'Gospar Lukša' : isHr ? 'Inspektor Toma' : 'Inspector Julian',
      color: SPEAKER_COLORS[0],
      gender: 'male',
      age: '45',
      personaPrompt: isDubrovnik
        ? 'Čuvar starih arhiva i tajni Grada. Govori autentičnim dubrovačkim govorom, smireno i mudro.'
        : isHr
          ? 'Iskusan istražitelj koji čita između redaka i poznaje svaku sjenu grada.'
          : 'Seasoned investigator who reads between the lines and knows every shadow of the old quarter.',
      actingNotes: isHr
        ? 'Dubok, baršunast bariton blizu mikrofona, odmjerene stanke.'
        : 'Deep, resonant baritone close to the mic with deliberate pauses.',
      voice: {
        baseVoice: 'Charon',
        stylePrompt: isHr
          ? 'Dubok, intiman dramski bariton'
          : 'Deep, world-weary dramatic baritone',
        speakingRate: 0.95,
        pitchAdjustment: -1,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 3.0,
            midPeakGainDb: 2.0,
            highShelfGainDb: 2.0,
          },
          compression: {
            enabled: true,
            thresholdDb: -22,
            ratio: 3.0,
            attackMs: 14,
            releaseMs: 105,
          },
          effectStack: createDefaultSpeakerDspStack(spk1Id, 3.0, 2.0, 2.0, -22, 3.0),
        },
      },
      createdAt: now,
    },
    {
      id: spk2Id,
      name: isDubrovnik ? 'Mare' : isHr ? 'Helena' : 'Clara',
      color: SPEAKER_COLORS[3],
      gender: 'female',
      age: '29',
      personaPrompt: isDubrovnik
        ? 'Restauratorica starih rukopisa u Gradu, pronicljiva i neustrašiva.'
        : isHr
          ? 'Arhivistica i svjedokinja ključnog događaja, oštroumna i emotivno izražajna.'
          : 'Archivist and key witness, sharp-witted and emotionally expressive.',
      actingNotes: isHr
        ? 'Izražajan lirski glas, suptilni uzdasi i živahna dikcija.'
        : 'Expressive lyric voice, subtle breath cues and vivid phrasing.',
      voice: {
        baseVoice: 'Aoede',
        stylePrompt: isHr
          ? 'Izražajan, čist ženski dramski glas'
          : 'Expressive, intimate dramatic female lead',
        speakingRate: 1.0,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 1.0,
            midPeakGainDb: 2.5,
            highShelfGainDb: 3.0,
          },
          compression: {
            enabled: true,
            thresholdDb: -20,
            ratio: 2.6,
            attackMs: 15,
            releaseMs: 100,
          },
          effectStack: createDefaultSpeakerDspStack(spk2Id, 1.0, 2.5, 3.0, -20, 2.6),
        },
      },
      createdAt: now + 1,
    },
  ];

  const blocks: ScriptBlock[] = [
    {
      id: `blk_${now}_1`,
      type: 'sound_effect',
      text: isDubrovnik
        ? 'Noćna bura i šum valova uz kamene mire u starom Portu'
        : isHr
          ? 'Noćna kiša na kamenim pločama i udaljeni koraci u prolazu'
          : 'Night rain on cobblestones and distant footsteps echoing in an archway',
      sfxCategory: 'weather_rain',
      sfxDurationSec: 4.0,
      sfxIntensity: 0.7,
      pauseAfterMs: 450,
      ttsStatus: 'unrendered',
      order: 0,
    },
    {
      id: `blk_${now}_2`,
      type: 'narration',
      speakerId: spk1Id,
      text: isDubrovnik
        ? `Ponoć je pasala nad Gradom. Pod kamenim voltima ostala je samo svjetlost jedne ланterne i tajna koja je čekala stoljećima.`
        : isHr
          ? `Sat je otkucao ponoć. U tišini starog arhiva ostao je samo trag na stolu: ${cleanTopic || 'neotvoreni spis iz prošle noći'}.`
          : `Midnight struck across the wet rooftops. Inside the archive, a single dossier lay open: ${cleanTopic || 'the unsealed record from last night'}.`,
      directorNotes: isHr ? 'tiho, atmosferično' : 'hushed, atmospheric',
      pauseAfterMs: 550,
      ttsStatus: 'unrendered',
      order: 1,
    },
    {
      id: `blk_${now}_3`,
      type: 'dialogue',
      speakerId: spk2Id,
      text: isDubrovnik
        ? `Gosparu Lukša, pogledajte ovaj pečat na dnu lista. Nitko u Gradu nije otvarō ovu škrinju još od vremena Republike!`
        : isHr
          ? `Pogledajte ovaj datum na rubu stranice. Netko je bio ovdje prije nas i točno je znao što traži.`
          : `Look at the timestamp in the margin. Someone was in this vault before us, and they knew exactly what they were looking for.`,
      directorNotes: isHr ? 'napeto, polušapatom' : 'tense, urgent whisper',
      pauseAfterMs: 450,
      ttsStatus: 'unrendered',
      order: 2,
    },
    {
      id: `blk_${now}_4`,
      type: 'dialogue',
      speakerId: spk1Id,
      text: isDubrovnik
        ? `Muči, Mare, i zatvori funjestru. Ako furesti čuju što smo našli, do zore nećemo imat mira.`
        : isHr
          ? `Zatvori vrata i ne govori glasno. Ova priča tek počinje.`
          : `Keep your voice down and lock the door. This story is only beginning.`,
      directorNotes: isHr ? 'ozbiljno, blizu mikrofona' : 'low, close-mic gravitas',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered',
      order: 3,
    },
  ];

  return {
    title: isHr
      ? `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : isDubrovnik ? 'Tajna Staroga Porta' : 'Noćni Spis'}"`
      : `Ep ${episodeNumber}: "${cleanTopic ? cleanTopic.slice(0, 48) : 'The Midnight Dossier'}"`,
    description: isHr
      ? `Atmosferična audio-drama: ${cleanTopic || 'noćna istraga, skriveni dokumenti i napeti dijalozi u studiju'}.`
      : `Atmospheric audio drama: ${cleanTopic || 'a midnight investigation, hidden records, and tense dramatic dialogue'}.`,
    defaultLanguage: language,
    dialect,
    dubrovnikRegister,
    genre: isDubrovnik
      ? 'Dubrovačka Radiodrama'
      : isHr
        ? 'Dramska Radiodrama / Triler'
        : 'Noir Audio Drama',
    author: 'Storia AI Studio',
    targetWpm: 136,
    targetLufs: -16,
    speakers,
    blocks,
    rationale: isHr
      ? 'Kreirana je dramska epizoda s dva kontrastna lika, prilagođenim Biquad EQ profilima i uvodnom atmosferom kiše.'
      : 'Created a dramatic episode blueprint with two contrasting leads, custom Biquad EQ profiles, and rain ambiance.',
  };
}

export async function generateEpisodeBlueprintWithAi(params: {
  prompt: string;
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  episodeNumber?: number;
  apiKey?: string | null;
  textModel?: GeminiTextModelId;
  abortSignal?: AbortSignal;
}): Promise<EpisodeAiBlueprint> {
  const {
    prompt,
    language,
    dialect = 'standard',
    dubrovnikRegister = 'contemporary',
    episodeNumber = 1,
    apiKey,
    textModel,
    abortSignal,
  } = params;

  const fallback = buildFallbackEpisodeBlueprint({
    prompt,
    language,
    dialect,
    dubrovnikRegister,
    episodeNumber,
  });

  if (!apiKey || apiKey.trim().length < 10) {
    return fallback;
  }

  try {
    const systemInstruction = buildEpisodeArchitectSystemPrompt(
      language,
      dialect,
      dubrovnikRegister,
      episodeNumber
    );
    const endpoint = buildGeminiEndpoint(
      textModel ?? 'gemini-2.5-flash',
      apiKey.trim()
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Episode Premise / Concept: ${prompt.trim() || 'An atmospheric multi-speaker audio drama or investigative podcast episode.'}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const rawText: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return fallback;
    }

    const parsed = JSON.parse(stripMarkdownJsonFence(rawText)) as Record<
      string,
      unknown
    >;
    const now = Date.now();

    const rawSpeakers = Array.isArray(parsed.speakers) ? parsed.speakers : [];
    const builtSpeakers: Speaker[] =
      rawSpeakers.length > 0
        ? rawSpeakers.slice(0, 5).map((rawSpk, idx) => {
            const s = (rawSpk ?? {}) as Record<string, unknown>;
            const spkId = `spk_${now}_${idx}`;
            const rawGender = String(s.gender || 'neutral');
            const validGender: Gender =
              rawGender === 'male' ||
              rawGender === 'female' ||
              rawGender === 'non-binary' ||
              rawGender === 'neutral' ||
              rawGender === 'other'
                ? rawGender
                : 'neutral';

            const rawVoice = String(s.baseVoice || '');
            const validVoice: GeminiBaseVoice = rawVoice
              ? normalizeGeminiVoiceName(rawVoice, validGender)
              : idx % 2 === 0
                ? 'Aoede'
                : 'Fenrir';

            const lowGain = Math.max(
              -10,
              Math.min(10, Number(s.lowShelfGainDb) || 1.5)
            );
            const midGain = Math.max(
              -10,
              Math.min(10, Number(s.midPeakGainDb) || 2.0)
            );
            const highGain = Math.max(
              -10,
              Math.min(10, Number(s.highShelfGainDb) || 1.5)
            );

            return {
              id: spkId,
              name: String(s.name || `Speaker ${idx + 1}`).trim(),
              color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
              gender: validGender,
              age: String(s.age || '35'),
              personaPrompt: String(
                s.personaPrompt || fallback.speakers[0].personaPrompt
              ),
              actingNotes: String(
                s.actingNotes || fallback.speakers[0].actingNotes
              ),
              voice: {
                baseVoice: validVoice,
                stylePrompt: String(
                  s.stylePrompt || fallback.speakers[0].voice.stylePrompt
                ),
                speakingRate: Math.max(
                  0.6,
                  Math.min(1.6, Number(s.speakingRate) || 1.0)
                ),
                pitchAdjustment: Math.round(
                  Math.max(-8, Math.min(8, Number(s.pitchAdjustment) || 0))
                ),
                enableDirectorNotes: true,
                ssmlEnabled: true,
                acoustics: {
                  biquadEq: {
                    enabled: true,
                    lowShelfGainDb: lowGain,
                    midPeakGainDb: midGain,
                    highShelfGainDb: highGain,
                  },
                  compression: {
                    enabled: true,
                    thresholdDb: -20,
                    ratio: 2.8,
                    attackMs: 14,
                    releaseMs: 95,
                  },
                  effectStack: createDefaultSpeakerDspStack(
                    spkId,
                    lowGain,
                    midGain,
                    highGain
                  ),
                },
              },
              createdAt: now + idx,
            };
          })
        : fallback.speakers;

    const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    const builtBlocks: ScriptBlock[] =
      rawBlocks.length > 0
        ? rawBlocks.slice(0, 10).map((rawBlk, idx) => {
            const b = (rawBlk ?? {}) as Record<string, unknown>;
            const rawType = String(b.type || 'dialogue');
            const validType: BlockType =
              rawType === 'sound_effect' ||
              rawType === 'narration' ||
              rawType === 'direction' ||
              rawType === 'dialogue'
                ? rawType
                : 'dialogue';

            const spkIdx = Math.max(
              0,
              Math.min(builtSpeakers.length - 1, Number(b.speakerIndex) || 0)
            );
            const rawSfx = String(b.sfxCategory || 'auto') as SfxCategoryPreset;

            return {
              id: `blk_${now}_${idx + 1}`,
              type: validType,
              speakerId:
                validType === 'sound_effect'
                  ? undefined
                  : builtSpeakers[spkIdx]?.id,
              text: String(b.text || '...').trim(),
              directorNotes: b.directorNotes
                ? String(b.directorNotes).trim()
                : undefined,
              sfxCategory: validType === 'sound_effect' ? rawSfx : undefined,
              sfxDurationSec: validType === 'sound_effect' ? 4.0 : undefined,
              sfxIntensity: validType === 'sound_effect' ? 0.7 : undefined,
              pauseAfterMs: Math.max(
                150,
                Math.min(2000, Number(b.pauseAfterMs) || 450)
              ),
              ttsStatus: 'unrendered',
              order: idx,
            };
          })
        : fallback.blocks;

    return {
      title: String(parsed.title || fallback.title).trim(),
      description: String(parsed.description || fallback.description).trim(),
      defaultLanguage: language,
      dialect,
      dubrovnikRegister,
      genre: String(parsed.genre || fallback.genre).trim(),
      author: String(parsed.author || 'Storia AI Studio').trim(),
      targetWpm: Math.max(
        80,
        Math.min(220, Number(parsed.targetWpm) || fallback.targetWpm)
      ),
      targetLufs: Math.max(
        -24,
        Math.min(-12, Number(parsed.targetLufs) || fallback.targetLufs)
      ),
      speakers: builtSpeakers,
      blocks: builtBlocks,
      rationale: String(parsed.rationale || fallback.rationale).trim(),
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return fallback;
  }
}
