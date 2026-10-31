# Phase 6: Studio Export & Broadcast Mastering

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Sections 3, 8, 10, 12 of [Design Document](../narration_podcast_editor_design_document.md)*  
*Prerequisite: [Phase 5 Validation Gate Passed](./phase_5_realtime_dsp_and_master_chain.md)*

---

## 1. Phase Overview & Objectives

Phase 6 completes **Storia** by delivering broadcast-grade offline audio mastering and multi-format manuscript/project export capabilities:
1. **Offline Broadcast Audio Mastering (`OfflineAudioContext`):**
   - Renders the complete episode mix (or individual per-speaker stems) at $44.1\text{ kHz}$ or $48.0\text{ kHz}$ through each speaker's Biquad EQ and dynamics chain.
   - Normalizes integrated loudness to the user's configured target (default $-16.0\text{ LUFS}$ for podcasts/narration) with a brickwall True Peak ceiling at $-1.0\text{ dBFS}$.
2. **Triangular PDF (TPDF) Dithering & Multi-Bit-Depth WAV Encoding:**
   - Applies mathematically decorrelated TPDF dither ($r_1 - r_2$) when quantizing $32\text{-bit}$ float master buffers down to $16\text{-bit}$ or $24\text{-bit}$ integer PCM, eliminating nonlinear quantization distortion During quiet vocal tails.
3. **Manuscript & Project Archival Exporters:**
   - Exports formatted industry screenplays in **Fountain (`.fountain`)**, production scripts in **Markdown (`.md`)** with embedded duration/token tables, and lossless **Storia Project Bundles (`.storia.json`)** with full import/restore support.

### Deliverables
- TPDF Dither generator, Loudness Normalizer, and multi-bit-depth ($16/24/32\text{-bit}$, $44.1/48\text{ kHz}$) RIFF/WAVE encoder (`src/core/dsp/TpdfDither.ts`).
- Offline episode mix and per-speaker stem renderer (`src/services/masterExportService.ts`).
- Fountain (`.fountain`), Markdown (`.md`), and Project JSON (`.storia.json`) exporter/importer (`src/services/scriptExportService.ts`).
- Studio Mastering & Export Modal (`src/components/modals/ExportMasterModal.tsx`).

---

## 2. Step-by-Step Implementation Tasks

### Step 6.1: TPDF Dither & Multi-Bit-Depth RIFF/WAV Encoder (`src/core/dsp/TpdfDither.ts`)
1. Implement `applyTpdfDitherSample(sampleFloat32: number, targetBitDepth: 16 | 24): number`:
   - Generates two independent uniform random values $r_1, r_2 \in [-0.5, +0.5]$ using a fast, seedable PRNG (xorshift128+) for deterministic testability.
   - Computes triangular noise $\nu = (r_1 - r_2)$ with peak-to-peak amplitude of $2\text{ LSB}$ at the target quantization step $\Delta = \frac{1}{2^{\text{bitDepth} - 1}}$.
2. Implement `encodeMasterWavBuffer(samples: Float32Array, config: AudioMasteringConfig): ArrayBuffer`:
   - Supports `sampleRate`: `44100 | 48000` (with linear/sinc resampling when converting from $48\text{ kHz}$ source to $44.1\text{ kHz}$).
   - Supports `bitDepth`:
     - `16`: Format tag `1` (`WAVE_FORMAT_PCM`), 2 bytes/sample (`Int16` little-endian), optional TPDF dither.
     - `24`: Format tag `1` (`WAVE_FORMAT_PCM`), packed 3 bytes/sample (`Int24` little-endian), optional TPDF dither.
     - `32`: Format tag `3` (`WAVE_FORMAT_IEEE_FLOAT`), 4 bytes/sample (`Float32` little-endian).

### Step 6.2: Offline Episode Mastering & Stem Renderer (`src/services/masterExportService.ts`)
1. Implement `renderMasterEpisodeMix(project: Project, onProgress?: (pct: number) => void)`:
   - Concatenates and processes each block's audio buffer through its speaker's 3-band Biquad EQ + Compressor and appends exact `pauseAfterMs` silence intervals.
   - Measures integrated loudness via `LoudnessMeter` (ITU-R BS.1770-4) and applies makeup gain so integrated loudness equals `project.audioConfig.targetLufs` ($-16.0\text{ LUFS}$).
   - Applies soft-knee lookahead brickwall limiting at `project.audioConfig.truePeakLimitDb` ($-1.0\text{ dBFS}$).
   - Encodes the final `Blob` (`audio/wav`) via `encodeMasterWavBuffer`.
2. Implement `renderSpeakerStems(project: Project)`:
   - Generates individual time-aligned WAV stem files per speaker (with silence padded during other speakers' lines so all stems align at $t = 0.0\text{ s}$ when imported into an external DAW like Reaper, Pro Tools, or Audition).

### Step 6.3: Fountain, Markdown & Project Archive Exporters (`src/services/scriptExportService.ts`)
1. Implement `exportToFountain(project: Project): string`:
   - Generates standard Fountain screenplay syntax (`Title:`, `Author:`, uppercase `SPEAKER` headers, parenthetical `(directorNotes)`, dialogue text, and centered narration/SFX cues).
2. Implement `exportToMarkdown(project: Project): string`:
   - Produces a clean production manuscript including cast table, total duration, audio token budget table, and block-by-block script with timestamps (`[00:03.2]`) and research notebook appendix.
3. Implement `exportProjectJson(project: Project): string` and `importProjectJson(jsonStr: string): Project`:
   - Validates schema integrity and imports projects into `useStoriaStore`.

### Step 6.4: Studio Export & Mastering Modal (`src/components/modals/ExportMasterModal.tsx`)
1. Connect `[Export Master]` in `TopBar.tsx` to `ExportMasterModal.tsx`:
   - **Audio Mastering Tab:**
     - Sample Rate selector: `48.0 kHz (Broadcast / Video)` vs `44.1 kHz (CD / Podcast Distribution)`.
     - Bit Depth selector: `16-bit PCM`, `24-bit PCM (Studio Standard)`, `32-bit IEEE Float`.
     - Dithering toggle: `TPDF (Triangular PDF)` vs `None (Truncate)`.
     - Loudness Target slider: `-16.0 LUFS (Podcast Standard)` / `-14.0 LUFS` / `-18.0 LUFS` and True Peak Ceiling (`-1.0 dBFS`).
     - Export buttons: `[Download Mastered WAV]` and `[Download Multi-Track Speaker Stems]`.
   - **Script & Project Archive Tab:**
     - One-click downloads for `.fountain`, `.md`, and `.storia.json`, plus `[Import .storia.json]` file dropzone.

---

## 3. Validation Gate 6 (Final Release Gate)

### 3.1. Automated Unit & Mastering Verification Tests (`tests/phase6/`)
Run via `npx vitest run tests/phase6` (and full suite `npm test`):
- **`tpdfAndWavEncoder.test.ts`**:
  - Generates 50,000 TPDF dither samples and verifies sample mean $\mu \approx 0.0$ ($|\mu| < 0.01\text{ LSB}$) and triangular variance $\sigma^2 \approx \frac{1}{6}\text{ LSB}^2$.
  - Verifies `encodeMasterWavBuffer` produces exact RIFF headers and byte lengths for:
    - $48\text{ kHz}$, $16\text{-bit}$ (`byteRate = 96000`, `blockAlign = 2`, format `1`)
    - $48\text{ kHz}$, $24\text{-bit}$ (`byteRate = 144000`, `blockAlign = 3`, format `1`)
    - $44.1\text{ kHz}$, $32\text{-bit}$ float (`byteRate = 176400`, `blockAlign = 4`, format `3`)
- **`masterNormalization.test.ts`**:
  - Normalizes a test episode buffer to $-16.0\text{ LUFS}$ with a $-1.0\text{ dBFS}$ ceiling; verifies resulting buffer never exceeds $10^{-1.0/20} \approx 0.89125$ linear peak and measures $-16.0 \pm 0.2\text{ LUFS}$.
- **`scriptExport.test.ts`**:
  - Verifies `exportToFountain` outputs valid Fountain headers, character cues, parentheticals, and dialogue.
  - Verifies `exportProjectJson` -> `importProjectJson` round-trip preserves 100% of project metadata, speakers, blocks, and research notebook records.

### 3.2. Interactive Studio Verification Checklist (End-to-End Acceptance)
- [ ] Click `[Export Master]` in `TopBar` to open `ExportMasterModal`.
- [ ] Select `48.0 kHz`, `24-bit PCM`, `TPDF Dither`, and `-16.0 LUFS`, then click `[Download Mastered WAV]` — verify the `.wav` file downloads and plays cleanly in an external media player.
- [ ] Click `[Download Multi-Track Speaker Stems]` — verify each speaker's stem WAV has identical total duration and sample alignment.
- [ ] Export `.fountain`, `.md`, and `.storia.json` files from the Script & Project Archive tab, then re-import the `.storia.json` bundle and verify full project restoration.

### 3.3. Final Release Sign-Off
Storia v1.0 is ready for release when:
1. `npm run typecheck` passes with 0 errors.
2. `npm test` executes all 6 phase test suites (`tests/phase1` through `tests/phase6`) with 100% pass rate.
3. `npm run build` produces a clean production bundle with zero warnings.

