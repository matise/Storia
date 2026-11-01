export type SupportedLanguage = 'en' | 'hr';

export type Gender = 'female' | 'male' | 'non-binary' | 'neutral' | 'other';

export type TtsEngineProvider = 'gemini_tts' | 'browser_tts';

/**
 * Base voice profiles supported by the Gemini TTS engine
 */
export type GeminiBaseVoice =
  | 'Puck'
  | 'Charon'
  | 'Kore'
  | 'Fenrir'
  | 'Aoede'
  | 'Zephyr'
  | 'Helios'
  | 'Leda'
  | 'Orpheus'
  | string;

export const GEMINI_BASE_VOICES: GeminiBaseVoice[] = [
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Aoede',
  'Zephyr',
  'Helios',
  'Leda',
  'Orpheus',
];

/**
 * Acoustic & DSP parameters applied to a speaker's audio monitor chain
 */
export interface SpeakerAcousticProfile {
  targetCentroidHz?: number; // Spectral centroid (brightness target: 500Hz - 5000Hz)
  timbreWarmth?: number; // Low-mid presence (-1.0 to +1.0)
  biquadEq?: {
    enabled?: boolean; // Master bypass toggle for 3-band Biquad EQ
    lowShelfGainDb: number; // Bass / Proximity compensation (~120Hz)
    midPeakGainDb: number; // Dialogue clarity band (~2.5kHz)
    highShelfGainDb: number; // Presence / Air (~8kHz)
  };
  compression?: {
    enabled?: boolean; // Master bypass toggle for Dynamics Compressor
    thresholdDb: number; // e.g. -20dB
    ratio: number; // e.g. 2.5:1
    attackMs: number; // 10ms - 30ms
    releaseMs: number; // 50ms - 200ms
  };
  effectStack?: AudioEffectConfig[]; // Modular real-time DSP effect stack
}

/**
 * Gemini Native TTS & Local Browser TTS Voice Configuration per Speaker
 */
export interface GeminiVoiceConfig {
  baseVoice: GeminiBaseVoice; // Base neural voice timbre
  browserVoiceURI?: string; // Optional pinned local SpeechSynthesisVoice URI
  stylePrompt: string; // Cross-modal conditioning prompt (e.g. "Raspy, cynical 40s detective")
  speakingRate: number; // 0.5x to 2.0x (controls <prosody rate> or Utterance.rate)
  pitchAdjustment: number; // -10st to +10st (semitones)
  enableDirectorNotes: boolean; // Treat bracketed [whispers] as acoustic style modifiers
  ssmlEnabled: boolean; // Allow inline SSML tags (<break>, <prosody>, <phoneme>)
  acoustics: SpeakerAcousticProfile; // Post-TTS client-side DSP EQ & Dynamics
}

export interface Speaker {
  id: string;
  name: string;
  color: string; // Hex or Tailwind color token for badge styling
  gender: Gender;
  age: string; // e.g., "Child", "30s", "Elderly", or "45"
  personaPrompt: string; // LLM persona prompt (personality, rhythm, idioms, worldview)
  actingNotes: string; // Human actor notes (accents, breathing, quirks)
  voice: GeminiVoiceConfig;
  createdAt: number;
}

export type BlockType = 'dialogue' | 'narration' | 'direction' | 'sound_effect';

export type SfxCategoryPreset =
  | 'auto'
  | 'tram_rail'
  | 'footsteps'
  | 'weather_rain'
  | 'wind_storm'
  | 'thunder'
  | 'door_creak'
  | 'impact_knock'
  | 'cinematic_drone'
  | 'radio_static'
  | 'custom_upload';

export type TtsBlockStatus = 'unrendered' | 'ok' | 'stale' | 'rendering';

export interface ScriptTimepoint {
  markName: string; // Matches SSML <mark name="..."/>
  timeSeconds: number; // Offset from start of block audio
}

/**
 * Structure of Arrays (SoA) Downsampled Peak Data for Waveform Display
 */
export interface WaveformPeakData {
  sampleRate: number; // Typically downsampled to 100-200 peaks/second
  length: number; // Number of peak slices
  minPeaks: Float32Array; // Negative envelope values [-1.0, 0.0]
  maxPeaks: Float32Array; // Positive envelope values [0.0, 1.0]
  rmsLevels: Float32Array; // Perceptual energy density per slice
}

export interface ScriptBlock {
  id: string;
  type: BlockType;
  speakerId?: string; // Required if type === 'dialogue'
  text: string; // Spoken dialogue or narrative prose
  directorNotes?: string; // Invisible style cue (e.g., "[šapatom / whispering]", "[ironično]")
  pauseAfterMs?: number; // Trailing pause duration between blocks
  estimatedDurationSec?: number; // Calculated via WPM baseline or exact audio metadata
  audioTokenEstimate?: number; // Calculated at ~25 audio tokens per second
  generatedAudioUrl?: string; // Cached Blob/IndexedDB reference to rendered PCM/WAV
  waveformPeaks?: WaveformPeakData; // Precomputed peak pyramid for instant rendering
  timepoints?: ScriptTimepoint[]; // Word-level or phrase-level sync points returned by Gemini TTS
  startTimeSec?: number; // Computed timeline global start position
  endTimeSec?: number; // Computed timeline global end position
  ttsStatus?: TtsBlockStatus; // Cached synthesis status
  renderedWithProvider?: TtsEngineProvider; // 'gemini_tts' | 'browser_tts'
  cacheKey?: string; // SHA-256 content key of last rendered audio
  sfxCategory?: SfxCategoryPreset; // Optional SFX preset category for sound_effect blocks
  sfxDurationSec?: number; // Target duration in seconds for sound_effect synthesis
  sfxIntensity?: number; // Intensity / gain [0.1, 1.0] for sound_effect synthesis
  volumeGainDb?: number; // Volume gain knob in dB: -Infinity (-60dB floor) to +10dB, default 0dB
  auxSendDb?: number; // Aux Send knob in dB: -Infinity (-48dB floor) to +10dB, default 0dB (unity)
  auxSendBusId?: string; // Target Aux Bus identifier (default 'aux_bus_main')
  directMute?: boolean; // When true, direct dry channel is muted (pre-fader send to aux)
  fadeInMs?: number; // Clip fade-in duration in milliseconds (default 0)
  fadeOutMs?: number; // Clip fade-out duration in milliseconds (default 0)
  fadeInCurve?: number; // Clip fade-in curvature: -1.0 (concave exponential) to 0 (linear) to +1.0 (convex logarithmic)
  fadeOutCurve?: number; // Clip fade-out curvature: -1.0 to +1.0
  customAudioFileName?: string; // Original filename if imported from a local audio file
  isCollapsed?: boolean; // UI view state: collapsed/minimized segment card
  order: number;
}

export interface AudioMasteringConfig {
  sampleRate: 44100 | 48000; // Standard broadcast rates adhering to Nyquist limits
  bitDepth: 16 | 24 | 32; // Target export resolution
  dither: 'none' | 'tpdf'; // Triangular PDF dither for 16-bit / 24-bit PCM exports
  targetLufs: number; // Target Integrated Loudness (e.g., -16 LUFS for podcasts)
  truePeakLimitDb: number; // e.g., -1.0 dBFS
}

/**
 * AI Agent & Research Schemas
 */
export type AIAgentMode =
  | 'persona_research' // Research factual topics interpreted through persona lens
  | 'cowriter' // Generate the next narrative beat or dialogue exchange
  | 'dialogue_doctor' // Polish lines to match speaker vocabulary & spoken cadence
  | 'bilingual_adapter'; // Culturally sensitive translation (EN <-> HR)

export type GeminiTextModelId =
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash-lite';

export type GeminiTtsModelId =
  | 'gemini-2.5-flash-preview-tts'
  | 'gemini-2.5-pro-preview-tts';

export const GEMINI_TEXT_MODELS: readonly {
  id: GeminiTextModelId;
  label: string;
  badge: string;
}[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview (Fast & Grounded)',
    badge: '3-Flash',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview (Deep Reasoning)',
    badge: '3.1-Pro',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Balanced Studio)',
    badge: '2.5-Flash',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro (Literary & Cultural)',
    badge: '2.5-Pro',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite (Ultra-Low Latency)',
    badge: '2.5-Lite',
  },
];

export const GEMINI_TTS_MODELS: readonly {
  id: GeminiTtsModelId;
  label: string;
}[] = [
  {
    id: 'gemini-2.5-flash-preview-tts',
    label: 'Gemini 2.5 Flash TTS (Sub-Second Studio Voice)',
  },
  {
    id: 'gemini-2.5-pro-preview-tts',
    label: 'Gemini 2.5 Pro TTS (High-Expressivity Drama)',
  },
];

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface PersonaResearchRecord {
  id: string;
  speakerId: string;
  query: string;
  personaResponse: string; // The answer written strictly in-character
  objectiveSummary?: string; // Raw factual takeaway from search
  sources: GroundingSource[]; // Verified citations from Google Search grounding
  modelUsed?: GeminiTextModelId;
  timestamp: number;
}

export type CoWriterWorkflowMode = 'scene_beats' | 'complete_story' | 'podcast_episode';

export interface CoWriterBeatBlockDraft {
  type: BlockType;
  speakerId?: string;
  text: string;
  directorNotes?: string;
  pauseAfterMs?: number;
}

export interface CoWriterAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl?: string; // base64 data url for images / PDFs
  textContent?: string; // extracted text content for documents (.txt, .md, .fountain, .json)
  isImage: boolean;
}

export interface CoWriterBeatCandidate {
  id: string;
  title: string;
  rationale: string;
  blocks: CoWriterBeatBlockDraft[];
  deepResearchUsed?: boolean;
  analyzedFiles?: string[];
  mode?: CoWriterWorkflowMode;
}

export interface ScriptDoctorOption {
  id: string;
  styleLabel: string;
  text: string;
  directorNotes: string;
  rationale: string;
  estimatedDurationSec: number;
  audioTokenEstimate: number;
}

export interface BilingualAdaptationResult {
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  originalText: string;
  adaptedText: string;
  adaptedDirectorNotes?: string;
  culturalNotes: string;
  genderAgreementApplied: string;
}

export type CroatianDialect = 'standard' | 'dubrovnik';
export type DubrovnikRegister = 'classical' | 'traditional' | 'contemporary';

export interface AIAgentSettings {
  apiKey?: string; // User-supplied Gemini API key (BYOK)
  textModel: GeminiTextModelId;
  ttsModel: GeminiTtsModelId;
  ttsProvider?: TtsEngineProvider; // 'gemini_tts' | 'browser_tts'
  enableSearchGrounding: boolean; // Enables Google Search tool for research
  temperature: number; // 0.2 (strict facts) to 0.85 (creative fiction)
  audioOutputFormat: 'pcm_48khz' | 'pcm_24khz' | 'ogg_opus';
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
}

/**
 * Modular Audio DSP Effect Stack & Aux Send Bus Schemas
 */
export type EffectModuleType =
  | 'biquad_eq'
  | 'dynamics_compressor'
  | 'gain_trim'
  | 'state_variable_filter'
  | 'passthrough';

export interface BaseEffectConfig {
  id: string;
  name: string;
  type: EffectModuleType;
  enabled: boolean; // Direct Audio Sync: when false, signal bypasses effect with 0 phase delay
}

export interface BiquadEqEffectConfig extends BaseEffectConfig {
  type: 'biquad_eq';
  lowShelfFreqHz?: number; // default 120Hz
  lowShelfGainDb: number;
  midPeakFreqHz?: number; // default 2500Hz
  midPeakGainDb: number;
  midPeakQ?: number; // default 1.0
  highShelfFreqHz?: number; // default 8000Hz
  highShelfGainDb: number;
}

export interface DynamicsEffectConfig extends BaseEffectConfig {
  type: 'dynamics_compressor';
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  kneeDb?: number; // default 0dB
}

export interface GainTrimEffectConfig extends BaseEffectConfig {
  type: 'gain_trim';
  gainDb: number;
  invertPolarity?: boolean;
  mute?: boolean;
}

export interface StateVariableFilterEffectConfig extends BaseEffectConfig {
  type: 'state_variable_filter';
  filterType: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  frequencyHz: number;
  q?: number;
}

export interface PassthroughEffectConfig extends BaseEffectConfig {
  type: 'passthrough';
}

export type AudioEffectConfig =
  | BiquadEqEffectConfig
  | DynamicsEffectConfig
  | GainTrimEffectConfig
  | StateVariableFilterEffectConfig
  | PassthroughEffectConfig;

export interface AuxBusConfig {
  id: string;
  name: string;
  color?: string; // Visual accent color (e.g. emerald #10b981)
  returnGainDb: number; // Master return level (-inf to +10 dB, default 0.0)
  enabled: boolean;
  modules: AudioEffectConfig[];
}

export function createDefaultMainAuxBus(): AuxBusConfig {
  return {
    id: 'aux_bus_main',
    name: 'Main FX (EQ + Dyn)',
    color: '#10b981',
    returnGainDb: 0.0,
    enabled: true,
    modules: [
      {
        id: 'fx_main_eq',
        name: '3-Band Biquad EQ',
        type: 'biquad_eq',
        enabled: true,
        lowShelfFreqHz: 120,
        lowShelfGainDb: 0,
        midPeakFreqHz: 2500,
        midPeakGainDb: 0,
        midPeakQ: 1.0,
        highShelfFreqHz: 8000,
        highShelfGainDb: 0,
      },
      {
        id: 'fx_main_dyn',
        name: 'Studio Dynamics Compressor',
        type: 'dynamics_compressor',
        enabled: true,
        thresholdDb: -20,
        ratio: 2.5,
        attackMs: 15,
        releaseMs: 100,
        kneeDb: 0,
      },
    ],
  };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  defaultLanguage: SupportedLanguage; // 'en' | 'hr'
  dialect?: CroatianDialect; // 'standard' | 'dubrovnik'
  dubrovnikRegister?: DubrovnikRegister; // 'classical' | 'traditional' | 'contemporary'
  speakers: Speaker[];
  blocks: ScriptBlock[];
  auxBusses?: AuxBusConfig[]; // Modular Aux Send Busses & Effect Stacks
  researchNotebook?: PersonaResearchRecord[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    author?: string;
    targetWpm?: number; // Baseline spoken pacing (130-150 WPM)
    genre?: string;
  };
  audioConfig: AudioMasteringConfig;
  aiSettings: AIAgentSettings;
}

export interface AppSettings {
  uiLanguage: SupportedLanguage;
  theme: 'dark' | 'light' | 'system';
  activeProjectId: string | null;
  audioBufferSize: 128 | 256 | 512;
  globalApiKey?: string; // Stored in localStorage or encrypted IndexedDB
}
