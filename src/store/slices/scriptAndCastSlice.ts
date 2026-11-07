import {
  BlockType,
  CoWriterBeatBlockDraft,
  CoWriterBeatCandidate,
  PersonaResearchRecord,
  Project,
  ScriptBlock,
  Speaker,
} from '../../types/storia';
import {
  AddBlockCommand,
  AddOrRemoveSpeakerCommand,
  DeleteBlockCommand,
  ReorderBlocksCommand,
  UpdateBlockCommand,
  UpdateSpeakerCommand,
} from '../../core/history/commands/scriptCommands';
import { recalculateProjectTimeline } from '../../core/pacing/pacingCalculator';
import {
  stopAllAudioPlayback,
  updateLiveBlockAudio,
  updateLiveDspIfPlaying,
} from '../../core/dsp/LiveAudioPreviewer';
import { persistProject } from '../projectPersistence';
import {
  StoriaStoreState,
  StoreSliceContext,
  transientPlaybackRef,
} from '../storeTypes';

export type ScriptAndCastSlice = Pick<
  StoriaStoreState,
  | 'selectBlock'
  | 'addResearchRecord'
  | 'insertSceneBeatBlocks'
  | 'loadCoWriterBeatAsEpisode'
  | 'addBlock'
  | 'updateBlock'
  | 'setAllBlocksCollapsed'
  | 'deleteBlock'
  | 'reorderBlocks'
  | 'moveBlockRelative'
  | 'assignSpeakerByHotkey'
  | 'addSpeaker'
  | 'updateSpeaker'
  | 'removeSpeaker'
>;

export function createScriptAndCastSlice({
  set,
  get,
  accessor,
  singletonHistory,
}: StoreSliceContext): ScriptAndCastSlice {
  return {
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

    addResearchRecord: (record: PersonaResearchRecord) => {
      const existing = get().project.researchNotebook ?? [];
      const nextNotebook = [
        record,
        ...existing.filter((r) => r.id !== record.id),
      ].slice(0, 30);
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

    loadCoWriterBeatAsEpisode: (beat: CoWriterBeatCandidate) => {
      stopAllAudioPlayback();
      const current = get().project;
      const now = Date.now();
      const newBlocks: ScriptBlock[] = beat.blocks.map((draft, idx) => ({
        id: `blk_${now}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
        type: draft.type,
        speakerId: draft.speakerId,
        text: draft.text,
        directorNotes: draft.directorNotes ?? 'prirodno / natural',
        pauseAfterMs: draft.pauseAfterMs ?? 450,
        ttsStatus: 'unrendered',
        order: idx,
      }));

      const targetWpm = current.metadata?.targetWpm ?? 140;
      const { blocks: hydratedBlocks } = recalculateProjectTimeline(
        newBlocks,
        current.speakers,
        targetWpm
      );

      const nextProject: Project = {
        ...current,
        title: beat.parsedEpisodeTitle?.trim() || current.title,
        description: beat.parsedEpisodeTopic?.trim() || current.description,
        blocks: hydratedBlocks,
        updatedAt: now,
      };

      const nextProjects = persistProject(nextProject, get().projects);
      set({
        project: nextProject,
        projects: nextProjects,
        selectedBlockId: hydratedBlocks[0]?.id ?? null,
        playingBlockId: null,
        previewingSpeakerId: null,
      });

      return hydratedBlocks.map((b) => b.id);
    },

    addBlock: (
      type: BlockType,
      afterBlockId?: string,
      customData?: Partial<ScriptBlock>
    ) => {
      const { project, selectedBlockId } = get();
      const defaultSpeakerId =
        type === 'dialogue'
          ? project.speakers[0]?.id
          : type === 'narration'
            ? (project.speakers.find((s) =>
                s.name.toLowerCase().includes('narrat')
              )?.id ?? project.speakers[0]?.id)
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
      if (
        patch.volumeGainDb !== undefined ||
        patch.fadeInMs !== undefined ||
        patch.fadeOutMs !== undefined ||
        patch.fadeInCurve !== undefined ||
        patch.fadeOutCurve !== undefined
      ) {
        updateLiveBlockAudio(blockId, {
          volumeGainDb: patch.volumeGainDb,
          fadeInMs: patch.fadeInMs,
          fadeOutMs: patch.fadeOutMs,
          fadeInCurve: patch.fadeInCurve,
          fadeOutCurve: patch.fadeOutCurve,
        });
      }
      void get().syncCacheStatuses();
    },

    setAllBlocksCollapsed: (collapsed: boolean) => {
      const { project } = get();
      const nextBlocks = project.blocks.map((b) => ({ ...b, isCollapsed: collapsed }));
      const nextProject: Project = {
        ...project,
        blocks: nextBlocks,
        updatedAt: Date.now(),
      };
      persistProject(nextProject);
      set({ project: nextProject });
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
          ? (updatedBlocks[Math.max(0, idx - 1)]?.id ??
            updatedBlocks[0]?.id ??
            null)
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
      const palette = [
        '#f59e0b',
        '#06b6d4',
        '#8b5cf6',
        '#ef4444',
        '#14b8a6',
        '#3b82f6',
      ];
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
  };
}

