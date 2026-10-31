# Phase 1: Project Workbench, Persistence, Bilingual Foundation & Command History

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Sections 2, 3, 7, 10, 11 of [Design Document](../narration_podcast_editor_design_document.md)*

---

## 1. Phase Overview & Objectives

Phase 1 establishes the core architectural skeleton of **Storia**. It delivers the TypeScript data model, zero-dependency bilingual (`en` / `hr`) localization engine, spoken word-per-minute (WPM) and audio token estimation engine, the Command pattern (`HistoryManager`) for studio-grade Undo/Redo, persistent `localStorage` state management via Zustand, and the responsive 3-column dark-mode studio workbench UI.

### Deliverables
- Complete Vite + React 19 + TypeScript + Tailwind CSS + Vitest project setup with Cross-Origin Isolation headers configured.
- Full TypeScript schema definitions in `src/types/storia.ts`.
- English (`en`) and Croatian (`hr`) localization dictionary and default sample project (*"Ep 1: Magla nad Zagrebom"*).
- Deterministic WPM duration and Gemini Audio Token ($25\text{ tokens/sec}$) pacing calculator.
- Command Pattern (`Command`, `HistoryManager`) and 6 concrete script/cast mutation commands.
- Dual-tier Zustand store (`useStoriaStore`) with `localStorage` persistence.
- Studio UI layout (`TopBar`, `CastSidebar`, `ScriptWorkbench`, `ScriptBlockCard`, `SpeakerConfigModal`, and `AgentDock` shell).

---

## 2. Step-by-Step Implementation Tasks

### Step 1.1: Project Scaffolding & Cross-Origin Isolation
1. Initialize `package.json` with core dependencies:
   - Runtime: `react@^19.0.0`, `react-dom@^19.0.0`, `zustand@^5.0.0`, `idb-keyval@^6.2.1`, `lucide-react`
   - Dev/Test: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `@testing-library/react`, `jsdom`
2. Configure `vite.config.ts` with Cross-Origin Isolation headers (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`) so `SharedArrayBuffer` is unlocked for Phase 5's lock-free `AudioWorklet`.
3. Configure dark studio color tokens in Tailwind (`slate-950`, `slate-900`, `indigo-500`, `emerald-500`, `amber-500`).

### Step 1.2: Core Data Architecture (`src/types/storia.ts`)
Implement all domain schemas specified in Section 3 of the design document:
- `SupportedLanguage` (`'en' | 'hr'`), `Gender`, `GeminiBaseVoice` (`'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | 'Zephyr' | 'Helios' | 'Leda' | 'Orpheus' | string`)
- `SpeakerAcousticProfile` (spectral centroid, timbre warmth, 3-band `biquadEq`, `compression`)
- `GeminiVoiceConfig` (`baseVoice`, `stylePrompt`, `speakingRate`, `pitchAdjustment`, `enableDirectorNotes`, `ssmlEnabled`, `acoustics`)
- `Speaker`, `BlockType` (`'dialogue' | 'narration' | 'direction' | 'sound_effect'`), `ScriptTimepoint`, `WaveformPeakData`, `ScriptBlock`
- `AudioMasteringConfig`, `AIAgentMode`, `GroundingSource`, `PersonaResearchRecord`, `AIAgentSettings`, `Project`, `AppSettings`

### Step 1.3: Bilingual Localization & Sample Episode (`src/i18n/`)
1. Create `src/i18n/dictionary.ts` with strongly typed keys covering every toolbar label, modal field, tooltip, badge status (`TTS: OK`, `TTS: Stale`), and AI dock tab in both English (`en`) and Croatian (`hr`).
2. Create `src/i18n/useTranslation.ts` exposing `t(key)` and language switching bound to `AppSettings.uiLanguage`.
3. Create `src/i18n/sampleProject.ts` containing the preloaded episode **"Ep 1: Magla nad Zagrebom"**:
   - **Marko** (`Male, 40s`, Voice: `Fenrir`, Style: `Cynical noir`, Croatian/English persona prompt)
   - **Ana** (`Female, 28`, Voice: `Kore`, Style: `High tension`)
   - **Narrator** (`Neutral`, Voice: `Zephyr`, Style: `Deep documentary`)
   - Initial dialogue, narration, and sound effect blocks with bracketed director notes (`[šapatom / whispered]`, `[nervozno / anxious]`, `[smireno / composed]`).

### Step 1.4: Spoken Pacing & Audio Token Calculator (`src/core/pacing/pacingCalculator.ts`)
1. Implement `calculateBlockPacing(block: ScriptBlock, speaker?: Speaker, targetWpm = 140)`:
   - Strip bracketed director notes (`[...]`) and XML/SSML tags from spoken word count so silent cues are not counted as spoken words.
   - Parse inline `<break time="Xms"/>` or `<break time="Xs"/>` tags plus `block.pauseAfterMs`.
   - Compute spoken duration:
     $$\text{duration}_{\text{spoken}} = \frac{\text{wordCount}}{\text{targetWpm} \times (\text{speaker?.voice.speakingRate} ?? 1.0)} \times 60$$
   - Add pause durations to obtain `estimatedDurationSec`.
   - Compute `audioTokenEstimate = Math.ceil(estimatedDurationSec * 25)` ($25\text{ tokens/sec}$).
2. Implement `recalculateProjectTimeline(blocks: ScriptBlock[], speakers: Speaker[], targetWpm?: number)`:
   - Sequentially assigns `order`, `startTimeSec`, `endTimeSec`, `estimatedDurationSec`, and `audioTokenEstimate` across all blocks.
   - Computes total episode duration, total audio tokens, and estimated USD cost ($\text{tokens} \times \$10.00 / 10^6$).

### Step 1.5: Command Pattern History Engine (`src/core/history/`)
1. Implement `Command` interface and `HistoryManager` class (`src/core/history/Command.ts`):
   - `executeCommand(cmd)`, `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clear()`, `serializeHistory()`.
   - Enforce `maxDepth = 100` FIFO eviction on `undoStack` and automatic `redoStack` clearing on any new mutation.
2. Implement concrete command classes in `src/core/history/commands/`:
   - `AddBlockCommand`: Inserts block at index, recalculates timeline, reverses on `undo()`.
   - `UpdateBlockCommand`: Captures previous and next `Partial<ScriptBlock>` (text, speakerId, directorNotes, pauseAfterMs, type), supports coalescing rapid typing within a $500\text{ ms}$ window.
   - `DeleteBlockCommand`: Captures deleted block and its original index for exact restoration on `undo()`.
   - `ReorderBlocksCommand`: Moves block from `fromIndex` to `toIndex` and recomputes cumulative timeline offsets.
   - `UpdateSpeakerCommand`: Captures full speaker snapshot before/after edit (including `GeminiVoiceConfig` and `SpeakerAcousticProfile`).
   - `AddOrRemoveSpeakerCommand`: Handles adding or removing cast members safely.

### Step 1.6: Dual-Tier Zustand Store (`src/store/useStoriaStore.ts`)
1. Implement structural state in Zustand persisted to `localStorage` (`storia_projects_v1`, `storia_app_settings_v1`).
2. Bind all structural mutations (`addBlock`, `updateBlock`, `deleteBlock`, `reorderBlocks`, `updateSpeaker`, `addSpeaker`) through the singleton `HistoryManager` so every user edit is automatically undoable/redoable.
3. Expose transient state refs (playhead time, active block ID, hover scrub position) outside React re-render cycles to prepare for Phase 3.

### Step 1.7: 3-Pane Studio Workbench UI (`src/components/`)
1. `TopBar.tsx`: Episode switcher, `EN/HR` language toggle, `Undo [Z]` / `Redo [Y]` buttons with live stack counters, `[API Key]` status pill, live Audio Token budget meter (`6,375 tok ($0.06)`), and `[Export Master]` button.
2. `CastSidebar.tsx` (240px left pane): Speaker cards displaying color badge, gender/age, base voice, style prompt, line count, and token share; `[+ New Speaker]` button; footer summary showing `Total Est` time, `Audio Tokens`, and `LUFS` target.
3. `ScriptWorkbench.tsx` & `ScriptBlockCard.tsx` (fluid center pane):
   - Transport header (`[> Play All]`, `[||]`, `[Loop]`, `[+ Dialogue]`, `[+ Narration]`, `[+ SFX]`, `[Frameloop: Demand]` indicator).
   - Block cards with speaker selector dropdown, hotkey assignment (`Alt+1..9`), inline `[directorNotes]` pill editor, auto-expanding script textarea, `pauseAfterMs` control, estimated duration/token readout, and block reorder (`Alt+Up`/`Alt+Down` or drag-and-drop).
4. `SpeakerConfigModal.tsx`: Modal to edit speaker demographics, `personaPrompt`, `actingNotes`, `GeminiBaseVoice`, `stylePrompt`, `speakingRate` ($0.5\times - 2.0\times$), `pitchAdjustment` ($-10\text{ st}$ to $+10\text{ st}$), and Biquad EQ / Compressor presets.

---

## 3. Validation Gate 1 (Phase 1 -> Phase 2)

### 3.1. Automated Unit & Integration Tests (`tests/phase1/`)
Run via `npx vitest run tests/phase1`:
- **`pacingCalculator.test.ts`**:
  - Verifies a 140-word block at 140 WPM and $1.0\times$ speaking rate yields exactly $60.0\text{ s}$ and $1,500\text{ audio tokens}$.
  - Verifies bracketed `[šapatom / whispered]` cues do not inflate spoken word count.
  - Verifies `speakingRate: 2.0` halves spoken duration while preserving exact `pauseAfterMs` duration.
  - Verifies `recalculateProjectTimeline` produces strictly contiguous `[startTimeSec, endTimeSec]` intervals.
- **`historyManager.test.ts`**:
  - Verifies `AddBlockCommand`, `UpdateBlockCommand`, `DeleteBlockCommand`, `ReorderBlocksCommand`, and `UpdateSpeakerCommand` execute, undo, and redo with deep-equal state restoration.
  - Verifies pushing 120 commands caps `undoStack` at 100 and evicts the oldest 20 commands.
  - Verifies executing a new command after `undo()` immediately empties `redoStack`.
- **`i18n.test.ts`**:
  - Verifies strict key parity between English (`en`) and Croatian (`hr`) dictionaries (zero missing keys).

### 3.2. Interactive Studio Verification Checklist
- [ ] Start dev server (`npm run dev`) and confirm zero console errors and `window.crossOriginIsolated === true`.
- [ ] Toggle UI language in `TopBar` between `EN` and `HR`; verify all panel headers, buttons, and tooltips translate instantaneously.
- [ ] Add a new dialogue block, assign it to *Ana*, enter director notes `[uzdah / sigh]`, and verify the live duration and audio token counter update in both the block card and `CastSidebar`.
- [ ] Reorder blocks up and down, delete a block, then press `Ctrl+Z` repeatedly followed by `Ctrl+Y` to verify complete state restoration.
- [ ] Refresh the browser tab (`F5`) and verify all edits persist from `localStorage`.

### 3.3. Exit Criteria
Phase 1 is marked **COMPLETE** only when `npm run typecheck` and `npx vitest run tests/phase1` pass with 0 failures and all 5 interactive studio checks succeed.

