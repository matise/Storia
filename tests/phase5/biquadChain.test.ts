import { describe, it, expect } from 'vitest';
import {
  computeHighShelfCoeffs,
  computeLowShelfCoeffs,
  computePeakingCoeffs,
  evaluateBiquadMagnitudeAtFreq,
  processBiquadFilterInPlace,
  processSpeakerDspBuffer,
} from '../../src/core/dsp/BiquadChain';
import { Speaker } from '../../src/types/storia';

describe('Phase 5 — RBJ Biquad Filter Math & Speaker DSP Chain', () => {
  it('produces exact unity passthrough coefficients at 0 dB gain across all 3 bands', () => {
    const low0 = computeLowShelfCoeffs(120, 0, 48000);
    const mid0 = computePeakingCoeffs(2500, 0, 1.0, 48000);
    const high0 = computeHighShelfCoeffs(8000, 0, 48000);

    for (const c of [low0, mid0, high0]) {
      expect(c.b0).toBe(1);
      expect(c.b1).toBe(0);
      expect(c.b2).toBe(0);
      expect(c.a0).toBe(1);
      expect(c.a1).toBe(0);
      expect(c.a2).toBe(0);
    }
  });

  it('amplifies a 2.5 kHz test sinusoid by +6.0 dB (~1.995x) while keeping DC and Nyquist at unity', () => {
    const sampleRate = 48000;
    const coeffs = computePeakingCoeffs(2500, 6.0, 1.0, sampleRate);

    // 1. Analytical Z-plane transfer function magnitude check
    const magCenter = evaluateBiquadMagnitudeAtFreq(coeffs, 2500, sampleRate);
    const magDc = evaluateBiquadMagnitudeAtFreq(coeffs, 0, sampleRate);
    const magNyquist = evaluateBiquadMagnitudeAtFreq(coeffs, sampleRate / 2, sampleRate);

    const expectedLinearGain = Math.pow(10, 6.0 / 20); // ~1.99526
    expect(magCenter).toBeCloseTo(expectedLinearGain, 3);
    expect(magDc).toBeCloseTo(1.0, 5);
    expect(magNyquist).toBeCloseTo(1.0, 5);

    // 2. Time-domain steady-state sinusoid amplification verification
    const numSamples = 4800; // 100ms at 48kHz
    const signal = new Float32Array(numSamples);
    const amplitude = 0.25;
    for (let i = 0; i < numSamples; i++) {
      signal[i] = amplitude * Math.sin((2 * Math.PI * 2500 * i) / sampleRate);
    }

    processBiquadFilterInPlace(signal, coeffs);

    // Measure peak in the second half (after filter transient settles)
    let steadyPeak = 0;
    for (let i = Math.floor(numSamples / 2); i < numSamples; i++) {
      const absVal = Math.abs(signal[i]);
      if (absVal > steadyPeak) steadyPeak = absVal;
    }

    const measuredGainDb = 20 * Math.log10(steadyPeak / amplitude);
    expect(measuredGainDb).toBeCloseTo(6.0, 1);
  });

  it('shapes Low-Shelf (120Hz), Mid-Peak (2.5kHz), High-Shelf (8kHz), and compresses loud peaks in processSpeakerDspBuffer', () => {
    const lowShelfPlus6 = computeLowShelfCoeffs(120, 6.0, 48000);
    expect(evaluateBiquadMagnitudeAtFreq(lowShelfPlus6, 20, 48000)).toBeGreaterThan(1.9);

    const highShelfMinus6 = computeHighShelfCoeffs(8000, -6.0, 48000);
    expect(evaluateBiquadMagnitudeAtFreq(highShelfMinus6, 18000, 48000)).toBeLessThan(0.55);

    const testSpeaker: Speaker = {
      id: 'spk_test',
      name: 'Test Voice',
      color: '#6366f1',
      gender: 'male',
      age: '35',
      personaPrompt: 'Detective',
      actingNotes: 'Warm baritone',
      createdAt: Date.now(),
      voice: {
        baseVoice: 'Orus',
        speakingRate: 1.0,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        stylePrompt: 'Warm baritone',
        acoustics: {
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 0,
            midPeakGainDb: 0,
            highShelfGainDb: 0,
          },
          compression: {
            enabled: true,
            thresholdDb: -18,
            ratio: 4.0,
            attackMs: 5,
            releaseMs: 50,
          },
        },
      },
    };

    const loudTone = new Float32Array(4800);
    for (let i = 0; i < loudTone.length; i++) {
      loudTone[i] = 0.85 * Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const compressed = processSpeakerDspBuffer(loudTone, testSpeaker, 48000);
    let tailPeak = 0;
    for (let i = 2400; i < compressed.length; i++) {
      tailPeak = Math.max(tailPeak, Math.abs(compressed[i]));
    }

    // Compressor with threshold -18dB and ratio 4:1 must attenuate a 0.85 (-1.4 dBFS) signal
    expect(tailPeak).toBeLessThan(0.6);
  });
});
