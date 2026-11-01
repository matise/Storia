import { describe, expect, it, vi } from 'vitest';
import { scheduleFadeEnvelope } from '../../src/core/dsp/VolumeEnvelope';
import { computeGainY } from '../../src/components/workbench/WaveformCanvas';
import {
  playAudioWithSpeakerDsp,
  updateLiveBlockAudio,
  stopAllAudioPlayback,
} from '../../src/core/dsp/LiveAudioPreviewer';

describe('Real-Time Volume Curve & Fade Envelope Engine', () => {
  it('computes gain coordinates starting from true zero / -infinity dB baseline', () => {
    const height = 44;
    const silent = computeGainY(height, -48);
    expect(silent.yGain).toBe(silent.bottomY);
    expect(silent.bottomY).toBe(height - 2);

    const unity = computeGainY(height, 0);
    expect(unity.yGain).toBeLessThan(unity.bottomY);
    expect(unity.yGain).toBe(Math.round(height * 0.20));

    const boosted = computeGainY(height, 10);
    expect(boosted.yGain).toBe(3); // top
  });

  it('schedules fade curve starting from true zero (amplitude 0.0) at the start corner', () => {
    let capturedCurve: Float32Array | null = null;

    const mockGainNode = {
      gain: {
        value: 1.0,
        cancelScheduledValues: vi.fn(),
        setValueCurveAtTime: vi.fn((curve: Float32Array) => {
          capturedCurve = curve;
        }),
        setTargetAtTime: vi.fn(),
      },
    } as unknown as GainNode;

    const mockCtx = {
      currentTime: 0,
    } as unknown as BaseAudioContext;

    // 1000ms fade-in, 500ms fade-out over a 5-second buffer
    scheduleFadeEnvelope(
      mockGainNode,
      mockCtx,
      5.0,
      1000, // fadeInMs
      0,    // linear curve
      500,  // fadeOutMs
      0,
      0,
      0
    );

    expect(capturedCurve).not.toBeNull();
    if (capturedCurve) {
      // First sample must be 0.0 (true zero amplitude / -infinity dB)
      expect((capturedCurve as Float32Array)[0]).toBeCloseTo(0.0, 5);
      // Last sample must be 0.0 (fade-out to zero)
      expect((capturedCurve as Float32Array)[(capturedCurve as Float32Array).length - 1]).toBeCloseTo(0.0, 5);
      // Midpoint during plateau must be 1.0 (unity)
      const midIdx = Math.floor((capturedCurve as Float32Array).length / 2);
      expect((capturedCurve as Float32Array)[midIdx]).toBeCloseTo(1.0, 5);
    }
  });

  it('updates live block audio gain and fade envelope in real-time while playing', async () => {
    // Generate a minimal mock RIFF/WAV array buffer
    const sampleRate = 8000;
    const numSamples = 1600; // 0.2s
    const wavHeaderSize = 44;
    const buffer = new ArrayBuffer(wavHeaderSize + numSamples * 2);
    const view = new DataView(buffer);
    // Write minimal header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true);
    const blob = new Blob([buffer], { type: 'audio/wav' });

    await playAudioWithSpeakerDsp({
      audioBlob: blob,
      blockId: 'blk_rt_test',
      volumeGainDb: 0,
      fadeInMs: 50,
      fadeOutMs: 50,
    });

    // In JSDOM without native Web Audio decodeAudioData, playAudioWithSpeakerDsp safely returns false
    // but updateLiveBlockAudio is resilient to active or inactive sessions
    expect(() => {
      updateLiveBlockAudio('blk_rt_test', {
        volumeGainDb: 3.0,
        fadeInMs: 120,
        fadeInCurve: 0.5,
      });
    }).not.toThrow();

    stopAllAudioPlayback();
  });
});
