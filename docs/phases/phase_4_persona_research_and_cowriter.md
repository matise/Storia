# Phase 4: Storia Persona Research & Co-Writing Agent (`gemini-3-flash-preview`)

*Parent Document: [Master Implementation Plan](../implementation_plan.md)*  
*Design Reference: Section 5 of [Design Document](../narration_podcast_editor_design_document.md)*  
*Prerequisite: [Phase 3 Validation Gate Passed](./phase_3_dod_waveform_and_bvh_timeline.md)*

---

## 1. Phase Overview & Objectives

Phase 4 brings Storia's AI storytelling and research suite online inside the right-hand `AgentDock` (340px), powered by **`gemini-3-flash-preview`**. It implements all four specialized modes specified in Section 5 of the design document:
1. **Persona-Grounded Research Engine (`persona_research`):** Investigates factual, historical, scientific, or cultural questions via Google Search grounding (`tools: [{ google_search: {} }]`), interpreting verified facts strictly through a chosen cast member's psychological worldview, idioms, and voice, complete with clickable citations and one-click dialogue insertion.
2. **Dialogue & Story Co-Writer (`cowriter`):** Analyzes the preceding 5–10 script blocks and proposes 3 distinct narrative continuations using Gemini's structured JSON schema output (`ScriptBlock[]`).
3. **Script Doctor & Vocal Cadence Polish (`dialogue_doctor`):** Rewrites draft lines to optimize spoken pacing against target WPM, trims literary run-on clauses, and injects bilingual stage directions (`[uzdah / sigh]`, `[ironično / sardonically]`).
4. **Bilingual Cultural Adapter (`bilingual_adapter`):** Translates blocks or scenes between English (`en`) and Croatian (`hr`), adapting regional idioms and enforcing Croatian grammatical gender agreement (`male` vs `female` past-tense participles, e.g., *"rekao sam"* vs *"rekla sam"*).

### Deliverables
- Gemini 3 / 2.5 service client (`src/services/geminiAgentService.ts`) with dynamic **Gemini Model Picker** routing (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`), Google Search grounding, structured JSON schema parsing, and offline mock fixtures for deterministic testing.
- Interactive **Gemini Model Picker** in both `AgentDock.tsx` header and `ApiKeyModal.tsx` (supporting both Text/Research models and Native TTS models: `gemini-2.5-flash-preview-tts` / `gemini-2.5-pro-preview-tts`).
- Complete 4-tab `AgentDock.tsx` UI (`Persona POV`, `Co-Writer`, `Script Doctor`, `Bilingual Adapter`).
- Persistent **Research Notebook** (`project.researchNotebook`) with source citations (`GroundingSource[]`) and undoable `[Insert as Dialogue Line]` integration.

---

## 2. Step-by-Step Implementation Tasks

### Step 4.1: Persona-Grounded Research Client (`src/services/geminiAgentService.ts`)
1. Implement `runPersonaResearch({ speaker, query, language, apiKey, enableSearchGrounding })`:
   - **System Instruction:** Encodes `speaker.name`, `speaker.age`, `speaker.gender`, `speaker.personaPrompt`, `speaker.actingNotes`, and required output language (`hr` or `en`), instructing the model to answer strictly in-character while remaining anchored to verified historical/factual findings.
   - **API Dispatch:** Calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}` with `tools: enableSearchGrounding ? [{ google_search: {} }] : undefined`.
   - **Citation Extraction:** Parses `candidates[0].groundingMetadata.groundingChunks` and `groundingSupports` into `GroundingSource[]` (`{ uri, title }`).
   - Returns a complete `PersonaResearchRecord` (`id`, `speakerId`, `query`, `personaResponse`, `objectiveSummary`, `sources`, `timestamp`).

### Step 4.2: Co-Writer Structured Scene Generator
1. Implement `generateNextSceneBeats({ precedingBlocks, speakers, language, apiKey, directionHint })`:
   - Passes the last 5–10 `ScriptBlock` items and active `Speaker` profiles.
   - Configures `generationConfig.responseMimeType = "application/json"` with a strict JSON schema returning 3 candidate scene beats, where each beat contains a `title`, `rationale`, and `blocks: Array<{ type, speakerId, text, directorNotes, pauseAfterMs }>`.
   - Validates and hydrates the returned JSON into ready-to-insert `ScriptBlock[]` objects.

### Step 4.3: Script Doctor & Vocal Cadence Polisher
1. Implement `doctorDialogueBlock({ block, speaker, targetWpm, language, apiKey })`:
   - Evaluates the current block's word count, syntax complexity, and spoken duration at `targetWpm`.
   - Prompts `gemini-3-flash-preview` to return 2–3 spoken-cadence alternatives (e.g., *Tighter Pacing*, *High Subtext*, *Naturalistic Idioms*) with appropriate bracketed `directorNotes` (`[šapatom / whispered]`, `[kratak uzdah / short sigh]`).

### Step 4.4: Bilingual Cultural & Grammatical Adapter (`EN <-> HR`)
1. Implement `adaptBlockBilingually({ block, speaker, sourceLang, targetLang, apiKey })`:
   - Injects explicit linguistic rules for Croatian (`hr`):
     - Enforces verb participle gender agreement based on `speaker.gender` (`male` $\rightarrow$ *-o* ending such as *"vidio sam, rekao sam"*; `female` $\rightarrow$ *-la* ending such as *"vidjela sam, rekla sam"*).
     - Preserves vocative case and authentic Kajkavian/Štokavian urban Zagreb flavor where appropriate to the speaker's persona.
   - Adapts idioms culturally rather than literally while maintaining comparable syllable counts so audio timing (`estimatedDurationSec`) remains consistent.

### Step 4.5: Agent Dock UI & Command History Integration (`src/components/layout/AgentDock.tsx`)
1. Build the 4 mode tabs inside `AgentDock.tsx`:
   - **Persona POV Tab:** Speaker selector, query textarea, `[Research via Google Search Ground]` button, in-character response card, clickable citation links (`[1] Hrvatski povijesni muzej (hpm.hr)`), Research Notebook history list, and `[Insert as Dialogue Line]` button (dispatches `AddBlockCommand`).
   - **Co-Writer Tab:** Optional scene direction prompt, `[Brainstorm 3 Next Beats]` button, preview cards for each multi-block beat, and `[Insert Beat into Script]` button (dispatches batch `AddBlockCommand`).
   - **Script Doctor Tab:** Automatically targets the currently selected `ScriptBlock`, displays current vs. doctored spoken duration/tokens, and provides `[Apply Polish]` (dispatches `UpdateBlockCommand`).
   - **Bilingual Adapter Tab:** `EN -> HR` / `HR -> EN` direction toggle, single-block or full-scene cultural adaptation preview, and `[Apply Translation]` (dispatches `UpdateBlockCommand`).

---

## 3. Validation Gate 4 (Phase 4 -> Phase 5)

### 3.1. Automated Unit & Integration Tests (`tests/phase4/`)
Run via `npx vitest run tests/phase4`:
- **`personaResearch.test.ts`**:
  - Verifies dual-layer system/user prompt construction for *Marko* (`hr`) and *Ana* (`en`).
  - Verifies parser extracts `GroundingSource[]` (`uri`, `title`) from `groundingMetadata.groundingChunks` and handles empty/missing grounding metadata gracefully.
- **`coWriterAndDoctor.test.ts`**:
  - Verifies structured JSON response parsing maps speaker names/IDs into valid `ScriptBlock[]` entities and rejects malformed payloads safely.
  - Verifies `[Insert as Dialogue Line]` and `[Apply Polish]` execute through `HistoryManager`, allowing full `undo()` and `redo()`.
- **`bilingualAdapter.test.ts`**:
  - Verifies gender-agreement prompt instructions explicitly enforce `male` vs `female` morphological constraints when adapting into Croatian (`hr`).

### 3.2. Interactive Studio Verification Checklist
- [ ] In `AgentDock` -> **Persona POV**, select *Marko* and submit the query from the design document: *"Kakve je pištolje koristila zagrebačka policija 1938. godine?"* — verify the in-character response and citations render in the Research Notebook.
- [ ] Click `[Insert as Dialogue Line]` on the research result; verify a new dialogue block assigned to *Marko* appears in the script workbench, then press `Ctrl+Z` and `Ctrl+Y` to confirm Undo/Redo works seamlessly.
- [ ] Switch to the **Co-Writer** tab, generate next scene beats, and insert a multi-line exchange into the script.
- [ ] Select a dialogue block, run **Script Doctor**, and apply the cadence-polished version with injected `[directorNotes]`.
- [ ] Switch to the **Bilingual Adapter** tab, translate a Croatian dialogue block by *Ana* (`Female`) into English and back into Croatian, verifying proper feminine verb agreement.

### 3.3. Exit Criteria
Phase 4 is marked **COMPLETE** only when `npm run typecheck` and `npx vitest run tests/phase1 tests/phase2 tests/phase3 tests/phase4` pass with 0 failures and all 5 interactive studio checks succeed.

