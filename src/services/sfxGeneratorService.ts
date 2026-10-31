import {
  ScriptBlock,
  ScriptTimepoint,
  SfxCategoryPreset,
  SupportedLanguage,
  WaveformPeakData,
} from '../types/storia';
import {
  encodePcm16ToWavBlob,
  extractWaveformPeaksFromPcm,
} from './geminiTtsService';

export interface SfxSynthesisResult {
  audioBlob: Blob;
  waveformPeaks: WaveformPeakData;
  timepoints: ScriptTimepoint[];
  durationSec: number;
  tokensUsed: number;
  ssmlPayload: string;
}

export type SfxLayerGeneratorType = Exclude<SfxCategoryPreset, 'auto' | 'custom_upload'>;

export interface SfxLayerConfig {
  type: SfxLayerGeneratorType;
  gain: number; // [0.1, 1.0]
  pitchScale: number; // [0.5, 2.0]
  rateHz?: number; // Cadence for footsteps / knocks / droplets
}

export interface SfxSynthesisRecipe {
  layers: SfxLayerConfig[];
  durationSec: number;
  reverbMix: number; // [0.0, 0.85] spatial wetness
  distanceLowpassHz: number; // [800, 11000] acoustic air absorption
  masterGain: number; // [0.2, 1.0]
  summaryLabel: string;
}

export interface SfxSynthesisOptions {
  block: ScriptBlock;
  language: SupportedLanguage;
  apiKey?: string | null;
  useAiCompiler?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Deterministic bilingual (Croatian + English) semantic & keyword analyzer that
 * compiles natural-language SFX descriptions into a multi-layer physical-modeling recipe.
 */
export function classifySfxPrompt(
  text: string,
  directorNotes?: string,
  explicitCategory?: SfxCategoryPreset,
  explicitDurationSec?: number,
  explicitIntensity?: number
): SfxSynthesisRecipe {
  const combined = `${text} ${directorNotes ?? ''}`.toLowerCase();
  const layers: SfxLayerConfig[] = [];

  const isDistant =
    /udaljen|dalek|tih|prigušen|distant|far|muffled|faint|background|ambient/.test(
      combined
    );
  const isIntense =
    /jak|snaž|glasn|oluj|gromoglas|heavy|loud|intense|violent|crash|slam/.test(
      combined
    );

  // If user chose a specific preset category (other than 'auto' or 'custom_upload'), prioritize it
  if (
    explicitCategory &&
    explicitCategory !== 'auto' &&
    explicitCategory !== 'custom_upload'
  ) {
    layers.push({
      type: explicitCategory,
      gain: 0.85,
      pitchScale: 1.0,
      rateHz: explicitCategory === 'footsteps' ? 2.1 : 1.5,
    });
  }

  const addLayerIfMissing = (
    type: SfxLayerGeneratorType,
    gain: number,
    pitchScale = 1.0,
    rateHz?: number
  ) => {
    if (!layers.some((l) => l.type === type)) {
      layers.push({ type, gain, pitchScale, rateHz });
    }
  };

  // 1. Tram / Train / Metallic Rails
  if (
    /tramvaj|tračnic|škripanj|vlak| željeznic|tram|rail|track|train|subway|screech|brakes/.test(
      combined
    )
  ) {
    addLayerIfMissing('tram_rail', isDistant ? 0.65 : 0.85, isDistant ? 0.92 : 1.05);
  }

  // 2. Footsteps / Cobblestone / Walking
  if (
    /korac|korak|kaldrm|hodanj|trčanj|cipel|čizm|stazi|ulic|footstep|step|walk|run|cobblestone|pavement|boots|gravel|stairs/.test(
      combined
    )
  ) {
    const fastSteps = /trčanj|brz|run|hurr|fast|sprint/.test(combined);
    addLayerIfMissing(
      'footsteps',
      0.8,
      1.0,
      fastSteps ? 3.4 : 1.95
    );
  }

  // 3. Rain / Wet Surface / Water Droplets
  if (
    /kiš|mokr|kapljic|pljusak|vod|lokv|rain|wet|drip|drizzle|downpour|puddle|water|splash/.test(
      combined
    )
  ) {
    addLayerIfMissing('weather_rain', isIntense ? 0.85 : 0.55, 1.0);
  }

  // 4. Wind / Storm / Fog Ambience
  if (
    /vjetar|vjetr|bur|propuh|magl|huja|hladn|noć|wind|gale|breeze|howl|fog|draft|eerie|air/.test(
      combined
    )
  ) {
    addLayerIfMissing('wind_storm', 0.6, isDistant ? 0.85 : 1.1);
  }

  // 5. Thunder / Lightning
  if (/grom|grmljavin|munj|oluj|thunder|lightning|rumble/.test(combined)) {
    addLayerIfMissing('thunder', 0.9, isDistant ? 0.8 : 1.0);
  }

  // 6. Door Creak / Hinges / Locks
  if (
    /vrat|škrip|ključ|brav|prozor|šark|door|creak|hinge|latch|lock|window|gate/.test(
      combined
    )
  ) {
    addLayerIfMissing('door_creak', 0.8, 1.0);
  }

  // 7. Knock / Impact / Slam / Glass
  if (
    /kucanj|udarac|lupanj|pad|tresak|stakl|zvono|knock|slam|thud|impact|bang|crash|hit|tap/.test(
      combined
    )
  ) {
    addLayerIfMissing('impact_knock', 0.85, 1.0, 2.4);
  }

  // 8. Radio Static / Telephone / Tape Hiss / Electronic
  if (
    /radio|šum|statič|telefon|signal|frekvencij|vrpc|static|interference|glitch|phone|ring|beep|tape|vinyl/.test(
      combined
    )
  ) {
    addLayerIfMissing('radio_static', 0.75, 1.0);
  }

  // 9. Cinematic Drone / Tension / Heartbeat
  if (
    /napetost|atmosfer|dron|puls|src|horor|mračn|sjene|drone|riser|sub|cinematic|heartbeat|tension|ominous|dark/.test(
      combined
    )
  ) {
    addLayerIfMissing('cinematic_drone', 0.7, 1.0);
  }

  // Fallback if no keywords matched
  if (layers.length === 0) {
    layers.push(
      { type: 'wind_storm', gain: 0.55, pitchScale: 0.95 },
      { type: 'cinematic_drone', gain: 0.5, pitchScale: 1.0 }
    );
  }

  // Compute target duration
  const defaultDur = Math.min(
    8.0,
    Math.max(2.4, 2.2 + layers.length * 0.65 + Math.min(2.0, text.length / 60))
  );
  const durationSec = Math.min(
    15.0,
    Math.max(1.0, Number(explicitDurationSec ?? defaultDur.toFixed(1)))
  );

  const reverbMix = isDistant ? 0.58 : /ambient|stereo|prostor|hall|room/.test(combined) ? 0.45 : 0.25;
  const distanceLowpassHz = isDistant ? 2900 : 7800;
  const masterGain = Math.min(
    1.0,
    Math.max(0.2, explicitIntensity ?? (isIntense ? 0.95 : isDistant ? 0.72 : 0.85))
  );

  return {
    layers: layers.slice(0, 4),
    durationSec,
    reverbMix,
    distanceLowpassHz,
    masterGain,
    summaryLabel: layers.map((l) => l.type).join(' + '),
  };
}

/**
 * Optional Gemini 3 Flash AI Prompt-to-DSP Patch Compiler.
 * Uses Gemini to analyze complex bilingual descriptions and refine synthesis parameters,
 * with instant fallback to the deterministic classifier.
 */
export async function compileSfxRecipeWithGemini(
  block: ScriptBlock,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<SfxSynthesisRecipe> {
  const baseRecipe = classifySfxPrompt(
    block.text,
    block.directorNotes,
    block.sfxCategory,
    block.sfxDurationSec,
    block.sfxIntensity
  );

  // If user forced a specific single preset (not 'auto'), use baseRecipe directly for instant response
  if (block.sfxCategory && block.sfxCategory !== 'auto') {
    return baseRecipe;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const prompt = [
      'You are an acoustic sound designer compiling a physical-modeling Web Audio SFX patch.',
      `Analyze this sound effect cue: "${block.text}" (Director notes: "${block.directorNotes ?? 'none'}").`,
      'Return ONLY a JSON object with:',
      '- layers: array of 1 to 3 objects with { "type": one of ["tram_rail","footsteps","weather_rain","wind_storm","thunder","door_creak","impact_knock","cinematic_drone","radio_static"], "gain": 0.2..1.0, "pitchScale": 0.6..1.5, "rateHz": 1.0..4.0 }',
      '- reverbMix: 0.1..0.8',
      '- distanceLowpassHz: 1200..9000',
    ].join('\n');

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return baseRecipe;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== 'string') {
      return baseRecipe;
    }

    const parsed = JSON.parse(rawText);
    const validTypes = new Set<SfxLayerGeneratorType>([
      'tram_rail',
      'footsteps',
      'weather_rain',
      'wind_storm',
      'thunder',
      'door_creak',
      'impact_knock',
      'cinematic_drone',
      'radio_static',
    ]);

    if (Array.isArray(parsed.layers) && parsed.layers.length > 0) {
      const validLayers: SfxLayerConfig[] = parsed.layers
        .filter((l: { type?: string }) => l && validTypes.has(l.type as SfxLayerGeneratorType))
        .slice(0, 4)
        .map((l: { type: SfxLayerGeneratorType; gain?: number; pitchScale?: number; rateHz?: number }) => ({
          type: l.type,
          gain: Math.min(1.0, Math.max(0.2, Number(l.gain) || 0.75)),
          pitchScale: Math.min(1.6, Math.max(0.6, Number(l.pitchScale) || 1.0)),
          rateHz: Math.min(5.0, Math.max(0.8, Number(l.rateHz) || 2.0)),
        }));

      if (validLayers.length > 0) {
        return {
          ...baseRecipe,
          layers: validLayers,
          reverbMix: Math.min(0.8, Math.max(0.1, Number(parsed.reverbMix) || baseRecipe.reverbMix)),
          distanceLowpassHz: Math.min(
            9500,
            Math.max(1000, Number(parsed.distanceLowpassHz) || baseRecipe.distanceLowpassHz)
          ),
          summaryLabel: validLayers.map((l) => l.type).join(' + '),
        };
      }
    }
  } catch {
    // Graceful fallback to deterministic recipe
  }

  return baseRecipe;
}

/**
 * Seeded PRNG (Mulberry32) so SFX generation is reproducible per prompt/seed,
 * while supporting fresh variations on force-regeneration when desired.
 */
function createSeededRng(seedText: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesizes a multi-layer physical-modeling sound effect into a Float32Array buffer,
 * applies one-pole lowpass air absorption and Schroeder comb/all-pass spatial reverb,
 * and returns a 16-bit PCM Int16Array.
 */
export function renderSfxRecipeToPcm16(
  recipe: SfxSynthesisRecipe,
  seedString: string,
  sampleRate = 24000
): Int16Array {
  const numSamples = Math.max(2400, Math.floor(recipe.durationSec * sampleRate));
  const mix = new Float32Array(numSamples);
  const rng = createSeededRng(seedString);

  for (const layer of recipe.layers) {
    const layerBuf = new Float32Array(numSamples);
    const pitch = layer.pitchScale || 1.0;

    switch (layer.type) {
      case 'tram_rail': {
        // Metallic wheel-on-rail flange screech + low bogie rumble + rail joint clacks
        let phase1 = 0;
        let phase2 = 0;
        let phase3 = 0;
        let rumblePhase = 0;
        let brownState = 0;

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const progress = i / numSamples;
          // Doppler & braking envelope
          const passbyEnv =
            Math.sin(Math.PI * progress) *
            (0.65 + 0.35 * Math.sin(2 * Math.PI * 0.45 * t));

          // Slight downward braking pitch glide on metallic resonances
          const glide = 1.0 - 0.14 * progress;
          const vibrato = 1.0 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t);

          const f1 = 1840 * pitch * glide * vibrato;
          const f2 = 2790 * pitch * glide;
          const f3 = 4120 * pitch * glide;

          phase1 += (2 * Math.PI * f1) / sampleRate;
          phase2 += (2 * Math.PI * f2) / sampleRate;
          phase3 += (2 * Math.PI * f3) / sampleRate;
          rumblePhase += (2 * Math.PI * 56 * pitch) / sampleRate;

          // FM-modulated metallic screech
          const screech =
            0.38 * Math.sin(phase1 + 0.6 * Math.sin(phase2)) +
            0.24 * Math.sin(phase2) +
            0.12 * Math.sin(phase3);

          // Rolling rail rumble (filtered brown noise + 56Hz hum)
          const white = rng() * 2 - 1;
          brownState = (brownState + 0.04 * white) * 0.96;
          const rumble = 0.45 * Math.sin(rumblePhase) + brownState * 1.6;

          // Periodic rail-joint "clack-clack"
          const jointPhase = (t * 2.2) % 1.0;
          const clack =
            jointPhase < 0.03
              ? Math.exp(-jointPhase * 140) * white * 0.55
              : jointPhase > 0.12 && jointPhase < 0.15
                ? Math.exp(-(jointPhase - 0.12) * 140) * white * 0.45
                : 0;

          layerBuf[i] = (screech * 0.45 + rumble * 0.45 + clack) * passbyEnv;
        }
        break;
      }

      case 'footsteps': {
        // Rhythmic heel-toe transient footsteps on wet cobblestone
        const stepRate = layer.rateHz ?? 1.95;
        const stepIntervalSec = 1.0 / stepRate;
        const totalSteps = Math.max(2, Math.floor(recipe.durationSec / stepIntervalSec));

        for (let s = 0; s < totalSteps; s++) {
          const jitter = (rng() - 0.5) * 0.045;
          const stepStartSec = s * stepIntervalSec + 0.12 + jitter;
          const startSample = Math.floor(stepStartSec * sampleRate);
          if (startSample >= numSamples) continue;

          const stepGain = 0.75 + 0.25 * rng();
          const heelPitch = (290 + (s % 2) * 35) * pitch;
          const toeOffsetSamples = Math.floor(0.055 * sampleRate);
          const stepLenSamples = Math.min(
            Math.floor(0.18 * sampleRate),
            numSamples - startSample
          );

          for (let k = 0; k < stepLenSamples; k++) {
            const tLocal = k / sampleRate;
            const white = rng() * 2 - 1;

            // Heel impact (low thud + stone click)
            const heelEnv = Math.exp(-tLocal * 48);
            const heelTone = Math.sin(2 * Math.PI * heelPitch * tLocal) * Math.exp(-tLocal * 65);
            const heelSignal = (heelTone * 0.55 + white * 0.45) * heelEnv;

            // Toe / wet pavement grit scrape 55ms later
            let toeSignal = 0;
            if (k >= toeOffsetSamples) {
              const tToe = (k - toeOffsetSamples) / sampleRate;
              const toeEnv = Math.exp(-tToe * 55);
              const gritTone = Math.sin(2 * Math.PI * heelPitch * 2.4 * tToe);
              toeSignal = (gritTone * 0.35 + white * 0.65) * toeEnv * 0.7;
            }

            layerBuf[startSample + k] += (heelSignal + toeSignal) * stepGain;
          }
        }
        break;
      }

      case 'weather_rain': {
        // Pink noise rain bed + stochastic water droplet pings
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < numSamples; i++) {
          const white = rng() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.95 * b2 + white * 0.048;
          const pink = b0 + b1 + b2 + white * 0.08;

          // Occasional individual droplet impact
          const dropTrigger = rng() < 0.0035 ? (rng() * 0.6 + 0.2) : 0;
          layerBuf[i] = pink * 0.55 + dropTrigger * white;
        }
        break;
      }

      case 'wind_storm': {
        // Dual state-variable resonant bandpass filters swept by slow quadrature LFOs
        let bp1 = 0;
        let lp1 = 0;
        let bp2 = 0;
        let lp2 = 0;

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const white = (rng() * 2 - 1) * 0.25;

          const fCutoff1 = (340 + 210 * Math.sin(2 * Math.PI * 0.23 * t)) * pitch;
          const fCutoff2 = (620 + 280 * Math.cos(2 * Math.PI * 0.17 * t + 0.9)) * pitch;

          const f1 = Math.min(0.45, (2 * Math.sin((Math.PI * fCutoff1) / sampleRate)));
          const f2 = Math.min(0.45, (2 * Math.sin((Math.PI * fCutoff2) / sampleRate)));
          const q = 0.12; // High resonance for eerie whistling wind

          const hp1 = white - lp1 - q * bp1;
          bp1 += f1 * hp1;
          lp1 += f1 * bp1;

          const hp2 = white - lp2 - q * bp2;
          bp2 += f2 * hp2;
          lp2 += f2 * bp2;

          const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.19 * t);
          layerBuf[i] = (bp1 * 0.65 + bp2 * 0.45) * swell;
        }
        break;
      }

      case 'thunder': {
        // Initial lightning crack followed by multi-tap rolling sub-bass rumble
        let lp = 0;
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const white = rng() * 2 - 1;

          const crackEnv = t < 0.35 ? Math.exp(-t * 14) : 0;
          const rollEnv =
            Math.exp(-t * 0.95) *
            (0.55 +
              0.25 * Math.sin(2 * Math.PI * 1.7 * t) +
              0.2 * Math.cos(2 * Math.PI * 3.1 * t));

          // Lowpass filter for sub-bass rumble
          lp = lp * 0.965 + white * 0.035;
          const subBoom = Math.sin(2 * Math.PI * (68 * Math.exp(-t * 0.4) + 32) * t) * rollEnv;

          layerBuf[i] = white * crackEnv * 0.45 + lp * rollEnv * 2.2 + subBoom * 0.55;
        }
        break;
      }

      case 'door_creak': {
        // Stick-slip wooden hinge friction followed by latch click
        let phase = 0;
        const creakDuration = Math.min(recipe.durationSec * 0.72, recipe.durationSec - 0.25);
        const latchSample = Math.floor((creakDuration + 0.08) * sampleRate);

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          if (t < creakDuration) {
            const progress = t / creakDuration;
            const env = Math.sin(Math.PI * progress);
            const fBase =
              (210 + 140 * Math.sin(progress * Math.PI * 1.5) + 35 * Math.sin(2 * Math.PI * 11 * t)) *
              pitch;
            phase += (2 * Math.PI * fBase) / sampleRate;

            // Rich harmonic stick-slip pulse wave
            const stickSlip =
              0.5 * Math.sin(phase) +
              0.3 * Math.sin(2 * phase + 0.4) +
              0.2 * Math.sin(3 * phase);
            layerBuf[i] = stickSlip * env * 0.75;
          } else if (i >= latchSample && i < latchSample + Math.floor(0.09 * sampleRate)) {
            const tClick = (i - latchSample) / sampleRate;
            const clickEnv = Math.exp(-tClick * 75);
            const white = rng() * 2 - 1;
            layerBuf[i] =
              (Math.sin(2 * Math.PI * 520 * tClick) * 0.6 + white * 0.4) * clickEnv * 0.9;
          }
        }
        break;
      }

      case 'impact_knock': {
        // Dramatic wooden knocks / impacts
        const knockCount = 3;
        const spacingSec = Math.min(0.42, recipe.durationSec / (knockCount + 1));

        for (let n = 0; n < knockCount; n++) {
          const startSample = Math.floor(((n + 0.5) * spacingSec) * sampleRate);
          const len = Math.min(Math.floor(0.22 * sampleRate), numSamples - startSample);
          for (let k = 0; k < len; k++) {
            const tLocal = k / sampleRate;
            const env = Math.exp(-tLocal * 38);
            const body = Math.sin(2 * Math.PI * 125 * pitch * Math.exp(-tLocal * 8) * tLocal);
            const woody = Math.sin(2 * Math.PI * 390 * pitch * tLocal) * Math.exp(-tLocal * 65);
            const click = (rng() * 2 - 1) * Math.exp(-tLocal * 110);
            layerBuf[startSample + k] += (body * 0.6 + woody * 0.25 + click * 0.35) * env;
          }
        }
        break;
      }

      case 'cinematic_drone': {
        // Dark atmospheric sub-bass + fifth drone with heartbeat pulse
        let pFund = 0;
        let pDetune = 0;
        let pFifth = 0;
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const progress = i / numSamples;
          const env = Math.sin(Math.PI * progress);

          const f0 = 55 * pitch; // A1
          pFund += (2 * Math.PI * f0) / sampleRate;
          pDetune += (2 * Math.PI * (f0 * 1.006)) / sampleRate;
          pFifth += (2 * Math.PI * (f0 * 1.498)) / sampleRate;

          const pad =
            0.5 * Math.sin(pFund) +
            0.35 * Math.sin(pDetune + 0.3 * Math.sin(pFund)) +
            0.25 * Math.sin(pFifth);

          // Subtle low heartbeat throb
          const pulse = 0.8 + 0.2 * Math.sin(2 * Math.PI * 1.15 * t);
          layerBuf[i] = pad * env * pulse * 0.8;
        }
        break;
      }

      case 'radio_static': {
        // Vintage radio tuning carrier whistle + vinyl/static crackle
        let carrierPhase = 0;
        let bp = 0;
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const white = rng() * 2 - 1;
          bp = 0.82 * bp + 0.18 * white;

          const carrierFreq =
            (1150 + 480 * Math.sin(2 * Math.PI * 0.65 * t)) * pitch;
          carrierPhase += (2 * Math.PI * carrierFreq) / sampleRate;

          const crackle = rng() < 0.008 ? (rng() * 2 - 1) * 0.95 : 0;
          const dropout = 0.65 + 0.35 * Math.sin(2 * Math.PI * 2.3 * t);

          layerBuf[i] =
            (bp * 0.45 + Math.sin(carrierPhase) * 0.12 + crackle) * dropout;
        }
        break;
      }
    }

    // Sum layer into master mix
    for (let i = 0; i < numSamples; i++) {
      mix[i] += layerBuf[i] * layer.gain;
    }
  }

  // Apply one-pole distance low-pass filter (air absorption for distant SFX)
  const rc = 1.0 / (2 * Math.PI * Math.max(400, recipe.distanceLowpassHz));
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  let lpState = 0;
  for (let i = 0; i < numSamples; i++) {
    lpState = lpState + alpha * (mix[i] - lpState);
    mix[i] = lpState;
  }

  // Apply Schroeder multi-tap comb reverb for spatial depth ("ambient stereo field")
  if (recipe.reverbMix > 0.02) {
    const d1 = Math.floor(0.0297 * sampleRate);
    const d2 = Math.floor(0.0371 * sampleRate);
    const d3 = Math.floor(0.0411 * sampleRate);
    const comb1 = new Float32Array(d1);
    const comb2 = new Float32Array(d2);
    const comb3 = new Float32Array(d3);
    let idx1 = 0;
    let idx2 = 0;
    let idx3 = 0;
    const feedback = Math.min(0.84, 0.48 + recipe.reverbMix * 0.4);
    const wet = recipe.reverbMix;
    const dry = 1.0 - wet * 0.45;

    for (let i = 0; i < numSamples; i++) {
      const input = mix[i];
      const c1 = comb1[idx1];
      const c2 = comb2[idx2];
      const c3 = comb3[idx3];

      comb1[idx1] = input + c1 * feedback;
      comb2[idx2] = input + c2 * (feedback * 0.96);
      comb3[idx3] = input + c3 * (feedback * 0.92);

      idx1 = (idx1 + 1) % d1;
      idx2 = (idx2 + 1) % d2;
      idx3 = (idx3 + 1) % d3;

      const reverbOut = (c1 + c2 + c3) / 3.0;
      mix[i] = input * dry + reverbOut * wet;
    }
  }

  // Apply smooth 40ms fade-in / 80ms fade-out and soft-knee peak normalization
  const fadeInSamples = Math.min(Math.floor(0.04 * sampleRate), Math.floor(numSamples / 4));
  const fadeOutSamples = Math.min(Math.floor(0.08 * sampleRate), Math.floor(numSamples / 4));

  let maxAbs = 0.001;
  for (let i = 0; i < numSamples; i++) {
    const abs = Math.abs(mix[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  const normScale = (0.88 * recipe.masterGain) / maxAbs;
  const pcm16 = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    let env = 1.0;
    if (i < fadeInSamples) {
      env = i / fadeInSamples;
    } else if (i > numSamples - fadeOutSamples) {
      env = (numSamples - i) / fadeOutSamples;
    }
    const sample = Math.max(-0.98, Math.min(0.98, mix[i] * normScale * env));
    pcm16[i] = Math.round(sample * 32767);
  }

  return pcm16;
}

/**
 * Synthesizes a `sound_effect` ScriptBlock into a cached 16-bit PCM WAV Blob,
 * extracts Structure-of-Arrays (SoA) `WaveformPeakData`, and computes timeline markers.
 */
export async function synthesizeSfxAudio(
  options: SfxSynthesisOptions
): Promise<SfxSynthesisResult> {
  const { block, apiKey, useAiCompiler = true, fetchImpl = fetch } = options;
  const sampleRate = 24000;

  const recipe =
    useAiCompiler && apiKey && apiKey.trim().length > 0
      ? await compileSfxRecipeWithGemini(block, apiKey, fetchImpl)
      : classifySfxPrompt(
          block.text,
          block.directorNotes,
          block.sfxCategory,
          block.sfxDurationSec,
          block.sfxIntensity
        );

  const seed = `${block.id}_${block.text}_${block.sfxCategory ?? 'auto'}_${
    block.sfxDurationSec ?? recipe.durationSec
  }`;
  const pcm16 = renderSfxRecipeToPcm16(recipe, seed, sampleRate);
  const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const wavBlob = encodePcm16ToWavBlob(pcmBytes, sampleRate, 1);
  const waveformPeaks = extractWaveformPeaksFromPcm(pcm16, sampleRate, 100);
  const durationSec = Number((pcm16.length / sampleRate).toFixed(2));

  // Build timeline markers for words in the SFX description so the scrubber tracks progress
  const words = block.text.trim().split(/\s+/).filter(Boolean);
  const timepoints: ScriptTimepoint[] = words.map((_, idx) => ({
    markName: `blk_${block.id}_w_${idx}`,
    timeSeconds: Number(((idx / Math.max(1, words.length)) * durationSec).toFixed(3)),
  }));

  return {
    audioBlob: wavBlob,
    waveformPeaks,
    timepoints,
    durationSec,
    tokensUsed: Math.max(1, Math.ceil(durationSec * 25)),
    ssmlPayload: `<sfx layers="${recipe.summaryLabel}" duration="${durationSec}s">${block.text}</sfx>`,
  };
}

/**
 * Decodes an uploaded local audio file (.wav, .mp3, .ogg, .flac) into a normalized
 * 24kHz 16-bit PCM WAV Blob + SoA `WaveformPeakData` for use on a `sound_effect` block.
 */
export async function decodeUploadedAudioFileToSfxResult(
  file: File,
  blockId: string
): Promise<SfxSynthesisResult> {
  const targetSampleRate = 24000;

  let arrayBuffer: ArrayBuffer;
  if (typeof file.arrayBuffer === 'function') {
    arrayBuffer = await file.arrayBuffer();
  } else if (typeof FileReader !== 'undefined') {
    arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  } else {
    arrayBuffer = await new Response(file).arrayBuffer();
  }

  let pcm16: Int16Array | null = null;
  let actualSampleRate = targetSampleRate;

  // 1. Try browser Web Audio API decodeAudioData first (supports WAV, MP3, OGG, AAC, FLAC)
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;

  if (AudioCtx) {
    try {
      const ctx = new AudioCtx({ sampleRate: targetSampleRate });
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      actualSampleRate = decoded.sampleRate;
      const ch0 = decoded.getChannelData(0);
      const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
      pcm16 = new Int16Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        const mono = ch1 ? 0.5 * (ch0[i] + ch1[i]) : ch0[i];
        const clamped = Math.max(-1.0, Math.min(1.0, mono));
        pcm16[i] = Math.round(clamped * 32767);
      }
      void ctx.close().catch(() => {});
    } catch {
      // Fallback to direct RIFF/WAV parser below
    }
  }

  // 2. Fallback: Direct RIFF/WAV 16-bit PCM parser (for Node/Vitest or raw WAV files)
  if (!pcm16) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.byteLength >= 44) {
      const view = new DataView(arrayBuffer);
      const sampleRateHeader = view.getUint32(24, true);
      if (sampleRateHeader >= 8000 && sampleRateHeader <= 96000) {
        actualSampleRate = sampleRateHeader;
      }
      const pcmByteLength = bytes.byteLength - 44;
      const sampleCount = Math.floor(pcmByteLength / 2);
      pcm16 = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        pcm16[i] = view.getInt16(44 + i * 2, true);
      }
    } else {
      // Minimal fallback buffer if corrupt/empty file
      pcm16 = new Int16Array(targetSampleRate);
    }
  }

  const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const wavBlob = encodePcm16ToWavBlob(pcmBytes, actualSampleRate, 1);
  const waveformPeaks = extractWaveformPeaksFromPcm(pcm16, actualSampleRate, 100);
  const durationSec = Number((pcm16.length / actualSampleRate).toFixed(2));

  const timepoints: ScriptTimepoint[] = [
    { markName: `blk_${blockId}_w_0`, timeSeconds: 0 },
  ];

  return {
    audioBlob: wavBlob,
    waveformPeaks,
    timepoints,
    durationSec,
    tokensUsed: 0, // Local file import uses 0 API tokens
    ssmlPayload: `<sfx file="${file.name}" duration="${durationSec}s" />`,
  };
}
