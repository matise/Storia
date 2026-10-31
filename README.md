# 🎙️ Storia — Intelligent Audio Drama, Podcast & Narration Studio

> **"From the archives of Dubrovnik to the modern soundstage — oral storytelling meets cutting-edge generative audio DSP."**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6.1-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-90%2F90%20Passing-emerald.svg)](https://vitest.dev/)

---

## 📖 The Story Behind Storia

Stories have echoed along the stone ramparts of the **Republic of Ragusa (Dubrovnik)** for centuries — recorded in invisible lemon-juice ink, diplomatic ciphers, radio dramas, and the cadence of spoken dialect. 

**Storia** was conceived by **Mate Fox Banchilo (Matija Miloslavić)** at **Robot Hand Made** as a dedication to the rich European and Mediterranean heritage of audio drama and radio theatre (*radiodrama*). While modern generative AI made speech synthesis possible, standard text-to-speech tools lacked the soul, pacing, spatial discipline, and dramatic precision demanded by real theatrical productions:

* Characters talked with uniform, sterile cadences.
* Dialects and gender morphology (such as Croatian Slavic agreement) were mangled by generic machine translators.
* Audio clips were disconnected fragments instead of continuous, master-ready studio timelines.
* Producers lacked broadcast-grade ITU-R BS.1770-4 loudness compliance and time-aligned stem separation.

**Storia** bridges this divide. It is a full-fledged, web-based digital audio workstation (DAW) and screenplay workbench engineered specifically for multi-speaker narrative fiction, investigative historical podcasts, audiobooks, and documentary dramas.

---

## ✨ Key Features & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              STORIA STUDIO                             │
├──────────────────┬─────────────────────────────────┬───────────────────┤
│  CAST & SPEAKERS │        SCRIPT WORKBENCH         │  AI AGENT & DOCK  │
│                  │                                 │                   │
│ • Voice Persona  │ • Screenplay / Fountain Format  │ • Search Grounding│
│ • Biquad EQ (3B) │ • DOD Canvas 2D Waveform Canvas │ • Co-Writer Beats │
│ • Dynamics Comp  │ • Temporal BVH 60 FPS Scrubber  │ • Dialogue Doctor │
│ • Speech Audition│ • Physical-Modeling SFX Engine  │ • HR ↔ EN Adapter │
│ • ITU-R Loudness │ • Real-Time Karaoke Alignment   │ • Gemini 3 Flash  │
└──────────────────┴─────────────────────────────────┴───────────────────┘
```

### 1. 🎭 Cast & Acoustic Persona Studio
- **Multi-Speaker Orchestration:** Assign distinct voice models, speaking rates, pitches, and color-coded avatars to each cast member.
- **Hardware-Accelerated DSP per Speaker:** Parametric 3-band Biquad EQ (120 Hz Low Shelf, 2.5 kHz Mid Peak, 8.0 kHz Air Shelf) and dynamics compressor.
- **Instant Audition:** Quick preview of any actor’s voice using browser speech synthesis or Gemini TTS.
- **Hotkeys:** Instant speaker selection via `Alt+1` through `Alt+9`.

### 2. ⚡ High-Performance DOD Waveform Transport & Timeline
- **Data-Oriented (DOD) SoA Architecture:** Structure-of-Arrays `Float32Array` peak buffers for lightning-fast rendering without garbage-collection spikes.
- **Unified Waveform Representation:** Master episode timeline and segment cards share synchronized, high-resolution 96-slice SoA peak algorithms and gain parameters.
- **Interactive Timeline Pause Dragging:** Direct mouse/pointer drag handles between timeline segments allow adjusting trailing pause durations (`pauseAfterMs`) in real time with visual feedback.
- **Bi-Directional Transport Scroll Linkage:** Clicking on any segment block or quick marker in the top transport timeline automatically selects and smoothly scrolls the workbench to that card below.
- **Temporal Bounding Volume Hierarchy (BVH):** 1D interval tree spatial partition enabling $O(\log N)$ block hits during mouse hover and fluid 60 FPS scrubbing.
- **Live Word Karaoke Synchronization:** Character- and word-level temporal tracking highlights words in real time as the narration plays.
- **DAW-Style Waveform Visualizer:** Center-crossing bipolar audio waves with dBFS gridlines, playhead indicators, and a precision draggable gain knob ($-48\text{ dB}$ to $+10\text{ dB}$).
- **Segment Card Collapse & Minimize:** Per-card expand/collapse chevrons toggle segments between a detailed screenplay editor and a sleek, compact summary view.
- **Clean Segment Header Layout:** Unified top bar with block index, collapse toggle, didaskalije (clean director notes without square brackets), status badges, audio tools (Regenerate, Waveform rebuild, Clear audio), reorder arrows, and delete controls.

### 3. 🤖 AI Agent & Dramatic Research Dock (Powered by Gemini)
- **Co-Writer 3 Workflow Modes:**
  - *Scene Co-Writer (3 Beats):* Generates 3 dramatic narrative beat choices.
  - *Long Complete Story:* Drafts a full multi-part episodic story arc.
  - *Podcast Episode:* Writes conversational dual-host interview and discussion formats.
- **Multimodal Document & Image Evidence Attachments:** Drag-and-drop or file upload (PDF, TXT, MD, images, scripts) onto the Co-Writer for instant context ingestion.
- **Deep Research Engine:** Integrated toggle enabling Google Search Grounding combined with deep multimodal document and image analysis.
- **Scalable Studio Panel Splitters:** Draggable splitter handles allow custom resizing of the Cast & Speakers and AI Agent & Research sidebars with min/max clamps.
- **Google Search Grounded Persona Research:** Fact-check historical queries, regional idioms, and period-accurate weaponry or attire directly from verified web sources with in-character responses.
- **Script Doctor & Vocal Cadence Polisher:** Analyze dialogue rhythm, breath pauses, and inject natural didaskalije / stage directions (`whispered`, `ironic`, `shivering`).
- **Bilingual Cultural & Grammatical Adapter (EN ↔ HR):** Preserves grammatical gender agreement (*glagolski pridjevi radni*, vocatives, aspect) and cultural nuance when adapting between Croatian and English.

### 4. 🔊 Hybrid Audio Synthesis & Procedural SFX
- **Gemini 2.5 Audio / TTS:** High-fidelity multi-speaker expressive voice synthesis.
- **Local Browser SpeechSynthesis Fallback:** Fully offline zero-token rehearsal mode.
- **Physical-Modeling Procedural SFX Engine:** Synthesizes Foley effects without external assets:
  - Rain & thunderstorm simulation
  - Wind gusts & resonant howling
  - Creaking doors & acoustic impacts
  - Footsteps on cobblestones
  - Vintage radio static & cinematic drones
  - Direct WAV drag-and-drop file import

### 5. 🎚️ Studio Mastering & Broadcast Export (Phase 6)
- **Broadcast Loudness Normalization:** Integrated ITU-R BS.1770-4 K-weighting filter and 4x polyphase sinc True Peak ceiling ($-1.0\text{ dBFS}$) compliant with podcast ($-16\text{ LUFS}$) and EBU R128 broadcast standards.
- **XorShift128+ TPDF Dither:** High-resolution multi-bit-depth audio quantization ($16\text{-bit}$, $24\text{-bit}$, and $32\text{-bit}$ float at $44.1\text{ kHz}$ or $48\text{ kHz}$).
- **High-Fidelity MP3 Export (320 kbps):** Pure client-side MP3 encoding at maximum $320\text{ kbps}$ constant bitrate via `lamejs` (`@breezystack/lamejs`), providing instant broadcast and distribution ready audio without external server transcoding.
- **Time-Aligned Multitrack Stems:** Export individual time-aligned WAV or MP3 (320 kbps) stems for every speaker alongside the complete episode master mix for post-production in Reaper, Pro Tools, or DaVinci Fairlight.
- **Round-Trip Screenplay Interchange:** Export to industry-standard `.fountain`, clean Markdown `.md`, or complete native `.storia.json` sessions.

### 6. 🌐 Deep Bilingual Experience (Croatian & English)
- 100% synchronized native terminology between English and Croatian.
- Fluid one-click language toggle in the top bar.
- Resilient UI scaling preventing layout wrapping regardless of text length.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/robothandmade/storia.git
cd storia

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Building for Production

```bash
# Typecheck and compile production bundle
npm run build

# Preview production build locally
npm run preview
```

### Running the Test Suite

```bash
# Run all 29 test suites (90 unit & integration tests)
npm test
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Bundler & Tooling** | [Vite 6](https://vitejs.dev/) + [Vitest](https://vitest.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **State Management** | [Zustand 5](https://github.com/pmndrs/zustand) (Immutable history & command stack) |
| **Icons & Brand** | Custom SVG Storybook Suite + [Lucide Icons](https://lucide.dev/) |
| **Local Cache** | [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB Audio Caching) |
| **Audio Core** | Web Audio API, OfflineAudioContext, Biquad DSP Chains, ITU-R BS.1770-4 Loudness, Sinc Resampling |
| **MP3 Encoding** | [@breezystack/lamejs](https://github.com/shijinyu/lamejs) (Pure JavaScript LAME MP3 Encoder at 320 kbps) |
| **AI Backend** | [Google Gemini API](https://ai.google.dev/) (Gemini 2.5 Flash, Gemini 2.5 TTS, Gemini 3 Flash/Pro) |

---

## 🎨 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Z` / `Cmd + Z` | Undo last edit or block reorder |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action |
| `Space` | Play / Pause master timeline transport |
| `Alt + 1` .. `Alt + 9` | Quick assign speaker to selected dialogue block |
| `Alt + ↑` / `Alt + ↓` | Reorder active block up or down |

---

## 👤 Author & Attribution

**Storia** was designed, programmed, and architected by:

* **Author:** Mate Fox Banchilo (Matija Miloslavić)
* **Studio / Brand:** [Robot Hand Made](https://github.com/robothandmade)
* **Email:** `robothandmade.du@gmail.com`
* **Origin:** Dubrovnik, Croatia 🇭🇷

> *"Dedicated to the art of radio drama, voice performers, scriptwriters, and the immortal spirit of the Ragusa storytellers."*

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

