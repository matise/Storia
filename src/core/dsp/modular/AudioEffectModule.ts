import {
  AudioEffectConfig,
  BiquadEqEffectConfig,
  DynamicsEffectConfig,
  EffectModuleType,
  GainTrimEffectConfig,
  PassthroughEffectConfig,
  StateVariableFilterEffectConfig,
} from '../../../types/storia';

/**
 * Standard interface implemented by all modular audio processing modules.
 * Every module features an inputNode and outputNode, with seamless
 * click-free parameter transitions and bit-transparent Direct Audio Sync (bypass).
 */
export interface IAudioEffectModule {
  readonly id: string;
  readonly name: string;
  readonly type: EffectModuleType;
  readonly inputNode: AudioNode;
  readonly outputNode: AudioNode;

  isEnabled(): boolean;
  setEnabled(enabled: boolean, immediate?: boolean): void;
  applyConfig(config: AudioEffectConfig, immediate?: boolean): void;
  getConfig(): AudioEffectConfig;
  disconnect(): void;
  dispose(): void;
}

/**
 * Base abstract class providing dry/wet crossfading for click-free bypass / Direct Audio Sync.
 */
abstract class BaseEffectModule<T extends AudioEffectConfig> implements IAudioEffectModule {
  public readonly id: string;
  public name: string;
  public readonly type: EffectModuleType;

  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;
  protected readonly dryGainNode: GainNode;
  protected readonly wetGainNode: GainNode;
  protected readonly ctx: BaseAudioContext;

  protected config: T;
  protected enabled: boolean;

  constructor(ctx: BaseAudioContext, config: T) {
    this.ctx = ctx;
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = { ...config };
    this.enabled = config.enabled ?? true;

    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1.0;

    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 1.0;

    this.dryGainNode = ctx.createGain();
    this.dryGainNode.gain.value = this.enabled ? 0.0 : 1.0;

    this.wetGainNode = ctx.createGain();
    this.wetGainNode.gain.value = this.enabled ? 1.0 : 0.0;

    // Direct dry bypass path
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.outputNode);

    // Wet output connects to master output
    this.wetGainNode.connect(this.outputNode);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean, immediate = false): void {
    this.enabled = enabled;
    this.config = { ...this.config, enabled };
    const now = this.ctx.currentTime;
    const targetDry = enabled ? 0.0 : 1.0;
    const targetWet = enabled ? 1.0 : 0.0;

    if (immediate || typeof this.dryGainNode.gain.setTargetAtTime !== 'function') {
      this.dryGainNode.gain.value = targetDry;
      this.wetGainNode.gain.value = targetWet;
    } else {
      this.dryGainNode.gain.setTargetAtTime(targetDry, now, 0.015);
      this.wetGainNode.gain.setTargetAtTime(targetWet, now, 0.015);
    }
  }

  public getConfig(): AudioEffectConfig {
    return { ...this.config, enabled: this.enabled };
  }

  public disconnect(): void {
    try {
      this.outputNode.disconnect();
    } catch {}
  }

  public dispose(): void {
    try {
      this.inputNode.disconnect();
      this.dryGainNode.disconnect();
      this.wetGainNode.disconnect();
      this.outputNode.disconnect();
    } catch {}
  }

  public abstract applyConfig(config: AudioEffectConfig, immediate?: boolean): void;
}

/**
 * 3-Band Parametric Biquad EQ Module
 * (120Hz Low-Shelf, 2.5kHz Mid-Peak, 8kHz High-Shelf) with Direct Audio Sync bypass.
 */
export class BiquadEqEffectModule extends BaseEffectModule<BiquadEqEffectConfig> {
  private readonly lowShelf: BiquadFilterNode;
  private readonly midPeak: BiquadFilterNode;
  private readonly highShelf: BiquadFilterNode;

  constructor(ctx: BaseAudioContext, config: BiquadEqEffectConfig) {
    super(ctx, config);

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = config.lowShelfFreqHz ?? 120;

    this.midPeak = ctx.createBiquadFilter();
    this.midPeak.type = 'peaking';
    this.midPeak.frequency.value = config.midPeakFreqHz ?? 2500;
    this.midPeak.Q.value = config.midPeakQ ?? 1.0;

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = config.highShelfFreqHz ?? 8000;

    // Connect wet path: input -> lowShelf -> midPeak -> highShelf -> wetGainNode
    this.inputNode.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.wetGainNode);

    this.applyConfig(config, true);
  }

  public applyConfig(config: AudioEffectConfig, immediate = false): void {
    if (config.type !== 'biquad_eq') return;
    this.config = { ...config };
    this.name = config.name;
    this.setEnabled(config.enabled ?? true, immediate);

    const now = this.ctx.currentTime;
    const low = config.lowShelfGainDb ?? 0;
    const mid = config.midPeakGainDb ?? 0;
    const high = config.highShelfGainDb ?? 0;

    if (config.lowShelfFreqHz !== undefined) this.lowShelf.frequency.value = config.lowShelfFreqHz;
    if (config.midPeakFreqHz !== undefined) this.midPeak.frequency.value = config.midPeakFreqHz;
    if (config.midPeakQ !== undefined) this.midPeak.Q.value = config.midPeakQ;
    if (config.highShelfFreqHz !== undefined) this.highShelf.frequency.value = config.highShelfFreqHz;

    if (immediate || typeof this.lowShelf.gain.setTargetAtTime !== 'function') {
      this.lowShelf.gain.value = low;
      this.midPeak.gain.value = mid;
      this.highShelf.gain.value = high;
    } else {
      this.lowShelf.gain.setTargetAtTime(low, now, 0.015);
      this.midPeak.gain.setTargetAtTime(mid, now, 0.015);
      this.highShelf.gain.setTargetAtTime(high, now, 0.015);
    }
  }

  public override dispose(): void {
    try {
      this.lowShelf.disconnect();
      this.midPeak.disconnect();
      this.highShelf.disconnect();
    } catch {}
    super.dispose();
  }
}

/**
 * Studio Dynamics Compressor Module
 * with click-free dry/wet bypass and broadcast-grade dynamic control.
 */
export class DynamicsCompressorEffectModule extends BaseEffectModule<DynamicsEffectConfig> {
  private readonly compressor: DynamicsCompressorNode;

  constructor(ctx: BaseAudioContext, config: DynamicsEffectConfig) {
    super(ctx, config);

    this.compressor = ctx.createDynamicsCompressor();

    // Connect wet path: input -> compressor -> wetGainNode
    this.inputNode.connect(this.compressor);
    this.compressor.connect(this.wetGainNode);

    this.applyConfig(config, true);
  }

  public applyConfig(config: AudioEffectConfig, immediate = false): void {
    if (config.type !== 'dynamics_compressor') return;
    this.config = { ...config };
    this.name = config.name;
    this.setEnabled(config.enabled ?? true, immediate);

    const now = this.ctx.currentTime;
    const threshold = config.thresholdDb ?? -20;
    const ratio = config.ratio ?? 2.5;
    const attack = (config.attackMs ?? 15) / 1000;
    const release = (config.releaseMs ?? 100) / 1000;
    const knee = config.kneeDb ?? 0;

    if (immediate || typeof this.compressor.threshold.setTargetAtTime !== 'function') {
      this.compressor.threshold.value = threshold;
      this.compressor.ratio.value = ratio;
      this.compressor.attack.value = attack;
      this.compressor.release.value = release;
      this.compressor.knee.value = knee;
    } else {
      this.compressor.threshold.setTargetAtTime(threshold, now, 0.015);
      this.compressor.ratio.setTargetAtTime(ratio, now, 0.015);
      this.compressor.attack.setTargetAtTime(attack, now, 0.015);
      this.compressor.release.setTargetAtTime(release, now, 0.015);
      this.compressor.knee.setTargetAtTime(knee, now, 0.015);
    }
  }

  public override dispose(): void {
    try {
      this.compressor.disconnect();
    } catch {}
    super.dispose();
  }
}

/**
 * Gain / Trim / Polarity Invert Module
 */
export class GainTrimEffectModule extends BaseEffectModule<GainTrimEffectConfig> {
  private readonly gainNode: GainNode;

  constructor(ctx: BaseAudioContext, config: GainTrimEffectConfig) {
    super(ctx, config);

    this.gainNode = ctx.createGain();
    this.inputNode.connect(this.gainNode);
    this.gainNode.connect(this.wetGainNode);

    this.applyConfig(config, true);
  }

  public applyConfig(config: AudioEffectConfig, immediate = false): void {
    if (config.type !== 'gain_trim') return;
    this.config = { ...config };
    this.name = config.name;
    this.setEnabled(config.enabled ?? true, immediate);

    const now = this.ctx.currentTime;
    const db = config.gainDb ?? 0;
    const polarity = config.invertPolarity ? -1 : 1;
    const isMuted = config.mute || !Number.isFinite(db) || db <= -48;
    const lin = isMuted ? 0 : Math.pow(10, db / 20) * polarity;

    if (immediate || typeof this.gainNode.gain.setTargetAtTime !== 'function') {
      this.gainNode.gain.value = lin;
    } else {
      this.gainNode.gain.setTargetAtTime(lin, now, 0.015);
    }
  }

  public override dispose(): void {
    try {
      this.gainNode.disconnect();
    } catch {}
    super.dispose();
  }
}

/**
 * State-Variable Filter Module (Lowpass, Highpass, Bandpass, Notch)
 */
export class StateVariableFilterEffectModule extends BaseEffectModule<StateVariableFilterEffectConfig> {
  private readonly filterNode: BiquadFilterNode;

  constructor(ctx: BaseAudioContext, config: StateVariableFilterEffectConfig) {
    super(ctx, config);

    this.filterNode = ctx.createBiquadFilter();
    this.inputNode.connect(this.filterNode);
    this.filterNode.connect(this.wetGainNode);

    this.applyConfig(config, true);
  }

  public applyConfig(config: AudioEffectConfig, immediate = false): void {
    if (config.type !== 'state_variable_filter') return;
    this.config = { ...config };
    this.name = config.name;
    this.setEnabled(config.enabled ?? true, immediate);

    const now = this.ctx.currentTime;
    this.filterNode.type = config.filterType ?? 'lowpass';
    const freq = config.frequencyHz ?? 1000;
    const q = config.q ?? 1.0;

    if (immediate || typeof this.filterNode.frequency.setTargetAtTime !== 'function') {
      this.filterNode.frequency.value = freq;
      this.filterNode.Q.value = q;
    } else {
      this.filterNode.frequency.setTargetAtTime(freq, now, 0.015);
      this.filterNode.Q.setTargetAtTime(q, now, 0.015);
    }
  }

  public override dispose(): void {
    try {
      this.filterNode.disconnect();
    } catch {}
    super.dispose();
  }
}

/**
 * Direct Audio Sync Passthrough Module (Zero processing, exact sample alignment)
 */
export class PassthroughEffectModule implements IAudioEffectModule {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'passthrough' as const;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;
  private config: PassthroughEffectConfig;

  constructor(ctx: BaseAudioContext, config: PassthroughEffectConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = { ...config };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.inputNode.gain.value = 1.0;
    this.outputNode.gain.value = 1.0;

    this.inputNode.connect(this.outputNode);
  }

  public isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  public setEnabled(enabled: boolean): void {
    this.config = { ...this.config, enabled };
  }

  public applyConfig(config: AudioEffectConfig): void {
    if (config.type !== 'passthrough') return;
    this.config = { ...config };
  }

  public getConfig(): AudioEffectConfig {
    return { ...this.config };
  }

  public disconnect(): void {
    try {
      this.outputNode.disconnect();
    } catch {}
  }

  public dispose(): void {
    try {
      this.inputNode.disconnect();
      this.outputNode.disconnect();
    } catch {}
  }
}

/**
 * Factory creating the appropriate concrete AudioEffectModule from its declarative configuration.
 */
export function createAudioEffectModule(
  ctx: BaseAudioContext,
  config: AudioEffectConfig
): IAudioEffectModule {
  switch (config.type) {
    case 'biquad_eq':
      return new BiquadEqEffectModule(ctx, config);
    case 'dynamics_compressor':
      return new DynamicsCompressorEffectModule(ctx, config);
    case 'gain_trim':
      return new GainTrimEffectModule(ctx, config);
    case 'state_variable_filter':
      return new StateVariableFilterEffectModule(ctx, config);
    case 'passthrough':
      return new PassthroughEffectModule(ctx, config);
    default:
      return new PassthroughEffectModule(ctx, {
        id: (config as AudioEffectConfig).id || 'fx_default',
        name: 'Default Passthrough',
        type: 'passthrough',
        enabled: true,
      });
  }
}

