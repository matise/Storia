import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpisodeWaveformTransport } from '../../src/components/workbench/EpisodeWaveformTransport';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptBlock, Speaker } from '../../src/types/storia';
import * as previewer from '../../src/core/dsp/LiveAudioPreviewer';

describe('Phase 3 — Auto Advance Functionality Toggle & Block Sequence Playback', () => {
  const dummySpeaker: Speaker = {
    id: 'spk-1',
    name: 'Mara',
    color: '#f97316',
    voice: {
      baseVoice: 'Zephyr',
      stylePrompt: 'Energetic',
      speakingRate: 1.0,
      pitchAdjustment: 0,
      enableDirectorNotes: true,
      ssmlEnabled: false,
      acoustics: {
        biquadEq: { enabled: true, lowShelfGainDb: 0, midPeakGainDb: 0, highShelfGainDb: 0 },
        compression: { enabled: true, thresholdDb: -18, ratio: 3.5, attackMs: 15, releaseMs: 120 },
      },
    },
    gender: 'female',
    age: 'young_adult',
    personaPrompt: 'Energetic dancer',
    actingNotes: 'Fast cadence',
    createdAt: Date.now(),
  };

  const blocks: ScriptBlock[] = [
    {
      id: 'blk-1',
      order: 0,
      type: 'dialogue',
      speakerId: 'spk-1',
      text: 'First line',
      ttsStatus: 'ok',
      generatedAudioUrl: 'blob:mock-1',
      estimatedDurationSec: 4.0,
      startTimeSec: 0,
      endTimeSec: 4.0,
      isCollapsed: false,
    },
    {
      id: 'blk-2',
      order: 1,
      type: 'dialogue',
      speakerId: 'spk-1',
      text: 'Second line',
      ttsStatus: 'ok',
      generatedAudioUrl: 'blob:mock-2',
      estimatedDurationSec: 5.0,
      startTimeSec: 4.0,
      endTimeSec: 9.0,
      isCollapsed: true,
    },
    {
      id: 'blk-3',
      order: 2,
      type: 'dialogue',
      speakerId: 'spk-1',
      text: 'Final line',
      ttsStatus: 'ok',
      generatedAudioUrl: 'blob:mock-3',
      estimatedDurationSec: 6.0,
      startTimeSec: 9.0,
      endTimeSec: 15.0,
      isCollapsed: true,
    },
  ];

  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.setState((s) => ({
      project: {
        ...s.project,
        speakers: [dummySpeaker],
        blocks: [...blocks],
      },
      isAutoAdvanceEnabled: true,
      playingBlockId: null,
    }));
  });

  it('renders the Auto Advance toggle button next to the Loop button in EpisodeWaveformTransport', () => {
    const handleToggleAutoAdvance = vi.fn();
    render(
      <EpisodeWaveformTransport
        blocks={blocks}
        speakers={[dummySpeaker]}
        playheadSec={0}
        totalDurationSec={15.0}
        activeBlockIndex={0}
        isPlaying={false}
        isLooping={false}
        isAutoAdvance={true}
        onToggleAutoAdvance={handleToggleAutoAdvance}
        playbackSpeed={1.0}
        onTogglePlay={vi.fn()}
        onStop={vi.fn()}
        onToggleLoop={vi.fn()}
        onSeekTimeSec={vi.fn()}
        onJumpBlockIndex={vi.fn()}
        onChangeSpeed={vi.fn()}
      />
    );

    const autoBtn = screen.getByTestId('transport-auto-advance-btn');
    expect(autoBtn).toBeDefined();
    expect(autoBtn.textContent).toContain('Auto');

    fireEvent.click(autoBtn);
    expect(handleToggleAutoAdvance).toHaveBeenCalledTimes(1);
  });

  it('toggles isAutoAdvanceEnabled state in the store', () => {
    expect(useStoriaStore.getState().isAutoAdvanceEnabled).toBe(true);

    useStoriaStore.getState().toggleAutoAdvance();
    expect(useStoriaStore.getState().isAutoAdvanceEnabled).toBe(false);

    useStoriaStore.getState().toggleAutoAdvance();
    expect(useStoriaStore.getState().isAutoAdvanceEnabled).toBe(true);

    useStoriaStore.getState().setAutoAdvance(false);
    expect(useStoriaStore.getState().isAutoAdvanceEnabled).toBe(false);
  });

  it('automatically opens next block and continues playback when a block completes with Auto Advance enabled', async () => {
    // Intercept playAudioWithSpeakerDsp to trigger onEnded callback immediately
    const playedBlockIds: string[] = [];
    vi.spyOn(previewer, 'playAudioWithSpeakerDsp').mockImplementation(async (params) => {
      if (params.blockId) playedBlockIds.push(params.blockId);
      params.onEnded?.();
      return true;
    });

    // Verify blk-2 is initially collapsed
    expect(useStoriaStore.getState().project.blocks[1].isCollapsed).toBe(true);

    // Audition blk-1
    await useStoriaStore.getState().auditionBlock('blk-1', 0);

    // With Auto Advance enabled, playing blk-1 triggers onEnded, which:
    // 1. Advances playback from blk-1 to blk-2, and then from blk-2 to blk-3 until the final clip
    expect(playedBlockIds).toEqual(['blk-1', 'blk-2', 'blk-3']);

    // 2. Final clip (blk-3) was opened during auto-advance
    expect(useStoriaStore.getState().project.blocks[2].isCollapsed).toBe(false);

    // 3. Selects blk-3
    expect(useStoriaStore.getState().selectedBlockId).toBe('blk-3');

    // When the final clip (blk-3) finishes, playback stops gracefully
    expect(useStoriaStore.getState().playingBlockId).toBeNull();
  });

  it('does NOT advance to next block when Auto Advance is disabled', async () => {
    const playedBlockIds: string[] = [];
    vi.spyOn(previewer, 'playAudioWithSpeakerDsp').mockImplementation(async (params) => {
      if (params.blockId) playedBlockIds.push(params.blockId);
      params.onEnded?.();
      return true;
    });

    useStoriaStore.setState({ isAutoAdvanceEnabled: false });

    // Audition blk-1
    await useStoriaStore.getState().auditionBlock('blk-1', 0);

    // Only blk-1 played; did not advance to blk-2
    expect(playedBlockIds).toEqual(['blk-1']);
    // blk-2 remains collapsed
    expect(useStoriaStore.getState().project.blocks[1].isCollapsed).toBe(true);
    expect(useStoriaStore.getState().playingBlockId).toBeNull();
  });
});
