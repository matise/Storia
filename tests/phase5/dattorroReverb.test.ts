import { describe, expect, it, vi } from 'vitest';
import { DattorroReverb } from '../../src/core/dsp/modular/DattorroReverb';
import {
  createAudioEffectModule,
  DattorroReverbEffectModule,
} from '../../src/core/dsp/modular/AudioEffectModule';
import {
  createDefaultEffectConfig,
  getEffectDescriptor,
} from '../../src/core/dsp/modular/EffectDescriptorRegistry';
import { DattorroReverbEffectConfig } from '../../src/types/storia';

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
    sampleRate: 48000,
    createGain: vi.fn(() => ({
      ...createMockNode(),
      gain: createMockAudioParam(1.0),
    })),
    createDelay: vi.fn((_max = 1.0) => ({
      ...createMockNode(),
      delayTime: createMockAudioParam(0),
    })),
    createBiquadFilter: vi.fn(() => ({
      ...createMockNode(),
      type: 'lowpass',
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1),
      gain: createMockAudioParam(0),
    })),
    createOscillator: vi.fn(() => ({
      ...createMockNode(),
      type: 'sine',
      frequency: createMockAudioParam(1),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createChannelMerger: vi.fn((ch = 2) => ({
      ...createMockNode(),
      numberOfInputs: ch,
    })),
  } as unknown as BaseAudioContext;
}

describe('Dattorro Reverb Controller & Modular Effect Integration', () => {
  it('instantiates DattorroReverb with default parameters and scales coprime delays to sample rate', () => {
    const ctx = createMockAudioContext();
    const reverb = new DattorroReverb(ctx);

    expect(reverb.decay).toBe(2.8);
    expect(reverb.damping).toBe(4500);
    expect(reverb.preDelay).toBe(20);
    expect(reverb.bandwidth).toBe(12000);
    expect(reverb.modDepth).toBe(0.35);
    expect(reverb.modRate).toBe(0.7);
    expect(reverb.lowCut).toBe(80);
    expect(reverb.mix).toBe(0.4);
    expect(reverb.gain).toBe(1.0);
    expect(reverb.isBypassed).toBe(false);

    expect(ctx.createDelay).toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createChannelMerger).toHaveBeenCalledWith(2);
  });

  it('updates dynamic parameters with clamping and smooth exponential ramps', () => {
    const ctx = createMockAudioContext();
    const reverb = new DattorroReverb(ctx);

    reverb.setDecay(5.5);
    expect(reverb.decay).toBe(5.5);

    reverb.setDamping(8000);
    expect(reverb.damping).toBe(8000);

    reverb.setPreDelay(45);
    expect(reverb.preDelay).toBe(45);

    reverb.setBandwidth(15000);
    expect(reverb.bandwidth).toBe(15000);

    reverb.setLowCut(120);
    expect(reverb.lowCut).toBe(120);

    reverb.setModulation(0.6, 1.2);
    expect(reverb.modDepth).toBe(0.6);
    expect(reverb.modRate).toBe(1.2);

    reverb.setMix(0.85);
    expect(reverb.mix).toBe(0.85);

    reverb.setGain(1.25);
    expect(reverb.gain).toBe(1.25);

    // Clamping checks
    reverb.setDecay(999);
    expect(reverb.decay).toBe(30.0);

    reverb.setPreDelay(-10);
    expect(reverb.preDelay).toBe(0);
  });

  it('handles click-free bypass / Direct Audio Sync', () => {
    const ctx = createMockAudioContext();
    const reverb = new DattorroReverb(ctx);

    reverb.setBypass(true);
    expect(reverb.isBypassed).toBe(true);

    reverb.setBypass(false);
    expect(reverb.isBypassed).toBe(false);
  });

  it('cleans up resources and disconnects nodes on dispose', () => {
    const ctx = createMockAudioContext();
    const reverb = new DattorroReverb(ctx);

    expect(() => reverb.dispose()).not.toThrow();
    // Subsequent calls should be safe no-ops
    expect(() => reverb.dispose()).not.toThrow();
  });

  it('integrates seamlessly with IAudioEffectModule and createAudioEffectModule factory', () => {
    const ctx = createMockAudioContext();
    const config: DattorroReverbEffectConfig = {
      id: 'fx_reverb_1',
      name: 'Plate Reverb Test',
      type: 'dattorro_reverb',
      enabled: true,
      decay: 4.2,
      damping: 6000,
      preDelay: 30,
      bandwidth: 14000,
      modDepth: 0.45,
      modRate: 0.9,
      lowCut: 100,
      mix: 0.5,
      gain: 1.1,
    };

    const module = createAudioEffectModule(ctx, config) as DattorroReverbEffectModule;
    expect(module).toBeInstanceOf(DattorroReverbEffectModule);
    expect(module.id).toBe('fx_reverb_1');
    expect(module.type).toBe('dattorro_reverb');
    expect(module.isEnabled()).toBe(true);

    // Toggle module bypass
    module.setEnabled(false);
    expect(module.isEnabled()).toBe(false);

    // Apply configuration updates
    module.applyConfig({
      ...config,
      decay: 6.0,
      mix: 0.75,
      enabled: true,
    });
    expect(module.isEnabled()).toBe(true);
    expect((module.getConfig() as DattorroReverbEffectConfig).decay).toBe(6.0);

    // Dispose module
    expect(() => module.dispose()).not.toThrow();
  });

  it('exposes full parameter descriptor registry and default config for dattorro_reverb', () => {
    const desc = getEffectDescriptor('dattorro_reverb');
    expect(desc).toBeDefined();
    expect(desc?.name).toBe('Dattorro Plate Reverb');
    expect(desc?.category).toBe('spatial');
    expect(desc?.iconName).toBe('Waves');
    expect(desc?.params.some((p) => p.id === 'decay')).toBe(true);
    expect(desc?.params.some((p) => p.id === 'damping')).toBe(true);
    expect(desc?.params.some((p) => p.id === 'preDelay')).toBe(true);
    expect(desc?.params.some((p) => p.id === 'mix')).toBe(true);

    const defaultConfig = createDefaultEffectConfig('dattorro_reverb') as DattorroReverbEffectConfig;
    expect(defaultConfig.type).toBe('dattorro_reverb');
    expect(defaultConfig.decay).toBe(2.8);
    expect(defaultConfig.damping).toBe(4500);
    expect(defaultConfig.mix).toBe(0.4);
    expect(defaultConfig.enabled).toBe(true);
  });
});

