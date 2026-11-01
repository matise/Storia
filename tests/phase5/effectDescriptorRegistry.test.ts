import { describe, expect, it } from 'vitest';
import {
  EFFECT_DESCRIPTORS,
  getEffectDescriptor,
  createDefaultEffectConfig,
} from '../../src/core/dsp/modular/EffectDescriptorRegistry';

describe('Phase 1 — EffectDescriptorRegistry & Telemetry Protocol', () => {
  it('registers all 5 effect types with valid categories, colors, and parameters', () => {
    const types = [
      'biquad_eq',
      'dynamics_compressor',
      'state_variable_filter',
      'gain_trim',
      'passthrough',
    ] as const;

    for (const t of types) {
      const desc = getEffectDescriptor(t);
      expect(desc).toBeDefined();
      expect(desc?.type).toBe(t);
      expect(desc?.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(desc?.iconName).toBeTruthy();
    }
  });

  it('declares 3-band EQ parameters with logarithmic and decibel scaling', () => {
    const eqDesc = EFFECT_DESCRIPTORS.biquad_eq;
    expect(eqDesc.params.length).toBe(7);

    const lowGain = eqDesc.params.find((p) => p.id === 'lowShelfGainDb');
    expect(lowGain).toBeDefined();
    expect(lowGain?.widget).toBe('knob');
    expect(lowGain?.min).toBe(-12);
    expect(lowGain?.max).toBe(12);
    expect(lowGain?.unit).toBe('dB');
    expect(lowGain?.formatDisplay?.(3.5)).toBe('+3.5 dB');
    expect(lowGain?.formatDisplay?.(-2.0)).toBe('-2.0 dB');

    // Visualizer registered
    expect(eqDesc.visualizers?.length).toBe(1);
    expect(eqDesc.visualizers?.[0].type).toBe('eq_response_curve');
  });

  it('declares compressor parameters with gain reduction telemetry meter', () => {
    const compDesc = EFFECT_DESCRIPTORS.dynamics_compressor;
    expect(compDesc.params.length).toBe(5);

    const thresh = compDesc.params.find((p) => p.id === 'thresholdDb');
    expect(thresh?.widget).toBe('knob');
    expect(thresh?.min).toBe(-60);
    expect(thresh?.max).toBe(0);

    const ratio = compDesc.params.find((p) => p.id === 'ratio');
    expect(ratio?.formatDisplay?.(4)).toBe('4.0:1');

    // Telemetry visualizer registered
    expect(compDesc.visualizers?.length).toBe(1);
    expect(compDesc.visualizers?.[0].type).toBe('gain_reduction_meter');
  });

  it('generates declarative default configs via createDefaultEffectConfig', () => {
    const eq = createDefaultEffectConfig('biquad_eq', 'custom_eq_1');
    expect(eq.id).toBe('custom_eq_1');
    expect(eq.type).toBe('biquad_eq');
    expect(eq.enabled).toBe(true);
    expect((eq as any).lowShelfFreqHz).toBe(120);

    const filter = createDefaultEffectConfig('state_variable_filter');
    expect(filter.type).toBe('state_variable_filter');
    expect((filter as any).filterType).toBe('lowpass');
    expect((filter as any).q).toBe(1.0);
  });
});

