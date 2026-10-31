import { describe, expect, it } from 'vitest';
import {
  encodePcm16ToWavBlob,
  encodePcm16ToWavBytes,
  extractWaveformPeaksFromPcm,
  synthesizeGeminiAudioWithPeaks,
} from '../../src/services/geminiTtsService';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 2 — Structure-of-Arrays (SoA) Peak Extraction & RIFF/WAV Framing', () => {
  it('extracts accurate minPeaks, maxPeaks, and rmsLevels (~0.7071) from a 48kHz full-scale sine wave', () => {
    const sampleRate = 48000;
    const peaksPerSecond = 100;
    const freqHz = 1000;
    const pcm = new Int16Array(sampleRate); // 1.0 second = 48,000 samples

    for (let i = 0; i < sampleRate; i++) {
      const val = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
      pcm[i] = Math.round(val * 32767);
    }

    const peaks = extractWaveformPeaksFromPcm(pcm, sampleRate, peaksPerSecond);

    expect(peaks.sampleRate).toBe(100);
    expect(peaks.length).toBe(100);
    expect(peaks.minPeaks).toBeInstanceOf(Float32Array);
    expect(peaks.maxPeaks).toBeInstanceOf(Float32Array);
    expect(peaks.rmsLevels).toBeInstanceOf(Float32Array);

    // Every 10ms slice (480 samples) contains 10 full cycles of 1kHz sine
    for (let p = 0; p < peaks.length; p++) {
      expect(peaks.maxPeaks[p]).toBeCloseTo(1.0, 2);
      expect(peaks.minPeaks[p]).toBeCloseTo(-1.0, 2);
      expect(peaks.rmsLevels[p]).toBeCloseTo(Math.SQRT1_2, 2); // 0.7071
    }
  });

  it('encodes raw LINEAR16 PCM bytes with a valid 44-byte RIFF/WAVE header', () => {
    const rawSamples = new Int16Array(480); // 10ms at 48kHz = 960 bytes
    const pcmBytes = new Uint8Array(rawSamples.buffer);
    const wavBytes = encodePcm16ToWavBytes(pcmBytes, 48000, 1);
    const wavBlob = encodePcm16ToWavBlob(pcmBytes, 48000, 1);

    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(44 + 960);
    expect(wavBytes.byteLength).toBe(44 + 960);

    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
    const ascii = (offset: number, len: number) =>
      String.fromCharCode(...wavBytes.subarray(offset, offset + len));

    expect(ascii(0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 960);
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // Mono
    expect(view.getUint32(24, true)).toBe(48000); // Sample rate
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(960);
  });

  it('synthesizes audio, word timepoints, and SoA peaks via procedural studio synth fallback', async () => {
    const project = createSampleProject();
    const block = project.blocks[0];
    const marko = project.speakers[0];

    const res = await synthesizeGeminiAudioWithPeaks({
      block,
      speaker: marko,
      language: 'hr',
      forceProcedural: true,
    });

    expect(res.usedProceduralFallback).toBe(true);
    expect(res.audioBlob.size).toBeGreaterThan(44);
    expect(res.durationSec).toBeGreaterThan(0.5);
    expect(res.tokensUsed).toBe(Math.ceil(res.durationSec * 25));
    expect(res.waveformPeaks.length).toBeGreaterThan(10);
    expect(res.timepoints.length).toBeGreaterThanOrEqual(3);
    expect(res.timepoints[0].markName).toBe(`start_${block.id}`);
  });
});
