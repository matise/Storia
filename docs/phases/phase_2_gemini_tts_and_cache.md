# Phase 2: Gemini 2.5 Flash TTS Synthesis Suite & IndexedDB Audio Cache

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Sections 4, 9 of [Design Document](../narration_podcast_editor_design_document.md)*  
*Prerequisite: [Phase 1 Validation Gate Passed](./phase_1_workbench_and_foundation.md)*

---

## 1. Phase Overview & Objectives

Phase 2 connects Storia's script blocks and speaker profiles to the **Gemini 2.5 Flash TTS** synthesis pipeline (`gemini-2.5-flash-preview-tts`). It implements Bring-Your-Own-Key (BYOK) local storage security, invisible acoustic system directives, director's notes (didaskalije) parsing, SSML `<mark>` and `<break>` injection, Structure-of-Arrays (SoA) `WaveformPeakData` extraction ($100\text{ peaks/sec}$), and a content-addressed IndexedDB audio cache that prevents redundant synthesis calls and tracks `[TTS: OK]` vs `[TTS: Stale]` states.

To allow full offline development and quota-free testing, Phase 2 also includes a deterministic **Procedural Studio Synthesizer Fallback** that generates formants, speech-cadence envelopes, and exact SSML timepoints when no live API key is configured or when offline test mode is enabled.

### Deliverables
- BYOK API Key Manager (`src/core/storage/keyVault.ts`) and `ApiKeyModal.tsx`.
- Director's notes parser, multi-speaker prosodic context builder, and SSML generator (`src/services/geminiTtsService.ts`).
- `synthesizeGeminiAudioWithPeaks` client with RIFF/WAV header framing and `Float32Array` SoA peak downsampling (`minPeaks`, `maxPeaks`, `rmsLevels`).
- Deterministic procedural PCM speech-envelope synthesizer for offline/CI validation.
- Content-hash IndexedDB cache (`src/core/storage/audioCache.ts`) using `idb-keyval` and Web Crypto `SHA-256`.

---

## 2. Step-by-Step Implementation Tasks

### Step 2.1: BYOK Security Vault & Settings Modal (`src/core/storage/keyVault.ts`, `src/components/modals/ApiKeyModal.tsx`)
1. Implement `keyVault.ts`:
   - Store and retrieve the user's Gemini API key in `localStorage` (with optional Web Crypto AES-GCM session wrapping).
   - Provide `hasValidApiKey()`, `getApiKey()`, `setApiKey(key)`, `clearApiKey()`, and a toggle for `useProceduralFallback` (when testing offline).
2. Build `ApiKeyModal.tsx`:
   - Masked password input for the Gemini API key with direct client-side test ping.
   - Model configuration selectors (`gemini-2.5-flash-preview-tts`, `gemini-3-flash-preview`, temperature, audio output format `pcm_48khz`).

### Step 2.2: Invisible Input Vectors, Didaskalije Parser & SSML Builder (`src/services/geminiTtsService.ts`)
1. Implement `buildAcousticDirective({ block, speaker, language, precedingBlocks })`:
   - Combines target language (`Croatian` / `English`), speaker demographics (`name`, `age`, `gender`), `personaPrompt`, `actingNotes`, and `voice.stylePrompt`.
   - Includes **Multi-Speaker Conversational Handoff** context (Section 4.3): injects the last 1–2 preceding lines so Speaker B responds naturally to Speaker A's emotional cadence.
   - Extracts block-level `directorNotes` and inline bracketed cues (`[šapatom / whispered]`, `[kratak uzdah / short sigh]`, `[ironično / sarcastic]`) into explicit acoustic directives.
2. Implement `buildSsmlPayload(block: ScriptBlock, speaker: Speaker)`:
   - Wraps text in `<speak><prosody rate="${speaker.voice.speakingRate}" pitch="${speaker.voice.pitchAdjustment}st">...</prosody></speak>`.
   - Tokenizes sentences/clauses and injects `<mark name="blk_${block.id}_w_${idx}"/>` synchronization markers plus `<mark name="start_${block.id}"/>` and `<mark name="end_${block.id}"/>`.
   - Appends `<break time="${block.pauseAfterMs}ms"/>` when `pauseAfterMs > 0`.

### Step 2.3: Gemini 2.5 Flash TTS Client & SoA Peak Extractor
1. Implement `extractWaveformPeaksFromPcm(int16Samples: Int16Array, sampleRate = 48000, peaksPerSecond = 100): WaveformPeakData`:
   - Computes `blockSize = Math.floor(sampleRate / peaksPerSecond)` ($480\text{ samples/slice}$ at $48\text{ kHz}$).
   - Allocates flat `Float32Array` buffers: `minPeaks`, `maxPeaks`, and `rmsLevels`.
   - Single-pass loop normalizing `int16Samples[s] / 32768.0` into $[-1.0, 1.0]$ and computing per-slice min, max, and $\text{RMS} = \sqrt{\frac{1}{N}\sum x_s^2}$.
2. Implement `encodePcm16ToWavBlob(pcmBytes: Uint8Array, sampleRate = 48000, numChannels = 1): Blob`:
   - Prepends a standard 44-byte RIFF/WAVE header (`RIFF`, `WAVE`, `fmt `, `data`) to raw `LINEAR16` PCM bytes so the browser's `AudioContext.decodeAudioData` and `<audio>` elements can decode it natively.
3. Implement `synthesizeGeminiAudioWithPeaks` (Section 4.5):
   - Sends `POST` to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:synthesizeSpeech?key=${apiKey}`.
   - Falls back cleanly to the procedural studio synthesizer when in offline/mock mode or when the user enables test synthesis.
   - Returns `{ audioBlob, timepoints, tokensUsed, waveformPeaks, durationSec }`.

### Step 2.4: Content-Addressed IndexedDB Cache (`src/core/storage/audioCache.ts`)
1. Implement `computeBlockCacheKey(block: ScriptBlock, speaker?: Speaker, language?: SupportedLanguage): Promise<string>`:
   - Computes SHA-256 hex digest of `JSON.stringify({ text: block.text, directorNotes: block.directorNotes, pauseAfterMs: block.pauseAfterMs, voice: speaker?.voice, persona: speaker?.personaPrompt, language })`.
   - Returns key `storia_tts_${block.id}_${hash.slice(0, 16)}`.
2. Store and retrieve `{ audioBlob, waveformPeaks, timepoints, durationSec, tokensUsed, cacheKey }` in IndexedDB via `idb-keyval`.
3. Serialize `Float32Array` peak buffers cleanly in IndexedDB and rehydrate them on project load.
4. Expose block synthesis status selector:
   - `'unrendered'`: No audio generated yet.
   - `'ok'`: Cached `cacheKey` matches current block & speaker hash (`[TTS: OK]`).
   - `'stale'`: Block text, director notes, or speaker voice modified since last synthesis (`[TTS: Stale]`).
   - `'rendering'`: Synthesis request in flight.

### Step 2.5: Workbench TTS Controls & Batch Synthesis
1. Update `ScriptBlockCard.tsx` with `[▶ Render Line (XX tok)]` button, `[TTS: OK]` / `[TTS: Stale]` status badges, and single-block audition playback.
2. Update `TopBar.tsx` `[Gen All Audio (X.Xk tok)]` button to sequentially or concurrently synthesize all `'unrendered'` and `'stale'` blocks with a live progress bar, skipping `'ok'` blocks already cached in IndexedDB.

---

## 3. Validation Gate 2 (Phase 2 -> Phase 3)

### 3.1. Automated Unit & Integration Tests (`tests/phase2/`)
Run via `npx vitest run tests/phase2`:
- **`ssmlAndDirectives.test.ts`**:
  - Verifies `buildAcousticDirective` includes Croatian/English language tags, speaker persona, acting notes, preceding dialogue context, and extracted `[...]` didaskalije.
  - Verifies `buildSsmlPayload` injects `<prosody>`, `<mark name="start_..."/>`, word/clause `<mark>` tags, and `<break time="...ms"/>`.
- **`peakExtraction.test.ts`**:
  - Feeds a synthetic $48\text{ kHz}$ full-scale sine wave (`Int16Array` with amplitude $\pm 32767$) into `extractWaveformPeaksFromPcm`: verifies `length === 100` for $1.0\text{ s}$ of audio, `maxPeaks[i] ≈ +1.0`, `minPeaks[i] ≈ -1.0`, and `rmsLevels[i] ≈ 0.7071` ($\frac{1}{\sqrt{2}}$).
  - Verifies `encodePcm16ToWavBlob` writes valid ASCII `'RIFF'` at offset 0, `'WAVE'` at offset 8, sample rate `48000` at offset 24, and exact payload length at offset 40.
- **`audioCache.test.ts`**:
  - Verifies identical block + speaker inputs produce identical SHA-256 cache keys (`status === 'ok'`).
  - Verifies mutating `block.text`, `block.directorNotes`, or `speaker.voice.speakingRate` changes the hash and immediately flags the block as `'stale'`.

### 3.2. Interactive Studio Verification Checklist
- [ ] Open `ApiKeyModal` from `TopBar`, configure either a live Gemini API key or enable Studio Procedural Synth mode, and verify `[API Key: OK]` indicator in `TopBar`.
- [ ] Click `[▶ Render Line]` on Block #1 (*Marko*); verify status badge changes to `[TTS: OK]`, exact audio duration replaces the WPM estimate, and audio plays audibly.
- [ ] Click `[Gen All Audio]` in `TopBar`; verify only unrendered/stale blocks are synthesized.
- [ ] Edit one word in Block #1; verify its badge immediately flips from `[TTS: OK]` to `[TTS: Stale]`.
- [ ] Press `Ctrl+Z` (Undo) to revert the text edit; verify the hash matches the cached IndexedDB entry again and the badge flips back to `[TTS: OK]` without re-synthesizing.

### 3.3. Exit Criteria
Phase 2 is marked **COMPLETE** only when `npm run typecheck` and `npx vitest run tests/phase1 tests/phase2` pass with 0 failures and all 5 interactive studio checks succeed.

