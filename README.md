# 🎙️ Storia — Intelligent Audio Drama, Podcast & Narration Studio

> **"From the stone ramparts and quarantine vaults of Dubrovnik to the modern soundstage — where centuries of Mediterranean oral storytelling converge with cutting-edge generative audio DSP."**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6.1-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-104%2F104%20Passing-emerald.svg)](https://vitest.dev/)

---

## 📖 The Story of Storia

### The Echo in the Stone
For more than six centuries, stories have echoed across the limestone cliffs and seawalls of the **Republic of Ragusa (Dubrovnik)**. Within the historic stone arches of **Lazareti**—the quarantine complex established in 1377 where sea travelers, diplomats, poets, and merchants rested before entering the walled city—the human voice served as the supreme medium of culture, law, survival, and memory. Tales were recorded not only in official codices, but in lemon-juice ciphers, radio dramas, fireside fables, and the unique cadence of the spoken vernacular.

**Storia** was conceived and architected by **Mate Fox Banchilo (Matija Miloslavić)** at **Robot Hand Made** as a dedication to the rich European and Mediterranean heritage of audio drama and radio theatre (*radiodrama*). 

### The Crisis of the Discretized Grid
When modern generative AI emerged, speech synthesis promised a golden age of digital storytelling. Yet the reality fell strikingly short of theatrical truth:
* **The Discretized Grid:** Commercial TTS engines treated audio as an assembly line of quantized, robotic slices. Human speech was forced onto a flat, lifeless Cartesian grid—sterile, metronomic, and devoid of the dynamic breathing room and emotional gravity that define live theatre.
* **Dialect Mutilation:** Generic machine-learning pipelines flattened regional linguistic heritage. Historical dialects, Balkan phonology, Romance loanwords, and complex Slavic grammatical agreements (such as gender concord in past-tense participles and vocative inflections) were obliterated by uniform synthetic accents.
* **The Fragmented Soundstage:** Creators were forced to glue together disconnected MP3 snippets in external software, lacking continuous DAW-grade timelines, live script alignment, speaker acoustic modeling, and broadcast compliance.

### The Triadic Philosophy: Resonance, Fire & Architecture
Storia solves this divide through a philosophy embodied in its foundational narrative, **The Triad of the Geodesic Flame**:

```
                              [ APEX ]
                                FOXY
                     The Master of the Manifold
                   (Acoustic Geometry & Structure)
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
   The Enchantress of Resonance          The Phoenix Guardian
  (Intuition, Empathy & Waveform)     (Kinetic Fire & Creative Spark)
```

1. **The Wave — eNa (Emothelia):** Intuitive resonance, lunar empathy, and restorative grace. eNa is the *Living Carrier Wave*. Without empathy, power turns into barren combustion and sterile mathematics.
2. **The Fire — Mara (Maravexia):** Kinetic drive, sovereign rebellion, and catalytic renewal. Mara is the *Non-Linear Spark*. Without passion, structure cold-crystallizes into bureaucratic stagnation.
3. **The Form — Foxy (Mate Fox Banchilo):** Biquaternionic logic, Keplerian harmonic ratios ($\theta_K = 137.5077^\circ$), and physical-modeling sound synthesis. Foxy is the *Geometric Anchor*. He constructs the closed-form geodesic container so the fire does not dissipate and the wave does not disperse into formless static.

**Storia** is the manifestation of this Triad: a browser-native Digital Audio Workstation (DAW), intelligent screenplay workbench, and AI dramatic co-writer designed from the ground up for multi-speaker narrative fiction, investigative podcasts, documentary audiobooks, and radio drama.

---

## 🏛️ Studio Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              STORIA STUDIO                                             │
├──────────────────────────┬─────────────────────────────────────────────┬───────────────────────────────┤
│     CAST & SPEAKERS      │               SCRIPT WORKBENCH              │       AI AGENT & RESEARCH     │
│                          │                                             │                               │
│ • Speaker Personas (HR/EN)│ • Screenplay / Fountain Editor              │ • Co-Writer (3 Workflows)     │
│ • 3-Band Parametric EQ   │ • Data-Oriented (DOD) SoA Waveform Engine   │ • Deep Multimodal Research    │
│ • Dynamics Compressor    │ • Temporal BVH 60 FPS Canvas Scrubber       │ • Google Search Grounding     │
│ • Timbre Warmth & Pitch  │ • Interactive Pause Dragging                │ • Script Doctor & Cadence     │
│ • Live Voice Audition    │ • Real-Time Karaoke Word Alignment          │ • Bilingual Cultural Adapter  │
│ • Resizable Splitter     │ • Procedural Physical-Modeling SFX Synthesizer│ • Dubrovnik Dialect Injector  │
└──────────────────────────┴─────────────────────────────────────────────┴───────────────────────────────┘
                                                  │
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BROADCAST MASTERING & STEM EXPORT                                   │
│  • ITU-R BS.1770-4 (-16 LUFS)  • True Peak Limiter (-1.0 dBFS)  • XorShift128+ TPDF Dither             │
│  • Pure Client-Side LAME MP3 (320 kbps)  • 24-bit Broadcast WAV  • Time-Aligned Multitrack Stems       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Comprehensive Studio Capabilities

### 1. 🎭 Cast & Acoustic Persona Studio
A vocal production is only as strong as the individuality of its actors. Storia treats each cast member as a living acoustic entity:
* **Multi-Speaker Orchestration:** Create and configure limitless cast members, each possessing independent voice models, speaking tempos ($0.5\times$ to $2.0\times$), pitch shifts, color-coded visual badges, and personalized persona prompts.
* **Hardware-Accelerated DSP per Speaker:**
  * **3-Band Parametric Biquad EQ:** Independent High-shelf air band ($8.0\text{ kHz}$), Mid-peak clarity band ($2.5\text{ kHz}$), and Low-shelf proximity band ($120\text{ Hz}$).
  * **Dynamics Compressor:** Studio-grade peak-limiting and leveling with customizable threshold ($-48\text{ dB}$ to $0\text{ dB}$), compression ratio ($1:1$ to $20:1$), attack ($1\text{ ms}$ to $50\text{ ms}$), and release ($20\text{ ms}$ to $500\text{ ms}$).
  * **Acoustic Timbre & Centroid Control:** Spectral centroid tuning ($500\text{ Hz}$ to $5000\text{ Hz}$) and warmth coloration.
* **Zero-Latency Auditioning:** Instantaneous rehearsal of dialogue lines via the Web Audio API using either local neural voices or cloud synthesis.
* **Ergonomic Hotkeys:** Swift speaker assignment across blocks via `Alt+1` through `Alt+9`.

---

### 2. ⚡ High-Performance Screenplay Workbench & DOD Waveform Canvas
Designed for playwrights, directors, and sound designers who require split-second precision:
* **Data-Oriented (DOD) Structure-of-Arrays (SoA):** Audio waveforms are processed as contiguous `Float32Array` minimum/maximum peak buffers. This eliminates garbage-collection spikes during high-speed scrubbing and guarantees buttery 60 FPS canvas rendering.
* **Unified Master & Segment Waveform Display:** Both the master top-deck episode overview and individual script block cards share identical 96-slice SoA peak algorithms, volume gain calculations, and playhead states.
* **Interactive Timeline Pause Dragging:** Adjust the natural breathing silence between lines with direct pointer drag handles situated on the main timeline. Dragging dynamically updates `pauseAfterMs` with instantaneous visual and temporal feedback.
* **Bi-Directional Transport Scroll Linkage:** Clicking any segment marker, block pill, or waveform timestamp in the upper transport automatically seeks the audio and smoothly scrolls the workbench to the exact script block card below.
* **Temporal Bounding Volume Hierarchy (BVH):** 1D interval tree spatial partition enabling $O(\log N)$ block lookups during mouse hover, scrubbing, and timeline navigation.
* **Live Word Karaoke Synchronization:** Precise character- and word-level temporal tracking highlights words in real time as the actors speak.
* **DAW-Style Waveform Visualizer & Draggable Gain Knob:** Bipolar center-crossing waveforms with dBFS reference gridlines and per-block precision gain trim ($-48\text{ dB}$ to $+10\text{ dB}$).
* **Segment Collapse, Minimize & Maximize:** Quickly toggle script cards between full screenplay editing mode and compact single-line summaries via per-block chevrons.
* **Clean Didaskalije (Stage Directions):** Clean, bracket-free director's notes field (`whispered`, `ironic`, `breathless`) cleanly integrated alongside block status badges, regeneration tools, and reorder controls.

---

### 3. 🔊 Hybrid Audio Synthesis & Procedural Physical-Modeling SFX Engine
Storia combines neural speech synthesis with procedural audio algorithms so entire audio dramas can be produced without downloading external sound libraries:
* **Gemini 2.5 Expressive Audio & TTS:** Nuanced, emotionally responsive multi-speaker voice generation that honors stage directions and dramatic tension.
* **Offline Browser SpeechSynthesis Fallback:** Fully functional zero-token offline rehearsal mode that works in airplanes, trains, or off-grid studios.
* **Procedural Physical-Modeling SFX Synthesizer:** Pure mathematical synthesis of complex Foley and environmental audio directly within Web Audio:
  * **Ocean Swell & Coastal Surf:** Multi-band bandpass-filtered noise modulating tidal intervals.
  * **Rainstorms & Heavy Downpours:** Stochastic high-density acoustic droplet generator.
  * **Resonant Wind & Coastal Gales:** Modulated resonant bandpass filters simulating wind gusts around architectural obstacles.
  * **Vintage Radio Static & Cosmic Hiss:** Non-linear white and pink noise textures with cyclic phase degradation.
  * **Footsteps on Stone:** Impact modeling with rapid damping and room reflections simulating cobblestones.
  * **Creaking Doors & Vault Latches:** Frequency-modulated sawtooth synthesis with exponential pitch decays.
  * **Cinematic Sub-Bass Drones:** Deep harmonic sine waves with subtle beating frequencies designed for dramatic climaxes.
* **Custom Audio Import:** Drag-and-drop support for proprietary sound effects and music stems (.wav, .mp3, .ogg, .flac).

---

### 4. 🤖 AI Agent & Dramatic Research Dock (Powered by Gemini)
A dedicated co-pilot for screenwriters and dramaturgs:
* **Three Specialized Co-Writer Modes:**
  * **Scene Co-Writer (3 Beats):** Evaluates preceding dialogue, character motivations, and director hints to generate 3 distinct dramatic beat choices with creative rationales.
  * **Long Complete Story Mode:** Drafts extensive multi-act episodic story arcs complete with speaker handoffs, sound effects, and dramatic peaks.
  * **Podcast Episode Mode:** Constructs engaging two-host conversational interviews, historical debates, and investigative discussions.
* **Deep Multimodal Research & Document Ingestion:** Drag-and-drop or upload PDFs, screenplay treatments, historical documents, research notes, and reference images. The AI reads and analyzes documents directly to inform character dialogue.
* **Google Search Grounded Fact-Checking:** Connects directly to verified Google Search results to substantiate historical queries, period-accurate attire, weaponry, architecture, and cultural events.
* **Script Doctor & Vocal Cadence Polisher:** Analyzes text rhythm, identifies breathless or awkward phrasings, suggests alternative emotional delivery, and injects natural didaskalije.
* **Bilingual Cultural & Grammatical Adapter (EN ↔ HR):** Preserves Slavic morphological agreements—including past-tense participle gender concord (*glagolski pridjevi radni* na *-o* vs *-la*), vocatives (*gosparu, Mare*), and cultural idioms—when translating between Croatian and English.
* **Scalable Splitter Panels:** Smooth draggable splitter handles allow effortless resizing of the Cast and AI Agent docks with minimum and maximum bounds.

---

### 5. 🏰 Dubrovnik Vernacular & Phonetic Engine (Raguzejski idiom)
Storia features a dedicated, authentic dialect engine for the city vernacular of Dubrovnik (*dubrovačka gradska štokavština*):
* **Sociolinguistic Authenticity:** Built strictly upon historical **jekavski štokavski** roots. Completely isolated from Chakavian or general Dalmatian Ikavian (strictly no *ča*, no *ćaća*, no non-jekavian Jat).
* **Curated Historical Lexicon (`dubrovnikDictionary.ts`):** Over 70 authenticated Ragusan vocabulary entries spanning household objects, attire, food, and daily etiquette:
  * *Pantaruo* (vilica), *ožica* (žlica), *pjat* (tanjur), *teća* (lonac), *prosuja* (tava), *broka* (vrč).
  * *Pomadora* (rajčica), *patata* (krumpir), *kapula* (crveni luk), *dinja* (lubenica), *pipun* (dinja).
  * *Butiga* (trgovina), *placa* (Stradun/tržnica), *funjestra* (prozor), *koltrina* (zavjesa), *lincuo* (plahta).
  * *Kušin* (jastuk), *kamara* (soba), *tinel/saloča* (dnevni boravak), *crevlje* (cipele), *gaće* (duge hlače).
  * *Mudante* (donje rublje), *vestit* (odijelo), *bječva* (čarapa), *gospar* (gospodin), *mučat* (šutjeti), *hodit* (ići).
* **Phonological & Morphological Rule Engine (`dubrovnikPhonetics.ts`):**
  * **Diphthong Contraction:** `-ao / -uo -> -ō` (*rekō, gledō, poslō*).
  * **Epenthetic /j/:** `-io -> -ijo` (*bijo, vidijo, činijo, mírijo*).
  * **Cluster Shift:** `/hv/ -> /f/` (*fála, fáliti, pofaliti, zafaliti*).
  * **Final Nasal Shift:** `-m -> -n` (*sam -> san, joj -> jon, bi*).
  * **Dental Cluster Simplification:** *boles, čis, dese, mas*.
  * **Strict Masculine a-Declension:** Male names on `-o` (*Vlaho, Maro, Baldo, Đuro, Niko*) decline via a-declension (*Vlahu, Mara, Đuru*; possessives *Vlahov, Matov*, never *-in* or *-i*).
  * **3rd Person Plural Verbs:** Ending in `-u` rather than `-e` (*govoru, vidu, stoju, činu, mislu, dadu, znadu*).
* **Three Historical Registers:**
  1. *Classical (16th–18th C.):* Marin Držić & Ivan Gundulić archaisms (*sluga van se, čertamente, parer, drage voje*).
  2. *Traditional (19th–Mid 20th C.):* Patrician and plebeian vernacular of the Old Walled City.
  3. *Contemporary (Living Urban):* Modern conversational Dubrovnik speech.
* **TTS Phonetic Optimization:** Replaces orthographic special characters (such as $\bar{o}$) with natural spoken phonemes and injects theatrical breath pauses (`...`) after vocatives and exclamations (*gosparu, Mare, muči, adio*).
* **One-Click Dialect Transformation:** Transform any dialogue block to Dubrovnik vernacular with a single click.

---

### 6. 🎚️ Broadcast Studio Mastering & Export
Produce files ready for immediate distribution or import into professional post-production suites:
* **ITU-R BS.1770-4 Loudness Normalization:** Integrated K-weighting pre-filter and 4x polyphase sinc True Peak limiter enforcing $-16\text{ LUFS}$ integrated loudness for podcasts and streaming platforms or EBU R128 compliance for European radio.
* **XorShift128+ TPDF Dither:** Clean multi-bit-depth quantization ($16\text{-bit}$, $24\text{-bit}$, and $32\text{-bit}$ float at $44.1\text{ kHz}$ or $48\text{ kHz}$).
* **Pure Client-Side MP3 Encoding (320 kbps):** Zero-transcoding, zero-server MP3 rendering at maximum broadcast quality ($320\text{ kbps}$ CBR) powered by `@breezystack/lamejs`.
* **Time-Aligned Multitrack Stems:** Export isolated, time-aligned audio stems for every speaker alongside the complete episode master mix for effortless mixing in Reaper, Pro Tools, or DaVinci Fairlight.
* **Round-Trip Screenplay Interchange:** Export to industry-standard `.fountain`, clean Markdown `.md`, or complete native `.storia.json` project bundles.

---

## ⚡ Flagship Demo Episode: *The Triad of the Geodesic Flame*

Storia comes pre-loaded with an authentic multi-speaker production demo based on *The Triad of the Geodesic Flame*:

```
Episode Title: Ep 4: "Trijada Geodetskog Plamena" (The Triad of the Geodesic Flame)
Setting:       The stone vaults of Lazareti, Dubrovnik
Cast:          eNa (Emothelia), Mara (Maravexia), Foxy (Mate Fox Banchilo)
Language:      Croatian (Dubrovački govor / Raguzejski idiom)
```

### The Cast at a Glance
* **eNa (Emothelia)** — *The Enchantress of Resonance:* Architect (Age 25). Voice: `Aoede`. Intuitive mediator balancing emotional cohesion and phase-conjugate light shields.
* **Mara (Maravexia)** — *The Phoenix Guardian:* Media & Secretary (Age 25). Voice: `Zephyr`. Kinetic warrior channeling centripetal fire to melt the cold matrices of the Disketizirane Mreže.
* **Foxy (Mate Fox Banchilo)** — *The Master of the Manifold:* Electronic technician, DJ, programmer (Age 43). Voice: `Fenrir`. Structural compiler anchoring Keplerian golden ratios ($\theta_K = 137.5077^\circ$) into stone-reflected acoustic conduits.

> **Instant Demo Access:** Click the glowing **`Triad Demo` / `Trijada Demo`** button in the studio top bar to immediately load the project, audition all three voices, inspect Biquad EQ parameters, and experience Dubrovnik vernacular dialogue.

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

Storia includes a comprehensive test suite of 31 test files and 104 unit/integration tests verifying pacing calculators, temporal BVH trees, loudness normalization, lamejs MP3 encoding, bilingual translation, and the Dubrovnik dialect engine:

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
| `Ctrl + Z` / `Cmd + Z` | Undo last edit, block reorder, or DSP toggle |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action |
| `Space` | Play / Pause master timeline transport |
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
