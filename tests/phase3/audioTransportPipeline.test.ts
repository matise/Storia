import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  studioTransportEngine,
  LiveMeterSnapshot,
} from '../../src/core/dsp/StudioTransportEngine';
import { LoudnessMeter } from '../../src/core/dsp/LoudnessMeter';
import { stopAllAudioPlayback, speakWithBrowserTts } from '../../src/core/dsp/LiveAudioPreviewer';
import { Project, ScriptBlock, Speaker } from '../../src/types/storia';

describe('Audio Transport & DSP Meter Pipeline Integration', () => {
  let speakMock: ReturnType<typeof vi.fn>;
  let cancelMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stopAllAudioPlayback();
    speakMock = vi.fn();
    cancelMock = vi.fn();
    const mockUtterance = vi.fn();
    (globalThis as unknown as { SpeechSynthesisUtterance: typeof mockUtterance }).SpeechSynthesisUtterance =
      mockUtterance;
    if (typeof window !== 'undefined') {
      (window as unknown as { SpeechSynthesisUtterance: typeof mockUtterance }).SpeechSynthesisUtterance =
        mockUtterance;
      (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: () => [],
      };
    }
  });

  it('resumes Web Audio context on user gesture without throwing', async () => {
    await expect(studioTransportEngine.resume()).resolves.toBeUndefined();
  });

  it('measures momentary LUFS accurately without collapsing to -70 LUFS on trailing silence pauses', () => {
    const sampleRate = 48000;
    const meter = new LoudnessMeter(sampleRate);

    // Create 1.0s of active 997Hz tone followed by 0.5s of pure silence (trailing pause)
    const activeLength = sampleRate * 1.0;
    const silenceLength = sampleRate * 0.5;
    const buffer = new Float32Array(activeLength + silenceLength);

    for (let i = 0; i < activeLength; i++) {
      buffer[i] = 0.5 * Math.sin((2 * Math.PI * 997 * i) / sampleRate);
    }
    // remaining silenceLength is 0.0

    const measurement = meter.analyzeBuffer(buffer, -16.0, -1.0);

    // Momentary loudness must reflect the active 1.0s tone, NOT the trailing 0.5s pause
    expect(measurement.momentaryLufs).toBeGreaterThan(-20.0);
    expect(measurement.momentaryLufs).toBeLessThan(-5.0);
    expect(measurement.integratedLufs).toBeGreaterThan(-20.0);
  });

  it('emits idle meter snapshot when studio transport stops', () => {
    const snapshots: LiveMeterSnapshot[] = [];
    const unsubscribe = studioTransportEngine.subscribeMeter((s) => {
      snapshots.push(s);
    });

    studioTransportEngine.emitSnapshot({
      momentaryLufs: -14.2,
      integratedLufs: -16.0,
      truePeakDbfs: -1.5,
      rmsDbfs: -16.8,
      isBroadcastSafe: true,
      activeSpeakerId: 'spk_1',
      activeBlockId: 'blk_1',
    });

    expect(studioTransportEngine.getLatestSnapshot().momentaryLufs).toBe(-14.2);

    studioTransportEngine.stop();

    const latest = studioTransportEngine.getLatestSnapshot();
    expect(latest.momentaryLufs).toBe(-70.0);
    expect(latest.truePeakDbfs).toBe(-100);
    expect(latest.activeBlockId).toBeNull();

    unsubscribe();
  });

  it('bridges single-block auditions to studioTransportEngine subscribers', () => {
    const mockSpeaker: Speaker = {
      id: 'spk_test',
      name: 'Test Voice',
      color: '#6366f1',
      gender: 'female',
      age: '30s',
      personaPrompt: 'Helpful narrator',
      actingNotes: 'Clear diction',
      createdAt: Date.now(),
      voice: {
        baseVoice: 'Puck',
        stylePrompt: 'Natural',
        speakingRate: 1.0,
        pitchAdjustment: 0,
        enableDirectorNotes: true,
        ssmlEnabled: true,
        acoustics: {
          biquadEq: {
            enabled: true,
            lowShelfGainDb: 0,
            midPeakGainDb: 0,
            highShelfGainDb: 0,
          },
          compression: {
            enabled: true,
            thresholdDb: -20,
            ratio: 2.5,
            attackMs: 15,
            releaseMs: 100,
          },
        },
      },
    };

    const snapshots: LiveMeterSnapshot[] = [];
    const unsubscribe = studioTransportEngine.subscribeMeter((s) => {
      snapshots.push(s);
    });

    const mockUtterance = vi.fn();
    (globalThis as unknown as { SpeechSynthesisUtterance: typeof mockUtterance }).SpeechSynthesisUtterance =
      mockUtterance;

    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [],
    };

    speakWithBrowserTts({
      text: 'Testing audio pipeline transport meter',
      speaker: mockSpeaker,
      language: 'en',
    });

    expect(speakMock).toHaveBeenCalled();

    // Stopping playback resets engine and meter
    stopAllAudioPlayback();
    expect(studioTransportEngine.getLatestSnapshot().momentaryLufs).toBe(-70.0);

    unsubscribe();
  });

  it('triggers speech output during Play All timeline playback when blocks use browser TTS', async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [],
    };

    const mockProject = {
      id: 'proj_test',
      title: 'Test',
      defaultLanguage: 'hr' as const,
      audioConfig: { sampleRate: 48000, bitDepth: 24, targetLufs: -16 },
      speakers: [
        {
          id: 'spk_mara',
          name: 'Mara',
          color: '#ec4899',
          gender: 'female' as const,
          age: '30s',
          personaPrompt: '',
          actingNotes: '',
          createdAt: Date.now(),
          voice: {
            baseVoice: 'Puck' as const,
            stylePrompt: '',
            speakingRate: 1.0,
            pitchAdjustment: 0,
            enableDirectorNotes: true,
            ssmlEnabled: true,
            acoustics: {
              biquadEq: { enabled: true, lowShelfGainDb: 0, midPeakGainDb: 0, highShelfGainDb: 0 },
              compression: { enabled: true, thresholdDb: -20, ratio: 2.5, attackMs: 15, releaseMs: 100 },
            },
          },
        },
      ],
      blocks: [],
    };

    const mockBlock = {
      id: 'blk_mara_1',
      order: 0,
      speakerId: 'spk_mara',
      type: 'dialogue' as const,
      text: 'Foxy! Daj nam što masno, gosparu Fox!',
      estimatedDurationSec: 4.5,
      pauseAfterMs: 500,
    };

    await studioTransportEngine.triggerBlockOnTimeline(
      mockBlock as unknown as ScriptBlock,
      mockProject as unknown as Project,
      0
    );

    // Verifies that Play All speaks the dialogue block aloud
    expect(speakMock).toHaveBeenCalled();
  });
});
