import { describe, expect, it, vi } from 'vitest';
import { AuxBusEngine } from '../../src/core/dsp/modular/AuxBusEngine';
import { studioTransportEngine } from '../../src/core/dsp/StudioTransportEngine';
import { createDefaultMainAuxBus } from '../../src/types/storia';

function createMockAudioContext(): AudioContext {
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
    state: 'running',
    resume: vi.fn(async () => {}),
    destination: createMockNode(),
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
    createBufferSource: vi.fn(() => ({
      ...createMockNode(),
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createBuffer: vi.fn((_ch: number, len: number, sr: number) => ({
      duration: len / sr,
      length: len,
      numberOfChannels: 1,
      sampleRate: sr,
      getChannelData: vi.fn(() => new Float32Array(len)),
    })),
    createAnalyser: vi.fn(() => ({
      ...createMockNode(),
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      getFloatTimeDomainData: vi.fn(),
    })),
  } as unknown as AudioContext;
}

describe('Phase 2 — Aux Bus Mixing Engine & Dual-Path Routing', () => {
  it('instantiates AuxBusEngine with default modules and handles return gain updates', () => {
    const mockCtx = createMockAudioContext();
    const config = createDefaultMainAuxBus();
    const bus = new AuxBusEngine(mockCtx, config);

    expect(bus.inputNode).toBeDefined();
    expect(bus.outputNode).toBeDefined();
    expect(bus.getConfig().id).toBe('aux_bus_main');
    expect(bus.getConfig().enabled).toBe(true);

    // Update return gain to -6 dB
    bus.setReturnGainDb(-6.0);
    expect(bus.getConfig().returnGainDb).toBe(-6.0);

    // Toggle master bus bypass
    bus.setEnabled(false);
    expect(bus.getConfig().enabled).toBe(false);

    bus.setEnabled(true);
    expect(bus.getConfig().enabled).toBe(true);
  });

  it('manages module bypass and configuration dynamically in AuxBusEngine', () => {
    const mockCtx = createMockAudioContext();
    const config = createDefaultMainAuxBus();
    const bus = new AuxBusEngine(mockCtx, config);

    // Initial modules: EQ (enabled) and Dyn (enabled)
    expect(bus.getModuleConfig('fx_main_eq')?.enabled).toBe(true);
    expect(bus.getModuleConfig('fx_main_dyn')?.enabled).toBe(true);

    // Toggle EQ module off
    bus.toggleModuleEnabled('fx_main_eq');
    expect(bus.getModuleConfig('fx_main_eq')?.enabled).toBe(false);

    // Update Dyn module config
    bus.updateModuleConfig('fx_main_dyn', {
      id: 'fx_main_dyn',
      name: 'Studio Dynamics Compressor',
      type: 'dynamics_compressor',
      enabled: true,
      thresholdDb: -18,
      ratio: 4,
      attackMs: 15,
      releaseMs: 100,
      kneeDb: 0,
    });
    const dynConfig = bus.getModuleConfig('fx_main_dyn');
    expect((dynConfig as any)?.thresholdDb).toBe(-18);
    expect((dynConfig as any)?.ratio).toBe(4);
  });

  it('allows adding and removing modules in AuxBusEngine', () => {
    const mockCtx = createMockAudioContext();
    const config = createDefaultMainAuxBus();
    const bus = new AuxBusEngine(mockCtx, config);

    expect(bus.getConfig().modules.length).toBe(2);

    bus.addModule({
      id: 'mod_gain_extra',
      name: 'Extra Trim',
      type: 'gain_trim',
      enabled: true,
      gainDb: 3.0,
      invertPolarity: false,
    });

    expect(bus.getConfig().modules.length).toBe(3);
    expect(bus.getModuleConfig('mod_gain_extra')).toBeDefined();

    bus.removeModule('mod_gain_extra');
    expect(bus.getConfig().modules.length).toBe(2);
    expect(bus.getModuleConfig('mod_gain_extra')).toBeUndefined();
  });

  it('integrates Aux Bus with StudioTransportEngine and updates send/mute parameters', () => {
    const mockCtx = createMockAudioContext();
    // Inject mock AudioContext
    (studioTransportEngine as any).ctx = mockCtx;
    (studioTransportEngine as any).masterLimiter = (mockCtx as any).createDynamicsCompressor();
    (studioTransportEngine as any).masterAnalyser = (mockCtx as any).createAnalyser();

    const auxBus = studioTransportEngine.getOrCreateAuxBus();
    expect(auxBus).toBeDefined();

    // Verify updating aux module through studioTransportEngine
    studioTransportEngine.toggleAuxModule('aux_bus_main', 'fx_main_eq', false);
    expect(studioTransportEngine.getAuxBus('aux_bus_main')?.getModuleConfig('fx_main_eq')?.enabled).toBe(false);

    // Verify updating block fades, gain, aux send level and direct mute
    const mockFadeGain = mockCtx.createGain();
    const mockVolGain = mockCtx.createGain();
    const mockDirectGain = mockCtx.createGain();
    const mockAuxSendGain = mockCtx.createGain();

    (studioTransportEngine as any).activeBlockId = 'block_test_1';
    (studioTransportEngine as any).activeBlockFadeGain = mockFadeGain;
    (studioTransportEngine as any).activeBlockVolumeGain = mockVolGain;
    (studioTransportEngine as any).activeBlockDirectGain = mockDirectGain;
    (studioTransportEngine as any).activeBlockAuxSendGain = mockAuxSendGain;

    studioTransportEngine.updateBlockFadesAndGain('block_test_1', {
      volumeGainDb: -3.0,
      auxSendDb: -10.0,
      directMute: true,
    });

    // Direct gain should ramp towards 0 (muted)
    expect(mockDirectGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.0, expect.any(Number), 0.015);
    // Aux send gain should ramp towards 10^(-10/20) = 0.3162
    expect(mockAuxSendGain.gain.setTargetAtTime).toHaveBeenCalledWith(expect.closeTo(0.3162, 3), expect.any(Number), 0.015);
  });
});
