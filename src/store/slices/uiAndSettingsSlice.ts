import {
  AppSettings,
  GeminiTextModelId,
  GeminiTtsModelId,
  Project,
  SupportedLanguage,
  TtsEngineProvider,
} from '../../types/storia';
import {
  hasValidApiKey,
  setApiKey,
  setTtsProvider,
} from '../../core/storage/keyVault';
import { stopAllAudioPlayback } from '../../core/dsp/LiveAudioPreviewer';
import { studioTransportEngine } from '../../core/dsp/StudioTransportEngine';
import { persistProject, persistSettings } from '../projectPersistence';
import {
  StoriaStoreState,
  StoreSliceContext,
  audioRuntimeControllers,
} from '../storeTypes';

export type UiAndSettingsSlice = Pick<
  StoriaStoreState,
  | 'setMasterPlaying'
  | 'toggleAutoAdvance'
  | 'setAutoAdvance'
  | 'setUiLanguage'
  | 'openSpeakerModal'
  | 'setApiKeyModalOpen'
  | 'setEpisodePropertiesModalOpen'
  | 'setExportMasterModalOpen'
  | 'setAuxBusModalOpen'
  | 'setActiveTtsProvider'
  | 'setGeminiTextModel'
  | 'setGeminiTtsModel'
  | 'setEnableSearchGrounding'
  | 'saveApiConfiguration'
  | 'clearTtsError'
>;

export function createUiAndSettingsSlice({
  set,
  get,
}: StoreSliceContext): UiAndSettingsSlice {
  return {
    setMasterPlaying: (playing: boolean) => {
      if (playing) {
        // Starting "Play All" must silence any single-block audition or speaker preview first
        audioRuntimeControllers.auditionSessionToken++;
        stopAllAudioPlayback();
        set({
          isMasterPlaying: true,
          playingBlockId: null,
          previewingSpeakerId: null,
        });
      } else {
        studioTransportEngine.stop();
        set({ isMasterPlaying: false });
      }
    },

    toggleAutoAdvance: () =>
      set((state) => ({ isAutoAdvanceEnabled: !state.isAutoAdvanceEnabled })),

    setAutoAdvance: (enabled: boolean) => set({ isAutoAdvanceEnabled: enabled }),

    setUiLanguage: (lang: SupportedLanguage) => {
      const nextSettings: AppSettings = {
        ...get().appSettings,
        uiLanguage: lang,
      };
      persistSettings(nextSettings);
      set({ appSettings: nextSettings });
    },

    openSpeakerModal: (
      speakerId: string | null,
      initialTab?: 'voice' | 'dsp' | 'persona'
    ) => {
      set({
        editingSpeakerId: speakerId,
        editingSpeakerInitialTab: initialTab ?? 'voice',
      });
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

    setAuxBusModalOpen: (open: boolean) => {
      set({ isAuxBusModalOpen: open });
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
  };
}

