import {
  ANTI_DENORMAL_OFFSET,
  BiquadCoeffs,
  processBiquadFilterInPlace,
} from './BiquadChain';

export interface LoudnessMeasurement {
  momentaryLufs: number;
  integratedLufs: number;
  samplePeakDbfs: number;
  truePeakDbfs: number;
  rmsDbfs: number;
  isBroadcastSafe: boolean;
}

/**
 * Computes the ITU-R BS.1770-4 Stage 1 (Pre-filter acoustic head model)
 * and Stage 2 (RLB high-pass filter) biquad coefficients for a given sample rate.
 * Uses the exact ITU-R BS.1770-4 Table 1 & Table 2 constants at 48,000 Hz
 * and analytical bilinear transform parameterization at other sample rates.
 */
export function computeKWeightingCoeffs(sampleRate = 48000): {
  preFilter: BiquadCoeffs;
  rlbHighPass: BiquadCoeffs;
} {
  if (sampleRate === 48000) {
    return {
      preFilter: {
        b0: 1.53512485958697,
        b1: -2.69169618940638,
        b2: 1.19839281085285,
        a0: 1.0,
        a1: -1.69065929318241,
        a2: 0.73248077421585,
      },
      rlbHighPass: {
        b0: 1.0,
        b1: -2.0,
        b2: 1.0,
        a0: 1.0,
        a1: -1.99004745483398,
        a2: 0.99007225036621,
      },
    };
  }

  // Analytical bilinear transform for arbitrary sample rates (e.g. 24000 Hz, 44100 Hz)
  // Stage 1: High-shelf pre-filter (f0 = 1681.974450955533 Hz, G = +3.999843853973347 dB, Q = 0.7071752369554196)
  const db = 3.999843853973347;
  const f0Stage1 = 1681.974450955533;
  const QStage1 = 0.7071752369554196;
  const K1 = Math.tan((Math.PI * f0Stage1) / sampleRate);
  const Vh = Math.pow(10, db / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0_1 = 1.0 + K1 / QStage1 + K1 * K1;

  const preFilter: BiquadCoeffs = {
    b0: (Vh + (Vb * K1) / QStage1 + K1 * K1) / a0_1,
    b1: (2.0 * (K1 * K1 - Vh)) / a0_1,
    b2: (Vh - (Vb * K1) / QStage1 + K1 * K1) / a0_1,
    a0: 1.0,
    a1: (2.0 * (K1 * K1 - 1.0)) / a0_1,
    a2: (1.0 - K1 / QStage1 + K1 * K1) / a0_1,
  };

  // Stage 2: RLB High-pass filter (f0 = 38.13547087602444 Hz, Q = 0.5003270373238773)
  const f0Stage2 = 38.13547087602444;
  const QStage2 = 0.5003270373238773;
  const K2 = Math.tan((Math.PI * f0Stage2) / sampleRate);
  const a0_2 = 1.0 + K2 / QStage2 + K2 * K2;

  const rlbHighPass: BiquadCoeffs = {
    b0: 1.0 / a0_2,
    b1: -2.0 / a0_2,
    b2: 1.0 / a0_2,
    a0: 1.0,
    a1: (2.0 * (K2 * K2 - 1.0)) / a0_2,
    a2: (1.0 - K2 / QStage2 + K2 * K2) / a0_2,
  };

  return { preFilter, rlbHighPass };
}

/**
 * Precomputed 12-tap Hann-windowed sinc polyphase sub-sample FIR kernels
 * for 4x True Peak oversampling (ITU-R BS.1770-4 Annex 2) at phases t = 0.25, 0.50, 0.75.
 */
const POLYPHASE_TAPS = 12;
const POLYPHASE_HALF = POLYPHASE_TAPS / 2;
const POLYPHASE_PHASES = [0.25, 0.5, 0.75].map((phase) => {
  const coeffs = new Float64Array(POLYPHASE_TAPS);
  for (let k = 0; k < POLYPHASE_TAPS; k++) {
    const x = k - (POLYPHASE_HALF - 1) - phase;
    const sinc = Math.abs(x) < 1e-9 ? 1.0 : Math.sin(Math.PI * x) / (Math.PI * x);
    // Hann window over [-POLYPHASE_HALF, +POLYPHASE_HALF]
    const win = 0.5 * (1.0 + Math.cos((Math.PI * x) / POLYPHASE_HALF));
    coeffs[k] = sinc * win;
  }
  return coeffs;
});

/**
 * Computes 4x oversampled inter-sample True Peak (in linear amplitude and dBFS)
 * using a 12-tap windowed-sinc polyphase FIR filter per ITU-R BS.1770-4 Annex 2.
 */
export function measureTruePeak(samples: Float32Array): {
  samplePeakLinear: number;
  truePeakLinear: number;
  samplePeakDbfs: number;
  truePeakDbfs: number;
} {
  if (samples.length === 0) {
    return {
      samplePeakLinear: 0,
      truePeakLinear: 0,
      samplePeakDbfs: -100,
      truePeakDbfs: -100,
    };
  }

  let maxSamplePeak = 0;
  let maxTruePeak = 0;
  const n = samples.length;

  for (let i = 0; i < n; i++) {
    const absS = Math.abs(samples[i]);
    if (absS > maxSamplePeak) maxSamplePeak = absS;
    if (absS > maxTruePeak) maxTruePeak = absS;

    // Evaluate 3 sub-sample polyphase phases between sample i and i+1
    for (let p = 0; p < 3; p++) {
      const kernel = POLYPHASE_PHASES[p];
      let sum = 0.0;
      for (let k = 0; k < POLYPHASE_TAPS; k++) {
        const idx = i - (POLYPHASE_HALF - 1) + k;
        if (idx >= 0 && idx < n) {
          sum += samples[idx] * kernel[k];
        }
      }
      const absInterp = Math.abs(sum);
      if (absInterp > maxTruePeak) {
        maxTruePeak = absInterp;
      }
    }
  }

  const samplePeakDbfs =
    maxSamplePeak > 1e-9 ? 20 * Math.log10(maxSamplePeak) : -100;
  const truePeakDbfs = maxTruePeak > 1e-9 ? 20 * Math.log10(maxTruePeak) : -100;

  return {
    samplePeakLinear: maxSamplePeak,
    truePeakLinear: maxTruePeak,
    samplePeakDbfs,
    truePeakDbfs,
  };
}

/**
 * ITU-R BS.1770-4 Loudness & True Peak Analyzer.
 * Measures Momentary (400ms), Gated Integrated LUFS, RMS, and 4x True Peak dBFS.
 */
export class LoudnessMeter {
  private readonly sampleRate: number;
  private readonly preFilterCoeffs: BiquadCoeffs;
  private readonly rlbCoeffs: BiquadCoeffs;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    const { preFilter, rlbHighPass } = computeKWeightingCoeffs(sampleRate);
    this.preFilterCoeffs = preFilter;
    this.rlbCoeffs = rlbHighPass;
  }

  /**
   * Applies the two-stage ITU-R BS.1770-4 K-Weighting filter to a copy of the input signal.
   */
  public applyKWeighting(samples: Float32Array): Float32Array {
    const weighted = new Float32Array(samples);
    processBiquadFilterInPlace(weighted, this.preFilterCoeffs);
    processBiquadFilterInPlace(weighted, this.rlbCoeffs);
    return weighted;
  }

  /**
   * Analyzes a mono Float32Array buffer according to ITU-R BS.1770-4.
   * Formula: LUFS = -0.691 + 10 * log10(meanSquareEnergy)
   */
  public analyzeBuffer(
    samples: Float32Array,
    targetLufs = -16.0,
    truePeakCeilingDbfs = -1.0
  ): LoudnessMeasurement {
    if (samples.length === 0) {
      return {
        momentaryLufs: -70,
        integratedLufs: -70,
        samplePeakDbfs: -100,
        truePeakDbfs: -100,
        rmsDbfs: -100,
        isBroadcastSafe: true,
      };
    }

    // 1. Measure raw RMS and 4x True Peak
    let rawSumSq = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      rawSumSq += s * s;
    }
    const rawMeanSq = rawSumSq / samples.length;
    const rmsDbfs =
      rawMeanSq > 1e-12 ? 10 * Math.log10(rawMeanSq) : -100;

    const { samplePeakDbfs, truePeakDbfs } = measureTruePeak(samples);

    // 2. Apply two-stage K-weighting filter
    const kWeighted = this.applyKWeighting(samples);

    // 3. Momentary Loudness (last 400ms window or full buffer if shorter than 400ms)
    const windowSamples = Math.max(1, Math.round(this.sampleRate * 0.4));
    const momentaryStart = Math.max(0, kWeighted.length - windowSamples);
    let momSumSq = 0;
    const momCount = kWeighted.length - momentaryStart;
    for (let i = momentaryStart; i < kWeighted.length; i++) {
      const v = kWeighted[i] + ANTI_DENORMAL_OFFSET;
      momSumSq += v * v;
    }
    const momMeanSq = momSumSq / Math.max(1, momCount);
    const momentaryLufs =
      momMeanSq > 1e-12 ? -0.691 + 10 * Math.log10(momMeanSq) : -70;

    // 4. Gated Integrated Loudness (400ms blocks with 75% overlap / 100ms step)
    const stepSamples = Math.max(1, Math.round(this.sampleRate * 0.1));
    const blockEnergies: number[] = [];

    if (kWeighted.length <= windowSamples) {
      blockEnergies.push(momMeanSq);
    } else {
      for (
        let start = 0;
        start + windowSamples <= kWeighted.length;
        start += stepSamples
      ) {
        let sumSq = 0;
        for (let i = start; i < start + windowSamples; i++) {
          const v = kWeighted[i];
          sumSq += v * v;
        }
        blockEnergies.push(sumSq / windowSamples);
      }
    }

    // Absolute gate at Gamma_a = -70 LUFS
    const absGateBlocks = blockEnergies.filter((z) => {
      const lufs = z > 1e-12 ? -0.691 + 10 * Math.log10(z) : -100;
      return lufs > -70.0;
    });

    let integratedLufs = -70.0;
    if (absGateBlocks.length > 0) {
      const meanAboveAbs =
        absGateBlocks.reduce((acc, z) => acc + z, 0) / absGateBlocks.length;
      const relativeThresholdLufs =
        -0.691 + 10 * Math.log10(Math.max(1e-12, meanAboveAbs)) - 10.0;

      // Relative gate at -10 LU below ungated average
      const relGateBlocks = absGateBlocks.filter((z) => {
        const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, z));
        return lufs > relativeThresholdLufs;
      });

      const finalMeanSq =
        relGateBlocks.length > 0
          ? relGateBlocks.reduce((acc, z) => acc + z, 0) / relGateBlocks.length
          : meanAboveAbs;

      integratedLufs = -0.691 + 10 * Math.log10(Math.max(1e-12, finalMeanSq));
    }

    const isBroadcastSafe =
      truePeakDbfs <= truePeakCeilingDbfs + 0.1 &&
      Math.abs(integratedLufs - targetLufs) <= 3.0;

    return {
      momentaryLufs,
      integratedLufs,
      samplePeakDbfs,
      truePeakDbfs,
      rmsDbfs,
      isBroadcastSafe,
    };
  }
}
