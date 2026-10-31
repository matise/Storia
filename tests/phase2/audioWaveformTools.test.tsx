import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptWorkbench } from '../../src/components/layout/ScriptWorkbench';

describe('Audio & Waveform Deletion, Regeneration, and Rebuild Tools', () => {
  beforeEach(async () => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.getState().setActiveTtsProvider('browser_tts');
    await useStoriaStore.getState().purgeAudioCache();
  });

  it('synthesizes block audio, rebuilds its SoA Float32Array waveform, forces regeneration, and deletes audio cleanly', async () => {
    const store = useStoriaStore.getState();
    const targetBlock = store.project.blocks.find((b) => b.type === 'dialogue')!;
    expect(targetBlock).toBeDefined();

    // 1. Initial synthesize
    await useStoriaStore.getState().synthesizeBlock(targetBlock.id);
    let updatedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === targetBlock.id)!;

    expect(updatedBlock.ttsStatus).toBe('ok');
    expect(updatedBlock.waveformPeaks).toBeDefined();
    expect(updatedBlock.waveformPeaks?.minPeaks).toBeInstanceOf(Float32Array);
    expect(updatedBlock.waveformPeaks?.maxPeaks).toBeInstanceOf(Float32Array);
    expect(updatedBlock.waveformPeaks?.rmsLevels).toBeInstanceOf(Float32Array);
    expect(updatedBlock.waveformPeaks!.minPeaks.length).toBeGreaterThan(0);

    // 2. Simulate missing/cleared waveformPeaks and test rebuildBlockWaveform
    await useStoriaStore.getState().rebuildBlockWaveform(targetBlock.id);
    updatedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === targetBlock.id)!;
    expect(updatedBlock.waveformPeaks).toBeDefined();
    expect(updatedBlock.waveformPeaks!.minPeaks.length).toBeGreaterThan(0);

    // 3. Force regenerate block audio
    await useStoriaStore.getState().regenerateBlockAudio(targetBlock.id);
    updatedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === targetBlock.id)!;
    expect(updatedBlock.ttsStatus).toBe('ok');
    expect(updatedBlock.waveformPeaks).toBeDefined();

    // 4. Delete block audio and verify clean reset to unrendered
    await useStoriaStore.getState().deleteBlockAudio(targetBlock.id);
    updatedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === targetBlock.id)!;
    expect(updatedBlock.ttsStatus).toBe('unrendered');
    expect(updatedBlock.waveformPeaks).toBeUndefined();
    expect(updatedBlock.generatedAudioUrl).toBeUndefined();
    expect(updatedBlock.cacheKey).toBeUndefined();
  });

  it('regenerates and deletes audio for all blocks belonging to a specific speaker', async () => {
    const store = useStoriaStore.getState();
    const targetSpeaker = store.project.speakers[0];
    expect(targetSpeaker).toBeDefined();

    // Regenerate all blocks for speaker[0]
    await useStoriaStore.getState().regenerateSpeakerAudio(targetSpeaker.id);

    let speakerBlocks = useStoriaStore
      .getState()
      .project.blocks.filter((b) => b.speakerId === targetSpeaker.id);
    expect(speakerBlocks.length).toBeGreaterThan(0);
    for (const block of speakerBlocks) {
      expect(block.ttsStatus).toBe('ok');
      expect(block.waveformPeaks).toBeDefined();
    }

    // Delete all audio for speaker[0]
    await useStoriaStore.getState().deleteSpeakerAudio(targetSpeaker.id);
    speakerBlocks = useStoriaStore
      .getState()
      .project.blocks.filter((b) => b.speakerId === targetSpeaker.id);
    for (const block of speakerBlocks) {
      expect(block.ttsStatus).toBe('unrendered');
      expect(block.waveformPeaks).toBeUndefined();
    }
  });

  it('renders per-block and episode-wide regeneration, waveform rebuild, and audio deletion buttons in ScriptWorkbench', async () => {
    const firstSpokenBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.type === 'narration' || b.type === 'dialogue')!;

    await useStoriaStore.getState().synthesizeBlock(firstSpokenBlock.id);

    render(<ScriptWorkbench />);

    // Episode-level batch buttons
    expect(screen.getByTestId('regen-all-audio-btn')).toBeTruthy();
    expect(screen.getByTestId('rebuild-all-waveforms-btn')).toBeTruthy();
    expect(screen.getByTestId('clear-all-audio-btn')).toBeTruthy();

    // Per-block tools on the synthesized block
    const regenBlockBtn = screen.getByTestId(`regen-block-audio-${firstSpokenBlock.id}`);
    const rebuildWaveformBtn = screen.getByTestId(`rebuild-block-waveform-${firstSpokenBlock.id}`);
    const deleteBlockAudioBtn = screen.getByTestId(`delete-block-audio-${firstSpokenBlock.id}`);

    expect(regenBlockBtn).toBeTruthy();
    expect(rebuildWaveformBtn).toBeTruthy();
    expect(deleteBlockAudioBtn).toBeTruthy();

    // Click per-block delete button and verify waveform & audio are removed
    fireEvent.click(deleteBlockAudioBtn);

    await waitFor(() => {
      const updated = useStoriaStore
        .getState()
        .project.blocks.find((b) => b.id === firstSpokenBlock.id)!;
      expect(updated.ttsStatus).toBe('unrendered');
      expect(updated.waveformPeaks).toBeUndefined();
    });
  });
});
