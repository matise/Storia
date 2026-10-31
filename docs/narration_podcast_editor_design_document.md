# Storia: Technical Architecture & Design Document
*The Intelligent Audio Drama, Podcast & Narration Studio*

## 1. Executive Summary
**Storia** (Croatian & Italian root for *story/history*, pronounced *[stôːrija]*) is an advanced web application designed for authoring, directing, researching, and producing episodic podcasts, radio dramas, voiceovers, and narrated audiobooks. 

Storia pairs a block-based script workbench with real-time digital signal processing (DSP), high-performance Data-Oriented waveform visualization, native multimodal audio generation via **Gemini 2.5 Flash TTS** (`gemini-2.5-flash-preview-tts`), and storytelling / research agents powered by **Gemini 3 Flash** (`gemini-3-flash-preview`). It supports browser-local offline persistence (`localStorage` / IndexedDB), seamless bilingual authoring (English and Croatian), fine-grained character persona management, director's notes parsing, and studio-grade audio mastering.

---

## 2. Core Pillars & Goals
* **Frictionless Scripting & Directing:** Rapid authoring of dialogue, narration, sound effects, and stage directions with keyboard navigation, hotkey speaker assignment, and automated spoken word-per-minute (WPM) pacing calculations.
* **Undo/Redo Command Architecture:** Complete history tracking via the Command pattern, enabling robust undo/redo across block edits, reordering, voice adjustments, and multi-track cuts.
* **Data-Oriented Waveform Visualization:** Structure of Arrays (SoA) peak pyramid buffers, 1D temporal bounding hierarchies (1D BVH) for $O(\log N)$ playhead-to-script lookups, and decoupled audio clock interpolation for jitter-free $144\text{ Hz}$ rendering.
* **Native Gemini TTS Engine:** High-fidelity vocal synthesis utilizing `gemini-2.5-flash-preview-tts`, leveraging natural language style prompts, persona system conditioning, invisible director notes (didaskalije), and SSML timepoint synchronization.
* **Rich Cast & Persona Management:** Granular speaker profiles containing acting notes, LLM persona prompts, base acoustic voice embeddings, and biquad DSP post-processing (timbre, brightness, EQ).
* **Storia Persona Research Agent:** Storytelling assistant capable of researching real-world knowledge through a character's specific psychological lens and worldview (using Google Search grounding), brainstorming plot twists, and doctoring dialogue cadences.
* **Bilingual Native Support:** Dual English and Croatian support across the project script workbench, character persona generation, linguistic agreement (gendered verbs and cases), and application UI.
* **Local-First Privacy & BYOK Security:** Offline-first architecture with user-provided Gemini API keys stored locally in encrypted browser storage (`localStorage` / Web Crypto API), ensuring project data remains private.
* **Deterministic Audio DSP Architecture:** Isolated `AudioWorklet` thread processing, lookahead event scheduling, lock-free ring buffers, and professional broadcast export standards ($44.1/48\text{ kHz}$, TPDF dithering, $-16\text{ LUFS}$ loudness target).

---

## 3. Data Architecture & Schemas

The following TypeScript definitions form the foundation for Storia projects, speakers, native TTS configurations, timeline visualization, and script blocks:

```typescript
export type SupportedLanguage = 'en' | 'hr';

export type Gender = 'female' | 'male' | 'non-binary' | 'neutral' | 'other';

/**
 * Base voice profiles supported by the Gemini TTS engine
 */
export type GeminiBaseVoice = 
  | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' 
  | 'Zephyr' | 'Helios' | 'Leda' | 'Orpheus' | string;

/**
 * Acoustic & DSP parameters applied to a speaker's audio monitor chain
 */
export interface SpeakerAcousticProfile {
  targetCentroidHz?: number;    // Spectral centroid (brightness target: 500Hz - 5000Hz)
  timbreWarmth?: number;        // Low-mid presence (-1.0 to +1.0)
  biquadEq?: {
    lowShelfGainDb: number;     // Bass / Proximity compensation (~120Hz)
    midPeakGainDb: number;      // Dialogue clarity band (~2.5kHz)
    highShelfGainDb: number;    // Presence / Air (~8kHz)
  };
  compression?: {
    thresholdDb: number;        // e.g. -20dB
    ratio: number;              // e.g. 2.5:1
    attackMs: number;           // 10ms - 30ms
    releaseMs: number;          // 50ms - 200ms
  };
}

/**
 * Gemini Native TTS Voice Configuration per Speaker
 */
export interface GeminiVoiceConfig {
  baseVoice: GeminiBaseVoice;       // Base neural voice timbre
  stylePrompt: string;              // Cross-modal conditioning prompt (e.g. "Raspy, cynical 40s detective")
  speakingRate: number;             // 0.5x to 2.0x (controls <prosody rate>)
  pitchAdjustment: number;          // -10st to +10st (semitones)
  enableDirectorNotes: boolean;     // Treat bracketed [whispers] as acoustic style modifiers
  ssmlEnabled: boolean;             // Allow inline SSML tags (<break>, <prosody>, <phoneme>)
  acoustics: SpeakerAcousticProfile;// Post-TTS client-side DSP EQ
}

export interface Speaker {
  id: string;
  name: string;
  color: string;                    // Hex or Tailwind color token for badge styling
  gender: Gender;
  age: string;                      // e.g., "Child", "30s", "Elderly", or "45"
  personaPrompt: string;            // LLM persona prompt (personality, rhythm, idioms, worldview)
  actingNotes: string;              // Human actor notes (accents, breathing, quirks)
  voice: GeminiVoiceConfig;
  createdAt: number;
}

export type BlockType = 'dialogue' | 'narration' | 'direction' | 'sound_effect';

export interface ScriptTimepoint {
  markName: string;                 // Matches SSML <mark name="..."/>
  timeSeconds: number;              // Offset from start of block audio
}

/**
 * Structure of Arrays (SoA) Downsampled Peak Data for Waveform Display
 */
export interface WaveformPeakData {
  sampleRate: number;               // Typically downsampled to 100-200 peaks/second
  length: number;                   // Number of peak slices
  minPeaks: Float32Array;           // Negative envelope values [-1.0, 0.0]
  maxPeaks: Float32Array;           // Positive envelope values [0.0, 1.0]
  rmsLevels: Float32Array;          // Perceptual energy density per slice
}

export interface ScriptBlock {
  id: string;
  type: BlockType;
  speakerId?: string;               // Required if type === 'dialogue'
  text: string;                     // Spoken dialogue or narrative prose
  directorNotes?: string;           // Invisible style cue (e.g., "[šapatom / whispering]", "[ironično]")
  pauseAfterMs?: number;            // Trailing pause duration between blocks
  estimatedDurationSec?: number;    // Calculated via WPM baseline or exact audio metadata
  audioTokenEstimate?: number;      // Calculated at ~25 audio tokens per second
  generatedAudioUrl?: string;       // Cached Blob/IndexedDB reference to rendered PCM/WAV
  waveformPeaks?: WaveformPeakData; // Precomputed peak pyramid for instant rendering
  timepoints?: ScriptTimepoint[];   // Word-level or phrase-level sync points returned by Gemini TTS
  startTimeSec?: number;            // Computed timeline global start position
  endTimeSec?: number;              // Computed timeline global end position
  order: number;
}

export interface AudioMasteringConfig {
  sampleRate: 44100 | 48000;        // Standard broadcast rates adhering to Nyquist limits
  bitDepth: 16 | 24 | 32;           // Target export resolution
  dither: 'none' | 'tpdf';          // Triangular PDF dither for 16-bit / 24-bit PCM exports
  targetLufs: number;               // Target Integrated Loudness (e.g., -16 LUFS for podcasts)
  truePeakLimitDb: number;          // e.g., -1.0 dBFS
}

/**
 * AI Agent & Research Schemas
 */
export type AIAgentMode = 
  | 'persona_research'              // Research factual topics interpreted through persona lens
  | 'cowriter'                      // Generate the next narrative beat or dialogue exchange
  | 'dialogue_doctor'               // Polish lines to match speaker vocabulary & spoken cadence
  | 'bilingual_adapter';            // Culturally sensitive translation (EN <-> HR)

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface PersonaResearchRecord {
  id: string;
  speakerId: string;
  query: string;
  personaResponse: string;          // The answer written strictly in-character
  objectiveSummary?: string;        // Raw factual takeaway from search
  sources: GroundingSource[];       // Verified citations from Google Search grounding
  timestamp: number;
}

export type GeminiTextModelId =
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash-lite';

export type GeminiTtsModelId =
  | 'gemini-2.5-flash-preview-tts'
  | 'gemini-2.5-pro-preview-tts';

export interface AIAgentSettings {
  apiKey?: string;                  // User-supplied Gemini API key (BYOK)
  textModel: GeminiTextModelId;     // Active Gemini model for Persona Research, Co-Writer, Doctor & Adapter
  ttsModel: GeminiTtsModelId;       // Active Gemini model for multimodal TTS synthesis
  enableSearchGrounding: boolean;   // Enables Google Search tool for research
  temperature: number;              // 0.2 (strict facts) to 0.85 (creative fiction)
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
    targetWpm?: number;             // Baseline spoken pacing (130-150 WPM)
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
  globalApiKey?: string;            // Stored in localStorage or encrypted IndexedDB
}
```

---

## 4. Gemini TTS Engine Architecture (`gemini-2.5-flash-preview-tts`)

Unlike legacy concatenative or shallow neural text-to-speech pipelines that treat input text strictly as graphemes, Storia's Gemini 2.5 Flash TTS integration treats audio as a discrete multimodal token stream.

```
+---------------------------------------------------------------------------------------------------+
|                            STORIA: GEMINI NATIVE TTS SYNTHESIS PIPELINE                           |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ INVISIBLE INPUT VECTORS ]              [ SPOKEN CONTENT ]          [ REAL-TIME ENGINE ]        |
|  * Speaker Persona System Prompt           * Dialogue Text             * gemini-2.5-flash-        |
|  * Cross-Modal Style Prompt                * Inline SSML (<break>)       preview-tts              |
|    ("cynical, weary, whispering")          * Dynamic Pacing Markers    * Sub-second latency       |
|  * Director Notes Didaskalije               (<mark name="word_1"/>)    * SoundStorm Codec         |
|    (e.g., "[uzdah / sigh]")                                            * SynthID Watermarking     |
|                                                                                                   |
|                                         |                                                         |
|                                         v                                                         |
|  +---------------------------------------------------------------------------------------------+  |
|  |                             API REQUEST DISPATCH (BYOK API Key)                             |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                         |                                                         |
|                   +---------------------+---------------------+                                   |
|                   v                                           v                                   |
|       [ RAW PCM / OPUS AUDIO STREAM ]              [ TIMEPOSITIONAL METADATA ]                    |
|       * High-speed binary audio chunks             * Word & line timestamps                       |
|       * Audio token tracking (25 tok/sec)          * Visual highlighting in Storia editor         |
|       * Structure-of-Arrays (SoA) Peaks            * 1D BVH Timeline Index                        |
|                   |                                           |                                   |
|                   v                                           v                                   |
|       [ CLIENT-SIDE DSP CHAIN ]                    [ TIMELINE SYNCHRONIZER ]                      |
|       * AudioWorklet & SPSC Ring Buffer            * Active block indicator                       |
|       * Biquad EQ & Dynamic Compressor             * Decoupled Lerp Playhead Scrubber             |
|       * Master Mix / Multi-speaker handoff         * Script karaoke highlight                     |
+---------------------------------------------------------------------------------------------------+
```

### 4.1. "Invisible" Input Controls & Directing Mechanisms
Storia leverages three decoupled input vectors that are never spoken aloud but directly sculpt the acoustic performance:

1. **System Persona Prompting:**
   The speaker's comprehensive identity (e.g., *"Ti si stari svjetioničar iz Visa s promuklim glasom i sporim tempom."* / *"You are a cynical 1940s noir private investigator."*) is transmitted as system-level context. The model modifies vocal tract configuration, fundamental frequency ($F_0$), and rhythm.
2. **Dynamic Style Conditioning:**
   Before each line, user-defined mood presets or block-specific director prompts (e.g., *"speak with rising panic, breathless"*) are encoded as style embeddings and injected into the generative transformer decoding steps.
3. **Director's Notes (Didaskalije) Parsing:**
   The Storia editor parser recognizes bracketed expressions (`[...]` or `(...)`). When sending text to Gemini 2.5 Flash TTS, these are treated as contextual acting directives:
   * `[šapatom / whispered]` $\rightarrow$ triggers glottal airflow and suppresses voiced vocal cord vibration.
   * `[kratak uzdah / short sigh]` $\rightarrow$ prompts the acoustic tokenizer to generate an organic inhalation/exhalation token before speech continues.
   * `[ironično / sarcastic]` $\rightarrow$ prompts vowel elongation and pitch down-glides on key syllables.

### 4.2. SSML & Millisecond-Accurate Timeline Synchronization
To ensure synchronous visual playback where the active script block and words light up during audio audition:
* Storia injects SSML `<mark name="blk_{id}_w_{idx}"/>` tags between sentences or clauses.
* The API response returns both the audio payload and a structured `timepoints` array containing exact offsets.
* The application's playback controller reads these timepoints to coordinate the script cursor, visual scrubber, and character portrait animations.
* `<break time="750ms"/>` tags are automatically computed from the `pauseAfterMs` property, guaranteeing precise theatrical pauses without requiring silence-padding hacks.

### 4.3. Multi-Speaker Conversational "Handoff"
Traditional systems synthesize each character separately, resulting in abrupt acoustic room-tone shifts and disconnects. Gemini 2.5 Flash TTS in Storia supports continuous conversational multi-speaker sessions:
* When rendering a scene, preceding lines from conversational partners are included in the prompt context.
* The model preserves **prosodic context**: Speaker B responds directly to the musical pitch and emotional cadence of Speaker A's preceding line.
* Eliminates unnatural silent voids between rapid-fire back-and-forth arguments.

### 4.4. Audio Token Accounting & Cost Estimation
Gemini 2.5 Flash TTS quantifies audio generation in **Audio Tokens** (approximately $25\text{ tokens}$ per second of audio output, priced at $\approx \$10.00$ per 1 million audio tokens).
* **Live Budget Meter:** As writers edit the script, Storia calculates an instant running estimate of audio tokens based on word count, speech rate ($\text{WPM}$), and inserted SSML breaks.
* **Token Awareness:** Warns authors that lengthy SSML pauses and slow speaking rates generate valid silence tokens that consume audio token quotas.

### 4.5. TTS Synthesis Pipeline & Peak Extraction

```typescript
/**
 * Synthesizes dialogue block using Gemini 2.5 Flash Preview TTS
 * and generates Structure-of-Arrays (SoA) peak data for Storia rendering.
 */
export async function synthesizeGeminiAudioWithPeaks({
  block,
  speaker,
  apiKey,
  language
}: {
  block: ScriptBlock;
  speaker: Speaker;
  apiKey: string;
  language: SupportedLanguage;
}): Promise<{ 
  audioBlob: Blob; 
  timepoints: ScriptTimepoint[]; 
  tokensUsed: number;
  waveformPeaks: WaveformPeakData;
}> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:synthesizeSpeech?key=${apiKey}`;

  const acousticDirective = [
    `Language: ${language === 'hr' ? 'Croatian' : 'English'}.`,
    `Character: ${speaker.name}, Age: ${speaker.age}, Gender: ${speaker.gender}.`,
    `Persona: ${speaker.personaPrompt}.`,
    `Acting style: ${speaker.actingNotes}.`,
    `Line emotional tone: ${speaker.voice.stylePrompt}.`,
    block.directorNotes ? `Immediate direction: ${block.directorNotes}.` : ''
  ].filter(Boolean).join(' ');

  const ssmlText = `
    <speak>
      <prosody rate="${speaker.voice.speakingRate}" pitch="${speaker.voice.pitchAdjustment}st">
        ${block.directorNotes ? `(${block.directorNotes}) ` : ''}
        <mark name="start_${block.id}"/>
        ${block.text}
        <mark name="end_${block.id}"/>
        ${block.pauseAfterMs ? `<break time="${block.pauseAfterMs}ms"/>` : ''}
      </prosody>
    </speak>
  `.trim();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { ssml: ssmlText },
      voice: {
        name: speaker.voice.baseVoice || 'Puck',
        languageCode: language === 'hr' ? 'hr-HR' : 'en-US'
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 48000
      },
      systemInstruction: { parts: [{ text: acousticDirective }] }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `TTS Synthesis error ${response.status}`);
  }

  const result = await response.json();
  const binaryAudio = atob(result.audioContent);
  const pcmBytes = new Uint8Array(binaryAudio.length);
  for (let i = 0; i < binaryAudio.length; i++) {
    pcmBytes[i] = binaryAudio.charCodeAt(i);
  }
  const audioBlob = new Blob([pcmBytes.buffer], { type: 'audio/wav' });

  // Convert 16-bit PCM bytes to Float32 sample array
  const int16View = new Int16Array(pcmBytes.buffer);
  const totalSamples = int16View.length;
  
  // Downsample to 100 peak points per second for efficient canvas rendering
  const peaksPerSecond = 100;
  const sampleRate = 48000;
  const blockSize = Math.floor(sampleRate / peaksPerSecond);
  const peakCount = Math.floor(totalSamples / blockSize);

  const minPeaks = new Float32Array(peakCount);
  const maxPeaks = new Float32Array(peakCount);
  const rmsLevels = new Float32Array(peakCount);

  for (let p = 0; p < peakCount; p++) {
    let min = 1.0;
    let max = -1.0;
    let sumSq = 0;
    const start = p * blockSize;
    const end = Math.min(start + blockSize, totalSamples);

    for (let s = start; s < end; s++) {
      const val = int16View[s] / 32768.0;
      if (val < min) min = val;
      if (val > max) max = val;
      sumSq += val * val;
    }

    minPeaks[p] = min;
    maxPeaks[p] = max;
    rmsLevels[p] = Math.sqrt(sumSq / (end - start));
  }

  const waveformPeaks: WaveformPeakData = {
    sampleRate: peaksPerSecond,
    length: peakCount,
    minPeaks,
    maxPeaks,
    rmsLevels
  };

  const timepoints: ScriptTimepoint[] = (result.timepoints || []).map((tp: any) => ({
    markName: tp.markName,
    timeSeconds: tp.timeSeconds
  }));

  const durationSec = totalSamples / sampleRate;
  const tokensUsed = Math.ceil(durationSec * 25);

  return { audioBlob, timepoints, tokensUsed, waveformPeaks };
}
```

---

## 5. Storia AI Storytelling & Persona Research Agent (`gemini-3-flash-preview`)

In parallel with audio synthesis, Storia's creative writing and research suite is powered by **`gemini-3-flash-preview`**. The agent operates directly within the browser using the user's API key with optional Google Search grounding.

```
+-------------------------------------------------------------------------------------------------+
|                                 STORIA AI STORYTELLING AGENT                                    |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   [1] PERSONA RESEARCH ENGINE             [2] DIALOGUE & STORY CO-WRITER                       |
|   - Inputs: User Query + Speaker Persona  - Inputs: Preceding Script Blocks + Target Speakers   |
|   - Google Search Grounding Enabled       - Enforces distinct vocabulary, idioms & rhythm       |
|   - Filters facts through character bias  - Outputs: Ready-to-insert dialogue/narration blocks  |
|                                                                                                 |
|   [3] SCRIPT DOCTOR & CADENCE POLISH      [4] BILINGUAL ADAPTER (EN <-> HR)                     |
|   - Injects emotional cues [whispers]     - Translates idioms while preserving voice timbre     |
|   - Adjusts length for audio timing (WPM) - Handles Croatian case grammar & diacritics (č,ć,ž)  |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

### 5.1. Persona-Grounded Research Engine
Unlike generic search assistants, Storia's **Persona Research Engine** investigates real-world historical, scientific, or cultural questions through the specific psychological lens, demographic background, and emotional state of a chosen cast member.

* **Workflow:**
  1. The user selects an existing speaker (e.g., *"Marko, 45, cynical former detective from Zagreb"* or *"Dr. Elena, astrophysicist with formal academic diction"*).
  2. The user submits a research topic (e.g., *"What were police regulations in Zagreb in 1938?"*).
  3. The system constructs a dual-layer prompt:
     * **System Instruction:** Sets the character's persona prompt, age, cultural worldview, emotional temperament, and required response language (`hr` or `en`).
     * **User Prompt:** The inquiry, with explicit instructions to combine verified web findings with personal reflections, idioms, and character commentary.
  4. The request is dispatched to `gemini-3-flash-preview` with `tools: [{ "google_search": {} }]`.
  5. The model retrieves up-to-date or historical web sources, synthesized directly in the character's voice.
  6. The response and clickable citation sources (`groundingMetadata.groundingAttributions`) are stored in Storia's **Research Notebook**, with one-click insertion into character dialogue.

### 5.2. Dialogue Co-Writer & Script Doctoring
* **Next Beat Brainstorming:**
  Analyzes the preceding 5-10 script blocks and proposes 3 plausible directions for the scene, each drafted as structured dialogue blocks matching the active cast's persona prompts.
* **Vocal Cadence Doctoring:**
  Takes draft text and rewrites it to optimize spoken pacing. Injects stage directions (e.g., `[kratak uzdah / short sigh]`, `[ironično / sardonically]`), trims overly literary run-on sentences into natural spoken audio units, and calculates estimated speech duration based on target WPM.
* **Structured Block Generation:**
  Uses Gemini's JSON schema generation (`responseMimeType: "application/json"`) when bulk drafting scenes, directly parsing the AI output into valid `ScriptBlock[]` entities.

### 5.3. English & Croatian Bilingual Adapter
* Preserves speaker voice consistency across translations. 
* Adapts regional idioms (e.g., English colloquialisms into authentic Croatian counterparts rather than literal machine translation).
* Properly maintains Croatian noun declensions, verbal aspects, and gender agreement based on the speaker's configured `gender` property (`male` vs `female` verb past tenses, e.g., *"rekao sam"* vs *"rekla sam"*).

---

## 6. High-Performance Timeline Visualization & Audio Spatialization

Drawing on high-performance engine architectures, Storia rejects naive, unbuffered DOM rendering for waveform scrubbers and multi-track audio playback in favor of **Data-Oriented Design (DOD)** and **Spatial Partitioning**.

```
+-------------------------------------------------------------------------------------------------+
|                          DATA-ORIENTED TIMELINE & PLAYHEAD SUBSYSTEM                           |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   [ STRUCTURE OF ARRAYS (SoA) PEAK PYRAMIDS ]                                                   |
|   * Float32Array minPeaks: [-0.85, -0.62, -0.40, ...]                                           |
|   * Float32Array maxPeaks: [+0.88, +0.65, +0.42, ...]                                           |
|   * Zero JavaScript heap allocation during timeline zoom/pan                                    |
|             |                                                                                   |
|             v                                                                                   |
|   [ 1D TEMPORAL BVH / INTERVAL TREE ]                                                           |
|   * Hierarchical time-bounding boxes: [startTimeSec, endTimeSec]                                |
|   * Binary search query: findBlockAtTime(currentTime) in O(log N)                               |
|   * Drives millisecond-precise karaoke highlighting without full array iterations               |
|             |                                                                                   |
|             v                                                                                   |
|   [ DECOUPLED CLOCK ACCUMULATOR & LERP ]                                                        |
|   * Hardware Web Audio Clock (Master Time)  -> AudioContext.currentTime                         |
|   * Display Render Loop (requestAnimationFrame) -> 60 / 120 / 144 Hz                            |
|   * State Interpolation (Lerp): Pos_render = Pos_prev * (1 - a) + Pos_curr * a                  |
|   * Zero playhead jitter across high-refresh displays                                           |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

### 6.1. 1D Temporal Bounding Volume Hierarchy (Interval Tree)
In large episodic scripts containing hundreds of dialogue blocks, searching for the active block or word marker on every audio clock tick introduces $O(N)$ overhead.
* Storia constructs a **1D Temporal BVH** over the script blocks whenever the script structure or audio durations change.
* Each node in the tree encapsulates an interval:
  $$I = [t_{\text{start}}, t_{\text{end}}]$$
* Point queries (e.g., `findActiveBlock(audioTime)`) traverse the tree in $O(\log N)$ time, identifying the current block, its associated speaker, and the active SSML mark within microsecond execution budgets.

### 6.2. Decoupled Audio Clock & Display Interpolation
The hardware audio thread runs at a fixed, buffer-aligned rate (e.g., $128\text{ samples} \approx 2.66\text{ ms}$ at $48\text{ kHz}$), while the browser's display refresh rate varies across client hardware ($60\text{ Hz}$, $120\text{ Hz}$ ProMotion, $144\text{ Hz}$).
* **Temporal Aliasing Hazard:** Reading the raw audio context time directly inside a `requestAnimationFrame` loop causes visible playhead stutter because the audio clock advances in discrete packet jumps.
* **Accumulator & Lerp:**
  The Storia timeline scrubber implements fixed-step state interpolation:
  $$\alpha = \frac{\Delta t_{\text{accumulated}}}{\Delta t_{\text{fixed}}}$$
  $$X_{\text{playhead}}(t) = X_{\text{prev}} \cdot (1 - \alpha) + X_{\text{curr}} \cdot \alpha$$
* **On-Demand Rendering (`frameloop="demand"`):**
  When playback is paused and the user is not actively zooming or dragging, the waveform render loop sleeps, dropping GPU and CPU usage to $0\%$.

### 6.3. Waveform Peak Canvas Renderer (DOD Structure)
Waveform slices are stored in flat `Float32Array` buffers (Structure of Arrays) rather than arrays of JavaScript objects:
```typescript
/**
 * Zero-allocation canvas waveform rendering loop for Storia
 */
export function renderWaveformToCanvas(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeakData,
  width: number,
  height: number,
  playheadProgress: number,
  accentColor: string
) {
  ctx.clearRect(0, 0, width, height);
  const midY = height / 2;
  const count = peaks.length;
  const stepX = width / count;

  // Render unplayed background waveform
  ctx.fillStyle = '#475569'; // Slate-600
  for (let i = 0; i < count; i++) {
    const x = i * stepX;
    const minY = midY + peaks.minPeaks[i] * midY;
    const maxY = midY + peaks.maxPeaks[i] * midY;
    ctx.fillRect(x, maxY, Math.max(1, stepX - 0.5), Math.max(1, minY - maxY));
  }

  // Render played progress highlight
  const playedWidth = width * Math.min(1, Math.max(0, playheadProgress));
  ctx.fillStyle = accentColor;
  const playedCount = Math.floor(count * playheadProgress);
  for (let i = 0; i < playedCount; i++) {
    const x = i * stepX;
    const minY = midY + peaks.minPeaks[i] * midY;
    const maxY = midY + peaks.maxPeaks[i] * midY;
    ctx.fillRect(x, maxY, Math.max(1, stepX - 0.5), Math.max(1, minY - maxY));
  }

  // Draw playhead cursor
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(playedWidth - 1, 0, 2, height);
}
```

---

## 7. State Architecture & The Command Pattern (Undo / Redo)

To guarantee scalability and studio-grade stability, Storia segregrates state into two operational layers:

```
+-------------------------------------------------------------------------------------------------+
|                                DUAL-TIER STATE & COMMAND SYSTEM                                 |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   [ STRUCTURAL STATE (Zustand) ]                 [ TRANSIENT STATE (Refs & Canvas) ]            |
|   * Script blocks & ordering                     * Current playhead audio position              |
|   * Cast & speaker definitions                   * Live VU meter levels & compression gain      |
|   * Project metadata & master config             * Active hover/scrub offsets                   |
|   * Low-frequency user edits                     * 60 - 144 Hz frame mutations                  |
|             |                                                                                   |
|             v                                                                                   |
|   [ COMMAND HISTORY STACK ]                                                                     |
|   * Executes mutations via Command objects:                                                     |
|       - AddBlockCommand                                                                         |
|       - DeleteBlockCommand                                                                      |
|       - ReorderBlocksCommand                                                                    |
|       - UpdateVoiceConfigCommand                                                                |
|   * Immutable JSON serialization for crash recovery & session restore                           |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

### 7.1. Command Pattern Interface

```typescript
export interface Command {
  id: string;
  description: string;
  execute(): void;
  undo(): void;
  toJSON(): Record<string, unknown>;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxDepth: number = 100;

  executeCommand(command: Command) {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo chain on new mutation
  }

  undo() {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo() {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
```

---

## 8. Real-Time Audio DSP & Playback Architecture

When generated audio from Gemini TTS is previewed or mastered, it passes through Storia's Web Audio processing pipeline:

```
+-------------------------------------------------------------------------------------------------+
|                            STORIA: CLIENT-SIDE WEB AUDIO ARCHITECTURE                          |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   [ DECODED TTS BUFFER ]                                                                        |
|             |                                                                                   |
|             v                                                                                   |
|   [ SPEAKER DSP CHAIN ]                                                                         |
|     * Biquad Low-Shelf EQ (120 Hz)       -> Body & Warmth compensation                          |
|     * Biquad Mid-Peak EQ (2.5 kHz)       -> Vocal clarity & Intelligibility                     |
|     * Biquad High-Shelf EQ (8.0 kHz)     -> Air & Sibilance control                             |
|     * Dynamic Range Compressor           -> -20 dB threshold, 2.5:1 ratio, smooth speech level  |
|             |                                                                                   |
|             v                                                                                   |
|   [ MASTER SUMMING BUS ]                                                                        |
|     * Lookahead Brickwall Limiter        -> -1.0 dBFS True Peak ceiling                         |
|     * Loudness Metering                  -> ITU-R BS.1770-4 (-16.0 LUFS target)                 |
|             |                                                                                   |
|             v                                                                                   |
|   [ EXPORT / PLAYBACK WORKLET ]                                                                 |
|     * SPSC Lock-free Ring Buffer         -> Zero main-thread blocking                           |
|     * TPDF Dither Stage                  -> Quantization noise decorrelation (16/24-bit)        |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

### 8.1. Biquad Equalization & Dynamic Range Control
Each speaker's rendered voice is shaped by a dedicated client-side audio node chain using Robert Bristow-Johnson (RBJ) Biquad filter implementations:
1. **Low-Shelf Filter ($120\text{ Hz}$):** Attenuates unwanted chest boom or boosts warmth.
2. **Peaking Filter ($2.5\text{ kHz}$):** Accentuates vocal format frequencies to preserve speech intelligibility across diverse playback devices.
3. **High-Shelf Filter ($8.0\text{ kHz}$):** Smooths high-frequency hiss or adds gentle top-end clarity.
4. **Dynamics Compression:** Smooths dynamic peaks from energetic lines, keeping the dialogue legible without operator intervention.

### 8.2. Lock-Free AudioWorklet Playback & Denormal Prevention
* **Real-Time Thread Safety:** Playback executes on a dedicated `AudioWorkletProcessor` thread. Communication between the React UI and the audio callback utilizes `SharedArrayBuffer` with `Atomics` for index tracking in a Single-Producer Single-Consumer (SPSC) ring buffer.
* **Denormal Number Protection:** To avoid CPU throttling spikes when audio signals decay exponentially into silence, processing loops add an inaudible offset ($10^{-25}$) or enable hardware Flush-to-Zero (FTZ) flags.

---

## 9. Storage, Security & BYOK Architecture

### 9.1. API Key Security & Client Privacy
* **Bring Your Own Key (BYOK):** The user enters their Google Gemini API key via Storia's settings drawer.
* **Storage Model:** The key is stored in browser `localStorage` or session memory, never transmitted to an intermediary backend server. All API calls execute directly from the browser to `https://generativelanguage.googleapis.com`.
* **Zero Script Telemetry:** Audio drama manuscripts, persona prompts, and audio clips reside exclusively on the client machine.

### 9.2. IndexedDB Audio Cache
* Audio blobs generated by Gemini TTS are keyed by `blockId + hash(text + speakerVoiceConfig + directorNotes)`.
* When a user replays a scene, cached audio plays instantaneously without redundant network roundtrips or extra token charges.
* Changes to dialogue or acting notes automatically invalidate the specific block's cache, prompting a visual "Re-render Audio" indicator.

---

## 10. User Interface & Layout Specification

```
+--------------------------------------------------------------------------------------------------------------------------------------+
| [Storia] Ep 1: "Magla nad Zagrebom" [v] | EN/HR [v] | Undo [Z] Redo [Y] | [API Key: OK] | [Gen All Audio (1.2k tok)] | [Export Master] |
+--------------------------------------------------------------------------------------------------------------------------------------+
| CAST & SPEAKERS (240px)     | SCRIPT WORKBENCH & TIMELINE (Fluid)                            | AI AGENT & RESEARCH DOCK (340px)      |
|                             |                                                                |                                       |
| [+ New Speaker]             | [ > Play All ] [ || ] [ Loop ] [ + Line ]  [Frameloop: Demand] | [Tabs: Persona POV | Co-writer | TTS] |
|                             | -------------------------------------------------------------- | ------------------------------------- |
| * Marko (Male, 40s)         | [ 1 ] Marko [šapatom / whispered] [TTS: OK]                    | Mode: Persona Research                |
|   - Voice: Fenrir           |   "Ugasi svjetlo. Netko nas promatra s onog                    | Speaker: Marko                        |
|   - Style: Cynical noir     |    tavana prekoputa."                                          | ------------------------------------- |
|   - 12 lines (420 tokens)   |   [ ||||||||||||||||||||||||| ] [▶ 00:03.2 / 00:03.2]          | Query:                                |
|                             |                                                                | "Kakve je pištolje koristila zagreba- |
| * Ana (Female, 28)          | [ 2 ] Ana [nervozno / anxious] [TTS: Stale]                    |  čka policija 1938. godine?"          |
|   - Voice: Kore             |   "To su samo sjene, Marko. Gledaš previše                     |                                       |
|   - Style: High tension     |    američkih filmova."                                         | [ Research via Google Search Ground ] |
|   - 9 lines (310 tokens)    |   [ ························· ] [▶ Render Line (28 tok)]       | ------------------------------------- |
|                             |                                                                | In-Character Response:                |
| * Narrator (Neutral)        | [ 3 ] Narrator [smireno / composed]                            | "Službeni pištolji? Krajem tridesetih |
|   - Voice: Zephyr           |   Magla je postajala sve gušća, gutajući zvuke                 |  redarstvo je nosilo FN M1922...      |
|   - Style: Deep documentary |   posljednjeg noćnog tramvaja.                                 |  teški, pouzdani, kalibar 9mm kratki."|
| --------------------------- | -------------------------------------------------------------- | Citations:                            |
| Total Est: 04:15            | [ + Dialogue ] [ + Narration ] [ + SFX ]                       | [1] Hrvatski povijesni muzej (hpm.hr) |
| Audio Tokens: 6,375 ($0.06) | -------------------------------------------------------------- | ------------------------------------- |
| LUFS: -16.0 (Broadcast OK)  | Waveform: Canvas 2D SoA | 1D BVH Active: Block #1 (t=01.4s)     | [ Insert as Dialogue Line ]           |
+--------------------------------------------------------------------------------------------------------------------------------------+
```

---

## 11. Technology Stack

| Layer | Choice | Technical Justification |
| :--- | :--- | :--- |
| **Name & Identity** | **Storia** | Elegant, culturally resonant name meaning *story/history* in Croatian and Romance dialects. |
| **Framework** | **React 19 (Single-bundle architecture)** | Efficient reactive state updates for long scripts, audio events, and dynamic modals. |
| **Styling** | **Tailwind CSS** | Studio dark mode palette, responsive drawers, sliders, and audio metering bars. |
| **TTS Engine** | **Gemini 2.5 Flash TTS (`gemini-2.5-flash-preview-tts`)** | Multimodal native speech synthesis, style prompts, SSML mark callbacks, and director notes. |
| **AI Intelligence** | **Gemini 3 Flash (`gemini-3-flash-preview`)** | Contextual persona-grounded research, Google Search grounding, co-writing, and cadence doctoring. |
| **Visualization** | **Data-Oriented Canvas 2D + Peak SoA** | Zero garbage-collection overhead during continuous waveform playback and timeline zooming. |
| **Indexing** | **1D Temporal BVH (Interval Tree)** | $O(\log N)$ playhead-to-block lookups, enabling word-accurate script karaoke synchronization. |
| **History** | **Command Pattern Architecture** | Undo/redo stack for block edits, speaker reassignments, and script mutations. |
| **Audio Core** | **Web Audio API (`AudioContext` + `AudioWorklet`)** | Off-main-thread audio playback, lookahead scheduling, biquad filter nodes, and live metering. |
| **Concurrency** | **`SharedArrayBuffer` + `Atomics` (SPSC FreeQueue)** | Glitch-free audio transport between background worker and audio thread. |
| **DSP / Math** | **Biquad Filters + TPDF Dither module** | RBJ cookbook equalization, sibilance control, and studio 16/24-bit export. |
| **State & Storage** | **Zustand + IndexedDB (`idb-keyval`) + LocalStorage** | Complete offline autonomy; persistent script blocks and cached audio PCM blobs. |
| **Localization** | **Zero-dependency bilingual dictionary** | Instant runtime switching between English and Croatian. |
| **Icons** | **Lucide-react** | Clean iconography for audio transport, speakers, microphone, and AI tools. |

---

## 12. Implementation Roadmap

1. **Phase 1: Project Workbench, Persistence & Bilingual Foundation**
   - Implement Zustand project store with local storage synchronization.
   - Author English and Croatian UI localization modules.
   - Build block-based script editor with drag-and-drop, hotkeys, and pacing calculators.
   - Implement the Command pattern history manager for full undo/redo.
2. **Phase 2: Gemini TTS Synthesis Suite (`gemini-2.5-flash-preview-tts`)**
   - Integrate API client for speech synthesis with user API key authentication.
   - Build speaker voice selector (`Puck`, `Charon`, `Kore`, `Fenrir`, etc.) with style prompts and pitch/rate controls.
   - Implement director notes extractor (`[...]` parsing) and SSML `<mark>` timepoint tracking.
   - Create IndexedDB audio cache for instant re-auditioning.
3. **Phase 3: Data-Oriented Waveform Visualization & Timeline Sync**
   - Generate Structure-of-Arrays (SoA) min/max/RMS peak buffers upon TTS decoding.
   - Build high-performance Canvas 2D waveform renderer with on-demand render loop (`frameloop="demand"`).
   - Implement 1D Temporal BVH for sub-millisecond block/word lookups during scrubbing.
   - Decouple audio hardware clock from render loop using fixed timestep state interpolation (Lerp).
4. **Phase 4: Storia Persona Research & Co-Writing Agent (`gemini-3-flash-preview`)**
   - Connect research agent with Google Search grounding tool.
   - Implement Persona POV query generation and citation rendering.
   - Add Dialogue Doctor and bilingual English-to-Croatian cultural adapter.
5. **Phase 5: Real-Time Audio DSP & Master Chain**
   - Connect Web Audio API chain with speaker-specific Biquad EQs (low-shelf, mid-peak, high-shelf).
   - Implement real-time dynamics compressor and ITU-R BS.1770-4 loudness meter.
   - Set up sequential block player with seamless multi-speaker transitions.
6. **Phase 6: Studio Export & Mastering**
   - Script export in Fountain, Markdown, and JSON schemas.
   - Multi-track and mastered WAV audio export with selectable sample rates ($44.1\text{ kHz}$ / $48\text{ kHz}$) and TPDF dithering.