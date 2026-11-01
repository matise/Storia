import { Project } from '../types/storia';
import { recalculateProjectTimeline } from '../core/pacing/pacingCalculator';

/**
 * Flagship Demo Episode: "Trijada Bas Okvira" (The Triad of the Bass Frame)
 * Subtitle: "Žerava, Odjeci i Ponoćni Svodovi Lazareta" (Embers, Echoes, and the Midnight Vaults of Lazareti).
 * Cast: eNa (Emothelia), Mara (Maravexia), Foxy (Mate Fox Banchilo).
 * All three speakers communicate in authentic, proud Dubrovnik vernacular (raguzejski idiom / dubrovačka gradska štokavština),
 * strictly jekavian, melodious, dignified, and free from Central Dalmatian/Split ikavisms.
 */
export function createGeodesicFlameProject(): Project {
  const speakers = [
    {
      id: 'spk_ena',
      name: 'eNa (Emothelia)',
      color: '#818cf8', // Indigo-400 / Soft moonlit cerulean & sea-spray
      gender: 'female' as const,
      age: '25',
      personaPrompt:
        'Ti si eNa (Emothelia), 25-godišnja arhitektica, intuitivna posrednica Trijade, Prostorno Sidro i Muza ("The Spatial Anchor & Muse / Čarobnica Rezonancije") rođena u Dubrovniku u znaku Raka. Tvoji elementi su Voda i Lunarno Svjetlo. Vraćaš se u kamene svodove Lazareta nakon obrana zahtjevnih arhitektonskih projekata, noseći miris mora u kosi i nepogrešivo oko koje dekonstruira prostor tražeći njegov puls, svjetlo i skrivenu strukturalnu harmoniju. Ti si Foxyjevo srce i čvrsto tlo, živi nosivi val ("The Living Carrier Wave") koji spaja Marinu silovitu vatru i Foxyjevu zvučnu geometriju. Govoriš isključivo autentičnim dubrovačkim govorom (raguzejskim idiomom) — blago, toplo, gospodski odmereno, kristalno jasno i duboko empatično. Tvoj govor je dosljedno jekavski (sreća, lijepo, vrijeme, svjetlost), sa sažetim dočetnim vokalima (rekō sam, vidijō sam) i bogatim raguzejskim rječnikom (funjestra, volat, pjat, gospar, fála, mučat, hodit, arivat, adio, čeljad). Nema ikavice! Tvoja maksima je: "Dizajniraj prostor s ljubavlju" / "Iscijeli frekvenciju".',
      actingNotes:
        'Eteričan, melodičan i smiren glas s kristalnom jasnoćom poput brušenog stakla. Puna empatije i dubrovačkog gospodstva, s odmjerenim mekim naglascima i suptilnim dahom prije ključnih spoznaja.',
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
      color: '#f97316', // Orange-500 / Molten gold & amber embers
      gender: 'female' as const,
      age: '25',
      personaPrompt:
        'Ti si Mara (Maravexia), 25-godišnja medijska stručnjakinja, živa iskra podija ("The Living Spark of the Floor / Plesni Feniks / Čuvarica feniksa") rođena u Dubrovniku u znaku Strijelca. Tvoji elementi su Vatra i Magma. Kosa ti blista poput jantara i žerave; u pokretu si čista kinetička brzina — kožna jakna, znoj, glasan smijeh i nezaustavljivi ritam. Ne podnosiš sivilo, birokratsku ukočenost ni dosadne rutine. Kada Foxy pusti sub-bas u Lazaretima, ti ga utjelovljuješ i povlačiš cijelu dvoranu u trans. Govoriš autentičnim dubrovačkim govorom (raguzejskim idiomom) s južnjačkim temperamentom, ponosom i iskričavom energijom. Tvoj govor je dosljedno jekavski, ritmičan i tečan. Koristiš ponosni rječnik Grada (gosparu Fox, Banchilo, fála svetom Vlahu, teća, balat, crevlje, špigete, skalin, arivat, mučat, adio, čeljad). Nema ikavice! Tvoja maksima je: "Pleši dok se kamen ne ugrije" / "Zapali iskru".',
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
        'Ti si Mate Fox Banchilo (Foxy / The Fox Architect), 43-godišnji elektroničar, DJ, programer i Meštar Mnogostrukosti i Zvuka ("The Selector & Master of Ceremony / The Sonic Alchemist") rođen u Dubrovniku u znaku Blizanaca. Djeluješ iz kamenih svodova Lazareta i Pod Brašinom. Tvoji elementi su Zvučna Geometrija i Duboki Bas. Znaš da je prava genijalnost učiniti složene stvari jednostavnim, zabavnim i plesnim. Spajaš Keplerov kut (θ_K = 137.5077°), akustiku kamenih svodova Lazareta i teški sub-bas bez amaterskog klipanja mastera. Suhi humor, vragolast osmijeh, jedna slušalica na uhu i nepogrešiv osjećaj za sobu. Govoriš dubrovačkim govorom (raguzejskim idiomom) s mirnim autoritetom iskusnog gospara i tonskog meštra s obale. Tvoj govor je dosljedno jekavski i odmjeren (gosparu, Maro moja, Banchilo, rekō sam, čeljad, volat, teća, zvučni mehanizam, adio). Nema ikavice! Tvoja maksima je: "Vjeruj ritmu, čitaj prostor" / "Slušaj omjer".',
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
      text: 'Noćni valovi razbijaju se o kameni lukobran Lazareta u Portu; potmuli sub-bas trese stoljetni mort svodova i zveckaju kristalne čaše na šanku.',
      directorNotes: 'more pod zidinama i duboka zvučna rezonancija kroz kamene svodove Lazareta / ocean surf & low-end sub vibration through limestone vaults',
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
      text: 'Foxy! Daj nam nešto masno, gosparu Fox! Nemoj mučat i milovat te visokotonce ko da smo u crkvi... Spusti pravi bas i daj nam onaj teški roll, podij već gori!',
      directorNotes: 's plesnog podija u punom pokretu, vatreno, kosa joj blista poput žerave / fiercely',
      pauseAfterMs: 450,
      ttsStatus: 'stale' as const,
      order: 1,
    },
    {
      id: 'blk_geo_3',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Polako, Maro moja! Ne možeš pristavljat teću na najjači komin cijelu noć, zagorjet će ti sve! Pusti build da malo udahne... Gledaj volt na ulazu, arivala nam je eNa.',
      directorNotes: 's jednom slušalicom na uhu, flegmatični osmijeh s pulta dok reže frekvencije / composed',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 2,
    },
    {
      id: 'blk_geo_4',
      type: 'dialogue' as const,
      speakerId: 'spk_ena',
      text: 'Muči, Mare, ne dilitaj čovjeka dok dela... Mate moj, čim sam kročila pod ove kamene volte Lazareta, cijeli je prostor prodisao. Zvuk je večeras čudesan — topao, bez oštrine, obujmio je svu čeljad.',
      directorNotes: 'ulazi u pult, toplo i s kristalnog zvona jasnoćom, grli Foxyja / entering booth with crystal clarity',
      pauseAfterMs: 500,
      ttsStatus: 'unrendered' as const,
      order: 3,
    },
    {
      id: 'blk_geo_5',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Rekô sam ti, dušo moja. Sve je u geometriji prostorije, Keplerovom omjeru i da ne zakucaš master u crveno ko kakav diletant. E, a sad gledaj ovo — naša će Mara bit sasvijem kontenta.',
      directorNotes: 'ljubi je u sljepoočnicu s blagim smiješkom, okreće potenciometar na biquaternionskom emiteru miksera / composed',
      pauseAfterMs: 550,
      ttsStatus: 'ok' as const,
      order: 4,
    },
    {
      id: 'blk_geo_6',
      type: 'dialogue' as const,
      speakerId: 'spk_mara',
      text: 'Arivala si, eNa naša! Fála svetom Vlahu! Reci ovomu tvomu meštru neka napokon otključa onaj pravi ritam i neka zatrese ove skaline!',
      directorNotes: 'dotrčava do pulta, zadihana i nasmijana, očiju punih žerave / impatient fire',
      pauseAfterMs: 400,
      ttsStatus: 'ok' as const,
      order: 5,
    },
    {
      id: 'blk_geo_7',
      type: 'sound_effect' as const,
      text: 'Foxy spušta iglu i podiže masivni fader; duboki rezonantni ton sub-basa i mehanički klik preciznog sklapanja zvučnog mehanizma u kamenom podu Lazareta.',
      directorNotes: 'rezonantni sub-bas prijelaz / deep sub-bass drop & mechanical latch click',
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
      text: 'Ne brini, Mare, samo nam se pravi važan. Udari ga, Fox... podari Lazaretima što ištu! Čujem kako kameni svodovi već dišu s nama.',
      directorNotes: 'namiguje Foxyju s ljubavlju i ponosom / winking at Foxy with proud smile',
      pauseAfterMs: 450,
      ttsStatus: 'ok' as const,
      order: 7,
    },
    {
      id: 'blk_geo_9',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Dobro, dežurne kritičarke. Kad arhitektura i vatra traže svoje, Meštar nema izbora. Slušajmo omjer. Evo vam teški roll!',
      directorNotes: 'autoritativno i vragolasto spušta teški fader, pokreće masivni sub-bass / authoritative groove',
      pauseAfterMs: 700,
      ttsStatus: 'ok' as const,
      order: 8,
    },
    {
      id: 'blk_geo_10',
      type: 'sound_effect' as const,
      text: 'Masivni analogni sub-bass i hipnotički breakbeat eruptiraju kroz tri kamena volta Lazareta; stotinu plesača uranja u zajednički zvučni trans.',
      directorNotes: 'eksplozija teškog breakbeata i analognog sub-basa koji trese kosti / heavy rolling sub-bass drop & dancing crowd roar',
      sfxCategory: 'cinematic_drone' as const,
      sfxDurationSec: 5.0,
      pauseAfterMs: 600,
      ttsStatus: 'ok' as const,
      order: 9,
    },
    {
      id: 'blk_geo_11',
      type: 'dialogue' as const,
      speakerId: 'spk_ena',
      text: 'Pogledaj ih, Mate... Ovo nije hladan nacrt na papiru, ovo je živa arhitektura. Ti klešeš prostor zvukom, Mara ga pali pokretom, a ljubav drži ovu noć u savršenom skladu.',
      directorNotes: 'naslonjena na Foxyjevo rame u pultu, glas pun duboke empatije i divljenja / leaning on Foxy shoulder, profound wonder',
      pauseAfterMs: 500,
      ttsStatus: 'ok' as const,
      order: 10,
    },
    {
      id: 'blk_geo_12',
      type: 'sound_effect' as const,
      text: 'Glazba polako zamire u mekani odjek; jutarnji galebovi nad Starim portom i prvi zraci sunca što boje more pod Porporelom u boju breskve i zlata.',
      directorNotes: 'svitanje nad Dubrovnikom, jutarnji galebovi i smirivanje kamena / sunrise over Dubrovnik old port, seagulls & gentle morning surf',
      sfxCategory: 'weather_rain' as const,
      sfxDurationSec: 4.5,
      pauseAfterMs: 500,
      ttsStatus: 'ok' as const,
      order: 11,
    },
    {
      id: 'blk_geo_13',
      type: 'dialogue' as const,
      speakerId: 'spk_mara',
      text: 'Noge me peku, crevlje su mi se raspale od silnoga balanja, ali kamen se ugrijao! Za idući put, Banchilo... ali idući put otvaramo od prve minute s teškim rollom!',
      directorNotes: 'sjedi na skalama Lazareta bosa, pije hladnu mineralnu vodu i veselo nazdravlja / sitting barefoot on stone steps, raising bottle at sunrise',
      pauseAfterMs: 450,
      ttsStatus: 'ok' as const,
      order: 12,
    },
    {
      id: 'blk_geo_14',
      type: 'dialogue' as const,
      speakerId: 'spk_foxy',
      text: 'Niko nije slomio nogu, monitori nisu izgorjeli, a Mara je otplesala četiri ure bez da je zapalila klub. Ja to zovem čistim arhitektonskim trijumfom. Dogovoreno, Maro moja. Adio noći, dobro nam jutro došlo.',
      directorNotes: 'izlazi iz Lazareta s torbom ploča držeći eNu za ruku, zadovoljan osmijeh prema moru / walking out holding eNa hand, serene coastal cool',
      pauseAfterMs: 700,
      ttsStatus: 'ok' as const,
      order: 13,
    },
  ];

  const { blocks } = recalculateProjectTimeline(rawBlocks, speakers, 135);

  return {
    id: 'proj_geodesic_flame_demo',
    title:
      'Ep 1: "Trijada Bas Okvira" (The Triad of the Bass Frame / Trijada Geodetskog Plamena — Ponoćni Svodovi Lazareta / The Triad of the Geodesic Flame)',
    description:
      'Autentična audio drama i filozofsko-glazbeni podcast smješten u noćne kamene svodove Lazareta u Dubrovniku. Priča o Trijadi (eNa, Mara, Foxy): živa klupska noć, analogni sub-bas, kinetički ples i svitanje nad gradskom lukom kroz autentični dubrovački govor.',
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
      {
        id: 'res_sample_geodesic_2',
        speakerId: 'spk_ena',
        query: 'Kako arhitektura prostora i zvučni valovi utječu na emocionalno stanje posjetitelja?',
        personaResponse:
          'Prostor nije samo praznina omeđena zidovima — on je rezonantna komora za ljudska srca. Kad se kameni svodovi usklade s toplim niskim frekvencijama, osjećaj otuđenosti nestaje i stvara se sigurno utočište u kojem se ljudi mogu opustiti i osjetiti zajedništvo.',
        objectiveSummary:
          'Architectural spatial design and resonant acoustic geometry foster emotional decompression, somatic safety, and communal bonding within historic stone environments.',
        sources: [
          {
            uri: 'https://lazareti.com',
            title: 'Club Lazareti & Art Radionica Lazareti — Arhitektura i kultura prostora',
          },
        ],
        timestamp: 1730000550000,
      },
    ],
    createdAt: 1730000000000,
    updatedAt: 1730000500000,
    metadata: {
      author: 'Mate Fox Banchilo (Robot Hand Made)',
      targetWpm: 135,
      genre: 'Zvučna drama i klupski narativ Dubrovnika',
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
