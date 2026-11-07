import {
  AudioEffectConfig,
  BiquadEqEffectConfig,
  CroatianDialect,
  DattorroReverbEffectConfig,
  DubrovnikRegister,
  DynamicsEffectConfig,
  GEMINI_VOICE_CATALOG,
  GeminiBaseVoice,
  GeminiTextModelId,
  Gender,
  normalizeGeminiVoiceName,
  Speaker,
  SpeakerAiDesignResult,
  StateVariableFilterEffectConfig,
  SupportedLanguage,
} from '../../types/storia';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';

export type SpeakerArchetypePresetId =
  | 'broadcast_host'
  | 'vintage_radio'
  | 'stone_vault'
  | 'noir_detective';

export function buildSpeakerDspSystemPrompt(
  speaker: Speaker,
  language: SupportedLanguage,
  dialect?: CroatianDialect,
  dubrovnikRegister?: DubrovnikRegister
): string {
  const langLabel = language === 'hr' ? 'Croatian (Hrvatski)' : 'English';
  const dubrovnikRules =
    language === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  return [
    `You are an elite Broadcast Audio Engineer, Acoustic DSP Designer, and Dramatic Casting Director for the Storia Audio Drama Studio.`,
    `Your task is to design a complete voice, persona, and modular Web Audio DSP effect chain for speaker "${speaker.name}" based on the user's description.`,
    `Target Language: ${langLabel}.`,
    `Available Official Gemini 2.5 TTS Base Voices (choose ONLY from these 30 exact names):`,
    ...GEMINI_VOICE_CATALOG.map(
      (v) => `- ${v.id} (${v.register}): ${v.descriptionEn}`
    ),
    `Available Modular DSP Effects (return in "effectStack" array):`,
    `1. "biquad_eq": { id, name: "3-Band Biquad EQ", type: "biquad_eq", enabled: true, lowShelfFreqHz: 120, lowShelfGainDb (-12..12), midPeakFreqHz (400..5000), midPeakGainDb (-12..12), midPeakQ (0.5..6.0), highShelfFreqHz: 8000, highShelfGainDb (-12..12) }`,
    `2. "dynamics_compressor": { id, name: "Studio Dynamics Compressor", type: "dynamics_compressor", enabled: true, thresholdDb (-40..0), ratio (1..20), attackMs (1..50), releaseMs (20..500), kneeDb (0..12) }`,
    `3. "state_variable_filter" (include when telephone, radio, megaphone, underwater, or muffled effect is needed): { id, name: "State-Variable Filter", type: "state_variable_filter", enabled: true, filterType: "bandpass"|"lowpass"|"highpass"|"notch", frequencyHz (100..12000), q (0.5..8.0) }`,
    `4. "dattorro_reverb" (include when cathedral, stone vault, cave, hall, room ambience, or ghostly echo is needed): { id, name: "Dattorro 1997 Plate Reverb", type: "dattorro_reverb", enabled: true, decay (0.4..12.0), damping (1000..14000), preDelay (5..150), mix (0.1..0.75), lowCut (40..300) }`,
    `Return ONLY valid JSON matching:`,
    `{"name": "optional updated name", "gender": "male"|"female"|"non-binary"|"neutral", "age": "string", "baseVoice": "Aoede"|"Fenrir"|..., "speakingRate": 0.7..1.4, "pitchAdjustment": -6..6, "stylePrompt": "concise vocal timbre & delivery prompt", "personaPrompt": "2-3 sentences of character psychology, vocabulary & worldview", "actingNotes": "breathing, cadence, micro-pauses & microphone proximity notes", "samplePhrase": "1-2 sentences in-character test line in ${langLabel}", "acousticRationale": "1-2 sentences explaining the EQ, dynamics, filter, and reverb choices", "effectStack": [ ... ]}`,
    dubrovnikRules,
  ]
    .filter(Boolean)
    .join('\n');
}

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

export function buildFallbackSpeakerDspDesign(
  prompt: string,
  speaker: Speaker,
  language: SupportedLanguage,
  dialect?: CroatianDialect
): SpeakerAiDesignResult {
  const lower = prompt.toLowerCase();
  const isHr = language === 'hr';
  const isDubrovnik = isHr && dialect === 'dubrovnik';

  const isPhoneOrRadio =
    /phone|telefon|radio|walkie|comms|intercom|megafon|megaphone|static|lo-fi|lofi|stari radio/.test(
      lower
    );
  const isVaultOrReverb =
    /vault|svod|lazaret|cathedral|katedral|crkv|cave|špilj|echo|jeka|reverb|stone|kamen|ghost|duh|hall|dvoran/.test(
      lower
    );
  const isNoirOrWhisper =
    /noir|detective|inspektor|detektiv|whisper|šapat|intimate|intiman|cynical|cinič|dark|mrač|late night/.test(
      lower
    );

  const inferredFemale =
    /\b(she|her|woman|female|girl|žena|cura|djevojka|voditeljica|glumica|gospođa|sinjora)\b/.test(
      lower
    ) ||
    (!/\b(he|him|man|male|boy|muškarac|čovjek|voditelj|glumac|gospar)\b/.test(
      lower
    ) &&
      speaker.gender === 'female');

  const gender: Gender = inferredFemale ? 'female' : 'male';
  let baseVoice: GeminiBaseVoice = inferredFemale ? 'Aoede' : 'Fenrir';
  if (isPhoneOrRadio) {
    baseVoice = inferredFemale ? 'Kore' : 'Puck';
  } else if (isNoirOrWhisper) {
    baseVoice = inferredFemale ? 'Leda' : 'Charon';
  } else if (isVaultOrReverb) {
    baseVoice = inferredFemale ? 'Aoede' : 'Orus';
  } else {
    baseVoice = inferredFemale ? 'Zephyr' : 'Fenrir';
  }

  let speakingRate = 1.0;
  let pitchAdjustment = 0;
  let age = speaker.age || '35';
  let stylePrompt = '';
  let personaPrompt = '';
  let actingNotes = '';
  let samplePhrase = '';
  let acousticRationale = '';
  const effectStack: AudioEffectConfig[] = [];

  if (isPhoneOrRadio) {
    speakingRate = 1.05;
    pitchAdjustment = 0;
    stylePrompt = isHr
      ? 'Hitni prijenos preko uskopojasne radio ili telefonske linije, fokusirana dikcija'
      : 'Urgent transmission over narrowband radio or vintage telephone line, focused articulation';
    personaPrompt = isHr
      ? `${speaker.name} javlja se s terena putem ograničene komunikacijske veze. Govori kratkim, odsječnim i preciznim rečenicama bez suvišnih ukrasa.`
      : `${speaker.name} reports from the field over a bandwidth-limited comms channel. Speaks in crisp, urgent, information-dense sentences.`;
    actingNotes = isHr
      ? 'Blagi pritisak u glasu, brzi udasi između fraza, naglašeni suglasnici radi razumljivosti kroz filtar.'
      : 'Slight vocal tension, quick breaths between clauses, crisp consonants to cut through the bandpass filter.';
    samplePhrase = isDubrovnik
      ? `Čuješ li me u Gradu? Linija šumi, ali poruka iz Porta mora proć prije ponoći!`
      : isHr
        ? `Čujete li me? Signal je slab, ali prijenos s terena ide uživo kroz filtar.`
        : `Do you copy? The line is breaking up, but our transmission is coming through live.`;
    acousticRationale = isHr
      ? 'Telefonski/radio efekt: Biquad EQ reže duboki bas (-10 dB na 120 Hz) i visoki zrak (-8 dB na 8 kHz) uz snažan mid-peak (+6.5 dB na 1.8 kHz), SVF Bandpass filtar na 1150 Hz (Q=1.8) i čvrsta 6:1 kompresija.'
      : 'Telephone/Radio comms chain: Biquad EQ cuts sub-bass (-10 dB @ 120 Hz) and air (-8 dB @ 8 kHz) with a +6.5 dB presence peak at 1.8 kHz, paired with an SVF Bandpass filter at 1150 Hz (Q=1.8) and tight 6:1 limiting.';

    const eq: BiquadEqEffectConfig = {
      id: `fx_eq_${speaker.id}`,
      name: '3-Band Biquad EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: -10,
      midPeakFreqHz: 1800,
      midPeakGainDb: 6.5,
      midPeakQ: 2.2,
      highShelfFreqHz: 8000,
      highShelfGainDb: -8,
    };
    const svf: StateVariableFilterEffectConfig = {
      id: `fx_svf_${speaker.id}`,
      name: 'State-Variable Filter',
      type: 'state_variable_filter',
      enabled: true,
      filterType: 'bandpass',
      frequencyHz: 1150,
      q: 1.8,
    };
    const dyn: DynamicsEffectConfig = {
      id: `fx_dyn_${speaker.id}`,
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -26,
      ratio: 6.0,
      attackMs: 5,
      releaseMs: 65,
      kneeDb: 2,
    };
    effectStack.push(eq, svf, dyn);
  } else if (isVaultOrReverb) {
    speakingRate = 0.92;
    pitchAdjustment = inferredFemale ? 0 : -2;
    stylePrompt = isHr
      ? 'Duboki, rezonantni kazališni glas u kamenom svodu s prirodnom akustičnom jekom'
      : 'Resonant theatrical projection inside a vaulted stone chamber with lush acoustic decay';
    personaPrompt = isHr
      ? `${speaker.name} govori s odmjerenošću i patinom stoljetnih kamenih svodova. Svaka riječ ima težinu i ostavlja prostor za odjek u prostoru.`
      : `${speaker.name} speaks with measured gravitas suited to centuries-old stone vaults, leaving deliberate pauses for acoustic reflections to bloom.`;
    actingNotes = isHr
      ? 'Sporiji tempo (0.92x), duže pauze nakon vokativa i točaka kako se Dattorro plate reverb ne bi zamutio.'
      : 'Slower pacing (0.92x), deliberate phrase endings so the Dattorro plate reverb tail decays cleanly.';
    samplePhrase = isDubrovnik
      ? `Pod ovim kamenim voltima Lazareta svaka riječ odzvanja kō da je urezana u mirima od Grada.`
      : isHr
        ? `Pod ovim kamenim svodovima svaka izgovorena riječ odjekuje kroz tišinu dvorane.`
        : `Beneath these vaulted stone arches, every spoken syllable resonates through the chamber.`;
    acousticRationale = isHr
      ? 'Akustika kamenog svoda: Blago rezanje tutnjave na 120 Hz (-2.5 dB) radi čistoće reverba, +2.5 dB jasnoće na 2.5 kHz, meka 2.8:1 kompresija i Dattorro 1997 Plate Reverb (T60 = 3.8 s, Pre-Delay 28 ms, Mix 36%).'
      : 'Stone Vault Acoustics: -2.5 dB low-shelf cut at 120 Hz to prevent reverb mud, +2.5 dB clarity at 2.5 kHz, gentle 2.8:1 compression, and Dattorro 1997 Plate Reverb (T60 = 3.8 s, Pre-Delay 28 ms, Mix 36%).';

    const eq: BiquadEqEffectConfig = {
      id: `fx_eq_${speaker.id}`,
      name: '3-Band Biquad EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: -2.5,
      midPeakFreqHz: 2500,
      midPeakGainDb: 2.5,
      midPeakQ: 1.1,
      highShelfFreqHz: 8000,
      highShelfGainDb: 2.0,
    };
    const dyn: DynamicsEffectConfig = {
      id: `fx_dyn_${speaker.id}`,
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -21,
      ratio: 2.8,
      attackMs: 18,
      releaseMs: 130,
      kneeDb: 4,
    };
    const rev: DattorroReverbEffectConfig = {
      id: `fx_rev_${speaker.id}`,
      name: 'Dattorro 1997 Plate Reverb',
      type: 'dattorro_reverb',
      enabled: true,
      decay: 3.8,
      damping: 4200,
      preDelay: 28,
      bandwidth: 11000,
      modDepth: 0.35,
      modRate: 0.65,
      lowCut: 110,
      mix: 0.36,
      gain: 1.0,
    };
    effectStack.push(eq, dyn, rev);
  } else if (isNoirOrWhisper) {
    speakingRate = 0.94;
    pitchAdjustment = inferredFemale ? -1 : -2;
    age = '42';
    stylePrompt = isHr
      ? 'Intimni, blago hrapavi noir glas blizu mikrofona (proximity efekt), suzdržana tenzija'
      : 'Intimate, close-mic noir delivery with warm proximity bass and restrained dramatic tension';
    personaPrompt = isHr
      ? `${speaker.name} promatra svijet iz sjene s dozom suhog cinizma i iskustva. Nikada ne podiže glas; autoritet gradi tišinom i blizinom mikrofona.`
      : `${speaker.name} observes from the shadows with world-weary wit. Never raises their voice—authority comes from close-mic intimacy and calculated pauses.`;
    actingNotes = isHr
      ? 'Govoriti sasvim blizu mikrofona (polušapat), čujni uzdasi, spuštena intonacija na kraju rečenica.'
      : 'Ultra-close microphone placement, audible breath textures, downward inflection at sentence endings.';
    samplePhrase = isDubrovnik
      ? `U ovu uru na Stradunu nema nikoga, gosparu... samo bura i sjene što pasaju ispod volata.`
      : isHr
        ? `Kiša nije prestala padati cijelu noć, a odgovori su čekali u sjeni na kraju ulice.`
        : `The rain hadn't stopped all night, and the answers were waiting in the shadows down the block.`;
    acousticRationale = isHr
      ? 'Noir Close-Mic profil: Pojačan bas blizine (+3.5 dB na 120 Hz), svilenkasti zrak za dah (+3.5 dB na 8 kHz), topla kompresija (Threshold -24 dB, Ratio 3.2:1) i suptilni tamni ambijent sobe (Mix 16%).'
      : 'Noir Close-Mic Profile: Enhanced proximity warmth (+3.5 dB @ 120 Hz), silky breath air (+3.5 dB @ 8 kHz), warm leveling compression (-24 dB, 3.2:1), and subtle dark room ambience (16% mix).';

    const eq: BiquadEqEffectConfig = {
      id: `fx_eq_${speaker.id}`,
      name: '3-Band Biquad EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: 3.5,
      midPeakFreqHz: 2400,
      midPeakGainDb: 1.5,
      midPeakQ: 1.0,
      highShelfFreqHz: 8000,
      highShelfGainDb: 3.5,
    };
    const dyn: DynamicsEffectConfig = {
      id: `fx_dyn_${speaker.id}`,
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -24,
      ratio: 3.2,
      attackMs: 12,
      releaseMs: 110,
      kneeDb: 6,
    };
    const rev: DattorroReverbEffectConfig = {
      id: `fx_rev_${speaker.id}`,
      name: 'Dattorro 1997 Plate Reverb',
      type: 'dattorro_reverb',
      enabled: true,
      decay: 1.2,
      damping: 3200,
      preDelay: 14,
      bandwidth: 9000,
      modDepth: 0.2,
      modRate: 0.5,
      lowCut: 120,
      mix: 0.16,
      gain: 1.0,
    };
    effectStack.push(eq, dyn, rev);
  } else {
    // Warm Broadcast / Podcast Host & Expressive Studio Character
    speakingRate = 1.02;
    pitchAdjustment = 0;
    stylePrompt = isHr
      ? `Topao, jasan i artikuliran studijski glas (${prompt.trim() || 'podcast i radiodrama'})`
      : `Warm, articulate studio broadcast voice (${prompt.trim() || 'podcast & audio drama'})`;
    personaPrompt = isHr
      ? `${speaker.name} zrači prirodnim autoritetom, toplinom i konverzacijskom inteligencijom. Ideje iznosi tečno, s jasnim naglascima i prirodnim ritmom.`
      : `${speaker.name} projects natural warmth, clarity, and conversational intelligence, guiding the listener with engaging cadence.`;
    actingNotes = isHr
      ? 'Ujednačen studijski ton, prirodan osmijeh u glasu, čista artikulacija na prijelazima misli.'
      : 'Balanced studio projection, natural conversational pacing, clean articulation across transitions.';
    samplePhrase = isDubrovnik
      ? `Sluga van se, čeljadi! Večeras u našem studiju govorimo o tajnama i akustici staroga Grada.`
      : isHr
        ? `Dobrodošli u studio! Provjeravamo toplinu glasa, artikulaciju srednjih frekvencija i studijsku kompresiju.`
        : `Welcome back to the studio! Testing broadcast vocal warmth, midrange clarity, and smooth dynamic leveling.`;
    acousticRationale = isHr
      ? 'Broadcast Studio Master lanac: +2.0 dB topline na 120 Hz, +2.5 dB vokalne prisutnosti na 2.8 kHz, +1.5 dB prozračnosti na 8 kHz uz glatku broadcast kompresiju (-20 dB, 3.0:1).'
      : 'Broadcast Studio Master Chain: +2.0 dB chest warmth at 120 Hz, +2.5 dB vocal presence at 2.8 kHz, +1.5 dB air shelf at 8 kHz, and smooth 3.0:1 broadcast compression.';

    const eq: BiquadEqEffectConfig = {
      id: `fx_eq_${speaker.id}`,
      name: '3-Band Biquad EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: 2.0,
      midPeakFreqHz: 2800,
      midPeakGainDb: 2.5,
      midPeakQ: 1.2,
      highShelfFreqHz: 8000,
      highShelfGainDb: 1.5,
    };
    const dyn: DynamicsEffectConfig = {
      id: `fx_dyn_${speaker.id}`,
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -20,
      ratio: 3.0,
      attackMs: 12,
      releaseMs: 95,
      kneeDb: 3,
    };
    effectStack.push(eq, dyn);
  }

  return {
    gender,
    age,
    baseVoice,
    speakingRate,
    pitchAdjustment,
    stylePrompt,
    personaPrompt,
    actingNotes,
    samplePhrase,
    effectStack,
    acousticRationale,
  };
}

function normalizeEffectStack(
  rawStack: unknown,
  speakerId: string,
  fallbackStack: AudioEffectConfig[]
): AudioEffectConfig[] {
  if (!Array.isArray(rawStack) || rawStack.length === 0) {
    return fallbackStack;
  }

  const normalized: AudioEffectConfig[] = [];
  rawStack.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const type = item.type;

    if (type === 'biquad_eq') {
      normalized.push({
        id: `fx_eq_${speakerId}_${idx}`,
        name: '3-Band Biquad EQ',
        type: 'biquad_eq',
        enabled: item.enabled !== false,
        lowShelfFreqHz: clamp(Number(item.lowShelfFreqHz) || 120, 40, 400),
        lowShelfGainDb: clamp(Number(item.lowShelfGainDb) || 0, -12, 12),
        midPeakFreqHz: clamp(Number(item.midPeakFreqHz) || 2500, 400, 6000),
        midPeakGainDb: clamp(Number(item.midPeakGainDb) || 0, -12, 12),
        midPeakQ: clamp(Number(item.midPeakQ) || 1.0, 0.4, 8.0),
        highShelfFreqHz: clamp(Number(item.highShelfFreqHz) || 8000, 3000, 16000),
        highShelfGainDb: clamp(Number(item.highShelfGainDb) || 0, -12, 12),
      });
    } else if (type === 'dynamics_compressor') {
      normalized.push({
        id: `fx_dyn_${speakerId}_${idx}`,
        name: 'Studio Dynamics Compressor',
        type: 'dynamics_compressor',
        enabled: item.enabled !== false,
        thresholdDb: clamp(Number(item.thresholdDb) || -20, -40, 0),
        ratio: clamp(Number(item.ratio) || 2.5, 1, 20),
        attackMs: clamp(Number(item.attackMs) || 15, 1, 50),
        releaseMs: clamp(Number(item.releaseMs) || 100, 20, 500),
        kneeDb: clamp(Number(item.kneeDb) || 3, 0, 12),
      });
    } else if (type === 'state_variable_filter') {
      const ft = String(item.filterType || 'bandpass');
      const validFilterType =
        ft === 'lowpass' || ft === 'highpass' || ft === 'bandpass' || ft === 'notch'
          ? ft
          : 'bandpass';
      normalized.push({
        id: `fx_svf_${speakerId}_${idx}`,
        name: 'State-Variable Filter',
        type: 'state_variable_filter',
        enabled: item.enabled !== false,
        filterType: validFilterType,
        frequencyHz: clamp(Number(item.frequencyHz) || 1200, 60, 15000),
        q: clamp(Number(item.q) || 1.4, 0.5, 10.0),
      });
    } else if (type === 'dattorro_reverb') {
      normalized.push({
        id: `fx_rev_${speakerId}_${idx}`,
        name: 'Dattorro 1997 Plate Reverb',
        type: 'dattorro_reverb',
        enabled: item.enabled !== false,
        decay: clamp(Number(item.decay) || 2.8, 0.2, 20.0),
        damping: clamp(Number(item.damping) || 4500, 500, 18000),
        preDelay: clamp(Number(item.preDelay) || 20, 0, 400),
        bandwidth: clamp(Number(item.bandwidth) || 10000, 1000, 20000),
        modDepth: clamp(Number(item.modDepth) || 0.3, 0.0, 1.0),
        modRate: clamp(Number(item.modRate) || 0.65, 0.1, 5.0),
        lowCut: clamp(Number(item.lowCut) || 90, 20, 500),
        mix: clamp(Number(item.mix) || 0.3, 0.05, 0.85),
        gain: 1.0,
      });
    }
  });

  return normalized.length > 0 ? normalized : fallbackStack;
}

export async function designSpeakerProfileWithAi(params: {
  prompt: string;
  speaker: Speaker;
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  apiKey?: string | null;
  textModel?: GeminiTextModelId;
  abortSignal?: AbortSignal;
}): Promise<SpeakerAiDesignResult> {
  const {
    prompt,
    speaker,
    language,
    dialect,
    dubrovnikRegister,
    apiKey,
    textModel,
    abortSignal,
  } = params;

  const fallback = buildFallbackSpeakerDspDesign(
    prompt,
    speaker,
    language,
    dialect
  );

  if (!apiKey || apiKey.trim().length < 10) {
    return fallback;
  }

  try {
    const systemInstruction = buildSpeakerDspSystemPrompt(
      speaker,
      language,
      dialect,
      dubrovnikRegister
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
                text: `Speaker Name: ${speaker.name}\nCurrent Gender: ${speaker.gender}\nCurrent Age: ${speaker.age}\nUser Voice & DSP Request: ${prompt.trim() || 'Optimize broadcast voice, persona, and studio DSP chain for this character.'}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.45,
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

    const parsed = JSON.parse(stripMarkdownJsonFence(rawText)) as Partial<SpeakerAiDesignResult>;

    const validGender: Gender =
      parsed.gender === 'male' ||
      parsed.gender === 'female' ||
      parsed.gender === 'non-binary' ||
      parsed.gender === 'neutral' ||
      parsed.gender === 'other'
        ? parsed.gender
        : fallback.gender;

    const validVoice = parsed.baseVoice
      ? normalizeGeminiVoiceName(parsed.baseVoice, validGender)
      : fallback.baseVoice;

    return {
      name: parsed.name?.trim() || undefined,
      gender: validGender,
      age: parsed.age ? String(parsed.age) : fallback.age,
      baseVoice: validVoice,
      speakingRate: clamp(
        Number(parsed.speakingRate) || fallback.speakingRate,
        0.5,
        2.0
      ),
      pitchAdjustment: Math.round(
        clamp(
          Number(parsed.pitchAdjustment ?? fallback.pitchAdjustment),
          -10,
          10
        )
      ),
      stylePrompt: parsed.stylePrompt?.trim() || fallback.stylePrompt,
      personaPrompt: parsed.personaPrompt?.trim() || fallback.personaPrompt,
      actingNotes: parsed.actingNotes?.trim() || fallback.actingNotes,
      samplePhrase: parsed.samplePhrase?.trim() || fallback.samplePhrase,
      acousticRationale:
        parsed.acousticRationale?.trim() || fallback.acousticRationale,
      effectStack: normalizeEffectStack(
        parsed.effectStack,
        speaker.id,
        fallback.effectStack
      ),
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return fallback;
  }
}

