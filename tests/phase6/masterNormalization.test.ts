import { describe, expect, it } from 'vitest';
import { normalizeBufferToLufs, renderMasterEpisodeMix, renderSpeakerStems } from '../../src/services/masterExportService';
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

  it('renders complete episode master mix into a valid WAV blob with progress callbacks', async () => {
    const project = createSampleProject();
    const progressList: number[] = [];

    const result = await renderMasterEpisodeMix(project, (pct) => {
      progressList.push(pct);
    });

    expect(result.wavBlob).toBeDefined();
    expect(result.wavBlob.size).toBeGreaterThan(44);
    expect(result.totalDurationSec).toBeGreaterThan(0);
    expect(result.filename).toContain('.wav');
    expect(progressList.length).toBeGreaterThan(0);
    expect(progressList[progressList.length - 1]).toBe(100);
  });

  it('renders time-aligned speaker stems with identical durations', async () => {
    const project = createSampleProject();
    const stems = await renderSpeakerStems(project);

    expect(stems.length).toBe(project.speakers.length);
    for (const stem of stems) {
      expect(stem.wavBlob.size).toBeGreaterThan(44);
      expect(stem.filename).toContain('_stem_');
      expect(Math.abs(stem.totalDurationSec - stems[0].totalDurationSec)).toBeLessThan(0.001);
    }
  });
});

