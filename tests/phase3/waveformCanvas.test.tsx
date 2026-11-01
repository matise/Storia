import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  generateSyntheticPreviewPeaks,
  renderWaveformToCanvas,
  WaveformCanvas,
} from '../../src/components/workbench/WaveformCanvas';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 3 — DOD Canvas 2D SoA Waveform Renderer & Scrubber', () => {
  it('renders unplayed peaks, played progress highlight, and playhead cursor from Float32Array SoA buffers', () => {
    const peaks = generateSyntheticPreviewPeaks('blk_test_soa', 50);
    expect(peaks.minPeaks).toBeInstanceOf(Float32Array);
    expect(peaks.maxPeaks).toBeInstanceOf(Float32Array);
    expect(peaks.rmsLevels).toBeInstanceOf(Float32Array);
    expect(peaks.length).toBe(50);

    const clearRect = vi.fn();
    const fillRect = vi.fn();
    const mockCtx = {
      clearRect,
      fillRect,
      fillStyle: '',
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderWaveformToCanvas(mockCtx, peaks, 200, 30, 0.5, '#6366f1', true);

    expect(clearRect).toHaveBeenCalledWith(0, 0, 200, 30);
    // 50 single-pass waveform spikes + 2 playhead cursor rects = 52 fillRect calls
    expect(fillRect).toHaveBeenCalledTimes(52);
  });

  it('invokes onSeekProgress and onScrubStateChange during pointer scrubbing on WaveformCanvas', () => {
    const onSeekProgress = vi.fn();
    const onScrubStateChange = vi.fn();

    render(
      <WaveformCanvas
        fallbackSeed="blk_scrub_test"
        playheadProgress={0.25}
        accentColor="#ec4899"
        isRenderedAudio={true}
        onSeekProgress={onSeekProgress}
        onScrubStateChange={onScrubStateChange}
      />
    );

    const canvas = screen.getByLabelText('Waveform Scrubber');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 26,
      right: 200,
      bottom: 26,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Ensure PointerEvent is available in JSDOM environment so clientX is preserved
    if (typeof window.PointerEvent === 'undefined') {
      window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }

    fireEvent.pointerDown(canvas, { clientX: 100 });
    expect(onScrubStateChange).toHaveBeenCalledWith(true);
    expect(onSeekProgress).toHaveBeenCalledWith(0.5);

    fireEvent.pointerMove(canvas, { clientX: 150 });
    expect(onSeekProgress).toHaveBeenCalledWith(0.75);

    fireEvent.pointerUp(canvas, { clientX: 150 });
    expect(onScrubStateChange).toHaveBeenCalledWith(false);
  });

  it('renders Master Episode Waveform Transport deck and per-block inline waveform transport controls', () => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.getState().switchProject('proj_magla_zagreb_ep1');
    render(<App />);

    // 1. Master Episode Waveform Transport Deck
    const deck = screen.getByTestId('episode-waveform-transport-deck');
    expect(deck).toBeDefined();

    const masterCanvas = screen.getByTestId('master-episode-waveform-canvas');
    expect(masterCanvas).toBeDefined();

    // Forward +5s transport button
    const forwardBtn = screen.getByTestId('transport-forward-btn');
    fireEvent.click(forwardBtn);

    const timecode = screen.getByTestId('transport-timecode-readout');
    expect(timecode.textContent).not.toContain('00:00.0 /');

    // Jump back to start (0:00.0)
    const jumpStartBtn = screen.getByTestId('transport-jump-start-btn');
    fireEvent.click(jumpStartBtn);
    expect(timecode.textContent).toContain('00:00.0 /');

    // Next Block transport button
    const nextBlockBtn = screen.getByTestId('transport-next-block-btn');
    fireEvent.click(nextBlockBtn);
    expect(useStoriaStore.getState().selectedBlockId).toBe('blk_2');

    // 2. Per-block inline waveform transport controls & current seconds readout
    const blk1WaveformPlay = screen.getByTestId('waveform-play-btn-blk_1');
    const blk1WaveformRestart = screen.getByTestId('waveform-restart-btn-blk_1');
    const blk1Timecode = screen.getByTestId('waveform-timecode-blk_1');
    const blk2Timecode = screen.getByTestId('waveform-timecode-blk_2');
    expect(blk1WaveformPlay).toBeDefined();
    expect(blk1WaveformRestart).toBeDefined();

    // Since we jumped to blk_2 above, blk_1 must show 00:00.0 (not stuck at max duration)
    expect(blk1Timecode.textContent).toContain('00:00.0 /');
    expect(blk2Timecode.textContent).toContain('00:00.0 /');

    // 3. Croatian Diacritics Auto-Restore button on ScriptBlockCard
    const restoreHrBtn = screen.getByTestId('restore-croatian-diacritics-blk_1');
    expect(restoreHrBtn).toBeDefined();
  });

  it('collapses and expands Master Episode Waveform Transport via panel collapse button and topbar toggle', () => {
    useStoriaStore.getState().resetToSampleProject();
    render(<App />);

    // Initially expanded
    expect(screen.getByTestId('episode-waveform-transport-deck')).toBeDefined();

    // Click integrated collapse button directly on transport panel
    const panelCollapseBtn = screen.getByTestId('transport-collapse-btn');
    fireEvent.click(panelCollapseBtn);

    // Deck is now collapsed / unmounted
    expect(screen.queryByTestId('episode-waveform-transport-deck')).toBeNull();

    // Click topbar toggle button to re-expand
    const topBarToggleBtn = screen.getByTestId('toggle-waveform-transport-btn');
    fireEvent.click(topBarToggleBtn);

    // Deck is expanded again
    expect(screen.getByTestId('episode-waveform-transport-deck')).toBeDefined();
  });
});
