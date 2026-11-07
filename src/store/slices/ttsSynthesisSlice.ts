import { Project, ScriptBlock, TtsEngineProvider } from '../../types/storia';
import { getApiKey, hasValidApiKey } from '../../core/storage/keyVault';
import {
  DEFAULT_PEAKS_PER_SECOND,
  DEFAULT_TTS_SAMPLE_RATE,
  encodePcm16ToWavBlob,
  extractWaveformPeaksFromPcm,
  synthesizeGeminiAudioWithPeaks,
  synthesizeProceduralSpeechPcm,
} from '../../services/geminiTtsService';
import {
  speakWithBrowserTts,
  stopAllAudioPlayback,
} from '../../core/dsp/LiveAudioPreviewer';
import {
  synthesizeSfxAudio,
  decodeUploadedAudioFileToSfxResult,
} from '../../services/sfxGeneratorService';
import { recalculateProjectTimeline } from '../../core/pacing/pacingCalculator';
import {
  computeBlockCacheKey,
  evaluateBlockCacheStatus,
  extractWaveformPeaksFromWavBlob,
  saveBlockAudioToCache,
  deleteBlockAudioFromCache,
  clearAllAudioCache,
  getLatestBlockAudioEntry,
} from '../../core/storage/audioCache';
import {
  StoriaStoreState,
  StoreSliceContext,
  audioRuntimeControllers,
} from '../storeTypes';
import { persistProject } from '../projectPersistence';

export type TtsSynthesisSlice = Pick<
  StoriaStoreState,
  | 'synthesizeBlock'
  | 'importSfxAudioFile'
  | 'regenerateBlockAudio'
  | 'deleteBlockAudio'
  | 'rebuildBlockWaveform'
  | 'synthesizeAllBlocks'
  | 'regenerateAllBlocksAudio'
  | 'rebuildAllWaveforms'
  | 'regenerateSpeakerAudio'
  | 'abortBatchSynthesis'
  | 'abortBlockSynthesis'
  | 'abortAllSynthesis'
  | 'deleteSpeakerAudio'
  | 'syncCacheStatuses'
  | 'purgeAudioCache'
>;

export function createTtsSynthesisSlice({
  set,
  get,
}: StoreSliceContext): TtsSynthesisSlice {
  return {
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

      // 1. Check content-addressed IndexedDB / L1 cache first (only when not forcing regen, not stale, and same provider)
      if (
        !forceRegen &&
        block.ttsStatus !== 'stale' &&
        (!block.renderedWithProvider || block.renderedWithProvider === effectiveProvider)
      ) {
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
      const prevController =
        audioRuntimeControllers.activeBlockSynthesisAbortControllers.get(blockId);
      if (prevController) {
        prevController.abort();
        audioRuntimeControllers.activeBlockSynthesisAbortControllers.delete(blockId);
      }
      const blockAbortController = new AbortController();
      audioRuntimeControllers.activeBlockSynthesisAbortControllers.set(
        blockId,
        blockAbortController
      );

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
            abortSignal: blockAbortController.signal,
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
            abortSignal: blockAbortController.signal,
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
        if (
          blockAbortController.signal.aborted ||
          (err as Error)?.name === 'AbortError'
        ) {
          set({
            project: {
              ...get().project,
              blocks: get().project.blocks.map((b) =>
                b.id === blockId
                  ? {
                      ...b,
                      ttsStatus: b.generatedAudioUrl ? ('ok' as const) : ('stale' as const),
                    }
                  : b
              ),
            },
          });
          return;
        }
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
      } finally {
        if (
          audioRuntimeControllers.activeBlockSynthesisAbortControllers.get(
            blockId
          ) === blockAbortController
        ) {
          audioRuntimeControllers.activeBlockSynthesisAbortControllers.delete(
            blockId
          );
        }
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
        const msg =
          err instanceof Error ? err.message : 'Failed to decode uploaded audio file';
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
        const cacheKey = await computeBlockCacheKey(
          block,
          undefined,
          project.defaultLanguage
        );
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
      const audioBlob = encodePcm16ToWavBlob(
        envelope.pcmBytes,
        DEFAULT_TTS_SAMPLE_RATE,
        1
      );
      const cacheKey = await computeBlockCacheKey(
        block,
        speaker,
        project.defaultLanguage
      );
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
      audioRuntimeControllers.batchSynthesisAbortController = new AbortController();
      set({ isBatchSynthesizing: true });
      try {
        const blocksToRender = get().project.blocks.filter(
          (b) => b.ttsStatus !== 'ok'
        );
        for (const blk of blocksToRender) {
          if (audioRuntimeControllers.batchSynthesisAbortController?.signal.aborted) {
            break;
          }
          await get().synthesizeBlock(blk.id);
        }
      } finally {
        set({ isBatchSynthesizing: false });
        audioRuntimeControllers.batchSynthesisAbortController = null;
      }
    },

    regenerateAllBlocksAudio: async () => {
      if (get().isBatchSynthesizing) return;
      audioRuntimeControllers.batchSynthesisAbortController = new AbortController();
      set({ isBatchSynthesizing: true });
      try {
        const allBlocks = [...get().project.blocks];
        for (const blk of allBlocks) {
          if (audioRuntimeControllers.batchSynthesisAbortController?.signal.aborted) {
            break;
          }
          await get().synthesizeBlock(blk.id, { forceRegenerate: true });
        }
      } finally {
        set({ isBatchSynthesizing: false });
        audioRuntimeControllers.batchSynthesisAbortController = null;
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
      audioRuntimeControllers.batchSynthesisAbortController = new AbortController();
      set({ isBatchSynthesizing: true });
      try {
        const speakerBlocks = get().project.blocks.filter(
          (b) => b.speakerId === speakerId
        );
        for (const blk of speakerBlocks) {
          if (audioRuntimeControllers.batchSynthesisAbortController?.signal.aborted) {
            break;
          }
          await get().synthesizeBlock(blk.id, { forceRegenerate: true });
        }
      } finally {
        set({ isBatchSynthesizing: false });
        audioRuntimeControllers.batchSynthesisAbortController = null;
      }
    },

    abortBatchSynthesis: () => {
      if (audioRuntimeControllers.batchSynthesisAbortController) {
        audioRuntimeControllers.batchSynthesisAbortController.abort();
        audioRuntimeControllers.batchSynthesisAbortController = null;
      }
      for (const ctrl of audioRuntimeControllers.activeBlockSynthesisAbortControllers.values()) {
        ctrl.abort();
      }
      audioRuntimeControllers.activeBlockSynthesisAbortControllers.clear();

      set({
        isBatchSynthesizing: false,
        project: {
          ...get().project,
          blocks: get().project.blocks.map((b) =>
            b.ttsStatus === 'rendering'
              ? {
                  ...b,
                  ttsStatus: b.generatedAudioUrl ? ('ok' as const) : ('stale' as const),
                }
              : b
          ),
        },
      });
    },

    abortBlockSynthesis: (blockId: string) => {
      const ctrl =
        audioRuntimeControllers.activeBlockSynthesisAbortControllers.get(blockId);
      if (ctrl) {
        ctrl.abort();
        audioRuntimeControllers.activeBlockSynthesisAbortControllers.delete(
          blockId
        );
      }
      set({
        project: {
          ...get().project,
          blocks: get().project.blocks.map((b) =>
            b.id === blockId && b.ttsStatus === 'rendering'
              ? {
                  ...b,
                  ttsStatus: b.generatedAudioUrl ? ('ok' as const) : ('stale' as const),
                }
              : b
          ),
        },
      });
    },

    abortAllSynthesis: () => {
      get().abortBatchSynthesis();
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
          const res = await evaluateBlockCacheStatus(
            b,
            spk,
            currentProject.defaultLanguage
          );
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
      set({
        project: nextProject,
        playingBlockId: null,
        previewingSpeakerId: null,
      });
    },
  };
}
