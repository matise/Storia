import { describe, expect, it } from 'vitest';
import {
  encodeMasterMp3Buffer,
  encodeMasterMp3Chunks,
  normalizeBufferToLufs,
  renderMasterEpisodeMix,
  renderSpeakerStems,
} from '../../src/services/masterExportService';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 6 — Step 6.2: Offline Episode Mastering & Stem Renderer', () => {
  it('normalizes an episode buffer to target LUFS with true peak limiting ceiling', () => {
    const sampleRate = 48000;
    const durationSec = 2.0;
    const buffer = new Float32Array(sampleRate * durationSec);

    // 1 kHz test sinusoid with initial peak at 0.5 (-6 dBFS)
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
    }

    const targetLufs = -16.0;
    const truePeakLimitDb = -1.0;
    const ceilingLin = Math.pow(10, truePeakLimitDb / 20); // ≈ 0.89125

    const result = normalizeBufferToLufs(buffer, sampleRate, targetLufs, truePeakLimitDb);

    // Verify resulting buffer never exceeds the true peak ceiling
    let maxAbs = 0;
    for (let i = 0; i < result.normalized.length; i++) {
      const absVal = Math.abs(result.normalized[i]);
      if (absVal > maxAbs) {
        maxAbs = absVal;
      }
    }

    expect(maxAbs).toBeLessThanOrEqual(ceilingLin + 0.001);
    expect(result.truePeakDbfs).toBeLessThanOrEqual(truePeakLimitDb + 0.1);
  });

  it('encodes mono audio buffer to 320 kbps MP3 using lamejs with valid MPEG frame headers', () => {
    const sampleRate = 48000;
    const durationSec = 1.0;
    const samples = new Float32Array(sampleRate * durationSec);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.4 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const chunks = encodeMasterMp3Chunks(samples, sampleRate, 320);
    expect(chunks.length).toBeGreaterThan(0);

    // Verify first chunk begins with valid MP3 frame sync (0xFF 0xFB)
    const firstChunk = chunks[0];
    expect(firstChunk[0]).toBe(0xff);
    expect(firstChunk[1] & 0xe0).toBe(0xe0); // 111 sync bits

    // Verify Blob creation
    const mp3Blob = encodeMasterMp3Buffer(samples, sampleRate, 320);
    expect(mp3Blob).toBeDefined();
    expect(mp3Blob.type).toBe('audio/mp3');
  });

  it('renders complete episode master mix into both WAV and 320 kbps MP3 blobs with progress callbacks', async () => {
    const project = createSampleProject();
    const progressList: number[] = [];

    const result = await renderMasterEpisodeMix(project, (pct) => {
      progressList.push(pct);
    });

    // WAV validation
    expect(result.wavBlob).toBeDefined();
    expect(result.wavBlob.size).toBeGreaterThan(44);
    expect(result.filename).toContain('.wav');

    // MP3 320 kbps validation
    expect(result.mp3Blob).toBeDefined();
    expect(result.mp3Blob.size).toBeGreaterThan(100);
    expect(result.mp3Blob.type).toBe('audio/mp3');
    expect(result.mp3Filename).toContain('320kbps.mp3');

    expect(result.totalDurationSec).toBeGreaterThan(0);
    expect(progressList.length).toBeGreaterThan(0);
    expect(progressList[progressList.length - 1]).toBe(100);
  });

  it('renders time-aligned speaker stems with both WAV and 320 kbps MP3 blobs', async () => {
    const project = createSampleProject();
    const stems = await renderSpeakerStems(project);

    expect(stems.length).toBe(project.speakers.length);
    for (const stem of stems) {
      expect(stem.wavBlob.size).toBeGreaterThan(44);
      expect(stem.filename).toContain('_stem_');
      expect(stem.filename).toContain('.wav');

      expect(stem.mp3Blob).toBeDefined();
      expect(stem.mp3Blob.size).toBeGreaterThan(100);
      expect(stem.mp3Filename).toContain('_stem_');
      expect(stem.mp3Filename).toContain('320kbps.mp3');

      expect(Math.abs(stem.totalDurationSec - stems[0].totalDurationSec)).toBeLessThan(0.001);
    }
  });
});

