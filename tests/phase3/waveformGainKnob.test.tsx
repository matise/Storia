import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VolumeGainKnob } from '../../src/components/workbench/VolumeGainKnob';
import { WaveformCanvas } from '../../src/components/workbench/WaveformCanvas';

describe('Volume Gain Knob & Waveform Rendering Enhancements', () => {
  it('renders VolumeGainKnob at 0dB unity gain and responds to drag and double-click reset', () => {
    const handleChange = vi.fn();
    render(
      <VolumeGainKnob
        valueDb={0}
        onChange={handleChange}
        size={30}
        testId="test-gain-knob"
      />
    );

    const knob = screen.getByTestId('test-gain-knob');
    expect(knob).toBeDefined();
    expect(knob.textContent).toContain('0.0');

    // Simulate vertical drag up (increase gain)
    fireEvent.pointerDown(knob, { clientY: 100 });
    fireEvent.pointerMove(knob, { clientY: 80 }); // moved 20px up
    expect(handleChange).toHaveBeenCalled();

    // Simulate double click to reset to 0dB unity gain
    fireEvent.doubleClick(knob);
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it('renders disabled grayish placeholder when isRenderedAudio is false and hides gain knob', () => {
    const { container } = render(
      <WaveformCanvas
        fallbackSeed="blk_unrendered"
        playheadProgress={0}
        accentColor="#6366f1"
        isRenderedAudio={false}
        blockId="blk_unrendered"
        showTransportControls={true}
        volumeGainDb={0}
        onChangeGainDb={vi.fn()}
      />
    );

    // Should render the unrendered badge / notice
    const badge = screen.getByTestId('waveform-unrendered-badge-blk_unrendered');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('No audio generated');

    // Gain knob should not be present when there is no rendered audio
    expect(screen.queryByTestId('gain-knob-blk_unrendered')).toBeNull();

    // Canvas should have disabled opacity styling
    const canvas = container.querySelector('canvas');
    expect(canvas?.className).toContain('opacity-60');
  });

  it('renders gain knob and active waveform when isRenderedAudio is true', () => {
    const handleChangeGain = vi.fn();
    const mockPeaks = {
      sampleRate: 100,
      length: 10,
      minPeaks: new Float32Array(10).fill(-0.5),
      maxPeaks: new Float32Array(10).fill(0.5),
      rmsLevels: new Float32Array(10).fill(0.3),
    };

    render(
      <WaveformCanvas
        peaks={mockPeaks}
        fallbackSeed="blk_rendered"
        playheadProgress={0.4}
        accentColor="#10b981"
        isRenderedAudio={true}
        blockId="blk_rendered"
        showTransportControls={true}
        volumeGainDb={3.5}
        onChangeGainDb={handleChangeGain}
      />
    );

    // Gain knob should be present for rendered audio
    const gainKnob = screen.getByTestId('gain-knob-blk_rendered');
    expect(gainKnob).toBeDefined();
    expect(gainKnob.textContent).toContain('+3.5');

    // Unrendered badge should NOT be shown
    expect(screen.queryByTestId('waveform-unrendered-badge-blk_rendered')).toBeNull();
  });
});

