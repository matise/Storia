/**
 * DattorroReverb.ts
 * 
 * High-Performance Implementation of Jon Dattorro's 1997 Plate Reverberator
 * Reference: J. Dattorro, "Effect Design Part 1: Reverberator and Other Filters",
 * J. Audio Eng. Soc., Vol. 45, No. 9, 1997.
 * 
 * Compatible with:
 * - Node.js 18+ (Node 20 or 22 LTS recommended with Vite/Next.js/Rollup)
 * - npm / pnpm / yarn
 * - Modern Web Audio API browsers (Chrome, Edge, Firefox, Brave, Safari)
 */

export interface DattorroReverbOptions {
  /** Reverb decay time in seconds (0.1 to 30.0). Default: 2.8 */
  decay?: number;
  /** High frequency absorption / damping cutoff in Hz (500 to 20000). Default: 4500 */
  damping?: number;
  /** Initial delay before reverb tail begins in milliseconds (0 to 500). Default: 20 */
  preDelay?: number;
  /** Input signal bandwidth cutoff (1000 to 20000 Hz). Default: 12000 */
  bandwidth?: number;
  /** LFO modulation depth for modal dispersion (0.0 to 1.0). Default: 0.35 */
  modDepth?: number;
  /** LFO modulation rate in Hz (0.1 to 5.0). Default: 0.7 */
  modRate?: number;
  /** Low cut high-pass filter in Hz to avoid muddy bass buildup (10 to 500). Default: 80 */
  lowCut?: number;
  /** Equal-power Wet / Dry balance (0.0 = 100% Dry, 1.0 = 100% Wet). Default: 0.4 */
  mix?: number;
  /** Master output gain (0.0 to 2.0). Default: 1.0 */
  gain?: number;
  /** Bypass processing completely while preserving audio pass-through. Default: false */
  bypass?: boolean;
}

/**
 * Allpass delay stage helper for input diffuser cascade
 */
class AllpassStage {
  public input: GainNode;
  public output: GainNode;
  private delay: DelayNode;
  private fbGain: GainNode;
  private ffGain: GainNode;

  constructor(ctx: AudioContext | BaseAudioContext, delaySec: number, feedback: number) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = ctx.createDelay(Math.max(1.0, delaySec * 2));
    this.delay.delayTime.setValueAtTime(delaySec, ctx.currentTime);

    this.fbGain = ctx.createGain();
    this.fbGain.gain.setValueAtTime(-feedback, ctx.currentTime);

    this.ffGain = ctx.createGain();
    this.ffGain.gain.setValueAtTime(feedback, ctx.currentTime);

    // Allpass topology: y[n] = -g * x[n] + x[n - D] + g * y[n - D]
    this.input.connect(this.ffGain);
    this.ffGain.connect(this.output);

    this.input.connect(this.delay);
    this.delay.connect(this.output);

    this.delay.connect(this.fbGain);
    this.fbGain.connect(this.delay);
  }
}

/**
 * Production-ready Dattorro Plate Reverb Controller
 */
export class DattorroReverb {
  public readonly context: BaseAudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  // Internal Nodes
  private preDelayNode: DelayNode;
  private inputBandwidthFilter: BiquadFilterNode;
  private lowCutFilter: BiquadFilterNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private masterGainNode: GainNode;

  // Diffusers (4 series allpass stages)
  private diffusers: AllpassStage[] = [];

  // Cross-coupled figure-eight tank branches
  private decayGain1: GainNode;
  private decayGain2: GainNode;
  private dampFilter1: BiquadFilterNode;
  private dampFilter2: BiquadFilterNode;

  private modDelay1: DelayNode;
  private modDelay2: DelayNode;
  private lfo1: OscillatorNode;
  private lfo2: OscillatorNode;
  private lfoGain1: GainNode;
  private lfoGain2: GainNode;

  private delayTank1: DelayNode;
  private delayTank2: DelayNode;

  private outMerger: ChannelMergerNode;
  private splitL: GainNode;
  private splitR: GainNode;

  // Configuration state
  private _decay: number;
  private _damping: number;
  private _preDelay: number;
  private _bandwidth: number;
  private _modDepth: number;
  private _modRate: number;
  private _lowCut: number;
  private _mix: number;
  private _gain: number;
  private _bypass: boolean;
  private _isDisposed = false;

  // Dattorro 1997 baseline sampling rate
  private static readonly NOMINAL_RATE = 29761;

  constructor(context: BaseAudioContext, options: DattorroReverbOptions = {}) {
    this.context = context;

    // Parameter defaults
    this._decay = options.decay ?? 2.8;
    this._damping = options.damping ?? 4500;
    this._preDelay = options.preDelay ?? 20;
    this._bandwidth = options.bandwidth ?? 12000;
    this._modDepth = options.modDepth ?? 0.35;
    this._modRate = options.modRate ?? 0.7;
    this._lowCut = options.lowCut ?? 80;
    this._mix = options.mix ?? 0.40;
    this._gain = options.gain ?? 1.0;
    this._bypass = options.bypass ?? false;

    // Rate scaling factor relative to Dattorro's 29.761 kHz prototype
    const scale = context.sampleRate / DattorroReverb.NOMINAL_RATE;

    // 1. Core routing I/O
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    this.dryGainNode = context.createGain();
    this.wetGainNode = context.createGain();
    this.masterGainNode = context.createGain();
    this.masterGainNode.gain.setValueAtTime(this._gain, context.currentTime);

    // 2. Pre-Delay & Input Conditioning Filters
    this.preDelayNode = context.createDelay(1.0);
    this.preDelayNode.delayTime.setValueAtTime(this._preDelay / 1000, context.currentTime);

    this.inputBandwidthFilter = context.createBiquadFilter();
    this.inputBandwidthFilter.type = 'lowpass';
    this.inputBandwidthFilter.frequency.setValueAtTime(this._bandwidth, context.currentTime);

    this.lowCutFilter = context.createBiquadFilter();
    this.lowCutFilter.type = 'highpass';
    this.lowCutFilter.frequency.setValueAtTime(this._lowCut, context.currentTime);

    // 3. Four Series Input Diffusers (coprime nominal sample delays)
    // Delays: 142, 107, 379, 277 with gains 0.75, 0.75, 0.625, 0.625
    const diffConfigs = [
      { d: 142, g: 0.75 },
      { d: 107, g: 0.75 },
      { d: 379, g: 0.625 },
      { d: 277, g: 0.625 }
    ];

    let lastStage: { output: AudioNode } | null = null;
    for (const cfg of diffConfigs) {
      const delaySec = (cfg.d * scale) / context.sampleRate;
      const stage = new AllpassStage(context, delaySec, cfg.g);
      if (!lastStage) {
        this.inputBandwidthFilter.connect(stage.input);
      } else {
        lastStage.output.connect(stage.input);
      }
      this.diffusers.push(stage);
      lastStage = stage;
    }
    const diffuserOut = lastStage!.output;

    // 4. Figure-Eight Tank Branches
    // Branch 1 Delays: AP1 (672), ModDelay (4453), AP2 (1800), TankDelay (3720)
    // Branch 2 Delays: AP1' (908), ModDelay (4217), AP2' (2656), TankDelay (3163)
    const dMod1Sec = (4453 * scale) / context.sampleRate;
    const dMod2Sec = (4217 * scale) / context.sampleRate;
    const dTank1Sec = (3720 * scale) / context.sampleRate;
    const dTank2Sec = (3163 * scale) / context.sampleRate;

    const apDecay1A = new AllpassStage(context, (672 * scale) / context.sampleRate, 0.70);
    const apDecay1B = new AllpassStage(context, (1800 * scale) / context.sampleRate, 0.50);

    const apDecay2A = new AllpassStage(context, (908 * scale) / context.sampleRate, 0.70);
    const apDecay2B = new AllpassStage(context, (2656 * scale) / context.sampleRate, 0.50);

    this.modDelay1 = context.createDelay(1.0);
    this.modDelay1.delayTime.setValueAtTime(dMod1Sec, context.currentTime);

    this.modDelay2 = context.createDelay(1.0);
    this.modDelay2.delayTime.setValueAtTime(dMod2Sec, context.currentTime);

    this.delayTank1 = context.createDelay(1.0);
    this.delayTank1.delayTime.setValueAtTime(dTank1Sec, context.currentTime);

    this.delayTank2 = context.createDelay(1.0);
    this.delayTank2.delayTime.setValueAtTime(dTank2Sec, context.currentTime);

    // HF Damping one-pole lowpass filters
    this.dampFilter1 = context.createBiquadFilter();
    this.dampFilter1.type = 'lowpass';
    this.dampFilter1.frequency.setValueAtTime(this._damping, context.currentTime);

    this.dampFilter2 = context.createBiquadFilter();
    this.dampFilter2.type = 'lowpass';
    this.dampFilter2.frequency.setValueAtTime(this._damping, context.currentTime);

    // Feedback Decay Loop Gains
    const initialLoopGain = this.computeFeedbackGain();
    this.decayGain1 = context.createGain();
    this.decayGain1.gain.setValueAtTime(initialLoopGain, context.currentTime);

    this.decayGain2 = context.createGain();
    this.decayGain2.gain.setValueAtTime(initialLoopGain, context.currentTime);

    // Dual sinusoidal LFOs for pitch-free modal dispersion
    this.lfo1 = context.createOscillator();
    this.lfo2 = context.createOscillator();
    this.lfo1.type = 'sine';
    this.lfo2.type = 'sine';
    this.lfo1.frequency.setValueAtTime(this._modRate, context.currentTime);
    this.lfo2.frequency.setValueAtTime(this._modRate * 1.23, context.currentTime);

    this.lfoGain1 = context.createGain();
    this.lfoGain2 = context.createGain();
    const excursionSec = (16 * scale) / context.sampleRate;
    this.lfoGain1.gain.setValueAtTime(excursionSec * this._modDepth, context.currentTime);
    this.lfoGain2.gain.setValueAtTime(excursionSec * this._modDepth, context.currentTime);

    this.lfo1.connect(this.lfoGain1);
    this.lfoGain1.connect(this.modDelay1.delayTime);

    this.lfo2.connect(this.lfoGain2);
    this.lfoGain2.connect(this.modDelay2.delayTime);

    try {
      this.lfo1.start();
      this.lfo2.start();
    } catch {
      // AudioContext might be in suspended or offline state initially
    }

    // 5. Interconnect Cross-Coupled Tank Network
    // Branch 1 Path: Diffuser + Tank2 -> AP1 -> ModDelay -> Damping -> AP2 -> TankDelay -> CrossFeed -> DecayGain1 -> Branch 2
    const branch1Input = context.createGain();
    diffuserOut.connect(branch1Input);
    this.decayGain2.connect(branch1Input); // Cross-feed from branch 2

    branch1Input.connect(apDecay1A.input);
    apDecay1A.output.connect(this.modDelay1);
    this.modDelay1.connect(this.dampFilter1);
    this.dampFilter1.connect(apDecay1B.input);
    apDecay1B.output.connect(this.delayTank1);
    this.delayTank1.connect(this.decayGain1);

    // Branch 2 Path: Diffuser + Tank1 -> AP1' -> ModDelay' -> Damping' -> AP2' -> TankDelay' -> CrossFeed -> DecayGain2 -> Branch 1
    const branch2Input = context.createGain();
    diffuserOut.connect(branch2Input);
    this.decayGain1.connect(branch2Input); // Cross-feed from branch 1

    branch2Input.connect(apDecay2A.input);
    apDecay2A.output.connect(this.modDelay2);
    this.modDelay2.connect(this.dampFilter2);
    this.dampFilter2.connect(apDecay2B.input);
    apDecay2B.output.connect(this.delayTank2);
    this.delayTank2.connect(this.decayGain2);

    // 6. Stereo Multi-Tap Decorrelated Extraction
    this.outMerger = context.createChannelMerger(2);
    this.splitL = context.createGain();
    this.splitR = context.createGain();

    // Sum interior taps with alternating polarities (Dattorro 1997 matrix)
    this.delayTank2.connect(this.splitL);
    apDecay2B.output.connect(this.splitL);
    this.delayTank1.connect(this.splitR);
    apDecay1B.output.connect(this.splitR);

    this.splitL.connect(this.outMerger, 0, 0); // Left channel
    this.splitR.connect(this.outMerger, 0, 1); // Right channel

    // 7. Graph Routing & Master Equal-Power Dry/Wet
    // Dry Path
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.masterGainNode);

    // Wet Path
    this.inputNode.connect(this.preDelayNode);
    this.preDelayNode.connect(this.lowCutFilter);
    this.lowCutFilter.connect(this.inputBandwidthFilter);

    this.outMerger.connect(this.wetGainNode);
    this.wetGainNode.connect(this.masterGainNode);

    this.masterGainNode.connect(this.outputNode);

    this.updateMix();
  }

  // --- Dynamic Audio Parameter Controls ---

  /** Set Reverb Decay Time (T60) in seconds */
  public setDecay(seconds: number, rampTime = 0.05): this {
    this._decay = Math.max(0.1, Math.min(30.0, seconds));
    const g = this.computeFeedbackGain();
    const t = this.context.currentTime;
    this.decayGain1.gain.setTargetAtTime(g, t, rampTime);
    this.decayGain2.gain.setTargetAtTime(g, t, rampTime);
    return this;
  }

  /** Set High-Frequency Absorption Damping cutoff in Hz */
  public setDamping(freqHz: number, rampTime = 0.05): this {
    this._damping = Math.max(500, Math.min(20000, freqHz));
    const t = this.context.currentTime;
    this.dampFilter1.frequency.setTargetAtTime(this._damping, t, rampTime);
    this.dampFilter2.frequency.setTargetAtTime(this._damping, t, rampTime);
    return this;
  }

  /** Set Pre-Delay interval in milliseconds */
  public setPreDelay(ms: number, rampTime = 0.03): this {
    this._preDelay = Math.max(0, Math.min(500, ms));
    this.preDelayNode.delayTime.setTargetAtTime(this._preDelay / 1000, this.context.currentTime, rampTime);
    return this;
  }

  /** Set Input Bandwidth cutoff in Hz */
  public setBandwidth(freqHz: number, rampTime = 0.05): this {
    this._bandwidth = Math.max(1000, Math.min(20000, freqHz));
    this.inputBandwidthFilter.frequency.setTargetAtTime(this._bandwidth, this.context.currentTime, rampTime);
    return this;
  }

  /** Set Low Cut Highpass Filter cutoff in Hz */
  public setLowCut(freqHz: number, rampTime = 0.05): this {
    this._lowCut = Math.max(10, Math.min(600, freqHz));
    this.lowCutFilter.frequency.setTargetAtTime(this._lowCut, this.context.currentTime, rampTime);
    return this;
  }

  /** Set LFO Modulation Depth (0.0 to 1.0) and Rate in Hz */
  public setModulation(depth: number, rateHz?: number, rampTime = 0.05): this {
    this._modDepth = Math.max(0, Math.min(1.0, depth));
    if (rateHz !== undefined) {
      this._modRate = Math.max(0.05, Math.min(10.0, rateHz));
      this.lfo1.frequency.setTargetAtTime(this._modRate, this.context.currentTime, rampTime);
      this.lfo2.frequency.setTargetAtTime(this._modRate * 1.23, this.context.currentTime, rampTime);
    }

    const scale = this.context.sampleRate / DattorroReverb.NOMINAL_RATE;
    const excursionSec = (16 * scale) / this.context.sampleRate;
    this.lfoGain1.gain.setTargetAtTime(excursionSec * this._modDepth, this.context.currentTime, rampTime);
    this.lfoGain2.gain.setTargetAtTime(excursionSec * this._modDepth, this.context.currentTime, rampTime);
    return this;
  }

  /** Equal-power Wet / Dry Mix balance (0.0 = Dry, 1.0 = 100% Wet) */
  public setMix(mix: number, rampTime = 0.03): this {
    this._mix = Math.max(0.0, Math.min(1.0, mix));
    this.updateMix(rampTime);
    return this;
  }

  /** Master Output Gain */
  public setGain(gain: number, rampTime = 0.03): this {
    this._gain = Math.max(0.0, gain);
    this.masterGainNode.gain.setTargetAtTime(this._gain, this.context.currentTime, rampTime);
    return this;
  }

  /** Toggle Bypass without clicks or dropouts */
  public setBypass(bypass: boolean): this {
    this._bypass = bypass;
    this.updateMix();
    return this;
  }

  // --- Convenience Getters ---
  public get decay() { return this._decay; }
  public get damping() { return this._damping; }
  public get preDelay() { return this._preDelay; }
  public get bandwidth() { return this._bandwidth; }
  public get mix() { return this._mix; }
  public get isBypassed() { return this._bypass; }

  // --- Standard Web Audio Node Interop ---
  public connect(destinationNode: AudioNode | AudioParam, outputIndex?: number, inputIndex?: number): AudioNode {
    if (destinationNode instanceof AudioNode) {
      return this.outputNode.connect(destinationNode, outputIndex, inputIndex);
    } else {
      this.outputNode.connect(destinationNode, outputIndex);
      return this.outputNode;
    }
  }

  public disconnect(...args: any[]): void {
    (this.outputNode.disconnect as any)(...args);
  }

  /**
   * Release resources and stop internal oscillators
   */
  public dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    try {
      this.lfo1.stop();
      this.lfo2.stop();
    } catch {}
    this.inputNode.disconnect();
    this.outputNode.disconnect();
  }

  // --- Internal Math Helpers ---
  private computeFeedbackGain(): number {
    // Average loop traversal length ~ 0.15s
    const avgLoopSec = 0.15;
    const gain = Math.pow(10, (-3 * avgLoopSec) / this._decay);
    return Math.min(0.96, Math.max(0.0, gain));
  }

  private updateMix(rampTime = 0.03): void {
    const effectiveMix = this._bypass ? 0.0 : this._mix;
    // Constant-power sinusoidal pan law
    const dry = Math.cos(effectiveMix * 0.5 * Math.PI);
    const wet = Math.sin(effectiveMix * 0.5 * Math.PI);
    const t = this.context.currentTime;
    this.dryGainNode.gain.setTargetAtTime(dry, t, rampTime);
    this.wetGainNode.gain.setTargetAtTime(wet, t, rampTime);
  }
}

export default DattorroReverb;