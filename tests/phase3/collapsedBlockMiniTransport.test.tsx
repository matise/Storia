import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScriptBlockCard } from '../../src/components/workbench/ScriptBlockCard';
import { ScriptBlock, Speaker } from '../../src/types/storia';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 3 — Collapsed Script Block Mini Transport Controls', () => {
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

  const sampleBlock: ScriptBlock = {
    id: 'blk-collapsed-1',
    order: 0,
    type: 'dialogue',
    speakerId: 'spk-1',
    text: 'Foxy! Daj nam sto masno!',
    directorNotes: 's plesnog podija',
    ttsStatus: 'ok',
    estimatedDurationSec: 14.9,
    startTimeSec: 0,
    endTimeSec: 14.9,
    isCollapsed: true,
  };

  it('renders mini transport controls (play, restart, scrubber) instead of TTS: OK when collapsed', () => {
    render(
      <ScriptBlockCard
        block={sampleBlock}
        index={0}
        totalBlocks={3}
        speakers={[dummySpeaker]}
        isSelected={false}
      />
    );

    // TTS: OK badge should NOT be present in collapsed strip
    expect(screen.queryByText('TTS: OK')).toBeNull();

    // Mini transport controls should be rendered
    expect(screen.getByTestId('collapsed-transport-blk-collapsed-1')).toBeDefined();
    expect(screen.getByTestId('collapsed-play-btn-blk-collapsed-1')).toBeDefined();
    expect(screen.getByTestId('collapsed-restart-btn-blk-collapsed-1')).toBeDefined();
    expect(screen.getByTestId('collapsed-scrubber-blk-collapsed-1')).toBeDefined();
  });

  it('triggers audition when clicking the collapsed play button', () => {
    const auditionSpy = vi.fn();
    useStoriaStore.setState({ auditionBlock: auditionSpy } as any);

    render(
      <ScriptBlockCard
        block={sampleBlock}
        index={0}
        totalBlocks={3}
        speakers={[dummySpeaker]}
        isSelected={false}
      />
    );

    const playBtn = screen.getByTestId('collapsed-play-btn-blk-collapsed-1');
    fireEvent.click(playBtn);

    expect(auditionSpy).toHaveBeenCalledWith('blk-collapsed-1', 0);
  });

  it('renders pause button when block is actively playing', () => {
    render(
      <ScriptBlockCard
        block={sampleBlock}
        index={0}
        totalBlocks={3}
        speakers={[dummySpeaker]}
        isSelected={true}
        isActivePlayheadBlock={true}
        blockPlayheadProgress={0.4}
      />
    );

    const playBtn = screen.getByTestId('collapsed-play-btn-blk-collapsed-1');
    expect(playBtn.className).toContain('bg-emerald-600');
  });

  it('seeks when clicking restart and scrubber bar', () => {
    const handleSeek = vi.fn();

    render(
      <ScriptBlockCard
        block={sampleBlock}
        index={0}
        totalBlocks={3}
        speakers={[dummySpeaker]}
        isSelected={false}
        onSeekWithinBlock={handleSeek}
      />
    );

    // Restart button
    const restartBtn = screen.getByTestId('collapsed-restart-btn-blk-collapsed-1');
    fireEvent.click(restartBtn);
    expect(handleSeek).toHaveBeenCalledWith(expect.objectContaining({ id: 'blk-collapsed-1' }), 0);

    // Scrubber click
    const scrubber = screen.getByTestId('collapsed-scrubber-blk-collapsed-1');
    // Mock getBoundingClientRect
    vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 100,
      top: 0,
      bottom: 10,
      right: 200,
      height: 10,
      x: 100,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.click(scrubber, { clientX: 150 }); // 50%
    expect(handleSeek).toHaveBeenCalledWith(expect.objectContaining({ id: 'blk-collapsed-1' }), 0.5);
  });

  it('renders dialect and diacritics buttons in top bar for dialogue and omits them for SFX', () => {
    const sfxBlock: ScriptBlock = {
      id: 'blk-sfx-1',
      order: 1,
      type: 'sound_effect',
      text: 'Heavy rain against window',
      sfxCategory: 'weather_rain',
      sfxDurationSec: 4.0,
      ttsStatus: 'unrendered',
      isCollapsed: false,
    };

    const dialogueBlock: ScriptBlock = {
      ...sampleBlock,
      id: 'blk-dialogue-1',
      isCollapsed: false,
    };

    const { rerender } = render(
      <ScriptBlockCard
        block={dialogueBlock}
        index={0}
        totalBlocks={2}
        speakers={[dummySpeaker]}
        isSelected={false}
      />
    );

    // Dialogue block has both tools in top bar
    expect(screen.getByTestId('transform-dubrovnik-dialect-blk-dialogue-1')).toBeDefined();
    expect(screen.getByTestId('restore-croatian-diacritics-blk-dialogue-1')).toBeDefined();

    // Now render SFX block
    rerender(
      <ScriptBlockCard
        block={sfxBlock}
        index={1}
        totalBlocks={2}
        speakers={[dummySpeaker]}
        isSelected={false}
      />
    );

    // SFX block does NOT have Croatian dialect / diacritics conversion buttons
    expect(screen.queryByTestId('transform-dubrovnik-dialect-blk-sfx-1')).toBeNull();
    expect(screen.queryByTestId('restore-croatian-diacritics-blk-sfx-1')).toBeNull();
    // But does have SFX category select and duration input
    expect(screen.getByTestId('sfx-category-select-blk-sfx-1')).toBeDefined();
    expect(screen.getByTestId('sfx-duration-input-blk-sfx-1')).toBeDefined();
  });

  it('collapses and expands all blocks globally via store action', () => {
    useStoriaStore.getState().resetToSampleProject();
    const store = useStoriaStore.getState();
    expect(store.project.blocks.length).toBeGreaterThan(0);

    // Collapse all
    store.setAllBlocksCollapsed(true);
    expect(useStoriaStore.getState().project.blocks.every((b) => b.isCollapsed)).toBe(true);

    // Expand all
    store.setAllBlocksCollapsed(false);
    expect(useStoriaStore.getState().project.blocks.every((b) => !b.isCollapsed)).toBe(true);
  });
});
