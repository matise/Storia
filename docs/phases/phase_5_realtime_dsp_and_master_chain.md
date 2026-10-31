# Phase 5: Real-Time Web Audio DSP, Biquad EQ & Master Chain

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Section 8 of [Design Document](../narration_podcast_editor_design_document.md)*  
*Prerequisite: [Phase 4 Validation Gate Passed](./phase_4_persona_research_and_cowriter.md)*

---

## 1. Phase Overview & Objectives

Phase 5 implements Storia's studio-grade real-time digital signal processing (DSP) and multi-speaker playback engine using the Web Audio API and `AudioWorklet`. Every speaker's voice is routed through a dedicated acoustic conditioning chain before summing into the master broadcast bus:
1. **Per-Speaker RBJ Biquad EQ & Dynamics Chain:**
   - **Low-Shelf Filter ($120\text{ Hz}$):** Proximity / warmth compensation (`lowShelfGainDb`).
   - **Peaking Filter ($2.5\text{ kHz}$):** Dialogue clarity and vocal formant intelligibility (`midPeakGainDb`).
   - **High-Shelf Filter ($8.0\text{ kHz}$):** Air and sibilance control (`highShelfGainDb`).
   - **Dynamics Compressor:** Smooths energetic vocal peaks (`thresholdDb: -20`, `ratio: 2.5:1`, `attackMs: 15`, `releaseMs: 100`).
2. **Master Broadcast Bus & ITU-R BS.1770-4 Loudness Metering:**
   - Lookahead brickwall True Peak limiter ($-1.0\text{ dBFS}$ ceiling).
   - K-weighted Momentary and Integrated Loudness metering targeting $-16.0\text{ LUFS}$.
3. **Lock-Free SPSC `AudioWorklet` & Denormal Protection:**
   - Single-Producer Single-Consumer (`RingBufferSPSC`) transport using `SharedArrayBuffer` and `Atomics` with $+10^{-25}$ DC offset injection to prevent CPU denormal spikes during silent pauses.

### Deliverables
- Per-speaker RBJ Biquad coefficient calculator and Web Audio node graph (`src/core/dsp/BiquadChain.ts`).
- ITU-R BS.1770-4 K-weighted LUFS and True Peak analyzer (`src/core/dsp/LoudnessMeter.ts`).
- Lock-free SPSC Ring Buffer (`src/core/dsp/RingBufferSPSC.ts`) and `public/worklets/spsc-playback-processor.js` with denormal protection.
- Multi-speaker sequential lookahead scheduler (`src/core/dsp/StudioTransportEngine.ts`) and live VU/LUFS meter visualization in `CastSidebar.tsx` and `SpeakerConfigModal.tsx`.

---

## 2. Step-by-Step Implementation Tasks

### Step 5.1: Robert Bristow-Johnson (RBJ) Biquad Filter Math & Speaker DSP Chain (`src/core/dsp/BiquadChain.ts`)
1. Implement pure RBJ Audio EQ Cookbook coefficient calculators (used for both offline unit verification and custom worklet/offline processing) alongside native `BiquadFilterNode` wiring:
   - `computeLowShelfCoeffs(fc = 120, gainDb, sampleRate = 48000, S = 1.0)`
   - `computePeakingCoeffs(fc = 2500, gainDb, Q = 1.0, sampleRate = 48000)`
   - `computeHighShelfCoeffs(fc = 8000, gainDb, sampleRate = 48000, S = 1.0)`
2. Implement `SpeakerDspChain`:
   - Instantiates `lowShelfNode` ($120\text{ Hz}$), `midPeakNode` ($2500\text{ Hz}$), `highShelfNode` ($8000\text{ Hz}$), and `DynamicsCompressorNode`.
   - Provides glitch-free parameter ramping via `AudioParam.setTargetAtTime(val, currentTime, 0.015)` when the user drags EQ or compression sliders during live playback.
   - Connects speaker edits via `UpdateVoiceConfigCommand` so DSP changes support full Undo/Redo.

### Step 5.2: ITU-R BS.1770-4 Loudness & True Peak Meter (`src/core/dsp/LoudnessMeter.ts`)
1. Implement the two-stage **K-Weighting filter** defined by ITU-R BS.1770-4:
   - **Stage 1 (Pre-filter / Acoustic head model):** High-shelf filter at $f_c = 1681.97\text{ Hz}$, $+3.9998\text{ dB}$.
   - **Stage 2 (RLB high-pass filter):** High-pass filter at $f_c = 38.135\text{ Hz}$, $Q = 0.5003$.
2. Compute mean-square energy over $400\text{ ms}$ momentary windows and gated integrated blocks:
   $$\text{LUFS} = -0.691 + 10 \log_{10}\left(\sum_{i} G_i \cdot z_i\right)$$
3. Compute sample peak and $4\times$ oversampled True Peak in $\text{dBFS}$ ($20 \log_{10}(\max |x|)$), driving the live status readout in `CastSidebar.tsx` (`LUFS: -16.0 (Broadcast OK)`).

### Step 5.3: Lock-Free SPSC Ring Buffer & AudioWorklet (`src/core/dsp/RingBufferSPSC.ts`, `public/worklets/spsc-playback-processor.js`)
1. Implement `RingBufferSPSC`:
   - Backed by `SharedArrayBuffer` (with `Int32Array` atomic `readIdx` / `writeIdx` header and `Float32Array` audio storage) plus automatic fallback to standard `ArrayBuffer` message-port transfer if `SharedArrayBuffer` is restricted by the host environment.
   - Lock-free `push(samples: Float32Array): number` and `pop(out: Float32Array): number` using `Atomics.load` and `Atomics.store`.
2. Implement `spsc-playback-processor.js` (`AudioWorkletProcessor`):
   - Pulls 128-sample frames from the SPSC ring buffer on the real-time audio thread.
   - Adds the anti-denormal offset (`const DENORMAL_OFFSET = 1e-25`) to every sample in the inner loop to guarantee hardware Flush-to-Zero stability during exponential filter decay.

### Step 5.4: Multi-Speaker Sequential Lookahead Transport (`src/core/dsp/StudioTransportEngine.ts`)
1. Implement lookahead scheduling across `project.blocks`:
   - Pre-schedules upcoming blocks $150\text{ ms}$ ahead of the playhead so speaker-to-speaker transitions and `pauseAfterMs` theatrical silences occur with sample-accurate timing.
   - Routes each block's decoded `AudioBuffer` through its assigned speaker's `SpeakerDspChain` into the Master Summing Bus (Lookahead Brickwall Limiter capped at $-1.0\text{ dBFS}$ + `LoudnessMeter`).
2. Wire `[> Play All]`, `[||]` (Pause), and `[Loop]` buttons in `ScriptWorkbench.tsx`, synchronized with Phase 3's `ClockInterpolator` and `TemporalBVH`.

---

## 3. Validation Gate 5 (Phase 5 -> Phase 6)

### 3.1. Automated Unit & DSP Math Tests (`tests/phase5/`)
Run via `npx vitest run tests/phase5`:
- **`biquadChain.test.ts`**:
  - Verifies RBJ Biquad filter coefficients at $0\text{ dB}$ gain produce an exact unity passthrough transfer function ($b_0/a_0 = 1, b_1 = a_1, b_2 = a_2$).
  - Verifies $+6\text{ dB}$ peaking filter at $2.5\text{ kHz}$ amplifies a $2.5\text{ kHz}$ test sinusoid by $\approx 1.995\times$ ($+6.0\text{ dB}$) while leaving DC ($0\text{ Hz}$) and Nyquist ($24\text{ kHz}$) at unity gain.
- **`ringBufferSpsc.test.ts`**:
  - Pushes and pops 100,000 float samples across randomized chunk sizes ($128$, $256$, $512$) through `RingBufferSPSC`, verifying wrap-around boundary integrity, zero dropped/corrupted samples, and proper full/empty detection.
  - Verifies anti-denormal protection prevents subnormal floats ($|x| < 10^{-38}$).
- **`loudnessMeter.test.ts`**:
  - Feeds a calibrated $1\text{ kHz}$ full-scale ($0\text{ dBFS}$ peak, $-3.01\text{ LUFS}$) and attenuated ($-16.0\text{ LUFS}$) sine wave into `LoudnessMeter` and asserts the measured LUFS is within $\pm 0.1\text{ LU}$ of the ITU-R BS.1770-4 specification.

### 3.2. Interactive Studio Verification Checklist
- [ ] Click `[> Play All]` in `ScriptWorkbench`; verify seamless sequential playback across *Marko*, *Ana*, and *Narrator* respecting each block's `pauseAfterMs`.
- [ ] Open `SpeakerConfigModal` for *Marko* during playback and sweep the $120\text{ Hz}$ Low-Shelf and $2.5\text{ kHz}$ Mid-Peak EQ sliders; verify smooth, click-free real-time tonal shaping.
- [ ] Observe the live VU and Integrated LUFS meter in `CastSidebar` updating during playback (`LUFS: -16.0 (Broadcast OK)`).
- [ ] Enable `[Loop]` mode and verify the transport wraps cleanly from the end of the last block back to Block #1 with synchronized playhead interpolation.

### 3.3. Exit Criteria
Phase 5 is marked **COMPLETE** only when `npm run typecheck` and `npx vitest run tests/phase1 tests/phase2 tests/phase3 tests/phase4 tests/phase5` pass with 0 failures and all 4 interactive studio checks succeed.

