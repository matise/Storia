# Phase 3: Data-Oriented Waveform Visualization & 1D BVH Timeline Sync

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Section 6 of [Design Document](../narration_podcast_editor_design_document.md)*  
*Prerequisite: [Phase 2 Validation Gate Passed](./phase_2_gemini_tts_and_cache.md)*

---

## 1. Phase Overview & Objectives

Phase 3 implements Storia's **Data-Oriented Design (DOD)** visualization and spatial indexing subsystem. Rather than rendering thousands of DOM nodes or performing $O(N)$ linear array scans on every frame, Phase 3 introduces:
1. A **1D Temporal Bounding Volume Hierarchy (Interval Tree)** for $O(\log N)$ playhead-to-block and playhead-to-word (`ScriptTimepoint`) queries.
2. A **Decoupled Audio Clock Accumulator & Linear Interpolator (Lerp)** that bridges discrete Web Audio hardware buffer jumps ($128\text{ samples} \approx 2.66\text{ ms}$) with high-refresh displays ($60/120/144\text{ Hz}$) without playhead stutter.
3. A **Zero-Allocation Canvas 2D Waveform Renderer** operating directly on `Float32Array` Structure-of-Arrays (`minPeaks`, `maxPeaks`, `rmsLevels`) with on-demand loop suspension (`frameloop="demand"`).

### Deliverables
- 1D Temporal BVH (`src/core/spatial/TemporalBVH.ts`) with $O(\log N)$ point and range queries.
- Fixed-timestep Clock Interpolator (`src/core/spatial/ClockInterpolator.ts`) with `frameloop="demand"` sleep management.
- Zero-allocation Canvas 2D waveform renderer (`src/components/workbench/WaveformCanvas.tsx`).
- Interactive scrubbing, click-to-seek, word-level script karaoke highlighting, and live BVH telemetry bar in `ScriptWorkbench.tsx`.

---

## 2. Step-by-Step Implementation Tasks

### Step 3.1: 1D Temporal Bounding Volume Hierarchy (`src/core/spatial/TemporalBVH.ts`)
1. Define the binary BVH node structure over sorted timeline intervals $I = [t_{\text{start}}, t_{\text{end}}]$:
   ```typescript
   export interface TemporalBVHNode {
     startTimeSec: number;
     endTimeSec: number;
     blockIndex: number;          // >= 0 for leaf nodes, -1 for internal nodes
     blockId: string | null;
     left: TemporalBVHNode | null;
     right: TemporalBVHNode | null;
   }
   ```
2. Implement `TemporalBVH` class:
   - `build(blocks: ScriptBlock[])`: Constructs a balanced binary tree in $O(N)$ time from the ordered `ScriptBlock[]` array.
   - `findBlockAtTime(timeSec: number): { block: ScriptBlock | null; blockIndex: number; depthVisited: number }`: Traverses the tree in $O(\log N)$ time to locate the active block containing `timeSec`.
   - `findActiveTimepoint(block: ScriptBlock, globalTimeSec: number): ScriptTimepoint | null`: Uses binary search over `block.timepoints` relative to `block.startTimeSec` to identify the active SSML `<mark>` word/clause in $O(\log M)$ time.
   - `queryRange(minTimeSec: number, maxTimeSec: number): ScriptBlock[]`: Returns all blocks overlapping a visible viewport window for virtualized timeline rendering.

### Step 3.2: Decoupled Audio Clock & Lerp Scrubber (`src/core/spatial/ClockInterpolator.ts`)
1. Implement `ClockInterpolator`:
   - Tracks hardware `AudioContext.currentTime` targets alongside `performance.now()` display frame timestamps.
   - Implements fixed-step accumulator ($\Delta t_{\text{fixed}} = \frac{128}{48000} \approx 0.002667\text{ s}$) and computes fractional interpolation factor:
     $$\alpha = \text{clamp}\left(\frac{\Delta t_{\text{accumulated}}}{\Delta t_{\text{fixed}}}, 0, 1\right)$$
     $$t_{\text{render}} = t_{\text{prev}} \cdot (1 - \alpha) + t_{\text{curr}} \cdot \alpha$$
2. Implement `DemandFrameLoop` controller:
   - Runs `requestAnimationFrame` **only** when `isPlaying === true` or `isScrubbing === true`.
   - When paused and idle, cancels the animation frame handle and enters `sleep` state (`0%` CPU/GPU usage), exposing a single-frame `invalidate()` trigger for manual seek or window resize events.

### Step 3.3: Zero-Allocation DOD Waveform Canvas (`src/components/workbench/WaveformCanvas.tsx`)
1. Implement `renderWaveformToCanvas` (Section 6.3 of the design document):
   - Accepts `ctx: CanvasRenderingContext2D`, `peaks: WaveformPeakData`, `width`, `height`, `playheadProgress` ($0.0 - 1.0$), and speaker `accentColor`.
   - Renders unplayed peaks in `#475569` (Slate-600), played peaks in the speaker's `accentColor`, RMS inner energy core at higher opacity, and a crisp $2\text{ px}$ `#f8fafc` playhead cursor.
   - Performs zero `new` object/array allocations inside the drawing loop.
2. Add HiDPI (`window.devicePixelRatio`) canvas scaling and `ResizeObserver` support that calls `frameLoop.invalidate()`.
3. Add pointer event handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`) for smooth click-to-seek and drag-scrubbing.

### Step 3.4: Karaoke Script Highlighting & Telemetry Footer
1. Connect `TemporalBVH` and `ClockInterpolator` to `ScriptWorkbench.tsx`:
   - During playback or scrubbing, query `bvh.findBlockAtTime(renderTimeSec)` and highlight the active `ScriptBlockCard` border and active word/clause token from `findActiveTimepoint`.
   - Render the bottom telemetry status bar specified in Section 10:
     `Waveform: Canvas 2D SoA | 1D BVH Active: Block #1 (t=01.4s) | Depth: 2 | [Frameloop: Demand (Sleeping/Active)]`.

---

## 3. Validation Gate 3 (Phase 3 -> Phase 4)

### 3.1. Automated Unit & Benchmark Tests (`tests/phase3/`)
Run via `npx vitest run tests/phase3`:
- **`temporalBvh.test.ts`**:
  - Builds a `TemporalBVH` with $N = 1,000$ sequential script blocks spanning $0\text{ s}$ to $5,000\text{ s}$.
  - Asserts `findBlockAtTime(t)` returns the exact matching block for 500 random timestamps and boundary edges, and asserts `depthVisited <= 11` ($\lceil \log_2(1000) \rceil + 1$) on every query.
  - Asserts `findActiveTimepoint` locates the exact SSML `<mark>` word offset in $O(\log M)$ time.
  - Asserts `queryRange(120, 180)` returns only the blocks overlapping $[120\text{ s}, 180\text{ s}]$.
- **`clockInterpolator.test.ts`**:
  - Simulates discrete $2.66\text{ ms}$ audio clock steps sampled at $144\text{ Hz}$ ($6.94\text{ ms}$) and $120\text{ Hz}$ ($8.33\text{ ms}$) display intervals; verifies `t_render` is strictly monotonic (never steps backward) and smoothly interpolates between hardware clock ticks.
  - Verifies `DemandFrameLoop` stops invoking its render callback immediately after `pause()` is called, and fires exactly once when `invalidate()` is called while paused.

### 3.2. Interactive Studio Verification Checklist
- [ ] Render audio for all blocks in the sample episode and inspect the inline SoA waveforms on each `ScriptBlockCard` — verify each waveform uses its speaker's configured accent color.
- [ ] Click and drag across a block's waveform while paused; verify the playhead scrubs smoothly at full display refresh rate and the bottom telemetry bar updates `1D BVH Active: Block #X (t=YY.Ys)` in real time.
- [ ] Play the sequence and observe active block border illumination and word-level karaoke highlighting synchronized with the SSML `<mark>` timepoints.
- [ ] Pause playback and confirm the status indicator reads `[Frameloop: Demand (Idle)]` with zero ongoing `requestAnimationFrame` ticks.

### 3.3. Exit Criteria
Phase 3 is marked **COMPLETE** only when `npm run typecheck` and `npx vitest run tests/phase1 tests/phase2 tests/phase3` pass with 0 failures and all 4 interactive studio checks succeed.

