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

export interface AIAgentSettings {
  apiKey?: string; // User-supplied Gemini API key (BYOK)
  textModel: GeminiTextModelId;
  ttsModel: GeminiTtsModelId;
  ttsProvider?: TtsEngineProvider; // 'gemini_tts' | 'browser_tts'
  enableSearchGrounding: boolean; // Enables Google Search tool for research
  temperature: number; // 0.2 (strict facts) to 0.85 (creative fiction)
  audioOutputFormat: 'pcm_48khz' | 'pcm_24khz' | 'ogg_opus';
}

export interface Project {
  id: string;
  title: string;
  description: string;
  defaultLanguage: SupportedLanguage; // 'en' | 'hr'
  speakers: Speaker[];
  blocks: ScriptBlock[];
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
