import { create } from 'zustand';
import {
  AppSettings,
  BlockType,
  CoWriterBeatBlockDraft,
  GeminiTextModelId,
  GeminiTtsModelId,
  PersonaResearchRecord,
  Project,
  ScriptBlock,
  Speaker,
  SupportedLanguage,
  TtsEngineProvider,
} from '../types/storia';
import {
  createInitialProjectLibrary,
  createSampleProject,
} from '../i18n/sampleProject';
import { HistoryManager } from '../core/history/Command';
import {
  AddBlockCommand,
  AddOrRemoveSpeakerCommand,
  DeleteBlockCommand,
  ProjectStateAccessor,
  ReorderBlocksCommand,
  UpdateBlockCommand,
  UpdateSpeakerCommand,
} from '../core/history/commands/scriptCommands';
import { recalculateProjectTimeline } from '../core/pacing/pacingCalculator';
import {
  getApiKey,
  getTtsProvider,
  hasValidApiKey,
  setApiKey,
  setTtsProvider,
} from '../core/storage/keyVault';
import {
  clearAllAudioCache,
  computeBlockCacheKey,
  deleteBlockAudioFromCache,
  evaluateBlockCacheStatus,
  extractWaveformPeaksFromWavBlob,
  getLatestBlockAudioEntry,
  saveBlockAudioToCache,
} from '../core/storage/audioCache';
import {
  DEFAULT_PEAKS_PER_SECOND,
  DEFAULT_TTS_SAMPLE_RATE,
  encodePcm16ToWavBlob,
  extractWaveformPeaksFromPcm,
  synthesizeGeminiAudioWithPeaks,
  synthesizeProceduralSpeechPcm,
} from '../services/geminiTtsService';
import {
  decodeUploadedAudioFileToSfxResult,
  synthesizeSfxAudio,
} from '../services/sfxGeneratorService';
import {
  playAudioWithSpeakerDsp,
  speakWithBrowserTts,
  stopAllAudioPlayback,
  updateLiveDspIfPlaying,
} from '../core/dsp/LiveAudioPreviewer';

const PROJECT_STORAGE_KEY = 'storia_active_project_v1';
const PROJECTS_LIBRARY_STORAGE_KEY = 'storia_projects_library_v1';
const SETTINGS_STORAGE_KEY = 'storia_app_settings_v1';

function hydrateProjectTimeline(parsed: Project): Project {
  const { blocks } = recalculateProjectTimeline(
    parsed.blocks,
    parsed.speakers,
    parsed.metadata?.targetWpm ?? 140
  );
  return { ...parsed, blocks };
}

function loadInitialProjectsLibrary(): Project[] {
  try {
    const rawLib = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    if (rawLib) {
      const parsedList = JSON.parse(rawLib) as Project[];
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        return parsedList
          .filter((p) => p && p.id && Array.isArray(p.blocks) && Array.isArray(p.speakers))
          .map(hydrateProjectTimeline);
      }
    }
  } catch {
    // Fallback to initial library
  }
  return createInitialProjectLibrary();
}

function loadInitialProject(library: Project[]): Project {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Project;
      if (parsed && parsed.id && Array.isArray(parsed.blocks) && Array.isArray(parsed.speakers)) {
        return hydrateProjectTimeline(parsed);
      }
    }
  } catch {
    // Fallback to first project in library
  }
  return library[0] ?? createSampleProject();
}

function loadInitialSettings(defaultProjectId: string): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      if (parsed && (parsed.uiLanguage === 'en' || parsed.uiLanguage === 'hr')) {
        return parsed;
      }
    }
  } catch {
    // Fallback to default settings
  }
  return {
    uiLanguage: 'en',
    theme: 'dark',
    activeProjectId: defaultProjectId,
    audioBufferSize: 128,
  };
}

function stripPeaksForStorage(project: Project): Project {
  return {
    ...project,
    blocks: project.blocks.map(({ waveformPeaks: _wp, ...rest }) => rest),
  };
}

function persistProject(project: Project, library?: Project[]): Project[] {
  const nextLib = library
    ? library.some((p) => p.id === project.id)
      ? library.map((p) => (p.id === project.id ? project : p))
      : [project, ...library]
    : undefined;

  try {
    localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify(stripPeaksForStorage(project))
    );
    if (nextLib) {
      localStorage.setItem(
        PROJECTS_LIBRARY_STORAGE_KEY,
        JSON.stringify(nextLib.map(stripPeaksForStorage))
      );
    }
  } catch {
    // Ignore storage quota errors in restricted test environments
  }

  return nextLib ?? [project];
}

function persistSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

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
  isApiKeyModalOpen: boolean;
  isEpisodePropertiesModalOpen: boolean;
  isExportMasterModalOpen: boolean;
  hasConfiguredApiKey: boolean;
  ttsProvider: TtsEngineProvider;
  useProceduralFallback: boolean;
  isBatchSynthesizing: boolean;
  previewingSpeakerId: string | null;
  playingBlockId: string | null;
  ttsErrorMessage: string | null;
  undoCount: number;
  redoCount: number;
  historyManager: HistoryManager;

  // UI & Modal Actions
  setUiLanguage: (lang: SupportedLanguage) => void;
  selectBlock: (blockId: string | null) => void;
  openSpeakerModal: (speakerId: string | null) => void;
  setApiKeyModalOpen: (open: boolean) => void;
  setEpisodePropertiesModalOpen: (open: boolean) => void;
  setExportMasterModalOpen: (open: boolean) => void;
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
    genre?: string;
    author?: string;
    targetWpm?: number;
  }) => Project;
  duplicateProject: (projectId?: string) => Project;
  deleteProject: (projectId: string) => void;

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
  syncCacheStatuses: () => Promise<void>;
  purgeAudioCache: () => Promise<void>;

  // History actions
  undo: () => void;
  redo: () => void;
  resetToSampleProject: () => void;
}

const initialProjectsLibrary = loadInitialProjectsLibrary();
const initialProject = loadInitialProject(initialProjectsLibrary);
const initialSettings = loadInitialSettings(initialProject.id);
const singletonHistory = new HistoryManager(100);
const initialProvider = getTtsProvider();

export const useStoriaStore = create<StoriaStoreState>((set, get) => {
  const accessor: ProjectStateAccessor = {
    getProject: () => get().project,
    setProject: (nextProject: Project) => {
      const nextProjects = persistProject(nextProject, get().projects);
      set({
        project: nextProject,
        projects: nextProjects,
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
    },
  };

  return {
    project: initialProject,
    projects: initialProjectsLibrary.some((p) => p.id === initialProject.id)
      ? initialProjectsLibrary.map((p) => (p.id === initialProject.id ? initialProject : p))
      : [initialProject, ...initialProjectsLibrary],
    appSettings: initialSettings,
    selectedBlockId: initialProject.blocks[0]?.id ?? null,
    editingSpeakerId: null,
    isApiKeyModalOpen: false,
    isEpisodePropertiesModalOpen: false,
    isExportMasterModalOpen: false,
    hasConfiguredApiKey: hasValidApiKey(),
    ttsProvider: initialProvider,
    useProceduralFallback: initialProvider === 'browser_tts',
    isBatchSynthesizing: false,
    previewingSpeakerId: null,
    playingBlockId: null,
    ttsErrorMessage: null,
    undoCount: 0,
    redoCount: 0,
    historyManager: singletonHistory,

    setUiLanguage: (lang: SupportedLanguage) => {
      const nextSettings: AppSettings = {
        ...get().appSettings,
        uiLanguage: lang,
      };
      persistSettings(nextSettings);
      set({ appSettings: nextSettings });
    },

    selectBlock: (blockId: string | null) => {
      set({ selectedBlockId: blockId });
      if (blockId) {
        const idx = get().project.blocks.findIndex((b) => b.id === blockId);
        if (idx >= 0) {
          transientPlaybackRef.current.activeBlockId = blockId;
          transientPlaybackRef.current.activeBlockIndex = idx;
          transientPlaybackRef.current.playheadTimeSec =
            get().project.blocks[idx].startTimeSec ?? 0;
        }
      }
    },

    openSpeakerModal: (speakerId: string | null) => {
      set({ editingSpeakerId: speakerId });
    },

    setApiKeyModalOpen: (open: boolean) => {
      set({ isApiKeyModalOpen: open, ttsErrorMessage: null });
    },

    setEpisodePropertiesModalOpen: (open: boolean) => {
      set({ isEpisodePropertiesModalOpen: open });
    },

    setExportMasterModalOpen: (open: boolean) => {
      set({ isExportMasterModalOpen: open });
    },

    importProjectFromBundle: (bundle: Project) => {
      stopAllAudioPlayback();
      singletonHistory.clear();

      const hydrated = hydrateProjectTimeline(bundle);
      const nextProjects = persistProject(hydrated, [
        ...get().projects.filter((p) => p.id !== hydrated.id),
        hydrated,
      ]);

      const nextSettings: AppSettings = {
        ...get().appSettings,
        activeProjectId: hydrated.id,
      };
      persistSettings(nextSettings);

      set({
        project: hydrated,
        projects: nextProjects,
        appSettings: nextSettings,
        selectedBlockId: hydrated.blocks[0]?.id ?? null,
        editingSpeakerId: null,
        previewingSpeakerId: null,
        playingBlockId: null,
        ttsErrorMessage: null,
        undoCount: 0,
        redoCount: 0,
        isExportMasterModalOpen: false,
      });
    },

    setActiveTtsProvider: (provider: TtsEngineProvider) => {
      setTtsProvider(provider);
      set({
        ttsProvider: provider,
        useProceduralFallback: provider === 'browser_tts',
        ttsErrorMessage: null,
      });
    },

    setGeminiTextModel: (modelId: GeminiTextModelId) => {
      const nextProject: Project = {
        ...get().project,
        aiSettings: {
          ...get().project.aiSettings,
          textModel: modelId,
        },
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    setGeminiTtsModel: (modelId: GeminiTtsModelId) => {
      const nextProject: Project = {
        ...get().project,
        aiSettings: {
          ...get().project.aiSettings,
          ttsModel: modelId,
        },
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    setEnableSearchGrounding: (enabled: boolean) => {
      const nextProject: Project = {
        ...get().project,
        aiSettings: {
          ...get().project.aiSettings,
          enableSearchGrounding: enabled,
        },
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    addResearchRecord: (record: PersonaResearchRecord) => {
      const existing = get().project.researchNotebook ?? [];
      const nextNotebook = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 30);
      const nextProject: Project = {
        ...get().project,
        researchNotebook: nextNotebook,
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    insertSceneBeatBlocks: (
      drafts: CoWriterBeatBlockDraft[],
      afterBlockId?: string
    ) => {
      const insertedIds: string[] = [];
      let cursorBlockId = afterBlockId ?? get().selectedBlockId ?? undefined;
      for (const draft of drafts) {
        const createdId = get().addBlock(draft.type, cursorBlockId, {
          speakerId: draft.speakerId,
          text: draft.text,
          directorNotes: draft.directorNotes,
          pauseAfterMs: draft.pauseAfterMs ?? 450,
        });
        insertedIds.push(createdId);
        cursorBlockId = createdId;
      }
      return insertedIds;
    },

    saveApiConfiguration: (
      apiKey: string,
      browserFallbackOrProvider: boolean | TtsEngineProvider,
      textModel?: GeminiTextModelId,
      ttsModel?: GeminiTtsModelId
    ) => {
      setApiKey(apiKey);
      const validKey = hasValidApiKey();
      const nextProvider: TtsEngineProvider =
        typeof browserFallbackOrProvider === 'string'
          ? browserFallbackOrProvider
          : browserFallbackOrProvider
            ? 'browser_tts'
            : 'gemini_tts';

      setTtsProvider(nextProvider);

      const nextProject: Project = {
        ...get().project,
        aiSettings: {
          ...get().project.aiSettings,
          textModel: textModel ?? get().project.aiSettings.textModel,
          ttsModel: ttsModel ?? get().project.aiSettings.ttsModel,
          ttsProvider: nextProvider,
        },
        updatedAt: Date.now(),
      };
      persistProject(nextProject);

      set({
        project: nextProject,
        hasConfiguredApiKey: validKey,
        ttsProvider: nextProvider,
        useProceduralFallback: nextProvider === 'browser_tts',
        ttsErrorMessage: null,
      });
    },

    clearTtsError: () => {
      set({ ttsErrorMessage: null });
    },

    updateProjectTitle: (title: string) => {
      get().updateProjectProperties({ title });
    },

    updateProjectProperties: (patch: ProjectPropertiesPatch) => {
      const current = get().project;
      const nextTargetWpm =
        patch.targetWpm !== undefined
          ? Math.max(60, Math.min(260, Number(patch.targetWpm) || 140))
          : (current.metadata?.targetWpm ?? 140);

      let nextBlocks = current.blocks;
      if (patch.targetWpm !== undefined && patch.targetWpm !== current.metadata?.targetWpm) {
        const prevPeaks = new Map(
          current.blocks.filter((b) => b.waveformPeaks).map((b) => [b.id, b.waveformPeaks])
        );
        const { blocks } = recalculateProjectTimeline(
          current.blocks,
          current.speakers,
          nextTargetWpm
        );
        nextBlocks = blocks.map((b) => ({
          ...b,
          waveformPeaks: prevPeaks.get(b.id) ?? b.waveformPeaks,
        }));
      }

      const nextProject: Project = {
        ...current,
        title: patch.title !== undefined ? patch.title : current.title,
        description:
          patch.description !== undefined ? patch.description : current.description,
        defaultLanguage:
          patch.defaultLanguage !== undefined
            ? patch.defaultLanguage
            : current.defaultLanguage,
        blocks: nextBlocks,
        metadata: {
          ...current.metadata,
          author:
            patch.author !== undefined ? patch.author : (current.metadata?.author ?? 'Storia Studio'),
          genre:
            patch.genre !== undefined ? patch.genre : (current.metadata?.genre ?? 'Audio Drama'),
          targetWpm: nextTargetWpm,
        },
        audioConfig: {
          ...current.audioConfig,
          sampleRate:
            patch.sampleRate !== undefined
              ? patch.sampleRate
              : current.audioConfig.sampleRate,
          bitDepth:
            patch.bitDepth !== undefined ? patch.bitDepth : current.audioConfig.bitDepth,
          targetLufs:
            patch.targetLufs !== undefined
              ? patch.targetLufs
              : current.audioConfig.targetLufs,
        },
        updatedAt: Date.now(),
      };

      const nextProjects = persistProject(nextProject, get().projects);
      set({ project: nextProject, projects: nextProjects });
    },

    switchProject: (projectId: string) => {
      const target = get().projects.find((p) => p.id === projectId);
      if (!target || target.id === get().project.id) return;

      stopAllAudioPlayback();
      singletonHistory.clear();

      // Save current project into library first
      const syncedLib = persistProject(get().project, get().projects);
      const nextActive = syncedLib.find((p) => p.id === projectId) ?? target;
      const finalLib = persistProject(nextActive, syncedLib);

      const nextSettings: AppSettings = {
        ...get().appSettings,
        activeProjectId: nextActive.id,
      };
      persistSettings(nextSettings);

      transientPlaybackRef.current.playheadTimeSec = 0;
      transientPlaybackRef.current.activeBlockId = nextActive.blocks[0]?.id ?? null;
      transientPlaybackRef.current.activeBlockIndex = 0;

      set({
        project: nextActive,
        projects: finalLib,
        appSettings: nextSettings,
        selectedBlockId: nextActive.blocks[0]?.id ?? null,
        editingSpeakerId: null,
        previewingSpeakerId: null,
        playingBlockId: null,
        ttsErrorMessage: null,
        undoCount: 0,
        redoCount: 0,
      });
    },

    createProject: (options) => {
      stopAllAudioPlayback();
      singletonHistory.clear();

      const lang: SupportedLanguage =
        options?.defaultLanguage ?? get().project.defaultLanguage ?? 'hr';
      const episodeNum = get().projects.length + 1;
      const now = Date.now();
      const baseSample = createSampleProject();

      const starterSpeakers: Speaker[] = baseSample.speakers.map((s, idx) => ({
        ...s,
        id: `spk_${now}_${idx}`,
      }));

      const starterBlockId = `blk_${now}_1`;
      const rawBlocks: ScriptBlock[] = [
        {
          id: starterBlockId,
          type: 'dialogue',
          speakerId: starterSpeakers[0].id,
          text:
            lang === 'hr'
              ? 'Nova scena počinje ovdje. Unesite dijalog ili naraciju...'
              : 'New scene begins here. Enter dialogue or narration...',
          directorNotes: lang === 'hr' ? 'prirodno / natural' : 'natural',
          pauseAfterMs: 450,
          ttsStatus: 'unrendered',
          order: 0,
        },
      ];

      const targetWpm = options?.targetWpm ?? 140;
      const { blocks } = recalculateProjectTimeline(
        rawBlocks,
        starterSpeakers,
        targetWpm
      );

      const newProject: Project = {
        id: `proj_${now}_${Math.random().toString(36).slice(2, 6)}`,
        title:
          options?.title?.trim() ||
          (lang === 'hr'
            ? `Ep ${episodeNum}: "Nova epizoda"`
            : `Ep ${episodeNum}: "New Episode"`),
        description:
          options?.description?.trim() ||
          (lang === 'hr'
            ? 'Opis nove epizode radio-drame ili podcasta.'
            : 'Synopsis for the new audio drama or podcast episode.'),
        defaultLanguage: lang,
        speakers: starterSpeakers,
        blocks,
        researchNotebook: [],
        createdAt: now,
        updatedAt: now,
        metadata: {
          author: options?.author?.trim() || 'Storia Studio',
          genre:
            options?.genre?.trim() ||
            (lang === 'hr' ? 'Audio drama / Podcast' : 'Audio Drama / Podcast'),
          targetWpm,
        },
        audioConfig: { ...get().project.audioConfig },
        aiSettings: { ...get().project.aiSettings },
      };

      const nextProjects = persistProject(newProject, [
        ...get().projects,
        newProject,
      ]);

      const nextSettings: AppSettings = {
        ...get().appSettings,
        activeProjectId: newProject.id,
      };
      persistSettings(nextSettings);

      set({
        project: newProject,
        projects: nextProjects,
        appSettings: nextSettings,
        selectedBlockId: newProject.blocks[0]?.id ?? null,
        editingSpeakerId: null,
        previewingSpeakerId: null,
        playingBlockId: null,
        ttsErrorMessage: null,
        undoCount: 0,
        redoCount: 0,
      });

      return newProject;
    },

    duplicateProject: (projectId?: string) => {
      const source =
        (projectId ? get().projects.find((p) => p.id === projectId) : undefined) ??
        get().project;
      const now = Date.now();
      const copySuffix = source.defaultLanguage === 'hr' ? ' (Kopija)' : ' (Copy)';

      const cloned: Project = {
        ...source,
        id: `proj_${now}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${source.title}${copySuffix}`,
        speakers: source.speakers.map((s) => ({ ...s })),
        blocks: source.blocks.map((b) => ({
          ...b,
          id: `blk_${now}_${b.order}`,
          ttsStatus: 'unrendered' as const,
          generatedAudioUrl: undefined,
          cacheKey: undefined,
          waveformPeaks: undefined,
        })),
        createdAt: now,
        updatedAt: now,
      };

      const nextProjects = persistProject(cloned, [...get().projects, cloned]);
      set({
        project: cloned,
        projects: nextProjects,
        selectedBlockId: cloned.blocks[0]?.id ?? null,
      });
      return cloned;
    },

    deleteProject: (projectId: string) => {
      const currentList = get().projects;
      if (currentList.length <= 1) return;

      const remaining = currentList.filter((p) => p.id !== projectId);
      if (remaining.length === 0) return;

      const nextActive =
        get().project.id === projectId ? remaining[0] : get().project;
      const finalLib = persistProject(nextActive, remaining);

      set({
        project: nextActive,
        projects: finalLib,
        selectedBlockId: nextActive.blocks[0]?.id ?? null,
      });
    },

    addBlock: (type: BlockType, afterBlockId?: string, customData?: Partial<ScriptBlock>) => {
      const { project, selectedBlockId } = get();
      const defaultSpeakerId =
        type === 'dialogue'
          ? project.speakers[0]?.id
          : type === 'narration'
            ? (project.speakers.find((s) => s.name.toLowerCase().includes('narrat'))?.id ??
              project.speakers[0]?.id)
            : undefined;

      const newBlockId = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newBlock: ScriptBlock = {
        id: newBlockId,
        type,
        speakerId: customData?.speakerId ?? defaultSpeakerId,
        text: customData?.text ?? '',
        directorNotes: customData?.directorNotes ?? '',
        pauseAfterMs: customData?.pauseAfterMs ?? 400,
        ttsStatus: 'unrendered',
        order: project.blocks.length,
        ...customData,
      };

      const targetRefId = afterBlockId ?? selectedBlockId;
      let insertIndex: number | undefined;
      if (targetRefId) {
        const foundIdx = project.blocks.findIndex((b) => b.id === targetRefId);
        if (foundIdx >= 0) {
          insertIndex = foundIdx + 1;
        }
      }

      const cmd = new AddBlockCommand(accessor, newBlock, insertIndex);
      singletonHistory.executeCommand(cmd);
      set({
        selectedBlockId: newBlockId,
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      return newBlockId;
    },

    updateBlock: (blockId: string, patch: Partial<ScriptBlock>) => {
      const cmd = new UpdateBlockCommand(accessor, blockId, patch);
      singletonHistory.executeCommand(cmd);
      set({
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      void get().syncCacheStatuses();
    },

    deleteBlock: (blockId: string) => {
      const { project, selectedBlockId } = get();
      if (project.blocks.length <= 1) return;
      const idx = project.blocks.findIndex((b) => b.id === blockId);
      const cmd = new DeleteBlockCommand(accessor, blockId);
      singletonHistory.executeCommand(cmd);

      const updatedBlocks = get().project.blocks;
      const nextSelected =
        selectedBlockId === blockId
          ? (updatedBlocks[Math.max(0, idx - 1)]?.id ?? updatedBlocks[0]?.id ?? null)
          : selectedBlockId;

      set({
        selectedBlockId: nextSelected,
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
    },

    reorderBlocks: (fromIndex: number, toIndex: number) => {
      const cmd = new ReorderBlocksCommand(accessor, fromIndex, toIndex);
      singletonHistory.executeCommand(cmd);
      set({
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
    },

    moveBlockRelative: (blockId: string, direction: 'up' | 'down') => {
      const { project } = get();
      const idx = project.blocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= project.blocks.length) return;
      get().reorderBlocks(idx, targetIdx);
    },

    assignSpeakerByHotkey: (blockId: string, speakerIndex: number) => {
      const { project } = get();
      const targetSpeaker = project.speakers[speakerIndex];
      if (!targetSpeaker) return;
      get().updateBlock(blockId, {
        speakerId: targetSpeaker.id,
        type: 'dialogue',
      });
    },

    addSpeaker: (partial?: Partial<Speaker>) => {
      const palette = ['#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#3b82f6'];
      const { project } = get();
      const color = palette[project.speakers.length % palette.length];
      const newSpeaker: Speaker = {
        id: `spk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: partial?.name ?? `Speaker ${project.speakers.length + 1}`,
        color: partial?.color ?? color,
        gender: partial?.gender ?? 'neutral',
        age: partial?.age ?? '30s',
        personaPrompt:
          partial?.personaPrompt ??
          'Distinctive radio drama character with expressive vocal cadence.',
        actingNotes: partial?.actingNotes ?? 'Natural conversational delivery.',
        voice: partial?.voice ?? {
          baseVoice: 'Puck',
          stylePrompt: 'Warm, articulate studio delivery',
          speakingRate: 1.0,
          pitchAdjustment: 0,
          enableDirectorNotes: true,
          ssmlEnabled: true,
          acoustics: {
            targetCentroidHz: 2200,
            timbreWarmth: 0.2,
            biquadEq: {
              enabled: true,
              lowShelfGainDb: 0,
              midPeakGainDb: 1.5,
              highShelfGainDb: 0.5,
            },
            compression: {
              enabled: true,
              thresholdDb: -20,
              ratio: 2.5,
              attackMs: 15,
              releaseMs: 100,
            },
          },
        },
        createdAt: Date.now(),
      };

      const cmd = new AddOrRemoveSpeakerCommand(accessor, 'add', newSpeaker);
      singletonHistory.executeCommand(cmd);
      set({
        editingSpeakerId: newSpeaker.id,
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      return newSpeaker;
    },

    updateSpeaker: (speaker: Speaker) => {
      const cmd = new UpdateSpeakerCommand(accessor, speaker);
      singletonHistory.executeCommand(cmd);
      updateLiveDspIfPlaying(speaker);
      set({
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      void get().syncCacheStatuses();
    },

    removeSpeaker: (speakerId: string) => {
      const { project } = get();
      if (project.speakers.length <= 1) return;
      const target = project.speakers.find((s) => s.id === speakerId);
      if (!target) return;
      const cmd = new AddOrRemoveSpeakerCommand(accessor, 'remove', target);
      singletonHistory.executeCommand(cmd);
      set({
        editingSpeakerId: null,
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
    },

    toggleSpeakerEq: (speakerId: string) => {
      const speaker = get().project.speakers.find((s) => s.id === speakerId);
      if (!speaker) return;
      const currentEq = speaker.voice.acoustics.biquadEq ?? {
        enabled: true,
        lowShelfGainDb: 0,
        midPeakGainDb: 0,
        highShelfGainDb: 0,
      };
      const nextEnabled = !(currentEq.enabled ?? true);
      const updated: Speaker = {
        ...speaker,
        voice: {
          ...speaker.voice,
          acoustics: {
            ...speaker.voice.acoustics,
            biquadEq: {
              ...currentEq,
              enabled: nextEnabled,
            },
          },
        },
      };
      get().updateSpeaker(updated);
    },

    toggleSpeakerDynamics: (speakerId: string) => {
      const speaker = get().project.speakers.find((s) => s.id === speakerId);
      if (!speaker) return;
      const currentComp = speaker.voice.acoustics.compression ?? {
        enabled: true,
        thresholdDb: -20,
        ratio: 2.5,
        attackMs: 15,
        releaseMs: 100,
      };
      const nextEnabled = !(currentComp.enabled ?? true);
      const updated: Speaker = {
        ...speaker,
        voice: {
          ...speaker.voice,
          acoustics: {
            ...speaker.voice.acoustics,
            compression: {
              ...currentComp,
              enabled: nextEnabled,
            },
          },
        },
      };
      get().updateSpeaker(updated);
    },

    stopAudioPreview: () => {
      stopAllAudioPlayback();
      set({ previewingSpeakerId: null, playingBlockId: null });
    },

    previewSpeakerVoice: async (
      speakerId: string,
      customSampleText?: string,
      overrideSpeaker?: Speaker
    ) => {
      const { project, ttsProvider, previewingSpeakerId } = get();
      if (previewingSpeakerId === speakerId && !customSampleText) {
        get().stopAudioPreview();
        return;
      }

      const speaker =
        overrideSpeaker ?? project.speakers.find((s) => s.id === speakerId);
      if (!speaker) return;

      stopAllAudioPlayback();
      const lang = project.defaultLanguage;
      const sampleLine =
        customSampleText?.trim() ||
        project.blocks.find((b) => b.speakerId === speaker.id)?.text ||
        (lang === 'hr'
          ? `Pozdrav, ja sam ${speaker.name}. Ovo je zvučna provjera mog glasa i Biquad ekvalizatora.`
          : `Hello, I am ${speaker.name}. This is a studio check of my vocal timbre and Biquad equalizer.`);

      set({ previewingSpeakerId: speaker.id, ttsErrorMessage: null });

      const activeProvider: TtsEngineProvider =
        ttsProvider === 'gemini_tts' && hasValidApiKey()
          ? 'gemini_tts'
          : 'browser_tts';

      if (activeProvider === 'gemini_tts') {
        try {
          const tempBlock: ScriptBlock = {
            id: `preview_${speaker.id}`,
            type: 'dialogue',
            speakerId: speaker.id,
            text: sampleLine,
            pauseAfterMs: 0,
            order: 0,
          };

          const result = await synthesizeGeminiAudioWithPeaks({
            block: tempBlock,
            speaker,
            apiKey: getApiKey(),
            language: lang,
            provider: 'gemini_tts',
            ttsModel: get().project.aiSettings.ttsModel,
          });

          const played = await playAudioWithSpeakerDsp({
            audioBlob: result.audioBlob,
            speaker,
            onEnded: () => {
              if (get().previewingSpeakerId === speaker.id) {
                set({ previewingSpeakerId: null });
              }
            },
          });

          if (!played) {
            set({ previewingSpeakerId: null });
          }
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Gemini TTS preview failed';
          set({ ttsErrorMessage: msg, previewingSpeakerId: null });
          return;
        }
      }

      const started = speakWithBrowserTts({
        text: sampleLine,
        speaker,
        language: lang,
        onEnded: () => {
          if (get().previewingSpeakerId === speaker.id) {
            set({ previewingSpeakerId: null });
          }
        },
      });

      if (!started) {
        set({ previewingSpeakerId: null });
      }
    },

    auditionBlock: async (blockId: string, startOffsetSec = 0) => {
      const { project, playingBlockId } = get();
      if (playingBlockId === blockId) {
        get().stopAudioPreview();
        return;
      }

      const block = project.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const speaker = project.speakers.find((s) => s.id === block.speakerId);

      stopAllAudioPlayback();
      set({ playingBlockId: block.id, previewingSpeakerId: null });

      const handleDone = () => {
        if (get().playingBlockId === block.id) {
          set({ playingBlockId: null });
        }
      };

      // SFX blocks always play their rendered or synthesized WAV audio (never speech synthesis)
      if (block.type === 'sound_effect') {
        let sfxBlob: Blob | undefined;
        if (!block.generatedAudioUrl) {
          const cached = await getLatestBlockAudioEntry(block.id);
          if (cached?.audioBlob) {
            sfxBlob = cached.audioBlob;
          } else {
            const synth = await synthesizeSfxAudio({
              block,
              language: project.defaultLanguage,
              useAiCompiler: false,
            });
            sfxBlob = synth.audioBlob;
          }
        }

        const played = await playAudioWithSpeakerDsp({
          audioUrl: block.generatedAudioUrl,
          audioBlob: sfxBlob,
          speaker,
          volumeGainDb: block.volumeGainDb,
          startOffsetSec,
          onEnded: handleDone,
        });
        if (!played) {
          set({ playingBlockId: null });
        }
        return;
      }

      if (
        block.renderedWithProvider === 'browser_tts' ||
        (!block.generatedAudioUrl && get().ttsProvider === 'browser_tts')
      ) {
        const started = speakWithBrowserTts({
          text: block.text,
          speaker,
          language: project.defaultLanguage,
          startOffsetSec,
          onEnded: handleDone,
        });
        if (!started) {
          set({ playingBlockId: null });
        }
        return;
      }

      const cachedEntry = !block.generatedAudioUrl
        ? await getLatestBlockAudioEntry(block.id)
        : null;

      if (block.generatedAudioUrl || cachedEntry?.audioBlob) {
        const played = await playAudioWithSpeakerDsp({
          audioUrl: block.generatedAudioUrl,
          audioBlob: cachedEntry?.audioBlob,
          speaker,
          volumeGainDb: block.volumeGainDb,
          startOffsetSec,
          onEnded: handleDone,
        });
        if (!played) {
          const started = speakWithBrowserTts({
            text: block.text,
            speaker,
            language: project.defaultLanguage,
            startOffsetSec,
            onEnded: handleDone,
          });
          if (!started) {
            set({ playingBlockId: null });
          }
        }
      } else {
        // Unrendered dialogue/narration block: audition immediately via Browser TTS or procedural Web Audio
        const started = speakWithBrowserTts({
          text: block.text,
          speaker,
          language: project.defaultLanguage,
          startOffsetSec,
          onEnded: handleDone,
        });
        if (!started) {
          set({ playingBlockId: null });
        }
      }
    },

    synthesizeBlock: async (
      blockId: string,
      options?: { forceRegenerate?: boolean }
    ) => {
      const { project, ttsProvider } = get();
      const blockIdx = project.blocks.findIndex((b) => b.id === blockId);
      if (blockIdx < 0) return;

      const block = project.blocks[blockIdx];
      const speaker = project.speakers.find((s) => s.id === block.speakerId);
      const language = project.defaultLanguage;
      const forceRegen = options?.forceRegenerate === true;

      if (forceRegen) {
        await deleteBlockAudioFromCache(block.id, block.cacheKey);
      }

      const effectiveProvider: TtsEngineProvider =
        ttsProvider === 'gemini_tts' && hasValidApiKey()
          ? 'gemini_tts'
          : 'browser_tts';

      if (
        block.type !== 'sound_effect' &&
        ttsProvider === 'gemini_tts' &&
        !hasValidApiKey()
      ) {
        if (!get().useProceduralFallback) {
          set({
            ttsErrorMessage:
              language === 'hr'
                ? 'Unesite Gemini API ključ za Gemini 2.5 TTS ili odaberite Lokalni Preglednik TTS.'
                : 'Enter a Gemini API key for Gemini 2.5 TTS or switch to Local Browser TTS.',
            isApiKeyModalOpen: true,
          });
          return;
        }
      }

      // 1. Check content-addressed IndexedDB / L1 cache first (unless forceRegenerate is true)
      if (!forceRegen) {
        const cacheCheck = await evaluateBlockCacheStatus(block, speaker, language);
        if (cacheCheck.status === 'ok' && cacheCheck.cachedEntry) {
          const entry = cacheCheck.cachedEntry;
          const nextBlocks = get().project.blocks.map((b) =>
            b.id === blockId
              ? {
                  ...b,
                  ttsStatus: 'ok' as const,
                  renderedWithProvider: effectiveProvider,
                  cacheKey: entry.cacheKey,
                  generatedAudioUrl: entry.audioUrl,
                  waveformPeaks: entry.waveformPeaks,
                  timepoints: entry.timepoints,
                  estimatedDurationSec: entry.durationSec,
                  audioTokenEstimate: entry.tokensUsed,
                }
              : b
          );
          const nextProject = { ...get().project, blocks: nextBlocks };
          persistProject(nextProject);
          set({ project: nextProject });
          if (block.type !== 'sound_effect' && effectiveProvider === 'browser_tts') {
            speakWithBrowserTts({ text: block.text, speaker, language });
          }
          return;
        }
      }

      // 2. Mark block as 'rendering'
      set({
        ttsErrorMessage: null,
        project: {
          ...get().project,
          blocks: get().project.blocks.map((b) =>
            b.id === blockId ? { ...b, ttsStatus: 'rendering' as const } : b
          ),
        },
      });

      try {
        const apiKey = getApiKey();

        let result: {
          audioBlob: Blob;
          waveformPeaks: NonNullable<ScriptBlock['waveformPeaks']>;
          timepoints: NonNullable<ScriptBlock['timepoints']>;
          durationSec: number;
          tokensUsed: number;
          providerUsed: TtsEngineProvider;
        };

        if (block.type === 'sound_effect') {
          const sfxResult = await synthesizeSfxAudio({
            block,
            language,
            apiKey: effectiveProvider === 'gemini_tts' ? apiKey : null,
            useAiCompiler: effectiveProvider === 'gemini_tts' && hasValidApiKey(),
          });
          result = {
            ...sfxResult,
            providerUsed: effectiveProvider,
          };
        } else {
          const precedingBlocks = get().project.blocks.slice(
            Math.max(0, blockIdx - 2),
            blockIdx
          );
          result = await synthesizeGeminiAudioWithPeaks({
            block,
            speaker,
            apiKey,
            language,
            precedingBlocks,
            allSpeakers: get().project.speakers,
            provider: effectiveProvider,
            ttsModel: get().project.aiSettings.ttsModel,
            speakImmediatelyOnBrowserTts: effectiveProvider === 'browser_tts',
          });
        }

        const cacheKey = await computeBlockCacheKey(block, speaker, language);
        const savedEntry = await saveBlockAudioToCache({
          blockId: block.id,
          cacheKey,
          audioBlob: result.audioBlob,
          durationSec: result.durationSec,
          tokensUsed: result.tokensUsed,
          timepoints: result.timepoints,
          waveformPeaks: result.waveformPeaks,
        });

        const updatedRawBlocks = get().project.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                ttsStatus: 'ok' as const,
                renderedWithProvider: result.providerUsed,
                cacheKey: savedEntry.cacheKey,
                generatedAudioUrl: savedEntry.audioUrl,
                waveformPeaks: savedEntry.waveformPeaks,
                timepoints: savedEntry.timepoints,
                estimatedDurationSec: savedEntry.durationSec,
                audioTokenEstimate: savedEntry.tokensUsed,
              }
            : b
        );

        const { blocks } = recalculateProjectTimeline(
          updatedRawBlocks,
          get().project.speakers,
          get().project.metadata?.targetWpm ?? 140
        );

        const mergedBlocks = blocks.map((b) => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            waveformPeaks: savedEntry.waveformPeaks,
            timepoints: savedEntry.timepoints,
            generatedAudioUrl: savedEntry.audioUrl,
            cacheKey: savedEntry.cacheKey,
            renderedWithProvider: result.providerUsed,
            ttsStatus: 'ok' as const,
            estimatedDurationSec: savedEntry.durationSec,
            audioTokenEstimate: savedEntry.tokensUsed,
          };
        });

        const finalProject: Project = {
          ...get().project,
          blocks: mergedBlocks,
          updatedAt: Date.now(),
        };
        persistProject(finalProject);
        set({ project: finalProject });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'TTS Synthesis failed';
        set({
          ttsErrorMessage: msg,
          project: {
            ...get().project,
            blocks: get().project.blocks.map((b) =>
              b.id === blockId ? { ...b, ttsStatus: 'stale' as const } : b
            ),
          },
        });
      }
    },

    importSfxAudioFile: async (blockId: string, file: File) => {
      const { project } = get();
      const block = project.blocks.find((b) => b.id === blockId);
      if (!block) return;

      set({
        ttsErrorMessage: null,
        project: {
          ...project,
          blocks: project.blocks.map((b) =>
            b.id === blockId ? { ...b, ttsStatus: 'rendering' as const } : b
          ),
        },
      });

      try {
        await deleteBlockAudioFromCache(block.id, block.cacheKey);
        const decoded = await decodeUploadedAudioFileToSfxResult(file, block.id);

        const updatedBlockSpec: ScriptBlock = {
          ...block,
          type: 'sound_effect',
          sfxCategory: 'custom_upload',
          customAudioFileName: file.name,
          sfxDurationSec: decoded.durationSec,
        };

        const cacheKey = await computeBlockCacheKey(
          updatedBlockSpec,
          undefined,
          project.defaultLanguage
        );

        const savedEntry = await saveBlockAudioToCache({
          blockId: block.id,
          cacheKey,
          audioBlob: decoded.audioBlob,
          durationSec: decoded.durationSec,
          tokensUsed: 0,
          timepoints: decoded.timepoints,
          waveformPeaks: decoded.waveformPeaks,
        });

        const updatedRawBlocks = get().project.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                type: 'sound_effect' as const,
                sfxCategory: 'custom_upload' as const,
                customAudioFileName: file.name,
                sfxDurationSec: decoded.durationSec,
                ttsStatus: 'ok' as const,
                cacheKey: savedEntry.cacheKey,
                generatedAudioUrl: savedEntry.audioUrl,
                waveformPeaks: savedEntry.waveformPeaks,
                timepoints: savedEntry.timepoints,
                estimatedDurationSec: savedEntry.durationSec,
                audioTokenEstimate: 0,
              }
            : b
        );

        const { blocks } = recalculateProjectTimeline(
          updatedRawBlocks,
          get().project.speakers,
          get().project.metadata?.targetWpm ?? 140
        );

        const mergedBlocks = blocks.map((b) => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            sfxCategory: 'custom_upload' as const,
            customAudioFileName: file.name,
            sfxDurationSec: decoded.durationSec,
            estimatedDurationSec: savedEntry.durationSec,
            waveformPeaks: savedEntry.waveformPeaks,
            timepoints: savedEntry.timepoints,
            generatedAudioUrl: savedEntry.audioUrl,
            cacheKey: savedEntry.cacheKey,
            ttsStatus: 'ok' as const,
          };
        });

        const finalProject: Project = {
          ...get().project,
          blocks: mergedBlocks,
          updatedAt: Date.now(),
        };
        persistProject(finalProject);
        set({ project: finalProject });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to decode uploaded audio file';
        set({
          ttsErrorMessage: msg,
          project: {
            ...get().project,
            blocks: get().project.blocks.map((b) =>
              b.id === blockId ? { ...b, ttsStatus: 'stale' as const } : b
            ),
          },
        });
      }
    },

    regenerateBlockAudio: async (blockId: string) => {
      await get().synthesizeBlock(blockId, { forceRegenerate: true });
    },

    deleteBlockAudio: async (blockId: string) => {
      if (get().playingBlockId === blockId) {
        get().stopAudioPreview();
      }
      const target = get().project.blocks.find((b) => b.id === blockId);
      if (!target) return;

      await deleteBlockAudioFromCache(blockId, target.cacheKey);

      const rawCleared = get().project.blocks.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          ttsStatus: 'unrendered' as const,
          cacheKey: undefined,
          generatedAudioUrl: undefined,
          waveformPeaks: undefined,
          timepoints: undefined,
          renderedWithProvider: undefined,
        };
      });

      const { blocks } = recalculateProjectTimeline(
        rawCleared,
        get().project.speakers,
        get().project.metadata?.targetWpm ?? 140
      );

      // Preserve existing waveformPeaks on other blocks that weren't deleted
      const prevPeaksMap = new Map(
        get()
          .project.blocks.filter((b) => b.id !== blockId && b.waveformPeaks)
          .map((b) => [b.id, b.waveformPeaks])
      );
      const merged = blocks.map((b) => ({
        ...b,
        waveformPeaks: prevPeaksMap.get(b.id) ?? b.waveformPeaks,
      }));

      const nextProject: Project = {
        ...get().project,
        blocks: merged,
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    rebuildBlockWaveform: async (blockId: string) => {
      const { project } = get();
      const block = project.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const speaker = project.speakers.find((s) => s.id === block.speakerId);

      // 1. Check if a cached WAV blob exists for this block so we can re-extract exact PCM peaks
      const cached = await getLatestBlockAudioEntry(block.id, block.cacheKey);
      if (cached && cached.audioBlob) {
        const extractedPeaks = await extractWaveformPeaksFromWavBlob(
          cached.audioBlob,
          DEFAULT_PEAKS_PER_SECOND
        );
        const nextPeaks = extractedPeaks ?? cached.waveformPeaks;
        const saved = await saveBlockAudioToCache({
          blockId: block.id,
          cacheKey: cached.cacheKey,
          audioBlob: cached.audioBlob,
          durationSec: cached.durationSec,
          tokensUsed: cached.tokensUsed,
          timepoints: cached.timepoints,
          waveformPeaks: nextPeaks,
        });

        const nextRawBlocks = get().project.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                waveformPeaks: saved.waveformPeaks,
                timepoints: saved.timepoints,
                generatedAudioUrl: saved.audioUrl,
                estimatedDurationSec: saved.durationSec,
                audioTokenEstimate: saved.tokensUsed,
                ttsStatus: 'ok' as const,
              }
            : b
        );
        const { blocks } = recalculateProjectTimeline(
          nextRawBlocks,
          get().project.speakers,
          get().project.metadata?.targetWpm ?? 140
        );
        const nextProject = { ...get().project, blocks, updatedAt: Date.now() };
        persistProject(nextProject);
        set({ project: nextProject });
        return;
      }

      // 2. If sound_effect block, synthesize physical-modeling SFX waveform & WAV blob
      if (block.type === 'sound_effect') {
        const sfxResult = await synthesizeSfxAudio({
          block,
          language: project.defaultLanguage,
          useAiCompiler: false,
        });
        const cacheKey = await computeBlockCacheKey(block, undefined, project.defaultLanguage);
        const saved = await saveBlockAudioToCache({
          blockId: block.id,
          cacheKey,
          audioBlob: sfxResult.audioBlob,
          durationSec: sfxResult.durationSec,
          tokensUsed: sfxResult.tokensUsed,
          timepoints: sfxResult.timepoints,
          waveformPeaks: sfxResult.waveformPeaks,
        });

        const nextRawBlocks = get().project.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                waveformPeaks: saved.waveformPeaks,
                timepoints: saved.timepoints,
                generatedAudioUrl: saved.audioUrl,
                cacheKey: saved.cacheKey,
                estimatedDurationSec: saved.durationSec,
                audioTokenEstimate: saved.tokensUsed,
                ttsStatus: 'ok' as const,
              }
            : b
        );
        const { blocks } = recalculateProjectTimeline(
          nextRawBlocks,
          get().project.speakers,
          get().project.metadata?.targetWpm ?? 140
        );
        const nextProject = { ...get().project, blocks, updatedAt: Date.now() };
        persistProject(nextProject);
        set({ project: nextProject });
        return;
      }

      // 3. Otherwise compute fresh speech-cadence PCM & SoA WaveformPeakData pyramid
      const envelope = synthesizeProceduralSpeechPcm({
        block,
        speaker,
        sampleRate: DEFAULT_TTS_SAMPLE_RATE,
        targetWpm: project.metadata?.targetWpm ?? 140,
      });
      const waveformPeaks = extractWaveformPeaksFromPcm(
        envelope.pcmInt16,
        DEFAULT_TTS_SAMPLE_RATE,
        DEFAULT_PEAKS_PER_SECOND
      );
      const audioBlob = encodePcm16ToWavBlob(envelope.pcmBytes, DEFAULT_TTS_SAMPLE_RATE, 1);
      const cacheKey = await computeBlockCacheKey(block, speaker, project.defaultLanguage);
      const tokensUsed = Math.ceil(envelope.durationSec * 25);

      const saved = await saveBlockAudioToCache({
        blockId: block.id,
        cacheKey,
        audioBlob,
        durationSec: envelope.durationSec,
        tokensUsed,
        timepoints: envelope.timepoints,
        waveformPeaks,
      });

      const nextRawBlocks = get().project.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              waveformPeaks: saved.waveformPeaks,
              timepoints: saved.timepoints,
              generatedAudioUrl: saved.audioUrl,
              cacheKey: saved.cacheKey,
              estimatedDurationSec: saved.durationSec,
              audioTokenEstimate: saved.tokensUsed,
              ttsStatus: 'ok' as const,
            }
          : b
      );
      const { blocks } = recalculateProjectTimeline(
        nextRawBlocks,
        get().project.speakers,
        get().project.metadata?.targetWpm ?? 140
      );
      const nextProject = { ...get().project, blocks, updatedAt: Date.now() };
      persistProject(nextProject);
      set({ project: nextProject });
    },

    synthesizeAllBlocks: async () => {
      if (get().isBatchSynthesizing) return;
      set({ isBatchSynthesizing: true });
      try {
        const blocksToRender = get().project.blocks.filter((b) => b.ttsStatus !== 'ok');
        for (const blk of blocksToRender) {
          await get().synthesizeBlock(blk.id);
        }
      } finally {
        set({ isBatchSynthesizing: false });
      }
    },

    regenerateAllBlocksAudio: async () => {
      if (get().isBatchSynthesizing) return;
      set({ isBatchSynthesizing: true });
      try {
        const allBlocks = [...get().project.blocks];
        for (const blk of allBlocks) {
          await get().synthesizeBlock(blk.id, { forceRegenerate: true });
        }
      } finally {
        set({ isBatchSynthesizing: false });
      }
    },

    rebuildAllWaveforms: async () => {
      const allBlocks = [...get().project.blocks];
      for (const blk of allBlocks) {
        await get().rebuildBlockWaveform(blk.id);
      }
    },

    regenerateSpeakerAudio: async (speakerId: string) => {
      if (get().isBatchSynthesizing) return;
      set({ isBatchSynthesizing: true });
      try {
        const speakerBlocks = get().project.blocks.filter(
          (b) => b.speakerId === speakerId
        );
        for (const blk of speakerBlocks) {
          await get().synthesizeBlock(blk.id, { forceRegenerate: true });
        }
      } finally {
        set({ isBatchSynthesizing: false });
      }
    },

    deleteSpeakerAudio: async (speakerId: string) => {
      const speakerBlocks = get().project.blocks.filter(
        (b) => b.speakerId === speakerId
      );
      for (const blk of speakerBlocks) {
        await get().deleteBlockAudio(blk.id);
      }
    },

    syncCacheStatuses: async () => {
      const currentProject = get().project;
      const speakerMap = new Map(currentProject.speakers.map((s) => [s.id, s]));
      let changed = false;

      const updatedBlocks = await Promise.all(
        currentProject.blocks.map(async (b) => {
          const spk = b.speakerId ? speakerMap.get(b.speakerId) : undefined;
          const res = await evaluateBlockCacheStatus(b, spk, currentProject.defaultLanguage);
          if (res.status === 'ok' && res.cachedEntry) {
            if (b.ttsStatus !== 'ok' || !b.waveformPeaks) {
              changed = true;
              return {
                ...b,
                ttsStatus: 'ok' as const,
                cacheKey: res.cachedEntry.cacheKey,
                generatedAudioUrl: res.cachedEntry.audioUrl,
                waveformPeaks: res.cachedEntry.waveformPeaks,
                timepoints: res.cachedEntry.timepoints,
              };
            }
          } else if (b.ttsStatus === 'ok' && res.status === 'stale') {
            changed = true;
            return {
              ...b,
              ttsStatus: 'stale' as const,
            };
          }
          return b;
        })
      );

      if (changed) {
        const nextProject = { ...get().project, blocks: updatedBlocks };
        persistProject(nextProject);
        set({ project: nextProject });
      }
    },

    purgeAudioCache: async () => {
      stopAllAudioPlayback();
      await clearAllAudioCache();
      const rawCleared = get().project.blocks.map((b) => ({
        ...b,
        ttsStatus: 'unrendered' as const,
        cacheKey: undefined,
        generatedAudioUrl: undefined,
        waveformPeaks: undefined,
        timepoints: undefined,
        renderedWithProvider: undefined,
      }));
      const { blocks } = recalculateProjectTimeline(
        rawCleared,
        get().project.speakers,
        get().project.metadata?.targetWpm ?? 140
      );
      const nextProject = { ...get().project, blocks };
      persistProject(nextProject);
      set({ project: nextProject, playingBlockId: null, previewingSpeakerId: null });
    },

    undo: () => {
      singletonHistory.undo();
      set({
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      void get().syncCacheStatuses();
    },

    redo: () => {
      singletonHistory.redo();
      set({
        undoCount: singletonHistory.getUndoCount(),
        redoCount: singletonHistory.getRedoCount(),
      });
      void get().syncCacheStatuses();
    },

    resetToSampleProject: () => {
      stopAllAudioPlayback();
      singletonHistory.clear();
      const freshLib = createInitialProjectLibrary();
      const fresh = freshLib[0];
      persistProject(fresh, freshLib);
      set({
        project: fresh,
        projects: freshLib,
        selectedBlockId: fresh.blocks[0]?.id ?? null,
        editingSpeakerId: null,
        isEpisodePropertiesModalOpen: false,
        previewingSpeakerId: null,
        playingBlockId: null,
        ttsErrorMessage: null,
        undoCount: 0,
        redoCount: 0,
      });
    },
  };
});
