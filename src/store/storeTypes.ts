import {
  AppSettings,
  AudioEffectConfig,
  BlockType,
  CoWriterBeatBlockDraft,
  CoWriterBeatCandidate,
  CroatianDialect,
  DubrovnikRegister,
  GeminiTextModelId,
  GeminiTtsModelId,
  PersonaResearchRecord,
  Project,
  ScriptBlock,
  Speaker,
  SupportedLanguage,
  TtsEngineProvider,
} from '../types/storia';
import { HistoryManager } from '../core/history/Command';
import { ProjectStateAccessor } from '../core/history/commands/scriptCommands';

/**
 * Shared mutable runtime session tokens and AbortController registry for audio playback & synthesis.
 */
export const audioRuntimeControllers = {
  auditionSessionToken: 0,
  batchSynthesisAbortController: null as AbortController | null,
  activeBlockSynthesisAbortControllers: new Map<string, AbortController>(),
  speakerPreviewAbortController: null as AbortController | null,
};

/**
 * Transient high-frequency state (playhead, active BVH block, VU metering)
 * kept outside React render cascades for 60-144Hz zero-jitter updates.
 */
export interface TransientPlaybackState {
  playheadTimeSec: number;
  activeBlockId: string | null;
  activeBlockIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  frameloopMode: 'demand' | 'active';
}

export const transientPlaybackRef: { current: TransientPlaybackState } = {
  current: {
    playheadTimeSec: 0,
    activeBlockId: 'blk_1',
    activeBlockIndex: 0,
    isPlaying: false,
    isLooping: false,
    frameloopMode: 'demand',
  },
};

export interface ProjectPropertiesPatch {
  title?: string;
  description?: string;
  defaultLanguage?: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  author?: string;
  genre?: string;
  targetWpm?: number;
  sampleRate?: 44100 | 48000;
  bitDepth?: 16 | 24 | 32;
  targetLufs?: number;
}

export interface StoriaStoreState {
  project: Project;
  projects: Project[];
  appSettings: AppSettings;
  selectedBlockId: string | null;
  editingSpeakerId: string | null;
  editingSpeakerInitialTab?: 'voice' | 'dsp' | 'persona';
  isApiKeyModalOpen: boolean;
  isEpisodePropertiesModalOpen: boolean;
  isExportMasterModalOpen: boolean;
  isAuxBusModalOpen: boolean;
  hasConfiguredApiKey: boolean;
  ttsProvider: TtsEngineProvider;
  useProceduralFallback: boolean;
  isBatchSynthesizing: boolean;
  previewingSpeakerId: string | null;
  playingBlockId: string | null;
  /** Episode-wide "Play All" transport state (mutually exclusive with single-block audition) */
  isMasterPlaying: boolean;
  setMasterPlaying: (playing: boolean) => void;
  isAutoAdvanceEnabled: boolean;
  toggleAutoAdvance: () => void;
  setAutoAdvance: (enabled: boolean) => void;
  ttsErrorMessage: string | null;
  undoCount: number;
  redoCount: number;
  historyManager: HistoryManager;

  // UI & Modal Actions
  setUiLanguage: (lang: SupportedLanguage) => void;
  selectBlock: (blockId: string | null) => void;
  openSpeakerModal: (
    speakerId: string | null,
    initialTab?: 'voice' | 'dsp' | 'persona'
  ) => void;
  setApiKeyModalOpen: (open: boolean) => void;
  setEpisodePropertiesModalOpen: (open: boolean) => void;
  setExportMasterModalOpen: (open: boolean) => void;
  setAuxBusModalOpen: (open: boolean) => void;
  importProjectFromBundle: (bundle: Project) => void;
  setActiveTtsProvider: (provider: TtsEngineProvider) => void;
  setGeminiTextModel: (modelId: GeminiTextModelId) => void;
  setGeminiTtsModel: (modelId: GeminiTtsModelId) => void;
  setEnableSearchGrounding: (enabled: boolean) => void;
  addResearchRecord: (record: PersonaResearchRecord) => void;
  insertSceneBeatBlocks: (
    drafts: CoWriterBeatBlockDraft[],
    afterBlockId?: string
  ) => string[];
  loadCoWriterBeatAsEpisode: (beat: CoWriterBeatCandidate) => string[];
  saveApiConfiguration: (
    apiKey: string,
    browserFallbackOrProvider: boolean | TtsEngineProvider,
    textModel?: GeminiTextModelId,
    ttsModel?: GeminiTtsModelId
  ) => void;
  clearTtsError: () => void;
  updateProjectTitle: (title: string) => void;
  updateProjectProperties: (patch: ProjectPropertiesPatch) => void;

  // Multi-Project (Episode) Library Actions
  switchProject: (projectId: string) => void;
  createProject: (options?: {
    title?: string;
    description?: string;
    defaultLanguage?: SupportedLanguage;
    dialect?: CroatianDialect;
    dubrovnikRegister?: DubrovnikRegister;
    genre?: string;
    author?: string;
    targetWpm?: number;
    targetLufs?: number;
    speakers?: Speaker[];
    blocks?: ScriptBlock[];
  }) => Project;
  duplicateProject: (projectId?: string) => Project;
  deleteProject: (projectId: string) => void;
  deleteProjectsBulk: (projectIds: string[]) => void;
  clearEntireLibrary: () => void;
  importProjectsBundle: (projects: Project[], activateFirst?: boolean) => number;

  // Command-backed mutations
  addBlock: (type: BlockType, afterBlockId?: string, customData?: Partial<ScriptBlock>) => string;
  updateBlock: (blockId: string, patch: Partial<ScriptBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  moveBlockRelative: (blockId: string, direction: 'up' | 'down') => void;
  assignSpeakerByHotkey: (blockId: string, speakerIndex: number) => void;

  addSpeaker: (speaker?: Partial<Speaker>) => Speaker;
  updateSpeaker: (speaker: Speaker) => void;
  removeSpeaker: (speakerId: string) => void;

  // Speaker DSP Quick Toggles & Voice Preview Tools
  toggleSpeakerEq: (speakerId: string) => void;
  toggleSpeakerDynamics: (speakerId: string) => void;
  toggleAuxBusModule: (busId: string, moduleId: string) => void;
  setAuxBusReturnGainDb: (busId: string, returnGainDb: number) => void;
  updateAuxBusModuleConfig: (busId: string, moduleId: string, config: AudioEffectConfig) => void;
  addAuxBusModule: (busId: string, module: AudioEffectConfig) => void;
  removeAuxBusModule: (busId: string, moduleId: string) => void;
  previewSpeakerVoice: (
    speakerId: string,
    customSampleText?: string,
    overrideSpeaker?: Speaker
  ) => Promise<void>;
  auditionBlock: (blockId: string, startOffsetSec?: number) => Promise<void>;
  stopAudioPreview: () => void;

  // Phase 2 & 3 TTS & SFX Synthesis, Regeneration, Waveform Rebuild & Deletion Tools
  synthesizeBlock: (
    blockId: string,
    options?: { forceRegenerate?: boolean }
  ) => Promise<void>;
  importSfxAudioFile: (blockId: string, file: File) => Promise<void>;
  regenerateBlockAudio: (blockId: string) => Promise<void>;
  deleteBlockAudio: (blockId: string) => Promise<void>;
  rebuildBlockWaveform: (blockId: string) => Promise<void>;
  synthesizeAllBlocks: () => Promise<void>;
  regenerateAllBlocksAudio: () => Promise<void>;
  rebuildAllWaveforms: () => Promise<void>;
  regenerateSpeakerAudio: (speakerId: string) => Promise<void>;
  deleteSpeakerAudio: (speakerId: string) => Promise<void>;
  abortBatchSynthesis: () => void;
  abortBlockSynthesis: (blockId: string) => void;
  abortAllSynthesis: () => void;
  syncCacheStatuses: () => Promise<void>;
  purgeAudioCache: () => Promise<void>;

  // History actions
  undo: () => void;
  redo: () => void;
  resetToSampleProject: () => void;
  loadGeodesicFlameDemo: () => void;
}

export type StoreSet = (
  partial:
    | Partial<StoriaStoreState>
    | ((state: StoriaStoreState) => Partial<StoriaStoreState>),
  replace?: false
) => void;

export type StoreGet = () => StoriaStoreState;

export interface StoreSliceContext {
  set: StoreSet;
  get: StoreGet;
  accessor: ProjectStateAccessor;
  singletonHistory: HistoryManager;
}

