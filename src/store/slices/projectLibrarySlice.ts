import {
  AppSettings,
  Project,
  ScriptBlock,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import {
  createGeodesicFlameProject,
  createInitialProjectLibrary,
  createSampleProject,
} from '../../i18n/sampleProject';
import { recalculateProjectTimeline } from '../../core/pacing/pacingCalculator';
import { stopAllAudioPlayback } from '../../core/dsp/LiveAudioPreviewer';
import {
  hydrateProjectTimeline,
  persistProject,
  persistSettings,
} from '../projectPersistence';
import {
  ProjectPropertiesPatch,
  StoriaStoreState,
  StoreSliceContext,
  transientPlaybackRef,
} from '../storeTypes';

export type ProjectLibrarySlice = Pick<
  StoriaStoreState,
  | 'importProjectFromBundle'
  | 'updateProjectTitle'
  | 'updateProjectProperties'
  | 'switchProject'
  | 'createProject'
  | 'duplicateProject'
  | 'deleteProject'
  | 'undo'
  | 'redo'
  | 'resetToSampleProject'
  | 'loadGeodesicFlameDemo'
>;

export function createProjectLibrarySlice({
  set,
  get,
  singletonHistory,
}: StoreSliceContext): ProjectLibrarySlice {
  return {
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
      if (
        patch.targetWpm !== undefined &&
        patch.targetWpm !== current.metadata?.targetWpm
      ) {
        const prevPeaks = new Map(
          current.blocks
            .filter((b) => b.waveformPeaks)
            .map((b) => [b.id, b.waveformPeaks])
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
          patch.description !== undefined
            ? patch.description
            : current.description,
        defaultLanguage:
          patch.defaultLanguage !== undefined
            ? patch.defaultLanguage
            : current.defaultLanguage,
        dialect: patch.dialect !== undefined ? patch.dialect : current.dialect,
        dubrovnikRegister:
          patch.dubrovnikRegister !== undefined
            ? patch.dubrovnikRegister
            : current.dubrovnikRegister,
        blocks: nextBlocks,
        metadata: {
          ...current.metadata,
          author:
            patch.author !== undefined
              ? patch.author
              : (current.metadata?.author ?? 'Storia Studio'),
          genre:
            patch.genre !== undefined
              ? patch.genre
              : (current.metadata?.genre ?? 'Audio Drama'),
          targetWpm: nextTargetWpm,
        },
        audioConfig: {
          ...current.audioConfig,
          sampleRate:
            patch.sampleRate !== undefined
              ? patch.sampleRate
              : current.audioConfig.sampleRate,
          bitDepth:
            patch.bitDepth !== undefined
              ? patch.bitDepth
              : current.audioConfig.bitDepth,
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
      transientPlaybackRef.current.activeBlockId =
        nextActive.blocks[0]?.id ?? null;
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
            (lang === 'hr'
              ? 'Audio drama / Podcast'
              : 'Audio Drama / Podcast'),
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
        (projectId
          ? get().projects.find((p) => p.id === projectId)
          : undefined) ?? get().project;
      const now = Date.now();
      const copySuffix =
        source.defaultLanguage === 'hr' ? ' (Kopija)' : ' (Copy)';

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

      const nextProjects = persistProject(cloned, [
        ...get().projects,
        cloned,
      ]);
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

    loadGeodesicFlameDemo: () => {
      stopAllAudioPlayback();
      singletonHistory.clear();
      const freshLib = createInitialProjectLibrary();
      const demo = createGeodesicFlameProject();
      const existingIdx = freshLib.findIndex((p) => p.id === demo.id);
      const updatedLib =
        existingIdx >= 0
          ? freshLib.map((p) => (p.id === demo.id ? demo : p))
          : [demo, ...freshLib];
      persistProject(demo, updatedLib);
      set({
        project: demo,
        projects: updatedLib,
        selectedBlockId: demo.blocks[0]?.id ?? null,
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
}

