import { describe, expect, it, beforeEach } from 'vitest';
import { synthesizeGeminiAudioWithPeaks } from '../../src/services/geminiTtsService';
import {
  runPersonaResearch,
  generateNextSceneBeats,
  doctorDialogueBlock,
  adaptBlockBilingually,
} from '../../src/services/geminiAgentService';
import { renderMasterEpisodeMix, renderSpeakerStems } from '../../src/services/masterExportService';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptBlock, Speaker } from '../../src/types/storia';

describe('Stop / Abort Backend Services & Synthesis Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    useStoriaStore.getState().resetToSampleProject();
  });

  it('aborts synthesizeGeminiAudioWithPeaks when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockBlock: ScriptBlock = {
      id: 'blk_test_abort',
      type: 'dialogue',
      text: 'Test line for abort functionality',
      order: 0,
    };

    await expect(
      synthesizeGeminiAudioWithPeaks({
        block: mockBlock,
        apiKey: 'test_dummy_key_12345678',
        language: 'hr',
        provider: 'gemini_tts',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();
  });

  it('aborts Gemini Agent services when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort();

    const speaker: Speaker = {
      id: 'spk_1',
      name: 'Maro',
      age: '40',
      gender: 'male',
      personaPrompt: 'Dubrovački kapetan',
      actingNotes: 'Smireno',
      color: '#6366f1',
      createdAt: Date.now(),
      voice: {
        baseVoice: 'Fenrir',
        stylePrompt: 'Odmjereno',
        speakingRate: 1.0,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: false,
        acoustics: {},
      },
    };

    const mockBlock: ScriptBlock = {
      id: 'blk_test',
      type: 'dialogue',
      speakerId: 'spk_1',
      text: 'Ovo je linija za analizu.',
      order: 0,
    };

    // 1. Persona Research abort
    await expect(
      runPersonaResearch({
        speaker,
        query: 'Test query',
        language: 'hr',
        apiKey: 'valid_api_key_long_enough',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();

    // 2. Co-Writer beats abort
    await expect(
      generateNextSceneBeats({
        precedingBlocks: [mockBlock],
        speakers: [speaker],
        language: 'hr',
        apiKey: 'valid_api_key_long_enough',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();

    // 3. Script doctor abort
    await expect(
      doctorDialogueBlock({
        block: mockBlock,
        speaker,
        language: 'hr',
        apiKey: 'valid_api_key_long_enough',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();

    // 4. Bilingual adapter abort
    await expect(
      adaptBlockBilingually({
        block: mockBlock,
        speaker,
        sourceLang: 'hr',
        targetLang: 'en',
        apiKey: 'valid_api_key_long_enough',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();
  });

  it('aborts renderMasterEpisodeMix and renderSpeakerStems when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort();

    const project = useStoriaStore.getState().project;

    await expect(
      renderMasterEpisodeMix(project, undefined, controller.signal)
    ).rejects.toThrow(/aborted/i);

    await expect(
      renderSpeakerStems(project, undefined, controller.signal)
    ).rejects.toThrow(/aborted/i);
  });

  it('aborts batch synthesis and single-block synthesis via store actions', () => {
    const store = useStoriaStore.getState();

    // Manually mark a block as rendering to simulate an active job
    const blockId = store.project.blocks[0].id;
    useStoriaStore.setState({
      isBatchSynthesizing: true,
      project: {
        ...store.project,
        blocks: store.project.blocks.map((b) =>
          b.id === blockId ? { ...b, ttsStatus: 'rendering' as const } : b
        ),
      },
    });

    expect(useStoriaStore.getState().isBatchSynthesizing).toBe(true);
    expect(useStoriaStore.getState().project.blocks[0].ttsStatus).toBe('rendering');

    // Trigger abortBatchSynthesis
    useStoriaStore.getState().abortBatchSynthesis();

    expect(useStoriaStore.getState().isBatchSynthesizing).toBe(false);
    expect(useStoriaStore.getState().project.blocks[0].ttsStatus).not.toBe('rendering');

    // Test abortBlockSynthesis
    useStoriaStore.setState({
      project: {
        ...store.project,
        blocks: store.project.blocks.map((b) =>
          b.id === blockId ? { ...b, ttsStatus: 'rendering' as const } : b
        ),
      },
    });
    expect(useStoriaStore.getState().project.blocks[0].ttsStatus).toBe('rendering');

    useStoriaStore.getState().abortBlockSynthesis(blockId);
    expect(useStoriaStore.getState().project.blocks[0].ttsStatus).not.toBe('rendering');
  });
});
