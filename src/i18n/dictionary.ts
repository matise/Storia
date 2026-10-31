import { SupportedLanguage } from '../types/storia';

export interface TranslationDictionary {
  // TopBar
  appTitle: string;
  appSubtitle: string;
  episodeLabel: string;
  undo: string;
  redo: string;
  apiKeyOk: string;
  apiKeySynth: string;
  apiKeyMissing: string;
  engineGeminiTts: string;
  engineBrowserTts: string;
  genAllAudio: string;
  regenAllAudio: string;
  rebuildAllWaveforms: string;
  clearAllAudio: string;
  generatingAudio: string;
  exportMaster: string;
  resetSample: string;
  tokensAbbrev: string;

  // CastSidebar & Speaker Preview Tools
  castAndSpeakers: string;
  newSpeaker: string;
  voiceLabel: string;
  styleLabel: string;
  linesCount: string;
  totalEstimated: string;
  audioTokensLabel: string;
  lufsLabel: string;
  broadcastOk: string;
  editSpeakerTooltip: string;
  previewSpeakerVoice: string;
  stopSpeakerPreview: string;
  eqToggleLabel: string;
  dynToggleLabel: string;
  dspQuickSliders: string;
  regenSpeakerAudio: string;
  clearSpeakerAudio: string;

  // ScriptWorkbench & Per-Block Audio/Waveform Tools
  playAll: string;
  pause: string;
  loop: string;
  addLine: string;
  addDialogue: string;
  addNarration: string;
  addDirection: string;
  addSfx: string;
  frameloopDemand: string;
  ttsOk: string;
  ttsStale: string;
  ttsUnrendered: string;
  ttsRendering: string;
  renderLine: string;
  reRenderLine: string;
  regenerateAudioBtn: string;
  regenerateAudioTooltip: string;
  rebuildWaveformBtn: string;
  rebuildWaveformTooltip: string;
  deleteAudioBtn: string;
  deleteAudioTooltip: string;
  directorNotesPlaceholder: string;
  dialoguePlaceholder: string;
  narrationPlaceholder: string;
  sfxPlaceholder: string;
  directionPlaceholder: string;
  pauseMsLabel: string;
  moveUp: string;
  moveDown: string;
  deleteBlock: string;
  waveformStatusPrefix: string;
  bvhActivePrefix: string;

  // Block types
  typeDialogue: string;
  typeNarration: string;
  typeDirection: string;
  typeSfx: string;

  // SFX Studio Controls
  sfxPresetLabel: string;
  sfxPresetAuto: string;
  sfxPresetTramRail: string;
  sfxPresetFootsteps: string;
  sfxPresetWeatherRain: string;
  sfxPresetWindStorm: string;
  sfxPresetThunder: string;
  sfxPresetDoorCreak: string;
  sfxPresetImpactKnock: string;
  sfxPresetCinematicDrone: string;
  sfxPresetRadioStatic: string;
  sfxPresetCustomUpload: string;
  sfxDurationLabel: string;
  importSfxBtn: string;
  importSfxTooltip: string;
  generateSfxBtn: string;
  reGenerateSfxBtn: string;

  // AgentDock & Gemini Model Picker
  aiDockTitle: string;
  geminiModelPickerLabel: string;
  geminiTtsModelPickerLabel: string;
  searchGroundingToggle: string;
  tabPersonaPov: string;
  tabCoWriter: string;
  tabDoctor: string;
  tabAdapter: string;
  modePersonaResearch: string;
  speakerSelectLabel: string;
  queryLabel: string;
  queryPlaceholder: string;
  researchViaGoogle: string;
  inCharacterResponse: string;
  citationsLabel: string;
  insertAsDialogue: string;
  researchNotebookTitle: string;
  modeCoWriter: string;
  coWriterWorkflowLabel: string;
  coWriterModeSceneBeats: string;
  coWriterModeCompleteStory: string;
  coWriterModePodcastEpisode: string;
  coWriterModeSceneBeatsDesc: string;
  coWriterModeCompleteStoryDesc: string;
  coWriterModePodcastEpisodeDesc: string;
  coWriterGenerateStoryBtn: string;
  coWriterGeneratePodcastBtn: string;
  leftSplitterTooltip: string;
  rightSplitterTooltip: string;
  coWriterDirectionHintLabel: string;
  coWriterDirectionHintPlaceholder: string;
  coWriterDeepResearchToggle: string;
  coWriterDeepResearchActive: string;
  coWriterDeepResearchIdle: string;
  coWriterDeepResearchTooltip: string;
  coWriterDropzoneLabel: string;
  coWriterDropzoneActive: string;
  coWriterUploadBtn: string;
  coWriterAttachedFilesLabel: string;
  coWriterRemoveFile: string;
  coWriterClearFiles: string;
  analyzedFilesLabel: string;
  generateBeatsBtn: string;
  insertBeatBtn: string;
  modeScriptDoctor: string;
  targetBlockLabel: string;
  runDoctorBtn: string;
  applyPolishBtn: string;
  modeBilingualAdapter: string;
  translationDirectionLabel: string;
  runAdapterBtn: string;
  applyTranslationBtn: string;
  genderMorphologyLabel: string;
  phase4PreviewNotice: string;

  // SpeakerConfigModal
  speakerModalTitle: string;
  speakerName: string;
  speakerGender: string;
  speakerAge: string;
  speakerColor: string;
  baseVoice: string;
  browserVoiceLabel: string;
  browserVoiceAuto: string;
  stylePrompt: string;
  personaPrompt: string;
  actingNotes: string;
  speakingRate: string;
  pitchAdjustment: string;
  enableDirectorNotes: string;
  ssmlEnabled: string;
  speakerAuditionTitle: string;
  speakerAuditionSamplePlaceholder: string;
  dspEqSection: string;
  enableEqChain: string;
  enableDynamicsComp: string;
  lowShelf120Hz: string;
  midPeak2500Hz: string;
  highShelf8000Hz: string;
  compressorThreshold: string;
  compressorRatio: string;
  saveChanges: string;
  cancel: string;
  deleteSpeaker: string;

  // ApiKeyModal
  apiModalTitle: string;
  apiModalSubtitle: string;
  apiKeyInputLabel: string;
  apiKeyPlaceholder: string;
  ttsProviderSelectLabel: string;
  geminiTtsOptionTitle: string;
  geminiTtsOptionDesc: string;
  browserTtsOptionTitle: string;
  browserTtsOptionDesc: string;
  proceduralFallbackLabel: string;
  proceduralFallbackDesc: string;
  ttsModelLabel: string;
  textModelLabel: string;
  audioFormatLabel: string;
  clearCacheLabel: string;
  saveApiSettings: string;
  clearKeyLabel: string;

  // Gender options
  genderMale: string;
  genderFemale: string;
  genderNonBinary: string;
  genderNeutral: string;
  genderOther: string;

  // Multi-Episode Library & Episode Properties
  episodePropertiesBtn: string;
  episodePropertiesModalTitle: string;
  episodesLibraryTitle: string;
  newEpisodeBtn: string;
  duplicateEpisodeBtn: string;
  deleteEpisodeBtn: string;
  episodeTitleLabel: string;
  episodeDescriptionLabel: string;
  episodeLanguageLabel: string;
  episodeGenreLabel: string;
  episodeAuthorLabel: string;
  episodeTargetWpmLabel: string;
  episodeSampleRateLabel: string;
  episodeBitDepthLabel: string;
  episodeTargetLufsLabel: string;
  toggleEpisodeMetaTooltip: string;

  // Waveform Transport Controls
  waveformTransportBtn: string;
  masterTimelineWaveformLabel: string;
  transportJumpStart: string;
  transportPrevBlock: string;
  transportRewind5s: string;
  transportStop: string;
  transportForward5s: string;
  transportNextBlock: string;
  transportSpeedLabel: string;
  blockWaveformPlayTooltip: string;
  blockWaveformRestartTooltip: string;
  gainKnobLabel: string;
  gainKnobTooltip: string;
  unrenderedWaveformNotice: string;

  // Export Master Modal (Phase 6)
  exportMasterModalTitle: string;
  tabAudioMastering: string;
  tabScriptArchive: string;
  exportFormatWav: string;
  exportSampleRateLabel: string;
  exportBitDepthLabel: string;
  exportDitherLabel: string;
  exportDitherTpdf: string;
  exportDitherNone: string;
  exportTargetLufsLabel: string;
  exportTruePeakCeilingLabel: string;
  exportDownloadMasterBtn: string;
  exportDownloadStemsBtn: string;
  exportRenderingNotice: string;
  exportDownloadFountainBtn: string;
  exportDownloadMarkdownBtn: string;
  exportDownloadProjectJsonBtn: string;
  exportImportProjectJsonBtn: string;
  exportMasterSuccessNotice: string;
  exportStemsSuccessNotice: string;

  // Additional UI & Dialog Labels
  autoDiacriticsTooltip: string;
  exportSubtitle: string;
  exportScriptArchiveDesc: string;
  exportFountainDesc: string;
  exportMarkdownDesc: string;
  exportProjectJsonDesc: string;
  masterAnalysisTitle: string;
  statIntegrated: string;
  statTruePeak: string;
  statMakeupGain: string;
  statTotalLength: string;
  audioEngineFooter: string;
  blocksCount: string;
  speakersCount: string;

  // Real-time Engine & Shortcuts
  frameloopActive: string;
  frameloopIdle: string;
  timeRangePrefix: string;
  keyboardShortcutsHelp: string;
}

export const DICTIONARY: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appTitle: 'Storia',
    appSubtitle: 'Audio Drama, Podcast & Narration Studio',
    episodeLabel: 'Episode',
    undo: 'Undo',
    redo: 'Redo',
    apiKeyOk: 'API Key: OK',
    apiKeySynth: 'Browser TTS',
    apiKeyMissing: 'API Key: Setup',
    engineGeminiTts: 'Gemini 2.5 TTS',
    engineBrowserTts: 'Local Browser TTS',
    genAllAudio: 'Gen All Audio',
    regenAllAudio: 'Regen All Audio',
    rebuildAllWaveforms: 'Rebuild Waveforms',
    clearAllAudio: 'Clear All Audio',
    generatingAudio: 'Synthesizing...',
    exportMaster: 'Export Master',
    resetSample: 'Reset Sample',
    tokensAbbrev: 'tok',

    castAndSpeakers: 'CAST & SPEAKERS',
    newSpeaker: 'New Speaker',
    voiceLabel: 'Voice',
    styleLabel: 'Style',
    linesCount: 'lines',
    totalEstimated: 'Total Est',
    audioTokensLabel: 'Audio Tokens',
    lufsLabel: 'LUFS',
    broadcastOk: 'Broadcast OK',
    editSpeakerTooltip: 'Configure voice, persona & Biquad EQ',
    previewSpeakerVoice: 'Preview Voice',
    stopSpeakerPreview: 'Stop Preview',
    eqToggleLabel: 'EQ',
    dynToggleLabel: 'Dyn',
    dspQuickSliders: 'Quick DSP & Audio Tools',
    regenSpeakerAudio: 'Regen Speaker Audio',
    clearSpeakerAudio: 'Clear Speaker Audio',

    playAll: 'Play All',
    pause: 'Pause',
    loop: 'Loop',
    addLine: 'Add Line',
    addDialogue: '+ Dialogue',
    addNarration: '+ Narration',
    addDirection: '+ Direction',
    addSfx: '+ SFX',
    frameloopDemand: 'Frameloop: Demand',
    ttsOk: 'TTS: OK',
    ttsStale: 'TTS: Stale',
    ttsUnrendered: 'TTS: Ready',
    ttsRendering: 'TTS: Rendering...',
    renderLine: 'Render Line',
    reRenderLine: 'Re-render Line',
    regenerateAudioBtn: 'Regenerate',
    regenerateAudioTooltip: 'Force regenerate TTS audio & waveform for this block',
    rebuildWaveformBtn: 'Waveform',
    rebuildWaveformTooltip: 'Rebuild Structure-of-Arrays (SoA) waveform peaks for this block',
    deleteAudioBtn: 'Clear Audio',
    deleteAudioTooltip: 'Delete generated audio & waveform data for this block',
    directorNotesPlaceholder: 'Director notes, e.g. [whispered]',
    dialoguePlaceholder: 'Enter spoken dialogue line...',
    narrationPlaceholder: 'Enter narrative prose...',
    sfxPlaceholder: 'Describe sound effect cue...',
    directionPlaceholder: 'Stage or acoustic direction...',
    pauseMsLabel: 'Pause (ms)',
    moveUp: 'Move block up (Alt+Up)',
    moveDown: 'Move block down (Alt+Down)',
    deleteBlock: 'Delete block',
    waveformStatusPrefix: 'Waveform: Canvas 2D SoA',
    bvhActivePrefix: '1D BVH Active',

    typeDialogue: 'Dialogue',
    typeNarration: 'Narration',
    typeDirection: 'Direction',
    typeSfx: 'SFX',

    sfxPresetLabel: 'SFX Engine',
    sfxPresetAuto: 'Auto-Detect (AI / Text)',
    sfxPresetTramRail: 'Tram & Rails',
    sfxPresetFootsteps: 'Footsteps & Cobblestone',
    sfxPresetWeatherRain: 'Rain & Wet Street',
    sfxPresetWindStorm: 'Wind & Fog',
    sfxPresetThunder: 'Thunder & Storm',
    sfxPresetDoorCreak: 'Door Creak & Latch',
    sfxPresetImpactKnock: 'Knocks & Impacts',
    sfxPresetCinematicDrone: 'Cinematic Drone',
    sfxPresetRadioStatic: 'Radio & Static',
    sfxPresetCustomUpload: 'Custom Audio File',
    sfxDurationLabel: 'Dur (s)',
    importSfxBtn: 'Import WAV/MP3',
    importSfxTooltip: 'Upload a local audio file (.wav, .mp3, .ogg) for this SFX block',
    generateSfxBtn: 'Generate SFX',
    reGenerateSfxBtn: 'Re-generate SFX',

    aiDockTitle: 'AI AGENT & RESEARCH DOCK',
    geminiModelPickerLabel: 'Gemini Agent Model',
    geminiTtsModelPickerLabel: 'Gemini TTS Model',
    searchGroundingToggle: 'Search Grounding',
    tabPersonaPov: 'Persona POV',
    tabCoWriter: 'Co-writer',
    tabDoctor: 'Doctor',
    tabAdapter: 'EN/HR',
    modePersonaResearch: 'Mode: Persona Research',
    speakerSelectLabel: 'Speaker',
    queryLabel: 'Query',
    queryPlaceholder: 'Ask a historical or factual question through this character lens...',
    researchViaGoogle: 'Research via Google Search Ground',
    inCharacterResponse: 'In-Character Response',
    citationsLabel: 'Citations',
    insertAsDialogue: 'Insert as Dialogue Line',
    researchNotebookTitle: 'Research Notebook History',
    modeCoWriter: 'Mode: Scene Co-Writer (3 Beats)',
    coWriterWorkflowLabel: 'Co-Writer Mode',
    coWriterModeSceneBeats: 'Scene (3 Beats)',
    coWriterModeCompleteStory: 'Long Story',
    coWriterModePodcastEpisode: 'Podcast',
    coWriterModeSceneBeatsDesc: 'Generates 3 scene beat continuation options',
    coWriterModeCompleteStoryDesc: 'Generates a long complete episodic story arc',
    coWriterModePodcastEpisodeDesc: 'Generates an engaging conversational podcast episode',
    coWriterGenerateStoryBtn: 'Generate Complete Story',
    coWriterGeneratePodcastBtn: 'Generate Podcast Episode',
    leftSplitterTooltip: 'Drag to resize Cast & Speakers panel',
    rightSplitterTooltip: 'Drag to resize AI Agent & Research panel',
    coWriterDirectionHintLabel: 'Scene Direction Hint (Optional)',
    coWriterDirectionHintPlaceholder: 'e.g., Introduce a sudden phone call or reveal a clue...',
    coWriterDeepResearchToggle: 'Deep Research',
    coWriterDeepResearchActive: 'Deep Research: ON',
    coWriterDeepResearchIdle: 'Deep Research: OFF',
    coWriterDeepResearchTooltip: 'Enables Google Search Grounding and deep multimodal document/image analysis',
    coWriterDropzoneLabel: 'Drag & drop image, document or screenplay here, or click to upload',
    coWriterDropzoneActive: 'Release to attach file to Co-Writer...',
    coWriterUploadBtn: 'Attach File',
    coWriterAttachedFilesLabel: 'Attached Evidence & Files',
    coWriterRemoveFile: 'Remove file',
    coWriterClearFiles: 'Clear All',
    analyzedFilesLabel: 'Analyzed Files',
    generateBeatsBtn: 'Brainstorm 3 Next Beats',
    insertBeatBtn: 'Insert Beat into Script',
    modeScriptDoctor: 'Mode: Script Doctor & Vocal Cadence',
    targetBlockLabel: 'Target Script Block',
    runDoctorBtn: 'Analyze & Polish Cadence',
    applyPolishBtn: 'Apply Polish to Block',
    modeBilingualAdapter: 'Mode: Bilingual Cultural Adapter (EN ↔ HR)',
    translationDirectionLabel: 'Adaptation Direction',
    runAdapterBtn: 'Adapt Block Culturally',
    applyTranslationBtn: 'Apply Adapted Line',
    genderMorphologyLabel: 'Morphology / Gender Agreement',
    phase4PreviewNotice: 'Connected to Research Notebook — ready for live Gemini queries.',

    speakerModalTitle: 'Speaker & Voice DSP Configuration',
    speakerName: 'Name',
    speakerGender: 'Gender',
    speakerAge: 'Age',
    speakerColor: 'Badge Color',
    baseVoice: 'Gemini Base Voice',
    browserVoiceLabel: 'Local Browser TTS Voice',
    browserVoiceAuto: 'Auto-match by language & gender',
    stylePrompt: 'Vocal Style Prompt',
    personaPrompt: 'LLM Persona System Prompt',
    actingNotes: 'Human Acting Notes (Didaskalije)',
    speakingRate: 'Speaking Rate',
    pitchAdjustment: 'Pitch Adjustment (st)',
    enableDirectorNotes: 'Parse [director notes] as acoustic modifiers',
    ssmlEnabled: 'Enable inline SSML (<break>, <mark>)',
    speakerAuditionTitle: 'Speaker Voice Audition & Test Phrase',
    speakerAuditionSamplePlaceholder: 'Enter sample phrase to audition this speaker...',
    dspEqSection: 'Client-Side Biquad EQ & Dynamics',
    enableEqChain: '3-Band Biquad EQ Enabled',
    enableDynamicsComp: 'Dynamics Compressor Enabled',
    lowShelf120Hz: 'Low-Shelf (120 Hz Warmth)',
    midPeak2500Hz: 'Mid-Peak (2.5 kHz Clarity)',
    highShelf8000Hz: 'High-Shelf (8.0 kHz Air)',
    compressorThreshold: 'Compressor Threshold (dB)',
    compressorRatio: 'Compressor Ratio',
    saveChanges: 'Save Speaker',
    cancel: 'Cancel',
    deleteSpeaker: 'Remove Speaker',

    apiModalTitle: 'TTS Synthesis Engine & BYOK Gemini API',
    apiModalSubtitle:
      'Choose between Google Gemini 2.5 Flash TTS (requires API key) or Local Browser TTS (Web Speech API).',
    apiKeyInputLabel: 'Google Gemini API Key (BYOK)',
    apiKeyPlaceholder: 'AIzaSy...',
    ttsProviderSelectLabel: 'Active TTS Synthesis Engine',
    geminiTtsOptionTitle: 'Gemini 2.5 Flash TTS (gemini-2.5-flash-preview-tts)',
    geminiTtsOptionDesc:
      'Studio neural multimodal speech synthesis with style conditioning, invisible director cues, and 24kHz PCM output.',
    browserTtsOptionTitle: 'Local Browser TTS (Web Speech API Alternative)',
    browserTtsOptionDesc:
      'Offline system speech synthesis using your browser and OS voices with zero API token usage.',
    proceduralFallbackLabel: 'Use Local Browser TTS Alternative (Offline / Zero-Quota)',
    proceduralFallbackDesc:
      'Uses built-in browser SpeechSynthesis voices when enabled or when no Gemini API key is configured.',
    ttsModelLabel: 'Native TTS Engine',
    textModelLabel: 'Storytelling & Research Agent',
    audioFormatLabel: 'Audio Stream Encoding',
    clearCacheLabel: 'Purge IndexedDB Audio Cache',
    saveApiSettings: 'Save Engine Settings',
    clearKeyLabel: 'Clear Key',

    genderMale: 'Male',
    genderFemale: 'Female',
    genderNonBinary: 'Non-binary',
    genderNeutral: 'Neutral',
    genderOther: 'Other',

    episodePropertiesBtn: 'Episode Settings',
    episodePropertiesModalTitle: 'Episodes Library & Episode Properties',
    episodesLibraryTitle: 'Studio Episodes Library',
    newEpisodeBtn: '+ New Episode',
    duplicateEpisodeBtn: 'Duplicate',
    deleteEpisodeBtn: 'Delete Episode',
    episodeTitleLabel: 'Episode Title',
    episodeDescriptionLabel: 'Description / Synopsis',
    episodeLanguageLabel: 'Episode Language',
    episodeGenreLabel: 'Genre',
    episodeAuthorLabel: 'Author / Producer',
    episodeTargetWpmLabel: 'Target Pacing (WPM)',
    episodeSampleRateLabel: 'Sample Rate (Hz)',
    episodeBitDepthLabel: 'Bit Depth',
    episodeTargetLufsLabel: 'Target Loudness (LUFS)',
    toggleEpisodeMetaTooltip: 'Show / Hide Episode Properties Bar',

    waveformTransportBtn: 'Waveform Transport',
    masterTimelineWaveformLabel: 'Master Episode Waveform & Transport',
    transportJumpStart: 'Jump to Start',
    transportPrevBlock: 'Previous Block',
    transportRewind5s: 'Rewind 5s',
    transportStop: 'Stop & Reset',
    transportForward5s: 'Forward 5s',
    transportNextBlock: 'Next Block',
    transportSpeedLabel: 'Speed',
    blockWaveformPlayTooltip: 'Play / Pause block from waveform',
    blockWaveformRestartTooltip: 'Restart block from 0:00',
    gainKnobLabel: 'Gain',
    gainKnobTooltip: 'Volume gain knob (-inf to +10 dB, double-click to reset 0 dB)',
    unrenderedWaveformNotice: 'No audio generated yet',

    exportMasterModalTitle: 'Studio Export & Broadcast Audio Mastering',
    tabAudioMastering: 'Audio Master & Stems',
    tabScriptArchive: 'Script & Project Bundles',
    exportFormatWav: 'Broadcast WAV / RIFF',
    exportSampleRateLabel: 'Sample Rate',
    exportBitDepthLabel: 'Bit Depth',
    exportDitherLabel: 'Dithering Algorithm',
    exportDitherTpdf: 'TPDF (Triangular PDF Noise)',
    exportDitherNone: 'None (Direct Truncation)',
    exportTargetLufsLabel: 'Target Integrated Loudness (LUFS)',
    exportTruePeakCeilingLabel: 'True Peak Limiter Ceiling (dBFS)',
    exportDownloadMasterBtn: 'Download Mastered Episode WAV',
    exportDownloadStemsBtn: 'Download Multi-Track Speaker Stems (ZIP/WAV)',
    exportRenderingNotice: 'Mastering episode audio with Biquad DSP, LUFS normalization & TPDF dither...',
    exportDownloadFountainBtn: 'Download Screenplay (.fountain)',
    exportDownloadMarkdownBtn: 'Download Production Script (.md)',
    exportDownloadProjectJsonBtn: 'Export Project Bundle (.storia.json)',
    exportImportProjectJsonBtn: 'Import Project Bundle (.storia.json)',
    exportMasterSuccessNotice: 'Master episode WAV generated successfully!',
    exportStemsSuccessNotice: 'Speaker stems generated and downloaded successfully!',

    autoDiacriticsTooltip: 'Auto-restore Croatian diacritics (č, ć, ž, š, đ)',
    exportSubtitle: 'Configure broadcast loudness normalization, bit depth, and script archival',
    exportScriptArchiveDesc: 'Export human-readable production scripts or lossless Storia project bundles for backup and cross-machine restoration.',
    exportFountainDesc: 'Standard screenplay format for Final Draft / Highland',
    exportMarkdownDesc: 'Cast table, timestamps, token counts & notebook appendix',
    exportProjectJsonDesc: 'Lossless bundle of speakers, blocks, EQ & research data',
    masterAnalysisTitle: 'Broadcast Master Analysis:',
    statIntegrated: 'Integrated:',
    statTruePeak: 'True Peak:',
    statMakeupGain: 'Makeup Gain:',
    statTotalLength: 'Total Length:',
    audioEngineFooter: 'Storia Studio Audio Engine v1.0 • ITU-R BS.1770-4',
    blocksCount: 'blocks',
    speakersCount: 'speakers',
    frameloopActive: 'Active',
    frameloopIdle: 'Idle',
    timeRangePrefix: 'Time:',
    keyboardShortcutsHelp: 'Ctrl+Z / Ctrl+Y • Alt+1..9 Speaker • Alt+↑/↓ Reorder',
  },
  hr: {
    appTitle: 'Storia',
    appSubtitle: 'Studio za audio dramu, podcast i naraciju',
    episodeLabel: 'Epizoda',
    undo: 'Poništi',
    redo: 'Ponovi',
    apiKeyOk: 'API ključ: OK',
    apiKeySynth: 'Preglednik TTS',
    apiKeyMissing: 'API Ključ: Postavi',
    engineGeminiTts: 'Gemini 2.5 TTS',
    engineBrowserTts: 'Preglednik TTS',
    genAllAudio: 'Generiraj sve',
    regenAllAudio: 'Regeneriraj sve',
    rebuildAllWaveforms: 'Obnovi valne oblike',
    clearAllAudio: 'Obriši sav zvuk',
    generatingAudio: 'Sinteza u tijeku...',
    exportMaster: 'Izvoz mastera',
    resetSample: 'Resetiraj uzorak',
    tokensAbbrev: 'tok',

    castAndSpeakers: 'ULOGE I GOVORNICI',
    newSpeaker: 'Novi govornik',
    voiceLabel: 'Glas',
    styleLabel: 'Stil',
    linesCount: 'replika',
    totalEstimated: 'Ukupno procj.',
    audioTokensLabel: 'Audio tokeni',
    lufsLabel: 'LUFS',
    broadcastOk: 'Emitiranje OK',
    editSpeakerTooltip: 'Konfiguriraj glas, personu i Biquad EQ',
    previewSpeakerVoice: 'Poslušaj glas',
    stopSpeakerPreview: 'Zaustavi',
    eqToggleLabel: 'EQ',
    dynToggleLabel: 'Din',
    dspQuickSliders: 'Brzi DSP i Audio Alati',
    regenSpeakerAudio: 'Regeneriraj glas uloge',
    clearSpeakerAudio: 'Obriši zvuk uloge',

    playAll: 'Reproduciraj sve',
    pause: 'Pauza',
    loop: 'Ponavljaj',
    addLine: 'Dodaj repliku',
    addDialogue: '+ Dijalog',
    addNarration: '+ Naracija',
    addDirection: '+ Didaskalija',
    addSfx: '+ Zvučni efekt',
    frameloopDemand: 'Petlja: Na zahtjev',
    ttsOk: 'TTS: OK',
    ttsStale: 'TTS: Zastarjelo',
    ttsUnrendered: 'TTS: Spremno',
    ttsRendering: 'TTS: Sinteza...',
    renderLine: 'Generiraj repliku',
    reRenderLine: 'Ponovno generiraj',
    regenerateAudioBtn: 'Regeneriraj',
    regenerateAudioTooltip: 'Ponovno generiraj TTS zvuk i valni oblik za ovaj blok',
    rebuildWaveformBtn: 'Valni oblik',
    rebuildWaveformTooltip: 'Ponovno izračunaj SoA vrhove valnog oblika za ovaj blok',
    deleteAudioBtn: 'Obriši zvuk',
    deleteAudioTooltip: 'Obriši generirani zvuk i podatke valnog oblika za ovaj blok',
    directorNotesPlaceholder: 'Didaskalije, npr. [šapatom / whispered]',
    dialoguePlaceholder: 'Unesite tekst dijaloga...',
    narrationPlaceholder: 'Unesite tekst naracije...',
    sfxPlaceholder: 'Opišite zvučni efekt...',
    directionPlaceholder: 'Scenska ili akustička uputa...',
    pauseMsLabel: 'Pauza (ms)',
    moveUp: 'Pomakni blok gore (Alt+Up)',
    moveDown: 'Pomakni blok dolje (Alt+Down)',
    deleteBlock: 'Obriši blok',
    waveformStatusPrefix: 'Valni oblik: Canvas 2D SoA',
    bvhActivePrefix: '1D BVH Aktivno',

    typeDialogue: 'Dijalog',
    typeNarration: 'Naracija',
    typeDirection: 'Didaskalija',
    typeSfx: 'SFX',

    sfxPresetLabel: 'SFX Pogon',
    sfxPresetAuto: 'Automatski (AI / Tekst)',
    sfxPresetTramRail: 'Tramvaj i tračnice',
    sfxPresetFootsteps: 'Koraci i kaldrma',
    sfxPresetWeatherRain: 'Kiša i mokra ulica',
    sfxPresetWindStorm: 'Vjetar i magla',
    sfxPresetThunder: 'Grmljavina i oluja',
    sfxPresetDoorCreak: 'Škripanje vrata i brava',
    sfxPresetImpactKnock: 'Kucanje i udarci',
    sfxPresetCinematicDrone: 'Filmski dron',
    sfxPresetRadioStatic: 'Radio šum i smetnje',
    sfxPresetCustomUpload: 'Vlastita audio datoteka',
    sfxDurationLabel: 'Trajanje (s)',
    importSfxBtn: 'Uvezi WAV/MP3',
    importSfxTooltip: 'Učitaj lokalnu audio datoteku (.wav, .mp3, .ogg) za ovaj SFX blok',
    generateSfxBtn: 'Generiraj SFX',
    reGenerateSfxBtn: 'Ponovno generiraj SFX',

    aiDockTitle: 'AI AGENT I ISTRAŽIVANJE',
    geminiModelPickerLabel: 'Gemini Model Agenta',
    geminiTtsModelPickerLabel: 'Gemini TTS Model',
    searchGroundingToggle: 'Google Utemeljenje',
    tabPersonaPov: 'Persona POV',
    tabCoWriter: 'Koautor',
    tabDoctor: 'Lektor',
    tabAdapter: 'EN/HR',
    modePersonaResearch: 'Način: Istraživanje kroz personu',
    speakerSelectLabel: 'Govornik',
    queryLabel: 'Upit',
    queryPlaceholder: 'Postavite povijesno ili činjenično pitanje iz perspektive lika...',
    researchViaGoogle: 'Istraži uz Google Search Grounding',
    inCharacterResponse: 'Odgovor u ulozi lika',
    citationsLabel: 'Izvori',
    insertAsDialogue: 'Umetni kao repliku dijaloga',
    researchNotebookTitle: 'Povijest istraživačke bilježnice',
    modeCoWriter: 'Način: Scenski koautor (3 nastavka)',
    coWriterWorkflowLabel: 'Način rada Koautora',
    coWriterModeSceneBeats: 'Scena (3 ritma)',
    coWriterModeCompleteStory: 'Duga priča',
    coWriterModePodcastEpisode: 'Podcast',
    coWriterModeSceneBeatsDesc: 'Generira 3 prijedloga nastavka scene',
    coWriterModeCompleteStoryDesc: 'Generira dugu, cjelovitu epizodnu priču s punim dramskim lukom',
    coWriterModePodcastEpisodeDesc: 'Generira dinamičnu razgovornu podcast epizodu',
    coWriterGenerateStoryBtn: 'Generiraj cjelovitu priču',
    coWriterGeneratePodcastBtn: 'Generiraj podcast epizodu',
    leftSplitterTooltip: 'Povuci za promjenu širine popisa likova',
    rightSplitterTooltip: 'Povuci za promjenu širine AI Agent panela',
    coWriterDirectionHintLabel: 'Smjernica za scenu (Opcionalno)',
    coWriterDirectionHintPlaceholder: 'npr. Uvedi iznenadni telefonski poziv ili otkrij trag...',
    coWriterDeepResearchToggle: 'Dubinsko istraživanje',
    coWriterDeepResearchActive: 'Dubinsko istraživanje: UKLJ',
    coWriterDeepResearchIdle: 'Dubinsko istraživanje: ISKLJ',
    coWriterDeepResearchTooltip: 'Uključuje Google Search Grounding i dubinsku multimodalnu analizu dokumenata i slika',
    coWriterDropzoneLabel: 'Dovuci sliku, dokument ili scenarij ovdje ili klikni za odabir',
    coWriterDropzoneActive: 'Otpusti datoteku za prilaganje Koautoru...',
    coWriterUploadBtn: 'Priloži datoteku',
    coWriterAttachedFilesLabel: 'Priloženi dokumenti i dokazi',
    coWriterRemoveFile: 'Ukloni datoteku',
    coWriterClearFiles: 'Očisti sve',
    analyzedFilesLabel: 'Analizirane datoteke',
    generateBeatsBtn: 'Generiraj 3 prijedloga scene',
    insertBeatBtn: 'Umetni prijedlog u scenarij',
    modeScriptDoctor: 'Način: Lektor dijaloga i govorni ritam',
    targetBlockLabel: 'Ciljani blok scenarija',
    runDoctorBtn: 'Analiziraj i dotjeraj ritam',
    applyPolishBtn: 'Primijeni na blok',
    modeBilingualAdapter: 'Način: Dvojezični kulturni adapter (EN ↔ HR)',
    translationDirectionLabel: 'Smjer prilagodbe',
    runAdapterBtn: 'Prilagodi blok kulturološki',
    applyTranslationBtn: 'Primijeni prilagođeni tekst',
    genderMorphologyLabel: 'Morfologija / Slaganje u rodu',
    phase4PreviewNotice: 'Povezano s istraživačkom bilježnicom — spremno za Gemini upite.',

    speakerModalTitle: 'Konfiguracija govornika i DSP glasa',
    speakerName: 'Ime',
    speakerGender: 'Spol / Rod',
    speakerAge: 'Dob',
    speakerColor: 'Boja oznake',
    baseVoice: 'Gemini bazni glas',
    browserVoiceLabel: 'Glas lokalnog preglednika (Web Speech)',
    browserVoiceAuto: 'Automatski odabir prema jeziku i rodu',
    stylePrompt: 'Uputa za vokalni stil',
    personaPrompt: 'LLM sustavna uputa persone',
    actingNotes: 'Glumačke upute (Didaskalije)',
    speakingRate: 'Brzina govora',
    pitchAdjustment: 'Visina tona (polutonovi)',
    enableDirectorNotes: 'Tumači [didaskalije] kao akustičke modifikatore',
    ssmlEnabled: 'Omogući ugrađeni SSML (<break>, <mark>)',
    speakerAuditionTitle: 'Isprobavanje glasa govornika (Audicija)',
    speakerAuditionSamplePlaceholder: 'Unesite testnu rečenicu za provjeru glasa...',
    dspEqSection: 'Klijentski Biquad EQ i dinamika',
    enableEqChain: '3-pojasni Biquad EQ uključen',
    enableDynamicsComp: 'Dinamički kompresor uključen',
    lowShelf120Hz: 'Low-Shelf (120 Hz Toplina)',
    midPeak2500Hz: 'Mid-Peak (2.5 kHz Jasnoća)',
    highShelf8000Hz: 'High-Shelf (8.0 kHz Zračnost)',
    compressorThreshold: 'Prag kompresora (dB)',
    compressorRatio: 'Omjer kompresije',
    saveChanges: 'Spremi govornika',
    cancel: 'Odustani',
    deleteSpeaker: 'Ukloni govornika',

    apiModalTitle: 'TTS Pogon Sinteze i BYOK Gemini API',
    apiModalSubtitle:
      'Odaberite između Google Gemini 2.5 Flash TTS-a (zahtijeva API ključ) ili lokalnog TTS-a preglednika (Web Speech API).',
    apiKeyInputLabel: 'Google Gemini API Ključ (BYOK)',
    apiKeyPlaceholder: 'AIzaSy...',
    ttsProviderSelectLabel: 'Aktivni TTS pogon sinteze',
    geminiTtsOptionTitle: 'Gemini 2.5 Flash TTS (gemini-2.5-flash-preview-tts)',
    geminiTtsOptionDesc:
      'Studijska multimodalna sinteza govora s uputama za stil, didaskalijama i 24kHz PCM zvukom.',
    browserTtsOptionTitle: 'Lokalni TTS Preglednika (Web Speech API alternativa)',
    browserTtsOptionDesc:
      'Offline sinteza govora pomoću ugrađenih glasova preglednika i operacijskog sustava bez potrošnje tokena.',
    proceduralFallbackLabel: 'Koristi lokalni TTS preglednika (Offline / Bez kvote)',
    proceduralFallbackDesc:
      'Koristi ugrađene Web Speech API glasove preglednika kada je uključeno ili kada nije unesen Gemini API ključ.',
    ttsModelLabel: 'Izvorni TTS Model',
    textModelLabel: 'Agent za priču i istraživanje',
    audioFormatLabel: 'Kodiranje audio streama',
    clearCacheLabel: 'Očisti IndexedDB Audio predmemoriju',
    saveApiSettings: 'Spremi postavke',
    clearKeyLabel: 'Obriši ključ',

    genderMale: 'Muški',
    genderFemale: 'Ženski',
    genderNonBinary: 'Nebinarni',
    genderNeutral: 'Neutralni',
    genderOther: 'Ostalo',

    episodePropertiesBtn: 'Postavke epizode',
    episodePropertiesModalTitle: 'Knjižnica epizoda i svojstva epizode',
    episodesLibraryTitle: 'Studijska knjižnica epizoda',
    newEpisodeBtn: '+ Nova epizoda',
    duplicateEpisodeBtn: 'Dupliciraj',
    deleteEpisodeBtn: 'Obriši epizodu',
    episodeTitleLabel: 'Naslov epizode',
    episodeDescriptionLabel: 'Opis / Sinopsis',
    episodeLanguageLabel: 'Jezik epizode',
    episodeGenreLabel: 'Žanr',
    episodeAuthorLabel: 'Autor / Producent',
    episodeTargetWpmLabel: 'Ciljani tempo (WPM)',
    episodeSampleRateLabel: 'Frekvencija uzorkovanja (Hz)',
    episodeBitDepthLabel: 'Bitna dubina',
    episodeTargetLufsLabel: 'Ciljana glasnoća (LUFS)',
    toggleEpisodeMetaTooltip: 'Prikaži / Sakrij traku sa svojstvima epizode',

    waveformTransportBtn: 'Valni transport',
    masterTimelineWaveformLabel: 'Glavni valni oblik i transport epizode',
    transportJumpStart: 'Skok na početak',
    transportPrevBlock: 'Prethodni blok',
    transportRewind5s: 'Unatrag 5s',
    transportStop: 'Zaustavi i vrati',
    transportForward5s: 'Unaprijed 5s',
    transportNextBlock: 'Sljedeći blok',
    transportSpeedLabel: 'Brzina',
    blockWaveformPlayTooltip: 'Reproduciraj / Pauziraj blok iz valnog oblika',
    blockWaveformRestartTooltip: 'Vrati blok na 0:00',
    gainKnobLabel: 'Pojačanje',
    gainKnobTooltip: 'Potenciometar glasnoće (-inf do +10 dB, dvoklik za 0 dB)',
    unrenderedWaveformNotice: 'Zvuk još nije generiran',

    exportMasterModalTitle: 'Studijski izvoz i emitiranje (Mastering)',
    tabAudioMastering: 'Audio Master i Stemovi',
    tabScriptArchive: 'Scenarij i paketi projekta',
    exportFormatWav: 'Broadcast WAV / RIFF',
    exportSampleRateLabel: 'Frekvencija uzorkovanja',
    exportBitDepthLabel: 'Bitna dubina',
    exportDitherLabel: 'Algoritam dither šuma',
    exportDitherTpdf: 'TPDF (Trokutasti PDF šum)',
    exportDitherNone: 'Bez dither-a (Rezanje)',
    exportTargetLufsLabel: 'Ciljana integrirana glasnoća (LUFS)',
    exportTruePeakCeilingLabel: 'Strop vršnog limita (dBFS)',
    exportDownloadMasterBtn: 'Preuzmi masterirani audio WAV',
    exportDownloadStemsBtn: 'Preuzmi višekanalne stemove uloga',
    exportRenderingNotice: 'Masteriranje zvuka uz Biquad DSP, LUFS normalizaciju i TPDF dither...',
    exportDownloadFountainBtn: 'Preuzmi scenarij (.fountain)',
    exportDownloadMarkdownBtn: 'Preuzmi produkcijski tekst (.md)',
    exportDownloadProjectJsonBtn: 'Izvezi paket projekta (.storia.json)',
    exportImportProjectJsonBtn: 'Uvezi paket projekta (.storia.json)',
    exportMasterSuccessNotice: 'Masterirani WAV uspješno generiran i spreman za emitiranje!',
    exportStemsSuccessNotice: 'Zasebni stemovi uloga uspješno generirani i preuzeti!',

    autoDiacriticsTooltip: 'Automatski dodaj hrvatske dijakritičke znakove (č, ć, ž, š, đ)',
    exportSubtitle: 'Podesite normalizaciju glasnoće, bitnu dubinu i arhivu scenarija',
    exportScriptArchiveDesc: 'Izvezite čitljive produkcijske scenarije ili cjelovite pakete projekta za sigurnosnu kopiju i nastavak rada.',
    exportFountainDesc: 'Standardni format scenarija za Final Draft / Highland',
    exportMarkdownDesc: 'Tablica uloga, vremenski kodovi, broj tokena i istraživačka bilježnica',
    exportProjectJsonDesc: 'Cjeloviti paket govornika, replika, EQ postavki i istraživanja',
    masterAnalysisTitle: 'Analiza mastera za emitiranje:',
    statIntegrated: 'Integrirano:',
    statTruePeak: 'Vršni True Peak:',
    statMakeupGain: 'Primijenjeno pojačanje:',
    statTotalLength: 'Ukupno trajanje:',
    audioEngineFooter: 'Storia Studio Audio Pogon v1.0 • ITU-R BS.1770-4',
    blocksCount: 'blokova',
    speakersCount: 'govornika',
    frameloopActive: 'Aktivno',
    frameloopIdle: 'Mirovanje',
    timeRangePrefix: 'Vrijeme:',
    keyboardShortcutsHelp: 'Ctrl+Z / Ctrl+Y • Alt+1..9 Uloga • Alt+↑/↓ Raspored',
  },
};
