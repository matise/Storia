import { create } from 'zustand';
import { Project } from '../types/storia';
import { HistoryManager } from '../core/history/Command';
import { ProjectStateAccessor } from '../core/history/commands/scriptCommands';
import { getTtsProvider, hasValidApiKey } from '../core/storage/keyVault';
import {
  StoriaStoreState,
  StoreSliceContext,
  transientPlaybackRef,
  TransientPlaybackState,
  ProjectPropertiesPatch,
} from './storeTypes';
import {
  loadInitialProjectsLibrary,
  loadInitialProject,
  loadInitialSettings,
  persistProject,
} from './projectPersistence';
import { createUiAndSettingsSlice } from './slices/uiAndSettingsSlice';
import { createProjectLibrarySlice } from './slices/projectLibrarySlice';
import { createScriptAndCastSlice } from './slices/scriptAndCastSlice';
import { createDspAndAuditionSlice } from './slices/dspAndAuditionSlice';
import { createTtsSynthesisSlice } from './slices/ttsSynthesisSlice';

export { transientPlaybackRef };
export type { TransientPlaybackState, ProjectPropertiesPatch, StoriaStoreState };

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

  const ctx: StoreSliceContext = {
    set,
    get,
    accessor,
    singletonHistory,
  };

  return {
    project: initialProject,
    projects: initialProjectsLibrary.some((p) => p.id === initialProject.id)
      ? initialProjectsLibrary.map((p) =>
          p.id === initialProject.id ? initialProject : p
        )
      : [initialProject, ...initialProjectsLibrary],
    appSettings: initialSettings,
    selectedBlockId: initialProject.blocks[0]?.id ?? null,
    editingSpeakerId: null,
    isApiKeyModalOpen: false,
    isEpisodePropertiesModalOpen: false,
    isExportMasterModalOpen: false,
    isAuxBusModalOpen: false,
    hasConfiguredApiKey: hasValidApiKey(),
    ttsProvider: initialProvider,
    useProceduralFallback: initialProvider === 'browser_tts',
    isBatchSynthesizing: false,
    previewingSpeakerId: null,
    playingBlockId: null,
    isMasterPlaying: false,
    isAutoAdvanceEnabled: true,
    ttsErrorMessage: null,
    undoCount: 0,
    redoCount: 0,
    historyManager: singletonHistory,

    ...createUiAndSettingsSlice(ctx),
    ...createProjectLibrarySlice(ctx),
    ...createScriptAndCastSlice(ctx),
    ...createDspAndAuditionSlice(ctx),
    ...createTtsSynthesisSlice(ctx),
  };
});
