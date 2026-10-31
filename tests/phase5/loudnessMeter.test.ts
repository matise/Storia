import { describe, it, expect } from 'vitest';
import {
  LoudnessMeter,
  measureTruePeak,
} from '../../src/core/dsp/LoudnessMeter';

describe('Phase 5 — ITU-R BS.1770-4 K-Weighted Loudness & 4x True Peak Meter', () => {
  it('measures a 997 Hz full-scale (0 dBFS) sine wave at -3.01 LUFS (+/- 0.1 LU) and a -16.0 LUFS calibrated sine wave within +/- 0.1 LU', () => {
    const sampleRate = 48000;
    const durationSec = 2.0;
    const numSamples = sampleRate * durationSec;
    const freq = 997.0; // ITU-R BS.1770-4 standard reference frequency

    // 1. Full-scale 0 dBFS peak sine wave -> theoretical -3.0103 LUFS
    const fullScaleSine = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      fullScaleSine[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const meter = new LoudnessMeter(sampleRate);
    const fsResult = meter.analyzeBuffer(fullScaleSine, -16.0, -1.0);

    expect(Math.abs(fsResult.integratedLufs - -3.01)).toBeLessThan(0.1);
    expect(Math.abs(fsResult.momentaryLufs - -3.01)).toBeLessThan(0.1);
    expect(fsResult.samplePeakDbfs).toBeCloseTo(0.0, 1);

    // 2. Attenuated sine wave calibrated for -16.0 LUFS (-12.99 dB below full-scale)
    const gainForMinus16 = Math.pow(10, (-16.0 - -3.0103) / 20);
    const broadcastSine = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      broadcastSine[i] =
        gainForMinus16 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const broadcastResult = meter.analyzeBuffer(broadcastSine, -16.0, -1.0);
    expect(Math.abs(broadcastResult.integratedLufs - -16.0)).toBeLessThan(0.1);
    expect(broadcastResult.isBroadcastSafe).toBe(true);
  });

  it('detects inter-sample overs using 4x oversampled Catmull-Rom True Peak metering', () => {
    // 12 kHz sinusoid sampled at 48 kHz with phase pi/4:
    // Discrete samples land at cos(pi/4) = 0.7071 (-3.01 dBFS), while true continuous peak is 1.0 (0 dBFS)
    const samples = new Float32Array(64);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.cos((2 * Math.PI * i) / 4 + Math.PI / 4);
    }

    const peaks = measureTruePeak(samples);
    expect(peaks.samplePeakLinear).toBeCloseTo(Math.SQRT1_2, 3);
    expect(peaks.truePeakLinear).toBeGreaterThan(0.95);
    expect(peaks.truePeakDbfs).toBeGreaterThan(peaks.samplePeakDbfs + 2.5);
  });
});

