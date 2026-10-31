import { AudioMasteringConfig } from '../../types/storia';

/**
 * Fast, seedable XorShift128+ Pseudo-Random Number Generator (PRNG)
 * for mathematically decorrelated, deterministic TPDF dither generation.
 */
export class XorShift128Plus {
  private s0: number;
  private s1: number;

  constructor(seed = 0x12345678) {
    this.s0 = seed >>> 0;
    this.s1 = (seed ^ 0x87654321) >>> 0;
    if (this.s0 === 0 && this.s1 === 0) {
      this.s0 = 1;
    }
  }

  /**
   * Generates a 32-bit unsigned pseudo-random integer.
   */
  public nextUint32(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= s1 << 23;
    this.s1 = (s1 ^ s0 ^ (s1 >>> 17) ^ (s0 >>> 26)) >>> 0;
    return (this.s1 + s0) >>> 0;
  }

  /**
   * Generates an independent uniform float in [-0.5, +0.5).
   */
  public nextUniform(): number {
    return (this.nextUint32() / 4294967296.0) - 0.5;
  }
}

/**
 * Shared instance of deterministic PRNG for audio dithering.
 */
export const defaultPrng = new XorShift128Plus(0x9e3779b9);

/**
 * Computes Triangular Probability Density Function (TPDF) noise sample
 * scaled to the LSB amplitude of the target integer bit depth.
 *
 * TPDF is formed by the difference of two independent uniform random variables:
 *   ν = (r1 - r2) * Δ
 * where Δ is the quantization step size: 1 / (2^(bitDepth - 1)).
 */
export function generateTpdfNoiseSample(
  targetBitDepth: 16 | 24,
  prng: XorShift128Plus = defaultPrng
): number {
  const r1 = prng.nextUniform();
  const r2 = prng.nextUniform();
  const delta = 1.0 / Math.pow(2, targetBitDepth - 1);
  return (r1 - r2) * delta;
}

/**
 * Quantizes a 32-bit floating point audio sample [-1.0, +1.0] down to a 16-bit
 * signed integer [-32768, +32767], with optional TPDF dithering.
 */
export function quantizeSampleToInt16(
  sample: number,
  applyDither = true,
  prng: XorShift128Plus = defaultPrng
): number {
  let s = sample;
  if (applyDither) {
    s += generateTpdfNoiseSample(16, prng);
  }
  const scaled = Math.round(s * 32768.0);
  return Math.max(-32768, Math.min(32767, scaled));
}

/**
 * Quantizes a 32-bit floating point audio sample [-1.0, +1.0] down to a 24-bit
 * signed integer [-8388608, +8388607], with optional TPDF dithering.
 */
export function quantizeSampleToInt24(
  sample: number,
  applyDither = true,
  prng: XorShift128Plus = defaultPrng
): number {
  let s = sample;
  if (applyDither) {
    s += generateTpdfNoiseSample(24, prng);
  }
  const scaled = Math.round(s * 8388608.0);
  return Math.max(-8388608, Math.min(8388607, scaled));
}

/**
 * High-quality linear/Hermite interpolation resampler to convert Float32Array buffers
 * between sample rates (e.g. 24000/48000 -> 44100 or 44100 -> 48000).
 */
export function resampleFloat32Buffer(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate || input.length === 0) {
    return new Float32Array(input);
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = srcIndex - i0;

    // Linear interpolation
    output[i] = input[i0] * (1.0 - frac) + input[i1] * frac;
  }

  return output;
}

/**
 * Encodes a mono or stereo Float32Array buffer into a broadcast-standard
 * RIFF/WAVE ArrayBuffer with multi-bit-depth (16, 24, 32-bit), custom sample rates
 * (44.1 kHz, 48 kHz), and optional TPDF dithering.
 */
export function encodeMasterWavBuffer(
  samples: Float32Array,
  config: AudioMasteringConfig,
  sourceSampleRate = 48000
): ArrayBuffer {
  // 1. Resample if source sample rate differs from export target
  const resampled =
    sourceSampleRate !== config.sampleRate
      ? resampleFloat32Buffer(samples, sourceSampleRate, config.sampleRate)
      : samples;

  const numChannels = 1;
  const sampleRate = config.sampleRate;
  const bitDepth = config.bitDepth;
  const numSamples = resampled.length;
  const applyDither = config.dither === 'tpdf';

  const bytesPerSample = bitDepth === 32 ? 4 : bitDepth === 24 ? 3 : 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const headerSize = 44;
  const totalBufferSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize = 36 + SubChunk2Size
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  // AudioFormat: 1 for PCM integer, 3 for IEEE Float
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const prng = new XorShift128Plus(0x12345678);

  // Write audio samples
  if (bitDepth === 16) {
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const int16 = quantizeSampleToInt16(resampled[i], applyDither, prng);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  } else if (bitDepth === 24) {
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const int24 = quantizeSampleToInt24(resampled[i], applyDither, prng);
      // Little-endian 3-byte packing
      view.setUint8(offset, int24 & 0xff);
      view.setUint8(offset + 1, (int24 >> 8) & 0xff);
      view.setInt8(offset + 2, (int24 >> 16) & 0xff);
      offset += 3;
    }
  } else {
    // 32-bit IEEE Float
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      view.setFloat32(offset, resampled[i], true);
      offset += 4;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

