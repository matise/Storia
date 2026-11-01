import { describe, expect, it, vi } from 'vitest';
import {
  BiquadEqEffectModule,
  createAudioEffectModule,
  DynamicsCompressorEffectModule,
  GainTrimEffectModule,
  StateVariableFilterEffectModule,
} from '../../src/core/dsp/modular/AudioEffectModule';
import { createDefaultMainAuxBus } from '../../src/types/storia';

function createMockAudioContext(): BaseAudioContext {
  const createMockAudioParam = (initial = 0) => ({
    value: initial,
    setTargetAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    setValueAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    cancelScheduledValues: vi.fn(),
  });

  const createMockNode = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  return {
    currentTime: 0,
    createGain: vi.fn(() => ({
      ...createMockNode(),
      gain: createMockAudioParam(1.0),
    })),
    createBiquadFilter: vi.fn(() => ({
      ...createMockNode(),
      type: 'lowpass',
      frequency: createMockAudioParam(350),
      Q: createMockAudioParam(1),
      gain: createMockAudioParam(0),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      ...createMockNode(),
      threshold: createMockAudioParam(-24),
      knee: createMockAudioParam(30),
      ratio: createMockAudioParam(12),
      attack: createMockAudioParam(0.003),
      release: createMockAudioParam(0.25),
    })),
  } as unknown as BaseAudioContext;
}

describe('Phase 1 — Modular Audio Effect Architecture & Direct Audio Sync', () => {
  it('creates default main aux bus with 3-Band EQ and Dynamics Compressor modules', () => {
    const bus = createDefaultMainAuxBus();

    expect(bus.id).toBe('aux_bus_main');
    expect(bus.enabled).toBe(true);
    expect(bus.returnGainDb).toBe(0.0);
    expect(bus.modules.length).toBe(2);

    const [eq, dyn] = bus.modules;
    expect(eq.type).toBe('biquad_eq');
    expect(eq.enabled).toBe(true);
    expect((eq as any).lowShelfGainDb).toBe(0);

    expect(dyn.type).toBe('dynamics_compressor');
    expect(dyn.enabled).toBe(true);
    expect((dyn as any).thresholdDb).toBe(-20);
  });

  it('instantiates BiquadEqEffectModule and toggles Direct Audio Sync bypass without clicks', () => {
    const ctx = createMockAudioContext();
    const module = new BiquadEqEffectModule(ctx, {
      id: 'fx_eq_test',
      name: 'Test EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfGainDb: 3.5,
      midPeakGainDb: -2.0,
      highShelfGainDb: 4.0,
    });

    expect(module.id).toBe('fx_eq_test');
    expect(module.type).toBe('biquad_eq');
    expect(module.isEnabled()).toBe(true);
    expect(module.inputNode).toBeDefined();
    expect(module.outputNode).toBeDefined();

    // In enabled mode: wetGain is 1.0, dryGain is 0.0
    expect((module as any).wetGainNode.gain.value).toBe(1.0);
    expect((module as any).dryGainNode.gain.value).toBe(0.0);

    // Bypass mode (Direct Audio Sync)
    module.setEnabled(false, true);
    expect(module.isEnabled()).toBe(false);
    expect((module as any).wetGainNode.gain.value).toBe(0.0);
    expect((module as any).dryGainNode.gain.value).toBe(1.0);

    // Dynamic config updating
    module.applyConfig(
      {
        id: 'fx_eq_test',
        name: 'Updated EQ',
        type: 'biquad_eq',
        enabled: true,
        lowShelfGainDb: 6.0,
        midPeakGainDb: 0.0,
        highShelfGainDb: -3.0,
      },
      true
    );
    expect(module.isEnabled()).toBe(true);
    expect((module as any).lowShelf.gain.value).toBe(6.0);
    expect((module as any).highShelf.gain.value).toBe(-3.0);

    module.dispose();
  });

  it('instantiates DynamicsCompressorEffectModule and updates compressor parameters', () => {
    const ctx = createMockAudioContext();
    const module = new DynamicsCompressorEffectModule(ctx, {
      id: 'fx_dyn_test',
      name: 'Test Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -24,
      ratio: 4.0,
      attackMs: 20,
      releaseMs: 150,
      kneeDb: 6,
    });

    expect(module.isEnabled()).toBe(true);
    const compNode = (module as any).compressor as DynamicsCompressorNode;
    expect(compNode.threshold.value).toBe(-24);
    expect(compNode.ratio.value).toBe(4.0);
    expect(compNode.attack.value).toBeCloseTo(0.02, 3);
    expect(compNode.release.value).toBeCloseTo(0.15, 3);
    expect(compNode.knee.value).toBe(6);

    // Bypass
    module.setEnabled(false, true);
    expect(module.isEnabled()).toBe(false);
    expect((module as any).wetGainNode.gain.value).toBe(0.0);
    expect((module as any).dryGainNode.gain.value).toBe(1.0);

    module.dispose();
  });

  it('supports GainTrimEffectModule with polarity inversion and mute threshold', () => {
    const ctx = createMockAudioContext();
    const module = new GainTrimEffectModule(ctx, {
      id: 'fx_gain_test',
      name: 'Test Gain',
      type: 'gain_trim',
      enabled: true,
      gainDb: -6,
      invertPolarity: false,
    });

    expect(module.isEnabled()).toBe(true);
    const gainNode = (module as any).gainNode as GainNode;
    expect(gainNode.gain.value).toBeCloseTo(Math.pow(10, -6 / 20), 3);

    // Invert polarity
    module.applyConfig(
      {
        id: 'fx_gain_test',
        name: 'Inverted Gain',
        type: 'gain_trim',
        enabled: true,
        gainDb: 0,
        invertPolarity: true,
      },
      true
    );
    expect(gainNode.gain.value).toBe(-1.0);

    // Muted threshold (< -48dB)
    module.applyConfig(
      {
        id: 'fx_gain_test',
        name: 'Muted Gain',
        type: 'gain_trim',
        enabled: true,
        gainDb: -60,
      },
      true
    );
    expect(gainNode.gain.value).toBe(0.0);

    module.dispose();
  });

  it('instantiates StateVariableFilterEffectModule and updates filter types', () => {
    const ctx = createMockAudioContext();
    const filter = new StateVariableFilterEffectModule(ctx, {
      id: 'fx_filter_test',
      name: 'Highpass Filter',
      type: 'state_variable_filter',
      enabled: true,
      filterType: 'highpass',
      frequencyHz: 150,
      q: 2.0,
    });

    expect(filter.isEnabled()).toBe(true);
    const biquad = (filter as any).filterNode as BiquadFilterNode;
    expect(biquad.type).toBe('highpass');
    expect(biquad.frequency.value).toBe(150);
    expect(biquad.Q.value).toBe(2.0);

    filter.dispose();
  });

  it('creates modules via createAudioEffectModule factory', () => {
    const ctx = createMockAudioContext();

    const eqModule = createAudioEffectModule(ctx, {
      id: 'factory_eq',
      name: 'Factory EQ',
      type: 'biquad_eq',
      enabled: true,
      lowShelfGainDb: 0,
      midPeakGainDb: 0,
      highShelfGainDb: 0,
    });
    expect(eqModule.type).toBe('biquad_eq');

    const filterModule = createAudioEffectModule(ctx, {
      id: 'factory_filter',
      name: 'Factory Filter',
      type: 'state_variable_filter',
      enabled: true,
      filterType: 'highpass',
      frequencyHz: 80,
    });
    expect(filterModule.type).toBe('state_variable_filter');

    const passModule = createAudioEffectModule(ctx, {
      id: 'factory_pass',
      name: 'Factory Passthrough',
      type: 'passthrough',
      enabled: true,
    });
    expect(passModule.type).toBe('passthrough');
  });
});

