import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptWorkbench } from '../../src/components/layout/ScriptWorkbench';
import { ScriptBlockCard } from '../../src/components/workbench/ScriptBlockCard';
import { EpisodeWaveformTransport } from '../../src/components/workbench/EpisodeWaveformTransport';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('Timeline Pause Drag, Segment Scroll Linkage, Reorganized Header & Block Collapsing', () => {
  beforeEach(() => {
    const sample = createSampleProject();
    useStoriaStore.setState({
      project: sample,
      selectedBlockId: sample.blocks[0].id,
      isMasterPlaying: false,
      playingBlockId: null,
    });
  });

  it('renders collapse toggle button and toggles collapsed state on ScriptBlockCard', () => {
    const sample = createSampleProject();
    const firstBlock = sample.blocks[0];

    render(
      <ScriptBlockCard
        block={firstBlock}
        index={0}
        totalBlocks={sample.blocks.length}
        speakers={sample.speakers}
        isSelected={true}
      />
    );

    // Initial state: expanded, textarea is visible
    expect(screen.getByDisplayValue(firstBlock.text)).toBeDefined();

    // Toggle collapse button
    const collapseBtn = screen.getByTestId(`toggle-collapse-block-${firstBlock.id}`);
    expect(collapseBtn).toBeDefined();

    fireEvent.click(collapseBtn);

    const updatedState = useStoriaStore.getState().project.blocks[0];
    expect(updatedState.isCollapsed).toBe(true);
  });

  it('renders collapsed compact view when isCollapsed is true', () => {
    const sample = createSampleProject();
    const collapsedBlock = { ...sample.blocks[0], isCollapsed: true };

    const { container } = render(
      <ScriptBlockCard
        block={collapsedBlock}
        index={0}
        totalBlocks={sample.blocks.length}
        speakers={sample.speakers}
        isSelected={false}
      />
    );

    // Expanded textarea should not be rendered
    expect(container.querySelector('textarea')).toBeNull();
    // Compact summary should be visible
    expect(screen.getByText(collapsedBlock.text)).toBeDefined();
  });

  it('keeps audio tools, order arrows, and delete buttons together in the top bar of ScriptBlockCard', () => {
    const sample = createSampleProject();
    const secondBlock = sample.blocks[1]; // Index 1 so both Move Up and Move Down are enabled

    render(
      <ScriptBlockCard
        block={secondBlock}
        index={1}
        totalBlocks={sample.blocks.length}
        speakers={sample.speakers}
        isSelected={true}
      />
    );

    // Tools in top bar
    expect(screen.getByTestId(`regen-block-audio-${secondBlock.id}`)).toBeDefined();
    expect(screen.getByTestId(`rebuild-block-waveform-${secondBlock.id}`)).toBeDefined();
    expect(screen.getByTestId(`delete-block-audio-${secondBlock.id}`)).toBeDefined();

    // Reorder buttons
    expect(screen.getByTitle(/Alt\+Up|Pomakni gore|Move Up/i)).toBeDefined();
    expect(screen.getByTitle(/Alt\+Down|Pomakni dolje|Move Down/i)).toBeDefined();
    expect(screen.getByTitle(/Delete block|Obriši blok/i)).toBeDefined();
  });

  it('renders clean director notes input without square brackets in UI', () => {
    const sample = createSampleProject();
    const firstBlock = sample.blocks[0];

    render(
      <ScriptBlockCard
        block={firstBlock}
        index={0}
        totalBlocks={sample.blocks.length}
        speakers={sample.speakers}
        isSelected={true}
      />
    );

    const notesInput = screen.getByDisplayValue(firstBlock.directorNotes || '');
    expect(notesInput).toBeDefined();
    // Ensure there are no literal '[' or ']' span wrappers around it
    expect(screen.queryByText('[')).toBeNull();
    expect(screen.queryByText(']')).toBeNull();
  });

  it('supports pause dragging on EpisodeWaveformTransport to adjust pauseAfterMs', () => {
    const sample = createSampleProject();
    const onUpdatePauseAfterMs = vi.fn();
    const onSelectBlockId = vi.fn();
    const totalDur = sample.blocks.reduce((acc, b) => acc + (b.estimatedDurationSec ?? 0), 0);

    // Ensure PointerEvent is available in JSDOM environment so clientX is preserved
    if (typeof window.PointerEvent === 'undefined') {
      window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }

    // Mock getBoundingClientRect on prototype before render
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 46,
      right: 600,
      bottom: 46,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    render(
      <EpisodeWaveformTransport
        blocks={sample.blocks}
        speakers={sample.speakers}
        playheadSec={0}
        totalDurationSec={totalDur}
        activeBlockIndex={0}
        isPlaying={false}
        isLooping={false}
        playbackSpeed={1.0}
        onTogglePlay={() => {}}
        onStop={() => {}}
        onToggleLoop={() => {}}
        onSeekTimeSec={() => {}}
        onJumpBlockIndex={() => {}}
        onChangeSpeed={() => {}}
        onUpdatePauseAfterMs={onUpdatePauseAfterMs}
        onSelectBlockId={onSelectBlockId}
      />
    );

    const canvas = screen.getByTestId('master-episode-waveform-canvas');

    // Pointer down near block 0 pause boundary
    const b0 = sample.blocks[0];
    const b0Start = b0.startTimeSec ?? 0;
    const b0Dur = b0.estimatedDurationSec ?? 0;
    const b0EndX = Math.round(((b0Start + b0Dur) / totalDur) * 600);

    // Click exactly on the pause boundary
    fireEvent.pointerDown(canvas, { clientX: b0EndX });
    expect(onSelectBlockId).toHaveBeenCalledWith(b0.id);

    // Pointer move to drag pause to the right (+30px)
    fireEvent.pointerMove(canvas, { clientX: b0EndX + 30 });
    expect(onUpdatePauseAfterMs).toHaveBeenCalled();

    // Pointer up completes the drag
    fireEvent.pointerUp(canvas);
  });

  it('links timeline selection to segment selection in ScriptWorkbench', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<ScriptWorkbench />);

    const sample = useStoriaStore.getState().project;
    const secondBlock = sample.blocks[1];

    // Click marker for second block on timeline
    const marker = screen.getByTestId(`timeline-block-marker-${secondBlock.id}`);
    fireEvent.click(marker);

    expect(useStoriaStore.getState().selectedBlockId).toBe(secondBlock.id);
  });
});
