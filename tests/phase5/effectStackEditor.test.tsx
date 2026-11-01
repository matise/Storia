import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EffectStackEditor } from '../../src/components/dsp/EffectStackEditor';
import { AudioEffectConfig } from '../../src/types/storia';

describe('Phase 2 — EffectStackEditor Component', () => {
  const initialModules: AudioEffectConfig[] = [
    {
      id: 'eq_1',
      name: 'Vocal EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfFreqHz: 120,
      lowShelfGainDb: 2.0,
      midPeakFreqHz: 2500,
      midPeakGainDb: -1.5,
      midPeakQ: 1.0,
      highShelfFreqHz: 8000,
      highShelfGainDb: 3.0,
    },
    {
      id: 'comp_1',
      name: 'Vocal Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -22,
      ratio: 3.5,
      attackMs: 10,
      releaseMs: 120,
      kneeDb: 0,
    },
  ];

  it('renders signal flow ribbon and module cards', () => {
    render(
      <EffectStackEditor
        modules={initialModules}
        onChangeModules={vi.fn()}
        title="Speaker Vocal DSP"
      />
    );

    expect(screen.getByText('Speaker Vocal DSP')).toBeDefined();
    expect(screen.getByText('2 modules in series')).toBeDefined();
    expect(screen.getAllByText('Vocal EQ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vocal Compressor').length).toBeGreaterThanOrEqual(1);
  });

  it('handles module bypass toggle', () => {
    const handleToggle = vi.fn();
    render(
      <EffectStackEditor
        modules={initialModules}
        onChangeModules={vi.fn()}
        onToggleModule={handleToggle}
      />
    );

    const bypassBtns = screen.getAllByText('ACTIVE');
    expect(bypassBtns.length).toBe(2);

    fireEvent.click(bypassBtns[0]);
    expect(handleToggle).toHaveBeenCalledWith('eq_1');
  });

  it('handles parameter updates via sliders', () => {
    const handleUpdate = vi.fn();
    render(
      <EffectStackEditor
        modules={initialModules}
        onChangeModules={vi.fn()}
        onUpdateModuleConfig={handleUpdate}
      />
    );

    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);

    // Adjust first slider
    fireEvent.change(sliders[0], { target: { value: '150' } });
    expect(handleUpdate).toHaveBeenCalledWith('eq_1', { lowShelfFreqHz: 150 });
  });

  it('allows adding and removing modules', () => {
    const handleChange = vi.fn();
    render(
      <EffectStackEditor
        modules={initialModules}
        onChangeModules={handleChange}
      />
    );

    // Add SVF Filter
    const addFilterBtn = screen.getByText('+ SVF Filter');
    fireEvent.click(addFilterBtn);
    expect(handleChange).toHaveBeenCalled();
    const updatedCall = handleChange.mock.calls[0][0];
    expect(updatedCall.length).toBe(3);
    expect(updatedCall[2].type).toBe('state_variable_filter');

    // Remove first module
    const removeBtns = screen.getAllByTitle('Remove module');
    fireEvent.click(removeBtns[0]);
    expect(handleChange).toHaveBeenCalledWith([initialModules[1]]);
  });
});
