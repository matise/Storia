import { Speaker } from '../../types/storia';

/**
 * Normalized Digital Biquad Filter Coefficients (Direct Form I / II Transposed)
 * Transfer function:
 * H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
 * where raw coefficients are already divided by a0.
 */
export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a0: number; // Always 1.0 after normalization
  a1: number;
  a2: number;
}

/**
 * Anti-denormal DC offset (+10^-25) to prevent subnormal floating-point CPU spikes
 * during exponential filter decay in silent pauses.
 */
export const ANTI_DENORMAL_OFFSET = 1e-25;

/**
 * Robert Bristow-Johnson (RBJ) Audio EQ Cookbook:
 * Computes normalized Low-Shelf biquad filter coefficients (default fc = 120 Hz).
 */
export function computeLowShelfCoeffs(
  fc = 120,
  gainDb = 0,
  sampleRate = 48000,
  S = 1.0
): BiquadCoeffs {
  if (Math.abs(gainDb) < 1e-9) {
    return { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 };
  }

  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha =
    (sinW0 / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

  const rawB0 = A * (A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha);
  const rawB1 = 2 * A * (A - 1 - (A + 1) * cosW0);
  const rawB2 = A * (A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha);
  const rawA0 = A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha;
  const rawA1 = -2 * (A - 1 + (A + 1) * cosW0);
  const rawA2 = A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha;

  return {
    b0: rawB0 / rawA0,
    b1: rawB1 / rawA0,
    b2: rawB2 / rawA0,
    a0: 1.0,
    a1: rawA1 / rawA0,
    a2: rawA2 / rawA0,
  };
}

/**
 * Robert Bristow-Johnson (RBJ) Audio EQ Cookbook:
 * Computes normalized Peaking EQ biquad filter coefficients (default fc = 2500 Hz, Q = 1.0).
 */
export function computePeakingCoeffs(
  fc = 2500,
  gainDb = 0,
  Q = 1.0,
  sampleRate = 48000
): BiquadCoeffs {
  if (Math.abs(gainDb) < 1e-9) {
    return { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 };
  }

  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);

  const rawB0 = 1 + alpha * A;
  const rawB1 = -2 * cosW0;
  const rawB2 = 1 - alpha * A;
  const rawA0 = 1 + alpha / A;
  const rawA1 = -2 * cosW0;
  const rawA2 = 1 - alpha / A;

  return {
    b0: rawB0 / rawA0,
    b1: rawB1 / rawA0,
    b2: rawB2 / rawA0,
    a0: 1.0,
    a1: rawA1 / rawA0,
    a2: rawA2 / rawA0,
  };
}

/**
 * Robert Bristow-Johnson (RBJ) Audio EQ Cookbook:
 * Computes normalized High-Shelf biquad filter coefficients (default fc = 8000 Hz).
 */
export function computeHighShelfCoeffs(
  fc = 8000,
  gainDb = 0,
  sampleRate = 48000,
  S = 1.0
): BiquadCoeffs {
  if (Math.abs(gainDb) < 1e-9) {
    return { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 };
  }

  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha =
    (sinW0 / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

  const rawB0 = A * (A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha);
  const rawB1 = -2 * A * (A - 1 + (A + 1) * cosW0);
  const rawB2 = A * (A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha);
  const rawA0 = A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha;
  const rawA1 = 2 * (A - 1 - (A + 1) * cosW0);
  const rawA2 = A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha;

  return {
    b0: rawB0 / rawA0,
    b1: rawB1 / rawA0,
    b2: rawB2 / rawA0,
    a0: 1.0,
    a1: rawA1 / rawA0,
    a2: rawA2 / rawA0,
  };
}

/**
 * Evaluates the magnitude response |H(e^(j*omega))| (linear gain) of a Biquad filter at a given frequency.
 */
export function evaluateBiquadMagnitudeAtFreq(
  coeffs: BiquadCoeffs,
  freqHz: number,
  sampleRate = 48000
): number {
  const w = (2 * Math.PI * freqHz) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  const numReal = coeffs.b0 + coeffs.b1 * cosW + coeffs.b2 * cos2W;
  const numImag = -(coeffs.b1 * sinW + coeffs.b2 * sin2W);

  const denReal = 1.0 + coeffs.a1 * cosW + coeffs.a2 * cos2W;
  const denImag = -(coeffs.a1 * sinW + coeffs.a2 * sin2W);

  const numMagSq = numReal * numReal + numImag * numImag;
  const denMagSq = denReal * denReal + denImag * denImag;

  return Math.sqrt(numMagSq / Math.max(1e-30, denMagSq));
}

/**
 * Processes a Float32Array audio buffer in-place using Direct Form II Transposed Biquad section
 * with anti-denormal protection.
 */
export function processBiquadFilterInPlace(
  samples: Float32Array,
  coeffs: BiquadCoeffs
): Float32Array {
  const { b0, b1, b2, a1, a2 } = coeffs;
  let z1 = 0.0;
  let z2 = 0.0;

  for (let i = 0; i < samples.length; i++) {
    const x = samples[i] + ANTI_DENORMAL_OFFSET;
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    samples[i] = Math.abs(y) < 1e-30 ? 0.0 : y;
  }

  return samples;
}

/**
 * Applies a Speaker's full 3-band RBJ Biquad EQ (120Hz Low-Shelf, 2.5kHz Mid-Peak, 8kHz High-Shelf)
 * and envelope Dynamics Compressor to a mono Float32Array buffer.
 * Used for both offline DSP verification and Phase 6 offline master rendering.
 */
export function processSpeakerDspBuffer(
  input: Float32Array,
  speaker?: Speaker,
  sampleRate = 48000
): Float32Array {
  const out = new Float32Array(input);
  if (!speaker) return out;

  const eq = speaker.voice.acoustics.biquadEq;
  const eqEnabled = eq?.enabled ?? true;

  if (eqEnabled && eq) {
    if (Math.abs(eq.lowShelfGainDb) > 1e-6) {
      const lowCoeffs = computeLowShelfCoeffs(120, eq.lowShelfGainDb, sampleRate);
      processBiquadFilterInPlace(out, lowCoeffs);
    }
    if (Math.abs(eq.midPeakGainDb) > 1e-6) {
      const midCoeffs = computePeakingCoeffs(2500, eq.midPeakGainDb, 1.0, sampleRate);
      processBiquadFilterInPlace(out, midCoeffs);
    }
    if (Math.abs(eq.highShelfGainDb) > 1e-6) {
      const highCoeffs = computeHighShelfCoeffs(8000, eq.highShelfGainDb, sampleRate);
      processBiquadFilterInPlace(out, highCoeffs);
    }
  }

  const comp = speaker.voice.acoustics.compression;
  const compEnabled = comp?.enabled ?? true;
  if (compEnabled && comp && comp.ratio > 1.01) {
    const thresholdDb = comp.thresholdDb ?? -20;
    const ratio = Math.max(1.0, comp.ratio ?? 2.5);
    const attackSec = Math.max(0.001, (comp.attackMs ?? 15) / 1000);
    const releaseSec = Math.max(0.005, (comp.releaseMs ?? 100) / 1000);

    const alphaAttack = Math.exp(-1.0 / (attackSec * sampleRate));
    const alphaRelease = Math.exp(-1.0 / (releaseSec * sampleRate));

    let envLin = 0.0;
    for (let i = 0; i < out.length; i++) {
      const absX = Math.abs(out[i]) + ANTI_DENORMAL_OFFSET;
      if (absX > envLin) {
        envLin = alphaAttack * envLin + (1.0 - alphaAttack) * absX;
      } else {
        envLin = alphaRelease * envLin + (1.0 - alphaRelease) * absX;
      }

      const envDb = 20 * Math.log10(Math.max(1e-9, envLin));
      if (envDb > thresholdDb) {
        const gainReductionDb = (thresholdDb - envDb) * (1.0 - 1.0 / ratio);
        const gainLin = Math.pow(10, gainReductionDb / 20);
        out[i] *= gainLin;
      }
    }
  }

  return out;
}

/**
 * Real-time Web Audio API per-speaker DSP chain:
 * Input -> Low-Shelf (120Hz) -> Mid-Peak (2.5kHz) -> High-Shelf (8kHz) -> Dry/Wet Compressor -> Output
 */
export class SpeakerDspChain {
  public readonly ctx: BaseAudioContext;
  public readonly lowShelfNode: BiquadFilterNode;
  public readonly midPeakNode: BiquadFilterNode;
  public readonly highShelfNode: BiquadFilterNode;
  public readonly compressorNode: DynamicsCompressorNode;
  public readonly dryGainNode: GainNode;
  public readonly wetCompGainNode: GainNode;
  public readonly outputNode: GainNode;

  constructor(ctx: BaseAudioContext, speaker?: Speaker) {
    this.ctx = ctx;

    this.lowShelfNode = ctx.createBiquadFilter();
    this.lowShelfNode.type = 'lowshelf';
    this.lowShelfNode.frequency.value = 120;

    this.midPeakNode = ctx.createBiquadFilter();
    this.midPeakNode.type = 'peaking';
    this.midPeakNode.frequency.value = 2500;
    this.midPeakNode.Q.value = 1.0;

    this.highShelfNode = ctx.createBiquadFilter();
    this.highShelfNode.type = 'highshelf';
    this.highShelfNode.frequency.value = 8000;

    this.compressorNode = ctx.createDynamicsCompressor();
    this.dryGainNode = ctx.createGain();
    this.wetCompGainNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    this.lowShelfNode.connect(this.midPeakNode);
    this.midPeakNode.connect(this.highShelfNode);

    this.highShelfNode.connect(this.dryGainNode);
    this.highShelfNode.connect(this.compressorNode);
    this.compressorNode.connect(this.wetCompGainNode);

    this.dryGainNode.connect(this.outputNode);
    this.wetCompGainNode.connect(this.outputNode);

    this.applySpeakerSettings(speaker, true);
  }

  public get inputNode(): AudioNode {
    return this.lowShelfNode;
  }

  public connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  public disconnect(): void {
    try {
      this.outputNode.disconnect();
    } catch {
      // Ignore if not connected
    }
  }

  /**
   * Glitch-free parameter update using exponential target ramping (tau = 15ms).
   */
  public applySpeakerSettings(speaker?: Speaker, immediate = false): void {
    const now = this.ctx.currentTime;
    const eq = speaker?.voice.acoustics.biquadEq;
    const eqEnabled = eq?.enabled ?? true;

    const lowGain = eqEnabled ? (eq?.lowShelfGainDb ?? 0) : 0;
    const midGain = eqEnabled ? (eq?.midPeakGainDb ?? 0) : 0;
    const highGain = eqEnabled ? (eq?.highShelfGainDb ?? 0) : 0;

    const comp = speaker?.voice.acoustics.compression;
    const compEnabled = comp?.enabled ?? true;
    const threshold = comp?.thresholdDb ?? -20;
    const ratio = compEnabled ? (comp?.ratio ?? 2.5) : 1.0;
    const attack = (comp?.attackMs ?? 15) / 1000;
    const release = (comp?.releaseMs ?? 100) / 1000;

    if (immediate || typeof this.lowShelfNode.gain.setTargetAtTime !== 'function') {
      this.lowShelfNode.gain.value = lowGain;
      this.midPeakNode.gain.value = midGain;
      this.highShelfNode.gain.value = highGain;
      this.compressorNode.threshold.value = threshold;
      this.compressorNode.ratio.value = ratio;
      this.compressorNode.attack.value = attack;
      this.compressorNode.release.value = release;
      this.dryGainNode.gain.value = compEnabled ? 0.0 : 1.0;
      this.wetCompGainNode.gain.value = compEnabled ? 1.0 : 0.0;
    } else {
      this.lowShelfNode.gain.setTargetAtTime(lowGain, now, 0.015);
      this.midPeakNode.gain.setTargetAtTime(midGain, now, 0.015);
      this.highShelfNode.gain.setTargetAtTime(highGain, now, 0.015);
      this.compressorNode.threshold.setTargetAtTime(threshold, now, 0.015);
      this.compressorNode.ratio.setTargetAtTime(ratio, now, 0.015);
      this.compressorNode.attack.setTargetAtTime(attack, now, 0.015);
      this.compressorNode.release.setTargetAtTime(release, now, 0.015);
      this.dryGainNode.gain.setTargetAtTime(compEnabled ? 0.0 : 1.0, now, 0.015);
      this.wetCompGainNode.gain.setTargetAtTime(compEnabled ? 1.0 : 0.0, now, 0.015);
    }
  }
}

