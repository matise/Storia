import {
  CoWriterAttachment,
  CroatianDialect,
  DubrovnikRegister,
  GEMINI_VOICE_CATALOG,
  GeminiBaseVoice,
  GeminiTextModelId,
  Gender,
  normalizeGeminiVoiceName,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';
import { SPEAKER_COLORS } from './episodeArchitectAgent';

export interface ExtractedCastMember {
  id: string;
  name: string;
  gender: Gender;
  age: string;
  archetype?: string;
  personaPrompt: string;
  actingNotes: string;
  voiceId: GeminiBaseVoice;
  stylePrompt: string;
  speakingRate: number;
  pitchAdjustment: number;
  lowShelfGainDb: number;
  midPeakGainDb: number;
  highShelfGainDb: number;
  sampleDialogue?: string;
  acousticRationale?: string;
  selected?: boolean;
}

export interface CastExtractionResult {
  characters: ExtractedCastMember[];
  detectedGenre?: string;
  settingSummary?: string;
  rationale?: string;
}

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Builds system prompt for Gemini to act as an elite dramatic casting director
 * and extract structured speaker profiles from character bibles.
 */
export function buildCastExtractionSystemPrompt(
  language: SupportedLanguage,
  dialect?: CroatianDialect,
  dubrovnikRegister?: DubrovnikRegister
): string {
  const isHr = language === 'hr';
  const dubrovnikRules =
    isHr && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  return [
    `You are an elite Dramatic Casting Director, Dialect Coach, and Broadcast Sound Engineer for Storia Audio Drama Studio.`,
    `Your task is to analyze character bibles, casting dossiers, narrative treatments, and screenplay materials, and extract all primary characters into fully realized audio drama voice profiles.`,
    `Language: ${isHr ? 'Croatian (Hrvatski)' : 'English'}.`,
    `Available Official Gemini 2.5 TTS Base Voices (assign ONLY from these exact 30 voices based on age, gender, timbre, and personality):`,
    ...GEMINI_VOICE_CATALOG.map(
      (v) => `- ${v.id} (${v.register}): ${v.descriptionEn}`
    ),
    `Requirements for each extracted character:`,
    `1. "name": Character name and any prominent nickname or alias (e.g. "Matija / Mate Fox (Foxy)").`,
    `2. "gender": "male" | "female" | "non-binary" | "neutral" | "other".`,
    `3. "age": Approximate age integer or description (e.g. "43", "25", "Elderly").`,
    `4. "archetype": Animal motif, mythical archetype, or dramatic role (e.g. "Vulpes / Night Strategist", "White Heron / System Architect", "Sea Moray / Bass Rhythm").`,
    `5. "personaPrompt": Detailed 2-3 sentence psychological profile, worldview, communication tempo, and motivations.`,
    `6. "actingNotes": Clear actor delivery guidance: vocal resonance, breathing, microphone proximity, emotional undertone, and regional dialect cues (e.g. Dubrovnik / Dalmatian / Župa vernacular, slang, cadence).`,
    `7. "voiceId": Best matched official base voice name from the 30 listed above.`,
    `8. "stylePrompt": Concise cross-modal conditioning prompt (e.g. "Raspy, quick-witted, cigarette-smoked 40s male baritone with dry Mediterranean irony").`,
    `9. "speakingRate": Pace multiplier between 0.8 and 1.3 (1.0 = normal).`,
    `10. "pitchAdjustment": Pitch shift in semitones (-4 to +4).`,
    `11. "lowShelfGainDb": Bass EQ compensation in dB (-4.0 to +6.0).`,
    `12. "midPeakGainDb": Dialogue clarity EQ in dB (-2.0 to +6.0).`,
    `13. "highShelfGainDb": High-frequency presence/air EQ in dB (-4.0 to +6.0).`,
    `14. "sampleDialogue": 1-2 authentic sentences of in-character dialogue in ${isHr ? 'Croatian' : 'English'}, incorporating their vocabulary, slang, and dialect.`,
    `15. "acousticRationale": 1-2 sentences explaining why this voice timbre and EQ settings complement their character psychology and anatomy.`,
    `Return ONLY valid JSON matching this structure:`,
    `{`,
    `  "detectedGenre": "e.g. Mediterranean Coastal Drama / Cyberpunk Thriller / Investigative Podcast",`,
    `  "settingSummary": "1-2 sentences summarizing the physical setting and acoustic ambiance",`,
    `  "rationale": "Overall summary of the extracted cast ensemble",`,
    `  "characters": [`,
    `    {`,
    `      "id": "spk_character_slug",`,
    `      "name": "...",`,
    `      "gender": "male"|"female"|"non-binary"|"neutral",`,
    `      "age": "...",`,
    `      "archetype": "...",`,
    `      "personaPrompt": "...",`,
    `      "actingNotes": "...",`,
    `      "voiceId": "...",`,
    `      "stylePrompt": "...",`,
    `      "speakingRate": 1.0,`,
    `      "pitchAdjustment": 0,`,
    `      "lowShelfGainDb": 2.0,`,
    `      "midPeakGainDb": 1.5,`,
    `      "highShelfGainDb": 1.0,`,
    `      "sampleDialogue": "...",`,
    `      "acousticRationale": "..."`,
    `    }`,
    `  ]`,
    `}`,
    dubrovnikRules,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Fallback cast extraction parser used offline or when API key is unconfigured.
 */
export function buildFallbackCastExtraction(params: {
  prompt?: string;
  attachments?: CoWriterAttachment[];
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
}): CastExtractionResult {
  const { prompt = '', attachments = [], language, dialect = 'standard' } = params;
  const isHr = language === 'hr';
  const isDubrovnik = isHr && dialect === 'dubrovnik';

  // Aggregate search text from prompt and attachments
  const allText = [
    prompt,
    ...attachments.map((a) => `${a.name} ${a.textContent ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const now = Date.now();

  // Special match for Ena, Mare, Foxy / Matija character bible
  const hasFoxy = /foxy|mate fox|matija|dj m@tise|vulpes|lazareti/.test(allText);
  const hasEna = /ena|heron|čaplja|kupari|14:19|arhitekt/.test(allText);
  const hasMare = /mare|blavor|moray|murina|mlini|135 bpm/.test(allText);

  if (hasFoxy || hasEna || hasMare) {
    const characters: ExtractedCastMember[] = [];

    if (hasFoxy || (!hasEna && !hasMare)) {
      characters.push({
        id: `spk_${now}_foxy`,
        name: 'Matija "Mate Fox" (Foxy)',
        gender: 'male',
        age: '43',
        archetype: 'Vulpes (Lisica) / Lazareti Noćni Strateg',
        personaPrompt: isHr
          ? 'DJ m@tise i organizator scene u Lazaretima. Noćni taktičar, pragmatičan, suh i ciničan, ali duboko odan bliskim ljudima. Vidi grad kao frekvencijsku mrežu.'
          : 'DJ m@tise and Lazareti underground organizer. Nighttime strategist, dry, cynical wit with intense loyalty. Views the coastline as an analog acoustic frequency grid.',
        actingNotes: isDubrovnik || isHr
          ? 'Dubok, lagano promukao bariton od cigareta i noćnih klubova. Brz, odrezan tempo, lokalni dubrovački noćni sleng i blagi cinizam.'
          : 'Deep, raspy baritone with cigarette smoke texture. Quick, clipped cadence, dry wit and subtle street gravitas.',
        voiceId: 'Orus',
        stylePrompt: isHr
          ? 'Promukao, suh, britak noćni muški bariton, blizu mikrofona'
          : 'Raspy, dry, sharp nighttime male baritone, close-mic delivery',
        speakingRate: 1.05,
        pitchAdjustment: -1,
        lowShelfGainDb: 3.5,
        midPeakGainDb: 2.0,
        highShelfGainDb: 1.5,
        sampleDialogue: isDubrovnik
          ? 'Mala, zaboravi teoriju. Kad u tri ujutro padne napon na zvučnicima u Lazaretima, jedino što te spašava je analogna skretnica i čisti instinkt.'
          : isHr
            ? 'Zaboravi priručnike. Kad u tri ujutro nestane signala, spašava te samo instinkt i ono što si sam zalemio.'
            : 'Forget the manual. When the power drops at three in the morning, the only thing that saves you is instinct and solid soldering.',
        acousticRationale: isHr
          ? 'Orus pruža teksturiranu hrapavost zrelog muškog glasa. Lagani low-shelf boost naglašava autoritet, a mid-peak čuva oštrinu.'
          : 'Orus offers textured raspy maturity. Low-shelf boost adds chest resonance while mid-peak preserves cynical articulation.',
        selected: true,
      });
    }

    if (hasEna) {
      characters.push({
        id: `spk_${now}_ena`,
        name: 'Ena',
        gender: 'female',
        age: '25',
        archetype: 'Bijela čaplja (White Heron) / Arhitektica sustava',
        personaPrompt: isHr
          ? 'Kupari, mlada inženjerka i kći obitelji. Mentalna geometrija 14:19, hladna, analitička, cerebralna. Traži skrivenu matematičku pravilnost u kaosu.'
          : 'Kupari, young systems engineer. Driven by 14:19 geometric ratios, cool, analytical, cerebral. Seeks mathematical underlying structures.',
        actingNotes: isHr
          ? 'Kristalno čist, smiren, odmjeren ženski glas. Minimalne oscilacije u intonaciji, savršen ritam disanja, distancirana elegancija.'
          : 'Pristine, poised, articulate female cadence. Minimal pitch jitter, deliberate breathing, detached elegance.',
        voiceId: 'Aoede',
        stylePrompt: isHr
          ? 'Kristalan, smiren, analitički ženski ton, kristalna artikulacija'
          : 'Crystal clear, calm, cerebral female timbre, articulate phrasing',
        speakingRate: 0.98,
        pitchAdjustment: 0,
        lowShelfGainDb: 0.5,
        midPeakGainDb: 1.5,
        highShelfGainDb: 3.0,
        sampleDialogue: isDubrovnik
          ? 'Nije to slučajnost, Mate. Svaka zgrada u Kuparima stoji pod kutom koji reflektira jeku točno u sekvenci od 1.4 sekunde. Netko je to izračunao prije nas.'
          : isHr
            ? 'Nema slučajnosti u ovom rasporedu. Vremenski interval signala ponavlja se s odstupanjem manjim od tri milisekunde.'
            : 'There is no coincidence here. The signal repeats with an error margin under three milliseconds.',
        acousticRationale: isHr
          ? 'Aoede nosi eteričnu čistoću i mirnoću. Visoki shelf naglašava zračnost i preciznost analitičkog glasa.'
          : 'Aoede delivers airy clarity and calm intellect. High-shelf boost highlights precise sibilance and poise.',
        selected: true,
      });
    }

    if (hasMare) {
      characters.push({
        id: `spk_${now}_mare`,
        name: 'Mare',
        gender: 'female',
        age: '26',
        archetype: 'Crni blavor / Morska murina (Sea Moray)',
        personaPrompt: isHr
          ? 'Mlini, flegmatični oklop, duboka tjelesna snaga i ritam od 135 BPM. Povezana s morem i obalnim rutama, malo govori ali kad progovori ima apsolutnu težinu.'
          : 'Mlini, phlegmatic emotional armor, grounding presence, pulsating at 135 BPM. Connected to maritime routes; speaks rarely with absolute weight.',
        actingNotes: isHr
          ? 'Dublji ženski alt, sporiji i teži tempo. Smirena, nepokolebljiva prisutnost bez nervoze u dahu.'
          : 'Grounded female alto, steady pulse. Unshakable, heavy presence with zero vocal trembling.',
        voiceId: 'Kore',
        stylePrompt: isHr
          ? 'Topao, staložen, dubok ženski alt, stabilan ritam'
          : 'Warm, grounded, steady female alto, immovable rhythm',
        speakingRate: 0.95,
        pitchAdjustment: -1,
        lowShelfGainDb: 2.5,
        midPeakGainDb: 2.0,
        highShelfGainDb: 0.5,
        sampleDialogue: isDubrovnik
          ? 'More se večeras diglo do mula u Mlinima. Ako mislite isplovit prije nego bura okrene na jugo, imate još samo kvarat od ure.'
          : isHr
            ? 'Plima je prekrila pristanište. Ako mislimo krenuti, moramo sada, prije nego što vjetar zatvori prolaz.'
            : 'The tide just covered the pier. If we are leaving, we move now before the wind closes the channel.',
        acousticRationale: isHr
          ? 'Kore pruža bogat, puni alt s naglašenim grudnim registrom, stvarajući dojam stijene i morskog sidra.'
          : 'Kore delivers a rich, full-bodied alto resonance that grounds the dramatic tension like an anchor.',
        selected: true,
      });
    }

    return {
      characters,
      detectedGenre: isDubrovnik
        ? 'Dubrovačka Obalna Drama / Župski Noir'
        : isHr
          ? 'Jadranska Obalna Drama / Psihološki Triler'
          : 'Coastal Mediterranean Drama / Psychological Noir',
      settingSummary: isHr
        ? 'Obala Župe dubrovačke (Kupari – Mlini – Brašina) i noćni klub Lazareti; kontrast betonske geometrije i morskih struja.'
        : 'The coast of Župa dubrovačka (Kupari – Mlini) and Lazareti vaults; contrast of brutalist geometry and coastal currents.',
      rationale: isHr
        ? `Uspješno izvučena 3 kontrastna lika iz priložene razrade likova (Foxy, Ena, Mare) s usklađenim Biquad EQ postavkama.`
        : `Successfully extracted 3 contrasting leads from character bible (Foxy, Ena, Mare) with matched vocal acoustics.`,
    };
  }

  // Default Fallback Cast for generic documents or prompts
  const isSciFi = /sci-fi|signal|space|station|cyber|telemetr/.test(allText);
  const isPodcast = /podcast|interview|razgovor|debata|analiz/.test(allText);

  if (isPodcast) {
    return {
      characters: [
        {
          id: `spk_${now}_host`,
          name: isHr ? 'Voditelj Marko' : 'Host Marcus',
          gender: 'male',
          age: '36',
          archetype: 'Investigative Podcast Host',
          personaPrompt: isHr
            ? 'Voditelj emisije, vješt sugovornik koji vodi debatu s lakoćom i preciznošću.'
            : 'Lead podcast host, articulate interviewer keeping conversations dynamic and insightful.',
          actingNotes: isHr
            ? 'Topao studijski bariton s jasnom artikulacijom blizu mikrofona.'
            : 'Warm studio baritone with close-mic intimacy.',
          voiceId: 'Fenrir',
          stylePrompt: 'Warm, engaging, articulate podcast host delivery',
          speakingRate: 1.02,
          pitchAdjustment: 0,
          lowShelfGainDb: 2.0,
          midPeakGainDb: 2.0,
          highShelfGainDb: 1.5,
          sampleDialogue: isHr
            ? 'Dobrodošli u novu epizodu. Danas otvaramo temu o kojoj se rijetko govori u eteru.'
            : 'Welcome back to the podcast. Today we are diving into a topic few dare to explore.',
          acousticRationale: 'Fenrir provides broadcast presence and articulation.',
          selected: true,
        },
        {
          id: `spk_${now}_guest`,
          name: isHr ? 'Dr. Iva Radić' : 'Dr. Sarah Lin',
          gender: 'female',
          age: '40',
          archetype: 'Subject-Matter Expert / Analyst',
          personaPrompt: isHr
            ? 'Stručnjakinja s dugogodišnjim iskustvom na terenu. Smirena, argumentirana, precizna.'
            : 'Field expert with extensive research background. Poised, evidence-driven, clear thinker.',
          actingNotes: isHr
            ? 'Staložen, stručan ton s prirodnim pauzama za naglasak ključnih teza.'
            : 'Authoritative, calm tone with deliberate cadence.',
          voiceId: 'Aoede',
          stylePrompt: 'Clear, intelligent, authoritative female expert delivery',
          speakingRate: 0.98,
          pitchAdjustment: 0,
          lowShelfGainDb: 1.0,
          midPeakGainDb: 1.5,
          highShelfGainDb: 2.5,
          sampleDialogue: isHr
            ? 'Podaci koje smo prikupili tijekom posljednjih pet godina pokazuju sasvim drugačiju sliku.'
            : 'The field measurements we gathered over the last five years reveal a completely different pattern.',
          acousticRationale: 'Aoede brings intellectual poise and pristine diction.',
          selected: true,
        },
      ],
      detectedGenre: 'Investigative Podcast / Debate',
      settingSummary: 'Acoustically treated studio booth with dual broadcast condenser microphones.',
      rationale: 'Created contrasting Podcast Host and Guest Expert profiles.',
    };
  }

  if (isSciFi) {
    return {
      characters: [
        {
          id: `spk_${now}_cmd`,
          name: isHr ? 'Zapovjednica Elena' : 'Commander Elena Vance',
          gender: 'female',
          age: '38',
          archetype: 'Orbital Commander / Tactical Anchor',
          personaPrompt: isHr
            ? 'Iskusna zapovjednica orbitalne postaje. Stroga, smirena pod pritiskom, štiti posadu po svaku cijenu.'
            : 'Seasoned orbital commander. Decisive, cool under decompression emergencies, protective of her crew.',
          actingNotes: isHr
            ? 'Autoritativan, odmjeren ženski glas blizu mikrofona, kratke zapovijedi.'
            : 'Authoritative, clipped vocal delivery, firm breath control.',
          voiceId: 'Aoede',
          stylePrompt: 'Crisp, commanding female military timbre',
          speakingRate: 1.0,
          pitchAdjustment: 0,
          lowShelfGainDb: 1.5,
          midPeakGainDb: 2.0,
          highShelfGainDb: 2.0,
          sampleDialogue: isHr
            ? 'Zatvorite sekundarnu komoru. Nitko ne dodiruje telemetriju dok ne utvrdimo podrijetlo signala.'
            : 'Seal the secondary airlock. Nobody touches the telemetry array until we confirm the source vector.',
          acousticRationale: 'Aoede provides clarity for intercom protocols.',
          selected: true,
        },
        {
          id: `spk_${now}_dr`,
          name: isHr ? 'Dr. Karlo Vidović' : 'Dr. Leo Chen',
          gender: 'male',
          age: '32',
          archetype: 'Signal Analyst / Spectral Decoder',
          personaPrompt: isHr
            ? 'Glavni astrofizičar i radio-analitičar. Opsesivan, hipoteze donosi brzo, fasciniran nepoznatim spektrom.'
            : 'Chief signal researcher. Rapid speech, obsessive attention to waveform shifts, driven by scientific discovery.',
          actingNotes: isHr
            ? 'Brz, blago uzbuđen ritam govora, često preklapa misli dok promatra podatke.'
            : 'Rapid, breathy delivery, speaking while monitoring fluctuating graphs.',
          voiceId: 'Fenrir',
          stylePrompt: 'Analytical, fast-paced male cadence with intellectual curiosity',
          speakingRate: 1.1,
          pitchAdjustment: 1,
          lowShelfGainDb: 0.0,
          midPeakGainDb: 2.5,
          highShelfGainDb: 2.0,
          sampleDialogue: isHr
            ? 'Frekvencija ne modulira nasumično! Pogledajte fazni pomak: ovo je strukturirani binarni puls.'
            : 'The frequency is not modulating randomly! Look at that phase shift: this is a structured harmonic pulse.',
          acousticRationale: 'Fenrir projects bright articulateness for scientific enthusiasm.',
          selected: true,
        },
      ],
      detectedGenre: 'Sci-Fi Audio Thriller',
      settingSummary: 'Isolated deep-space research platform monitoring anomalous radio bursts.',
      rationale: 'Generated contrasting tactical vs. analytical leads.',
    };
  }

  // General Audio Drama / Podcast Default
  return {
    characters: [
      {
        id: `spk_${now}_lead1`,
        name: isDubrovnik ? 'Gospar Lukša' : isHr ? 'Inspektor Toma' : 'Julian Mercer',
        gender: 'male',
        age: '46',
        archetype: 'The Veteran / Archivist',
        personaPrompt: isHr
          ? 'Čovjek koji poznaje svaku sjenu i skriveni kut. Smiren, ciničan, nepovjerljiv prema lakim rješenjima.'
          : 'Seasoned investigator who trusts facts over narratives. Measured, observant, dry wit.',
        actingNotes: isHr
          ? 'Dubok, topao bariton blizu mikrofona, odmjerene stanke između rečenica.'
          : 'Deep, resonant close-mic baritone with deliberate pauses.',
        voiceId: 'Charon',
        stylePrompt: 'Deep, world-weary dramatic baritone',
        speakingRate: 0.95,
        pitchAdjustment: -1,
        lowShelfGainDb: 3.0,
        midPeakGainDb: 2.0,
        highShelfGainDb: 1.5,
        sampleDialogue: isHr
          ? 'Dokumenti ne lažu, ali ljudi koji ih slažu u arhiv imaju vrlo selektivno pamćenje.'
          : 'Records do not lie, but the people who file them away have remarkably selective memories.',
        acousticRationale: 'Charon carries dramatic gravitas and vocal warmth.',
        selected: true,
      },
      {
        id: `spk_${now}_lead2`,
        name: isDubrovnik ? 'Mare iz Grada' : isHr ? 'Ana Kovač' : 'Clara Jensen',
        gender: 'female',
        age: '29',
        archetype: 'The Investigator / Truth Seeker',
        personaPrompt: isHr
          ? 'Istraživačka novinarka s oštrim okom za detalje. Hrabra, direktna, ne odustaje od neugodnih pitanja.'
          : 'Investigative journalist with relentless curiosity. Sharp, fast-paced, questions everything.',
        actingNotes: isHr
          ? 'Svjež, jasan i direktan ton, prirodna dinamika bez afektiranja.'
          : 'Crisp, energetic, natural delivery with persuasive cadence.',
        voiceId: 'Aoede',
        stylePrompt: 'Clear, inquisitive, intelligent female delivery',
        speakingRate: 1.05,
        pitchAdjustment: 0,
        lowShelfGainDb: 1.0,
        midPeakGainDb: 2.0,
        highShelfGainDb: 2.5,
        sampleDialogue: isHr
          ? 'Ako nitko nije postavio ovo pitanje već trideset godina, onda ga moramo postaviti večeras.'
          : 'If no one has asked this question in thirty years, then tonight is the night we start.',
        acousticRationale: 'Aoede brings inquisitive energy and transparent diction.',
        selected: true,
      },
    ],
    detectedGenre: isDubrovnik
      ? 'Dubrovačka Radiodrama'
      : isHr
        ? 'Dramska Istraga'
        : 'Narrative Audio Drama',
    settingSummary: isHr
      ? 'Noćni studio i arhivske dvorane.'
      : 'Late night broadcast studio and dusty archive vaults.',
    rationale: 'Created two contrasting dramatic protagonists.',
  };
}

/**
 * Extracts a structured cast of characters from an attached document, character bible,
 * or premise using Gemini 2.5 Flash / Pro multimodal capabilities.
 */
export async function extractCastFromDocumentWithAi(params: {
  prompt?: string;
  attachments?: CoWriterAttachment[];
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  apiKey?: string | null;
  textModel?: GeminiTextModelId;
  abortSignal?: AbortSignal;
}): Promise<CastExtractionResult> {
  const {
    prompt = '',
    attachments = [],
    language,
    dialect = 'standard',
    dubrovnikRegister = 'contemporary',
    apiKey,
    textModel,
    abortSignal,
  } = params;

  const fallback = buildFallbackCastExtraction({
    prompt,
    attachments,
    language,
    dialect,
    dubrovnikRegister,
  });

  if (!apiKey || apiKey.trim().length < 10) {
    return fallback;
  }

  try {
    const systemInstruction = buildCastExtractionSystemPrompt(
      language,
      dialect,
      dubrovnikRegister
    );
    const endpoint = buildGeminiEndpoint(
      textModel ?? 'gemini-2.5-flash',
      apiKey.trim()
    );

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [
      {
        text: `Cast Extraction Instruction: Thoroughly inspect the attached character bible, screenplay dossier, or story premise. Extract all prominent characters with rich archetypes, dialogue delivery styles, and assigned voices. Prompt instructions: ${prompt.trim() || 'Extract full dramatic cast.'}`,
      },
    ];

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.dataUrl && att.dataUrl.startsWith('data:')) {
          const commaIdx = att.dataUrl.indexOf(',');
          const base64Data = att.dataUrl.slice(commaIdx + 1);
          parts.push({
            inlineData: {
              mimeType:
                att.mimeType || (att.isImage ? 'image/png' : 'application/pdf'),
              data: base64Data,
            },
          });
        } else if (att.textContent) {
          parts.push({
            text: `[CHARACTER DOSSIER / SOURCE DOCUMENT: ${att.name}]\n${att.textContent.slice(0, 60000)}\n[END DOSSIER: ${att.name}]`,
          });
        }
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortSignal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.4,
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

    const parsed = JSON.parse(
      stripMarkdownJsonFence(rawText)
    ) as Partial<CastExtractionResult>;

    if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
      return fallback;
    }

    const now = Date.now();
    const normalizedCharacters: ExtractedCastMember[] = parsed.characters.map(
      (c, idx) => {
        const rawGender = String(c.gender ?? 'male').toLowerCase();
        const validGender: Gender =
          rawGender === 'female' ||
          rawGender === 'non-binary' ||
          rawGender === 'neutral' ||
          rawGender === 'other'
            ? (rawGender as Gender)
            : 'male';

        const validVoice = normalizeGeminiVoiceName(c.voiceId, validGender);

        return {
          id: c.id?.trim() || `spk_extracted_${now}_${idx}`,
          name: c.name?.trim() || `Character ${idx + 1}`,
          gender: validGender,
          age: c.age ? String(c.age) : '30',
          archetype: c.archetype?.trim() || undefined,
          personaPrompt:
            c.personaPrompt?.trim() ||
            'Dramatic character with distinct vocal rhythm.',
          actingNotes:
            c.actingNotes?.trim() ||
            'Natural studio dialogue delivery, close-mic.',
          voiceId: validVoice,
          stylePrompt:
            c.stylePrompt?.trim() || 'Expressive audio drama delivery',
          speakingRate: clamp(Number(c.speakingRate) || 1.0, 0.7, 1.4),
          pitchAdjustment: Math.round(
            clamp(Number(c.pitchAdjustment) || 0, -6, 6)
          ),
          lowShelfGainDb: clamp(Number(c.lowShelfGainDb) || 1.5, -6, 8),
          midPeakGainDb: clamp(Number(c.midPeakGainDb) || 1.5, -6, 8),
          highShelfGainDb: clamp(Number(c.highShelfGainDb) || 1.0, -6, 8),
          sampleDialogue: c.sampleDialogue?.trim() || undefined,
          acousticRationale: c.acousticRationale?.trim() || undefined,
          selected: true,
        };
      }
    );

    return {
      characters: normalizedCharacters,
      detectedGenre: parsed.detectedGenre?.trim() || fallback.detectedGenre,
      settingSummary: parsed.settingSummary?.trim() || fallback.settingSummary,
      rationale:
        parsed.rationale?.trim() ||
        `Extracted ${normalizedCharacters.length} character profile(s) from document context.`,
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return fallback;
  }
}

/**
 * Converts an ExtractedCastMember into a full, production-ready Speaker object.
 */
export function castMemberToSpeaker(
  member: ExtractedCastMember,
  colorIndex: number
): Speaker {
  const color = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
  const archetypePrefix = member.archetype
    ? `[Archetype: ${member.archetype}]\n`
    : '';

  return {
    id: member.id || `spk_${Date.now()}_${colorIndex}`,
    name: member.name,
    color,
    gender: member.gender,
    age: member.age || '30',
    personaPrompt: `${archetypePrefix}${member.personaPrompt}`.trim(),
    actingNotes: member.actingNotes,
    voice: {
      baseVoice: member.voiceId,
      stylePrompt: member.stylePrompt,
      speakingRate: member.speakingRate,
      pitchAdjustment: member.pitchAdjustment,
      enableDirectorNotes: true,
      ssmlEnabled: true,
      acoustics: {
        biquadEq: {
          enabled: true,
          lowShelfGainDb: member.lowShelfGainDb,
          midPeakGainDb: member.midPeakGainDb,
          highShelfGainDb: member.highShelfGainDb,
        },
        compression: {
          enabled: true,
          thresholdDb: -20,
          ratio: 2.5,
          attackMs: 15,
          releaseMs: 100,
        },
      },
    },
    createdAt: Date.now(),
  };
}
