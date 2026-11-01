# 🎙️ Storia — The Intelligent Audio Drama & Screenplay Studio

> **"From the stone ramparts and quarantine vaults of Dubrovnik to the modern soundstage — where centuries of Mediterranean oral storytelling converge with cutting-edge generative audio DSP."**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6.1-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-145%2F145%20Passing-emerald.svg)](https://vitest.dev/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Hardware%20DSP-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Broadcast Compliant](https://img.shields.io/badge/Loudness-ITU--R%20BS.1770--4-amber.svg)](https://www.itu.int/rec/R-REC-BS.1770)

---

## 🌟 First Impression: What is Storia?

**Storia** is a browser-native **Digital Audio Workstation (DAW)**, **intelligent screenplay editor**, and **dramatic AI co-writer** engineered from the ground up for narrative fiction, radio drama (*radiodrama*), investigative podcasts, and multi-speaker audiobooks.

Traditional text-to-speech tools treat voice generation as a static assembly line of disconnected MP3 clips on a sterile grid. **Storia** replaces that model with a unified theatrical soundstage:

* 🎚️ **Hardware-Accelerated Web Audio DSP:** Per-speaker 3-band parametric Biquad EQs, studio dynamics compressors, and volume fade curves with $-\infty\text{ dB}$ corner attenuation.
* ⚡ **60 FPS Data-Oriented (DOD) Waveforms:** Contiguous `Float32Array` Structure-of-Arrays (SoA) peak pyramids that scrub, zoom, and pan smoothly without garbage-collection lag.
* 🎙️ **Real-Time Karaoke Alignment & Click-to-Seek:** Character-weighted phonetic word pacing with punctuation pause modeling that keeps text highlights in exact lockstep with waveform needle lines and timecodes.
* 🔄 **Continuous Auto-Advance Playback:** Uninterrupted sequence auditioning that automatically unfolds and advances block-to-block through the entire episode.
* 🔊 **Hybrid Audio Engine:** Seamless integration of Google Gemini 2.5 expressive multi-speaker voice synthesis, zero-token offline browser TTS, and pure procedural physical-modeling SFX (ocean surf, rainstorms, footsteps on stone, creaking doors, and sub-bass drones).
* 🏰 **Authentic Dubrovnik Dialect Engine:** 570+ authenticated Ragusan vocabulary entries, jekavski štokavski declension rules, and speech breath pause modeling.
* 🎛️ **Broadcast Mastering Suite:** In-browser ITU-R BS.1770-4 ($-16\text{ LUFS}$) normalization, $4\times$ oversampled True Peak limiting, XorShift128+ TPDF dither, pure client-side 320 kbps MP3 encoding via `@breezystack/lamejs`, and time-aligned multitrack speaker stems.

---

## 🏛️ Studio Layout & Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                  STORIA STUDIO WORKSPACE                                               │
├──────────────────────────┬─────────────────────────────────────────────────────────────┬───────────────────────────────┤
│     CAST & SPEAKERS      │                  EPISODE WAVEFORM TRANSPORT                 │       AI AGENT & RESEARCH     │
│                          │  [Play All] [Auto] [Loop]  00:26.0 / 02:54.2  [Stereo VU]   │                               │
│ • Speaker Personas (HR/EN)│  ───[#1 SFX]───[#2 Mara]───[#3 Foxy]───[#4 eNa]─────────────│ • Co-Writer (3 Workflows)     │
│ • 3-Band Parametric EQ   ├─────────────────────────────────────────────────────────────┤ • Deep Multimodal Research    │
│   - High Shelf (8 kHz)   │                     SCRIPT WORKBENCH                        │ • Google Search Grounding     │
│   - Mid Peak (2.5 kHz)   │                                                             │ • Script Doctor & Cadence     │
│   - Low Shelf (120 Hz)   │  [#1 SFX: Lazareti Surf]  [Mini Transport] 00:04.0          │ • Bilingual Cultural Adapter  │
│ • Dynamics Compressor    │  [#2 Mara: Dialogue]      [Live Waveform + Fade Handles]    │ • Dubrovnik Dialect Injector  │
│ • Timbre Warmth & Pitch  │  [#3 Foxy: Dialogue]      [Unified Karaoke Script Editor]   │ • Document Dropzone (PDF/IMG) │
│ • Live Voice Audition    │  • 1D Temporal BVH ($O(\log N)$)  • Interactive Pause Drag  │ • Resizable Splitter Dock     │
│ • Resizable Splitter     │  • Collapsed Mini Transport       • Click-Word-to-Seek      │                               │
└──────────────────────────┴─────────────────────────────────────────────────────────────┴───────────────────────────────┘
                                                           │
                                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            BROADCAST MASTERING & STEM EXPORT                                           │
│     • ITU-R BS.1770-4 (-16 LUFS)  • True Peak Limiter (-1.0 dBFS)  • XorShift128+ Triangular Dither (TPDF)             │
│     • Pure Client-Side LAME MP3 (320 kbps)  • 24-bit Broadcast WAV  • Time-Aligned Multitrack Stems (.fountain / .json)│
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Studio Capabilities

### 1. ⚡ Master Episode Waveform Transport Deck
* **Data-Oriented (DOD) Peak Pyramid:** Waveforms are rendered using contiguous `Float32Array` minimum/maximum peak arrays across 96 discrete slices, completely eliminating memory allocation spikes during high-speed scrubbing.
* **Timeline Zoom & Smooth Pan:** Seamlessly scale from $1.0\times$ (full episode overview) up to $10.0\times$ (sample-accurate editing) with horizontal wheel panning and zoom fit triggers.
* **Direct Part Drag & Reordering:** Move, swap, and reorder dialogue blocks and sound effects directly on the master waveform timeline with visual drag ghosts and drop targets.
* **Interactive Silence & Pause Dragging:** Adjust the natural breathing silence between dialogue lines (`pauseAfterMs`) using direct pointer drag handles positioned on the timeline canvas.
* **Integrated Stereo VU / Loudness Meter:** Real-time dual-channel peak metering accompanied by integrated K-weighted LUFS telemetry and true-peak broadcast compliance indicators.
* **Auto-Advance Playback Engine:** Dedicated `Auto` sequence mode that seamlessly continues playback from block to block, automatically expanding the active block and scrolling it into view.
* **1D Temporal Bounding Volume Hierarchy (BVH):** Binary interval tree spatial partition delivering instant $O(\log N)$ block lookups during mouse hover, scrubbing, and playhead advancement.

---

### 2. 📝 Unified Script Editor & Live Karaoke Word Transport
* **Zero-Layout-Shift Surface:** The editor seamlessly toggles between two synchronized states without any shift in typography, line-height, padding, or borders:
  1. **Idle Edit Mode:** A clean, responsive multi-line textarea with keyboard shortcuts (`Ctrl+Enter` to insert the next line, `Alt+↑`/`Alt+↓` to reorder).
  2. **Word-Transport Mode:** An interactive spoken surface displaying character-weighted word tokens.
* **Phonetic Pacing & Pause Weighting:** Words are automatically weighted based on character length and punctuation pauses (commas add $+1.8$, sentence boundaries add $+3.2$ breath pauses) to calculate natural conversational timing.
* **Dynamic 60 FPS Karaoke Highlighting:** The active word highlights in emerald in lockstep with the waveform needle and timecode readout, updating smoothly at 60 FPS across both single-block auditions and master "Play All" playback.
* **Click-Word-to-Seek:** Click any individual word to instantly jump the audio playback needle and timecode to that exact spoken syllable.
* **Double-Click Edit Unlock:** Double-clicking anywhere on the text immediately pauses playback and unlocks standard textarea editing.

---

### 3. 🎚️ Script Block Cards & Collapsed Mini Transports
* **Dual Expanded / Collapsed Views:** Script blocks can be collapsed into sleek, single-line summaries to conserve screen space when managing large, multi-scene scripts.
* **Collapsed Mini Transport Controls:** Even when collapsed, script blocks provide instant play/pause buttons, restart buttons, duration timecodes, and an interactive mini timeline scrubber with a real-time progress needle.
* **Adobe Audition-Grade Volume Fade Handles:** Expanded blocks feature interactive fade-in and fade-out handles directly on the waveform canvas. Fades start strictly from absolute silence ($-\infty\text{ dB}$) using smooth power-law curves with zero clicks, pops, or latency.
* **Precision Volume Gain Knob:** Draggable radial gain control providing per-block trim adjustment from $-48\text{ dB}$ to $+10\text{ dB}$.
* **Clean Didaskalije (Stage Directions):** An unobtrusive, bracket-free director's notes field (`whispered`, `ironic`, `breathless`, `shouting`) integrated directly into the block header.

---

### 4. 🎭 Cast & Acoustic Persona Studio
* **Multi-Speaker Orchestration:** Create and manage limitless cast members, each with unique voice assignments, speaking tempos ($0.5\times$ to $2.0\times$), pitch shifts, color accents, and personalized backstory prompts.
* **Studio Parametric Biquad EQ per Speaker:**
  * **High Shelf:** Air and presence boost ($8.0\text{ kHz}$).
  * **Mid Peak:** Vocal intelligibility and dialogue clarity ($2.5\text{ kHz}$).
  * **Low Shelf:** Proximity effect and chest warmth ($120\text{ Hz}$).
* **Studio Dynamics Compressor:** Peak limiting and level control with customizable threshold ($-48\text{ dB}$ to $0\text{ dB}$), compression ratio ($1:1$ to $20:1$), attack ($1\text{ ms}$ to $50\text{ ms}$), and release ($20\text{ ms}$ to $500\text{ ms}$).
* **Acoustic Timbre & Centroid Control:** Spectral centroid tuning ($500\text{ Hz}$ to $5000\text{ Hz}$) for authentic voice coloration.
* **Zero-Latency Voice Auditioning:** Instantaneous line rehearsal via the Web Audio API using either local neural voices or cloud synthesis.
* **Speaker Quick-Assign Hotkeys:** Rapidly assign cast members to script blocks using `Alt+1` through `Alt+9`.

---

### 5. 🔊 Hybrid Synthesis & Procedural Physical-Modeling SFX
* **Gemini 2.5 Expressive Voice Generation:** Emotionally nuanced multi-speaker speech synthesis honoring dramatic tension and theatrical stage directions.
* **Offline Browser SpeechSynthesis Fallback:** Fully functional offline auditioning that works without network access or API tokens.
* **Procedural Physical-Modeling SFX Synthesizer:** Pure mathematical synthesis of complex Foley and environmental audio directly within Web Audio:
  * 🌊 **Ocean Swell & Coastal Surf:** Multi-band bandpass-filtered noise modulating tidal surge intervals.
  * 🌧️ **Rainstorms & Heavy Downpours:** Stochastic high-density acoustic droplet generator.
  * 💨 **Resonant Wind & Coastal Gales:** Modulated resonant bandpass filters simulating wind gusts around stone structures.
  * 📻 **Vintage Radio Static:** Non-linear white and pink noise textures with cyclic phase degradation.
  * 👞 **Footsteps on Stone:** Impact modeling with rapid damping and early reflections simulating limestone cobblestones.
  * 🚪 **Creaking Doors & Vault Latches:** Frequency-modulated sawtooth synthesis with exponential pitch decays.
  * 🔊 **Cinematic Sub-Bass Drones:** Deep harmonic sine waves with subtle beating frequencies designed for dramatic climaxes.
* **Custom Audio Import:** Drag-and-drop support for external sound effects and music stems (`.wav`, `.mp3`, `.ogg`, `.flac`).

---

### 6. 🤖 AI Dramatic Co-Writer & Research Dock (Powered by Gemini)
* **Three Specialized Screenwriting Modes:**
  1. **Scene Co-Writer (3 Beats):** Analyzes preceding dialogue, character motivations, and director hints to generate 3 distinct dramatic beat choices with creative rationales.
  2. **Complete Episodic Story Mode:** Drafts extensive multi-act story arcs complete with speaker handoffs, sound effects, and dramatic peaks.
  3. **Podcast Episode Mode:** Generates engaging two-host conversational interviews, historical debates, and investigative discussions.
* **Deep Multimodal Research & Document Ingestion:** Drag-and-drop PDFs, treatment outlines, historical codices, and reference images. The AI analyzes uploaded documents to ground character dialogue.
* **Google Search Grounded Fact-Checking:** Connects directly to verified Google Search results to substantiate historical queries, period attire, weaponry, architecture, and cultural facts.
* **Script Doctor & Vocal Cadence Polisher:** Evaluates rhythmic flow, detects breathless phrasing, suggests emotional delivery adjustments, and inserts natural didaskalije.
* **Bilingual Cultural & Grammatical Adapter (EN ↔ HR):** Preserves Slavic morphological agreements—including past-tense participle gender concord (*glagolski pridjevi radni* na *-o* vs *-la*), vocatives (*gosparu, Mare*), and cultural idioms—when translating between Croatian and English.

---

### 7. 🏰 Dubrovnik Vernacular & Phonetic Dialect Engine
Storia features a dedicated, authentic dialect engine for the historic city vernacular of Dubrovnik (*dubrovačka gradska štokavština / Raguzejski idiom*):
* **Sociolinguistic Authenticity:** Built strictly upon historical **jekavski štokavski** roots. Completely isolated from Chakavian or general Central Dalmatian Ikavian (strictly no *ča*, no *ćaća*, no non-jekavian Jat).
* **Master Bidirectional Lexical Database (`dubrovnikDictionary.ts`):** Over 570 authenticated Ragusan vocabulary entries spanning 7 distinct semantic categories:
  * **Household & Dining:** *Pantaruo / pantaruoli* (vilica), *ožica* (žlica), *pjat* (tanjur), *teća* (lonac), *prosuja* (tava), *broka* (vrč), *žmuo* (čaša), *pomadora* (rajčica), *patata* (krumpir), *kapula* (crveni luk), *dinja* (lubenica!), *pipun* (dinja!), *cukar* (šećer), *beškotin* (keks), *butiga* (dućan).
  * **Attire & Personal Items:** *Crevlje* (cipele), *špigete* (vezice), *gaće* (duge hlače!), *mudante* (donje rublje), *vestit* (odijelo), *bječva* (čarapa), *šugaman* (ručnik), *kušin* (jastuk), *lincuo* (plahta), *takujin* (novčanik), *lapis* (olovka).
  * **Society & People:** *Gospar* (gospodin/plemić), *sinjora* (gospođa), *čeljad / čejad* (ljudi), *našjenac* (domaći), *furesti* (stranci), *manjgura* (cura), *huncut* (vragolan).
  * **Verbs & Expressions:** *Mučat* (šutjeti), *hodit* (ići), *balat* (plesati), *dilitat* (ometati), *pasat* (proći), *fermat* (stati), *arivat* (stići), *guštat* (uživati), *škerac* (šala), *intravenjat* (događati se), *pjantat* (ostaviti).
  * **Topography & Architecture:** *Volat / volti* (kameni luk), *skalin / skalini* (stepenice), *komin* (ognjište), *funjestra* (prozor), *koltrina* (zavjesa), *kamara* (soba), *tinel / saloča* (dnevni boravak), *spjađa* (plaža), *porat* (luka).
* **Idiomatic Phrase Engine:** Pre-compiled phrase transforms: *u Grad* (u Dubrovnik), *put Grada* (prema Dubrovniku), *na placi* (na Stradunu), *u Portu* (u staroj luci), *sluga van se* (dobar dan), *adio ti* (doviđenja), *fála van vele* (hvala lijepa), *ne mari* (nema veze), *što činiš* (što radiš).
* **Phonological & Morphological Rules:**
  * **Masculine a-Declension:** Male names ending in `-o` (*Vlaho, Maro, Baldo, Đuro, Niko, Mato, Pero*) decline strictly via a-declension (*Vlaha/Vlahu, Mara/Maru*; possessives *Vlahov, Marov*, never *-in* or *-i*).
  * **Infinitive Truncation:** `-ti` $\rightarrow$ `-t` (*gledat, radit, govorit, hodit*).
  * **Diphthong Contraction:** `-ao / -uo -> -ō` (*rekō, gledō, poslō*).
  * **Final Nasal Shift:** `-m -> -n` (*sam -> san, sa mnom -> sa mnon*).
  * **TTS Breath Pause Modeling:** Normalizes contracted vowels and inserts natural pauses after vocatives and exclamations (*gosparu, Mare, muči, adio, čertamente*).
* **Three Historical Registers:** Classical (16th–18th C. Držić & Gundulić), Traditional (19th–Mid 20th C. Old Walled City), and Contemporary (Living Urban).

---

### 8. 🎛️ Broadcast Mastering Suite & Multitrack Stems
* **ITU-R BS.1770-4 Loudness Normalization:** Integrated K-weighting pre-filter and $4\times$ polyphase sinc True Peak limiter enforcing $-16\text{ LUFS}$ integrated loudness for podcasts or EBU R128 compliance for broadcast radio.
* **XorShift128+ TPDF Dither:** Clean multi-bit-depth quantization ($16\text{-bit}$, $24\text{-bit}$, and $32\text{-bit}$ float at $44.1\text{ kHz}$ or $48\text{ kHz}$).
* **Pure Client-Side MP3 Encoding (320 kbps):** Zero-transcoding, zero-server MP3 rendering at maximum broadcast quality ($320\text{ kbps}$ CBR) powered by `@breezystack/lamejs`.
* **Time-Aligned Multitrack Stems:** Export isolated, time-aligned audio stems for every speaker alongside the complete episode master mix for effortless mixing in Reaper, Pro Tools, or DaVinci Fairlight.
* **Screenplay Interchange:** Export to industry-standard `.fountain`, clean Markdown `.md`, or complete native `.storia.json` project bundles.

---

## 🧩 Component Details & File Structure

| Component / Module | Path | Description & Architectural Responsibility |
|---|---|---|
| **ScriptWorkbench** | `src/components/layout/ScriptWorkbench.tsx` | Main orchestrator managing the 60 FPS playback loop (`DemandFrameLoop`, `ClockInterpolator`), 1D `TemporalBVH`, auto-advance loop, and multi-block virtualization. |
| **EpisodeWaveformTransport** | `src/components/workbench/EpisodeWaveformTransport.tsx` | Master top-deck waveform transport with timeline zoom ($1.0\times$–$10.0\times$), horizontal panning, draggable pause gap handles, stereo VU/LUFS meter, and auto-advance toggle. |
| **ScriptBlockCard** | `src/components/workbench/ScriptBlockCard.tsx` | Individual screenplay block card supporting expanded waveform editing, volume fade curves, gain knob, collapsed mini transport, and unified script editor. |
| **UnifiedScriptEditor** | `src/components/workbench/UnifiedScriptEditor.tsx` | Zero-layout-shift script editor toggling between idle textarea and 60 FPS karaoke word-transport mode with character-weighted timing and click-to-seek. |
| **WaveformCanvas** | `src/components/workbench/WaveformCanvas.tsx` | Hardware-accelerated Canvas 2D peak renderer with volume fade curves starting strictly at $-\infty\text{ dB}$, gain scaling, and live timecode readout. |
| **BroadcastVuMeter** | `src/components/workbench/BroadcastVuMeter.tsx` | Real-time stereo LED peak meter with K-weighted LUFS readout, true-peak warning indicators, and broadcast compliance status. |
| **CastPanel & SpeakerCard** | `src/components/cast/CastPanel.tsx` | Speaker roster managing voice assignments, 3-band parametric Biquad EQ curves, dynamics compressor sliders, and zero-latency line auditions. |
| **CoWriterAgentDock** | `src/components/cowriter/CoWriterAgentDock.tsx` | Gemini-powered dramatic assistant supporting 3 writing modes (Scene, Story, Podcast), multimodal document upload, and Google Search Grounding. |
| **ExportMasterModal** | `src/components/export/ExportMasterModal.tsx` | Studio mastering control panel for offline ITU-R BS.1770-4 loudness normalization, stem export, and 320 kbps MP3 rendering. |
| **TemporalBVH** | `src/core/spatial/TemporalBVH.ts` | 1D interval tree spatial partition enabling $O(\log N)$ block and timepoint lookups during mouse hover, scrubbing, and playhead advancement. |
| **ClockInterpolator** | `src/core/spatial/ClockInterpolator.ts` | High-precision time accumulator supporting demand-based 60 FPS requestAnimationFrame loops and smooth scrubbing. |
| **WordTimingMapper** | `src/core/pacing/wordTimingMapper.ts` | Phonetic character-weight calculator and punctuation pause modeler for conversational speech alignment and click-to-seek progress mapping. |
| **StudioTransportEngine** | `src/core/dsp/StudioTransportEngine.ts` | Web Audio API node graph orchestrating master timeline playback, multi-speaker DSP parameter updates, and gain staging. |
| **LiveAudioPreviewer** | `src/core/dsp/LiveAudioPreviewer.ts` | Zero-latency single-block and speaker voice preview manager with dynamic elapsed time tracking. |
| **BiquadChain** | `src/core/dsp/BiquadChain.ts` | Cascaded 3-band parametric biquad equalizer (high shelf, mid peak, low shelf) with bypass toggles and frequency response calculations. |
| **MasteringChain** | `src/core/mastering/MasteringChain.ts` | Offline audio mastering pipeline combining K-weighting filters, $4\times$ oversampled True Peak limiting, and TPDF dithering. |
| **LoudnessMeter** | `src/core/mastering/LoudnessMeter.ts` | ITU-R BS.1770-4 momentary, short-term, and integrated LUFS measurement algorithm. |
| **DubrovnikDictionary** | `src/core/dubrovnik/dubrovnikDictionary.ts` | Master bidirectional lexical database with 570+ authenticated Ragusan vocabulary entries across 7 semantic categories. |
| **DubrovnikPhonetics** | `src/core/dubrovnik/dubrovnikPhonetics.ts` | Phonological rule engine handling masculine a-declension, infinitive truncation, diphthong contraction, and TTS breath pause injection. |
| **UseStoriaStore** | `src/store/useStoriaStore.ts` | Central Zustand store managing multi-project state, command-pattern history stack (undo/redo), audio cache sync, and playback modes. |

---

## 🎭 Flagship Demo: *The Triad of the Bass Frame*

Storia comes pre-configured with an authentic multi-speaker production demo based on ***The Triad of the Bass Frame*** (*Trijada Bas Okvira — Ponoćni Svodovi Lazareta*):

```
Episode Title: Ep 1: "Trijada Bas Okvira" (The Triad of the Bass Frame / Ponoćni Svodovi Lazareta)
Setting:       The midnight stone vaults of Lazareti & Old Port (Porat), Dubrovnik
Cast:          eNa (Emothelia), Mara (Maravexia), Foxy (Mate Fox Banchilo)
Language:      Croatian (Dubrovački govor / Raguzejski idiom)
```

```
                              [ APEX ]
                                FOXY
                     The Selector & Master of Ceremony
                   (Acoustic Geometry & Sonic Alchemy)
                   Keplerian Angle: θ_K = 137.5077°
                                 /  \
                                /    \
                               /      \
                              /        \
                             /          \
                            /            \
                           /              \
                          /   THE TRIAD    \
                         /                  \
                        /                    \
            eNa ────────────────────────────── Mara
       The Spatial Anchor & Muse            The Dancefloor Phoenix
    (Intuition, Empathy & Waveform)     (Kinetic Fire & Creative Spark)
```

1. **The Wave — eNa (Emothelia):** 4th-year architecture student (Age 25, Cancer). Voice: `Aoede`. Returning down the winding Adriatic highway from Split to Lazareti; lunar empathy, spatial geometry, and the *Living Carrier Wave* reconciling kinetic fire and sub-bass resonance.
2. **The Fire — Mara (Maravexia):** Media and communications (Age 25, Sagittarius). Voice: `Zephyr`. Kinetic fire, curls glowing like amber and žerava, sweat, leather, and unstoppable rhythm on the centuries-old flagstones.
3. **The Form — Foxy (Mate Fox Banchilo):** Electronic specialist, DJ, and programmer (Age 43, Gemini). Voice: `Fenrir`. Structural compiler anchoring Keplerian golden ratios ($\theta_K = 137.5077^\circ$) into stone-reflected acoustic conduits with dry coastal wit and zero master clipping.

> **Instant Demo Access:** Click the glowing **`Triad Demo` / `Trijada Demo`** button in the studio top bar to immediately load the project, audition all three voices, inspect Biquad EQ parameters, and experience Dubrovnik vernacular dialogue.

---

## 📚 Multi-Episode Studio Library

Switch instantly between four distinct episodic productions in the Top Bar switcher:
1. **Ep 1: "Trijada Bas Okvira" (The Triad of the Bass Frame):** Authentic Dubrovnik audio drama in the midnight vaults of Lazareti (eNa, Mara, Foxy).
2. **Ep 2: "Magla nad Zagrebom":** 1930s historical noir radio drama with Cynical Inspector Marko and Journalist Ana.
3. **Ep 3: "Signals from Palagruža":** Oceanic sci-fi thriller set around the remote lighthouse island of Palagruža.
4. **Ep 4: "Noćni arhiv Republike":** Historical secret diplomacy and cipher documentary podcast from the Old Dubrovnik archives.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js 18+** (Node 20 or 22 LTS recommended)
* **npm** or **pnpm**
* A modern web browser with Web Audio API support (Chrome, Edge, Firefox, Brave, Safari)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/robothandmade/storia.git
cd storia

# 2. Install dependencies
npm install

# 3. Start the local studio server
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build

```bash
# Typecheck and compile production bundle
npm run build

# Preview production build locally
npm run preview
```

### Running the Test Suite

Storia includes a comprehensive test suite of **39 test files and 145 unit/integration tests** verifying pacing calculators, temporal BVH trees, loudness normalization, lamejs MP3 encoding, bilingual translation, realtime volume fade curves, collapsed mini transports, auto-advance sequencing, and the Dubrovnik dialect engine:

```bash
npm test
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **User Interface** | [React 19](https://react.dev/) + [TypeScript 5.7](https://www.typescriptlang.org/) | Concurrent rendering, declarative studio UI, typed data models |
| **Bundler & Tooling** | [Vite 6](https://vitejs.dev/) + [Vitest](https://vitest.dev/) | Sub-second HMR, optimized production tree-shaking, unit testing |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern CSS variables, hardware-accelerated layouts, dark studio theme |
| **State & History** | [Zustand 5](https://github.com/pmndrs/zustand) | Command-pattern undo/redo stack, multi-project session library |
| **Audio Core** | Web Audio API + OfflineAudioContext | Biquad EQ, dynamics compression, procedural Foley synthesis |
| **Loudness & Limiting** | ITU-R BS.1770-4 K-Weighting + True Peak | Broadcast-compliant -16 LUFS loudness and sinc true-peak limiting |
| **Dither & Encoding** | TPDF Dither + [@breezystack/lamejs](https://github.com/shijinyu/lamejs) | High-resolution 24-bit WAV & client-side 320 kbps MP3 encoding |
| **Local Persistence** | [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB) | Content-addressed SHA-256 audio caching for zero token waste |
| **AI Backend** | [Google Gemini API](https://ai.google.dev/) | Gemini 2.5 Flash, Gemini 2.5 TTS, Gemini 3 Flash / Pro |

---

## 🎨 Studio Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Play / Pause master timeline transport |
| `Ctrl + Z` / `Cmd + Z` | Undo last edit, block reorder, or DSP toggle |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action |
| `Ctrl + Enter` | Insert new dialogue block below current line |
| `Alt + 1` .. `Alt + 9` | Quick-assign speaker to the active dialogue block |
| `Alt + ↑` / `Alt + ↓` | Reorder active block up or down |

---

## 👤 Author & Attribution

**Storia** was designed, programmed, and architected by:

* **Creator:** **Mate Fox Banchilo (Matija Miloslavić)**
* **Studio & Brand:** [Robot Hand Made](https://github.com/robothandmade)
* **Email:** `robothandmade.du@gmail.com`
* **Location:** Dubrovnik, Croatia 🇭🇷

> *"Dedicated to the voice actors, sound sculptors, playwrights, and the immortal spirit of the Ragusa storytellers who proved that true resonance can never be silenced by the grid."*

---

## 📄 License

This project is open-source software licensed under the **[MIT License](LICENSE)**.
