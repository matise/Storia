import { describe, expect, it } from 'vitest';
import {
  XorShift128Plus,
  encodeMasterWavBuffer,
  generateTpdfNoiseSample,
  quantizeSampleToInt16,
  quantizeSampleToInt24,
  resampleFloat32Buffer,
} from '../../src/core/dsp/TpdfDither';
import { AudioMasteringConfig } from '../../src/types/storia';

describe('Phase 6 — Step 6.1: TPDF Dither & Multi-Bit-Depth RIFF/WAV Encoder', () => {
  it('generates 50,000 TPDF dither samples with expected zero-mean and triangular variance', () => {
    const prng = new XorShift128Plus(0xdeadbeef);
    const numSamples = 50000;
    let sum = 0;
    let sumSq = 0;
    const delta16 = 1.0 / 32768.0;

    for (let i = 0; i < numSamples; i++) {
      const sample = generateTpdfNoiseSample(16, prng);
      // Normalized to LSB units
      const inLsb = sample / delta16;
      sum += inLsb;
      sumSq += inLsb * inLsb;
    }

    const mean = sum / numSamples;
    const variance = sumSq / numSamples - mean * mean;

    // Mean should be centered near 0 (< 0.05 LSB)
    expect(Math.abs(mean)).toBeLessThan(0.05);

    // Theoretical variance of triangular PDF (difference of two U(-0.5, 0.5)):
    // Var(X - Y) = Var(X) + Var(Y) = 1/12 + 1/12 = 1/6 ≈ 0.1667 LSB^2
    expect(variance).toBeGreaterThan(0.14);
    expect(variance).toBeLessThan(0.19);
  });

  it('quantizes samples to 16-bit and 24-bit with TPDF dither and boundary clamping', () => {
    const prng = new XorShift128Plus(0x42);

    // Clamping checks
    expect(quantizeSampleToInt16(1.5, true, prng)).toBe(32767);
    expect(quantizeSampleToInt16(-1.5, true, prng)).toBe(-32768);

    expect(quantizeSampleToInt24(1.5, true, prng)).toBe(8388607);
    expect(quantizeSampleToInt24(-1.5, true, prng)).toBe(-8388608);

    // Near-zero quiet tail quantization
    const quietTail = 0.0001;
    const q16 = quantizeSampleToInt16(quietTail, true, prng);
    expect(Number.isInteger(q16)).toBe(true);
    expect(Math.abs(q16)).toBeLessThan(10);
  });

  it('resamples float buffer accurately between sample rates', () => {
    // 100 samples at 48000 Hz resampled to 24000 Hz should yield 50 samples
    const input = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      input[i] = Math.sin((i / 100) * Math.PI * 2);
    }

    const resampled = resampleFloat32Buffer(input, 48000, 24000);
    expect(resampled.length).toBe(50);
    expect(Math.abs(resampled[0])).toBeLessThan(0.01);
  });

  it('encodes exact RIFF headers for 48kHz 16-bit, 48kHz 24-bit, and 44.1kHz 32-bit float', () => {
    const samples = new Float32Array(480); // 10ms of audio at 48kHz

    // 1. 48kHz, 16-bit PCM
    const config16: AudioMasteringConfig = {
      sampleRate: 48000,
      bitDepth: 16,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    };
    const ab16 = encodeMasterWavBuffer(samples, config16, 48000);
    const v16 = new DataView(ab16);

    // RIFF Chunk
    expect(String.fromCharCode(v16.getUint8(0), v16.getUint8(1), v16.getUint8(2), v16.getUint8(3))).toBe('RIFF');
    expect(String.fromCharCode(v16.getUint8(8), v16.getUint8(9), v16.getUint8(10), v16.getUint8(11))).toBe('WAVE');

    // Format chunk
    expect(v16.getUint16(20, true)).toBe(1); // WAVE_FORMAT_PCM
    expect(v16.getUint16(22, true)).toBe(1); // mono
    expect(v16.getUint32(24, true)).toBe(48000); // 48kHz
    expect(v16.getUint32(28, true)).toBe(96000); // 48000 * 2 = 96000 byteRate
    expect(v16.getUint16(32, true)).toBe(2); // blockAlign
    expect(v16.getUint16(34, true)).toBe(16); // 16-bit

    // Data chunk: 480 samples * 2 bytes = 960 bytes
    expect(v16.getUint32(40, true)).toBe(960);
    expect(ab16.byteLength).toBe(44 + 960);

    // 2. 48kHz, 24-bit PCM
    const config24: AudioMasteringConfig = {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    };
    const ab24 = encodeMasterWavBuffer(samples, config24, 48000);
    const v24 = new DataView(ab24);
    expect(v24.getUint16(20, true)).toBe(1);
    expect(v24.getUint32(28, true)).toBe(144000); // 48000 * 3 = 144000 byteRate
    expect(v24.getUint16(32, true)).toBe(3); // blockAlign
    expect(v24.getUint16(34, true)).toBe(24);
    expect(v24.getUint32(40, true)).toBe(480 * 3); // 1440 bytes
    expect(ab24.byteLength).toBe(44 + 1440);

    // 3. 44.1kHz, 32-bit Float
    const config32: AudioMasteringConfig = {
      sampleRate: 44100,
      bitDepth: 32,
      dither: 'none',
      targetLufs: -16.0,
      truePeakLimitDb: -1.0,
    };
    const ab32 = encodeMasterWavBuffer(samples, config32, 48000);
    const v32 = new DataView(ab32);
    expect(v32.getUint16(20, true)).toBe(3); // WAVE_FORMAT_IEEE_FLOAT
    expect(v32.getUint32(24, true)).toBe(44100);
    expect(v32.getUint16(32, true)).toBe(4); // 4 bytes blockAlign
    expect(v32.getUint16(34, true)).toBe(32);
  });
});

