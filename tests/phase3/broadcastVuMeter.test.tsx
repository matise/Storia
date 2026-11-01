import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BroadcastVuMeter } from '../../src/components/workbench/BroadcastVuMeter';
import { LiveMeterSnapshot } from '../../src/core/dsp/StudioTransportEngine';

describe('Phase 3 — Hardware Stereo Broadcast VU Meter', () => {
  const idleSnapshot: LiveMeterSnapshot = {
    momentaryLufs: -70.0,
    integratedLufs: -18.0,
    truePeakDbfs: -18.0,
    rmsDbfs: -22.0,
    isBroadcastSafe: true,
    activeSpeakerId: null,
    activeBlockId: null,
  };

  const playingSnapshot: LiveMeterSnapshot = {
    momentaryLufs: -18.0,
    integratedLufs: -18.5,
    truePeakDbfs: -2.5,
    rmsDbfs: -19.0,
    isBroadcastSafe: true,
    activeSpeakerId: 'spk-1',
    activeBlockId: 'blk-1',
  };

  const clippedSnapshot: LiveMeterSnapshot = {
    momentaryLufs: -6.0,
    integratedLufs: -12.0,
    truePeakDbfs: 0.5,
    rmsDbfs: -8.0,
    isBroadcastSafe: false,
    activeSpeakerId: 'spk-1',
    activeBlockId: 'blk-1',
  };

  it('renders idle VU meter with -inf readout and 0% bar widths when not playing', () => {
    render(<BroadcastVuMeter meterSnapshot={idleSnapshot} isPlaying={false} />);

    expect(screen.getByTestId('broadcast-vu-meter')).toBeDefined();
    expect(screen.getByTestId('vu-meter-readout').textContent).toBe('-inf dB');

    const barL = screen.getByTestId('vu-meter-bar-l');
    const barR = screen.getByTestId('vu-meter-bar-r');
    expect(barL.style.width).toBe('0%');
    expect(barR.style.width).toBe('0%');

    const clipLed = screen.getByTestId('vu-clip-led');
    expect(clipLed.className).not.toContain('bg-rose-500');
  });

  it('renders active level bars and LUFS readout during playback', () => {
    render(<BroadcastVuMeter meterSnapshot={playingSnapshot} isPlaying={true} />);

    expect(screen.getByTestId('vu-meter-readout').textContent).toBe('-18.0 LUFS');

    const barL = screen.getByTestId('vu-meter-bar-l');
    const barR = screen.getByTestId('vu-meter-bar-r');

    // (-18 + 50) / 50 * 100 = 64%
    expect(barL.style.width).toBe('64%');
    expect(barR.style.width).not.toBe('0%');

    const clipLed = screen.getByTestId('vu-clip-led');
    expect(clipLed.className).not.toContain('bg-rose-500');
  });

  it('activates clipping warning LED when True Peak exceeds -1.0 dBFS', () => {
    render(<BroadcastVuMeter meterSnapshot={clippedSnapshot} isPlaying={true} />);

    const clipLed = screen.getByTestId('vu-clip-led');
    expect(clipLed.className).toContain('bg-rose-500');
    expect(screen.getByTestId('vu-meter-readout').className).toContain('text-rose-400');
  });
});

