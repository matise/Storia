import {
  AudioEffectConfig,
  ScriptBlock,
  Speaker,
  TtsEngineProvider,
  createDefaultMainAuxBus,
} from '../../types/storia';
import { getApiKey, hasValidApiKey } from '../../core/storage/keyVault';
import { getLatestBlockAudioEntry } from '../../core/storage/audioCache';
import { synthesizeGeminiAudioWithPeaks } from '../../services/geminiTtsService';
import { synthesizeSfxAudio } from '../../services/sfxGeneratorService';
import {
  playAudioWithSpeakerDsp,
  speakWithBrowserTts,
  stopAllAudioPlayback,
} from '../../core/dsp/LiveAudioPreviewer';
import { studioTransportEngine } from '../../core/dsp/StudioTransportEngine';
import { persistProject } from '../projectPersistence';
import {
  StoriaStoreState,
  StoreSliceContext,
  audioRuntimeControllers,
} from '../storeTypes';

export type DspAndAuditionSlice = Pick<
  StoriaStoreState,
  | 'toggleSpeakerEq'
  | 'toggleSpeakerDynamics'
  | 'toggleAuxBusModule'
  | 'setAuxBusReturnGainDb'
  | 'updateAuxBusModuleConfig'
  | 'addAuxBusModule'
  | 'removeAuxBusModule'
  | 'stopAudioPreview'
  | 'previewSpeakerVoice'
  | 'auditionBlock'
>;

export function createDspAndAuditionSlice({
  set,
  get,
}: StoreSliceContext): DspAndAuditionSlice {
  return {
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

      // Realtime Aux Bus module sync (EQ:ON in toolbar)
      studioTransportEngine.toggleAuxModule(
        'aux_bus_main',
        'fx_main_eq',
        nextEnabled
      );
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== 'aux_bus_main') return bus;
        return {
          ...bus,
          modules: bus.modules.map((m) =>
            m.id === 'fx_main_eq' ? { ...m, enabled: nextEnabled } : m
          ),
        };
      });
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
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

      // Realtime Aux Bus module sync (Dyn:ON in toolbar)
      studioTransportEngine.toggleAuxModule(
        'aux_bus_main',
        'fx_main_dyn',
        nextEnabled
      );
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== 'aux_bus_main') return bus;
        return {
          ...bus,
          modules: bus.modules.map((m) =>
            m.id === 'fx_main_dyn' ? { ...m, enabled: nextEnabled } : m
          ),
        };
      });
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    toggleAuxBusModule: (busId: string, moduleId: string) => {
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      let nextState = false;
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== busId) return bus;
        return {
          ...bus,
          modules: bus.modules.map((m) => {
            if (m.id !== moduleId) return m;
            nextState = !m.enabled;
            return { ...m, enabled: nextState };
          }),
        };
      });
      studioTransportEngine.toggleAuxModule(busId, moduleId, nextState);
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    setAuxBusReturnGainDb: (busId: string, returnGainDb: number) => {
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) =>
        bus.id === busId ? { ...bus, returnGainDb } : bus
      );
      studioTransportEngine.updateAuxBusConfig(busId, { returnGainDb });
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    updateAuxBusModuleConfig: (
      busId: string,
      moduleId: string,
      config: AudioEffectConfig
    ) => {
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== busId) return bus;
        return {
          ...bus,
          modules: bus.modules.map((m) => (m.id === moduleId ? config : m)),
        };
      });
      studioTransportEngine.updateAuxModuleConfig(busId, moduleId, config);
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    addAuxBusModule: (busId: string, module: AudioEffectConfig) => {
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== busId) return bus;
        return {
          ...bus,
          modules: [...bus.modules, module],
        };
      });
      const engineBus = studioTransportEngine.getAuxBus(busId);
      if (engineBus) {
        engineBus.addModule(module);
      }
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    removeAuxBusModule: (busId: string, moduleId: string) => {
      const currentBusses = get().project.auxBusses ?? [
        createDefaultMainAuxBus(),
      ];
      const updatedBusses = currentBusses.map((bus) => {
        if (bus.id !== busId) return bus;
        return {
          ...bus,
          modules: bus.modules.filter((m) => m.id !== moduleId),
        };
      });
      const engineBus = studioTransportEngine.getAuxBus(busId);
      if (engineBus) {
        engineBus.removeModule(moduleId);
      }
      const nextProj = { ...get().project, auxBusses: updatedBusses };
      persistProject(nextProj, get().projects);
      set({ project: nextProj });
    },

    stopAudioPreview: () => {
      audioRuntimeControllers.auditionSessionToken++;
      if (audioRuntimeControllers.speakerPreviewAbortController) {
        audioRuntimeControllers.speakerPreviewAbortController.abort();
        audioRuntimeControllers.speakerPreviewAbortController = null;
      }
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

      if (audioRuntimeControllers.speakerPreviewAbortController) {
        audioRuntimeControllers.speakerPreviewAbortController.abort();
      }
      const myAbortController = new AbortController();
      audioRuntimeControllers.speakerPreviewAbortController = myAbortController;

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
            abortSignal: myAbortController.signal,
          });

          if (myAbortController.signal.aborted) return;

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
          if (
            myAbortController.signal.aborted ||
            (err as Error)?.name === 'AbortError'
          ) {
            return;
          }
          const msg =
            err instanceof Error ? err.message : 'Gemini TTS preview failed';
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

      // Claim a fresh audition session; any older in-flight audition becomes stale.
      const myToken = ++audioRuntimeControllers.auditionSessionToken;
      const isStale = () =>
        myToken !== audioRuntimeControllers.auditionSessionToken ||
        get().playingBlockId !== block.id;

      // Single-block audition and episode "Play All" are mutually exclusive:
      // stop the master transport atomically with claiming the audition.
      stopAllAudioPlayback();
      set({
        playingBlockId: block.id,
        previewingSpeakerId: null,
        isMasterPlaying: false,
      });

      const handleDone = () => {
        if (
          myToken === audioRuntimeControllers.auditionSessionToken &&
          get().playingBlockId === block.id
        ) {
          if (get().isAutoAdvanceEnabled) {
            const currentBlocks = get().project.blocks;
            const curIdx = currentBlocks.findIndex((b) => b.id === block.id);
            if (curIdx >= 0 && curIdx < currentBlocks.length - 1) {
              const nextBlock = currentBlocks[curIdx + 1];
              const nextIsCollapsed = Boolean(nextBlock.isCollapsed);
              if (nextIsCollapsed) {
                get().updateBlock(block.id, { isCollapsed: true });
              }
              get().updateBlock(nextBlock.id, { isCollapsed: false });
              get().selectBlock(nextBlock.id);
              if (typeof document !== 'undefined') {
                const el = document.getElementById(
                  `script-block-card-${nextBlock.id}`
                );
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
              set({ playingBlockId: null });
              void get().auditionBlock(nextBlock.id, 0);
              return;
            }
          }
          set({ playingBlockId: null });
        }
      };
      const clearIfCurrent = () => {
        if (!isStale()) set({ playingBlockId: null });
      };
      const speakFallback = () => {
        if (isStale()) return;
        const started = speakWithBrowserTts({
          text: block.text,
          speaker,
          language: project.defaultLanguage,
          startOffsetSec,
          onEnded: handleDone,
        });
        if (!started) clearIfCurrent();
      };

      // SFX blocks always play their rendered or synthesized WAV audio (never speech synthesis)
      if (block.type === 'sound_effect') {
        let sfxBlob: Blob | undefined;
        const cached = await getLatestBlockAudioEntry(block.id, block.cacheKey);
        if (isStale()) return;
        if (cached?.audioBlob) {
          sfxBlob = cached.audioBlob;
        } else if (!block.generatedAudioUrl) {
          const synth = await synthesizeSfxAudio({
            block,
            language: project.defaultLanguage,
            useAiCompiler: false,
          });
          if (isStale()) return;
          sfxBlob = synth.audioBlob;
        }

        const played = await playAudioWithSpeakerDsp({
          audioUrl: block.generatedAudioUrl,
          audioBlob: sfxBlob,
          speaker,
          blockId: block.id,
          volumeGainDb: block.volumeGainDb,
          auxSendDb: block.auxSendDb,
          auxSendBusId: block.auxSendBusId,
          directMute: block.directMute,
          fadeInMs: block.fadeInMs,
          fadeOutMs: block.fadeOutMs,
          fadeInCurve: block.fadeInCurve,
          fadeOutCurve: block.fadeOutCurve,
          startOffsetSec,
          onEnded: handleDone,
          isCancelled: isStale,
        });
        if (!played) clearIfCurrent();
        return;
      }

      if (
        block.renderedWithProvider === 'browser_tts' ||
        (!block.generatedAudioUrl && get().ttsProvider === 'browser_tts')
      ) {
        speakFallback();
        return;
      }

      const cachedEntry = await getLatestBlockAudioEntry(
        block.id,
        block.cacheKey
      );
      if (isStale()) return;

      if (cachedEntry?.audioBlob || block.generatedAudioUrl) {
        const played = await playAudioWithSpeakerDsp({
          audioUrl: block.generatedAudioUrl,
          audioBlob: cachedEntry?.audioBlob,
          speaker,
          blockId: block.id,
          volumeGainDb: block.volumeGainDb,
          auxSendDb: block.auxSendDb,
          auxSendBusId: block.auxSendBusId,
          directMute: block.directMute,
          fadeInMs: block.fadeInMs,
          fadeOutMs: block.fadeOutMs,
          fadeInCurve: block.fadeInCurve,
          fadeOutCurve: block.fadeOutCurve,
          startOffsetSec,
          onEnded: handleDone,
          isCancelled: isStale,
        });
        if (!played) speakFallback();
      } else {
        // Unrendered dialogue/narration block: audition immediately via Browser TTS
        speakFallback();
      }
    },
  };
}

