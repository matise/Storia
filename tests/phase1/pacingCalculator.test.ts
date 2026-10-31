import { describe, expect, it } from 'vitest';
import {
  AUDIO_TOKENS_PER_SECOND,
  calculateBlockPacing,
  countSpokenWords,
  parseInlineSsmlBreakMs,
  recalculateProjectTimeline,
  stripNonSpokenTokens,
} from '../../src/core/pacing/pacingCalculator';
import { createSampleProject } from '../../src/i18n/sampleProject';
import { ScriptBlock, Speaker } from '../../src/types/storia';

describe('Phase 1 — Spoken Pacing & Audio Token Calculator', () => {
  const baseSpeaker: Speaker = {
    id: 'spk_test',
    name: 'Test Speaker',
    color: '#6366f1',
    gender: 'male',
    age: '40s',
    personaPrompt: 'Test persona',
    actingNotes: 'Test notes',
    voice: {
      baseVoice: 'Fenrir',
      stylePrompt: 'Calm',
      speakingRate: 1.0,
      pitchAdjustment: 0,
      enableDirectorNotes: true,
      ssmlEnabled: true,
      acoustics: {},
    },
    createdAt: 0,
  };

  it('calculates exact 60.0s duration and 1,500 audio tokens for 140 words at 140 WPM (1.0x rate)', () => {
    const words140 = Array.from({ length: 140 }, (_, i) => `word${i + 1}`).join(' ');
    const result = calculateBlockPacing(
      {
        text: words140,
        type: 'dialogue',
        pauseAfterMs: 0,
      },
      baseSpeaker,
      140
    );

    expect(result.wordCount).toBe(140);
    expect(result.spokenDurationSec).toBe(60);
    expect(result.estimatedDurationSec).toBe(60);
    expect(result.audioTokenEstimate).toBe(60 * AUDIO_TOKENS_PER_SECOND); // 1500
  });

  it('strips bracketed director notes ([...]) and SSML tags from spoken word count', () => {
    const raw =
      '[šapatom / whispered] Ugasi svjetlo. <mark name="w1"/> [kratak uzdah] Netko nas promatra.';
    expect(stripNonSpokenTokens(raw)).toBe('Ugasi svjetlo. Netko nas promatra.');
    expect(countSpokenWords(raw)).toBe(5);
  });

  it('parses inline SSML <break time="..."/> tags and adds them to pauseAfterMs', () => {
    const raw = 'Wait a moment. <break time="750ms"/> Now listen closely. <break time="1.25s"/>';
    expect(parseInlineSsmlBreakMs(raw)).toBe(2000);

    const pacing = calculateBlockPacing(
      {
        text: raw,
        type: 'dialogue',
        pauseAfterMs: 500,
      },
      baseSpeaker,
      140
    );

    expect(pacing.pauseDurationSec).toBe(2.5);
  });

  it('scales spoken duration inversely with speaker speakingRate while keeping pause duration exact', () => {
    const fastSpeaker: Speaker = {
      ...baseSpeaker,
      voice: { ...baseSpeaker.voice, speakingRate: 2.0 },
    };
    const words140 = Array.from({ length: 140 }, () => 'riječ').join(' ');
    const result = calculateBlockPacing(
      {
        text: words140,
        type: 'dialogue',
        pauseAfterMs: 1000,
      },
      fastSpeaker,
      140
    );

    expect(result.spokenDurationSec).toBe(30);
    expect(result.pauseDurationSec).toBe(1);
    expect(result.estimatedDurationSec).toBe(31);
    expect(result.audioTokenEstimate).toBe(31 * 25);
  });

  it('recalculateProjectTimeline produces strictly contiguous [startTimeSec, endTimeSec] intervals', () => {
    const project = createSampleProject();
    const summary = recalculateProjectTimeline(project.blocks, project.speakers, 140);

    expect(summary.blocks.length).toBeGreaterThan(0);
    let expectedStart = 0;

    for (let i = 0; i < summary.blocks.length; i++) {
      const blk: ScriptBlock = summary.blocks[i];
      expect(blk.order).toBe(i);
      expect(blk.startTimeSec).toBeCloseTo(expectedStart, 3);
      expect(blk.endTimeSec).toBeCloseTo(
        expectedStart + (blk.estimatedDurationSec ?? 0),
        3
      );
      expectedStart = blk.endTimeSec ?? expectedStart;
    }

    expect(summary.totalDurationSec).toBeCloseTo(expectedStart, 3);
    expect(summary.totalAudioTokens).toBeGreaterThan(0);
  });
});

