import { ScriptBlock, Speaker } from '../../types/storia';

export const AUDIO_TOKENS_PER_SECOND = 25;
export const AUDIO_TOKEN_PRICE_PER_MILLION_USD = 10.0;
export const DEFAULT_TARGET_WPM = 140;

export interface BlockPacingResult {
  wordCount: number;
  spokenDurationSec: number;
  pauseDurationSec: number;
  estimatedDurationSec: number;
  audioTokenEstimate: number;
}

export interface TimelineSummaryResult {
  blocks: ScriptBlock[];
  totalDurationSec: number;
  totalAudioTokens: number;
  estimatedCostUsd: number;
  speakerStats: Record<
    string,
    {
      lineCount: number;
      durationSec: number;
      audioTokens: number;
    }
  >;
}

/**
 * Strips bracketed director notes ([...]) and inline XML/SSML tags (<...>)
 * so that non-spoken acting cues do not inflate the spoken word count.
 */
export function stripNonSpokenTokens(rawText: string): string {
  return rawText
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts explicit inline SSML <break time="..."/> durations in milliseconds.
 */
export function parseInlineSsmlBreakMs(rawText: string): number {
  let totalBreakMs = 0;
  const breakRegex = /<break\s+[^>]*time=["'](\d+(?:\.\d+)?)(ms|s)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = breakRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isNaN(val)) {
      totalBreakMs += unit === 's' ? val * 1000 : val;
    }
  }
  return totalBreakMs;
}

/**
 * Counts spoken words after stripping bracketed director notes and SSML tags.
 */
export function countSpokenWords(rawText: string): number {
  const cleaned = stripNonSpokenTokens(rawText);
  if (!cleaned) return 0;
  return cleaned.split(' ').filter(Boolean).length;
}

/**
 * Calculates estimated spoken duration (seconds) and Gemini TTS Audio Tokens (~25 tok/sec)
 * for a single ScriptBlock.
 */
export function calculateBlockPacing(
  block: Pick<
    ScriptBlock,
    'text' | 'type' | 'pauseAfterMs' | 'sfxDurationSec' | 'sfxCategory'
  >,
  speaker?: Speaker,
  targetWpm: number = DEFAULT_TARGET_WPM
): BlockPacingResult {
  const wordCount = countSpokenWords(block.text);
  const inlineBreakMs = parseInlineSsmlBreakMs(block.text);
  const trailingPauseMs = Math.max(0, block.pauseAfterMs ?? 0);
  const pauseDurationSec = (inlineBreakMs + trailingPauseMs) / 1000;

  if (block.type === 'direction') {
    // Pure stage directions are non-spoken unless pause is configured
    const estimatedDurationSec = Number(pauseDurationSec.toFixed(3));
    return {
      wordCount: 0,
      spokenDurationSec: 0,
      pauseDurationSec,
      estimatedDurationSec,
      audioTokenEstimate: Math.ceil(estimatedDurationSec * AUDIO_TOKENS_PER_SECOND),
    };
  }

  if (
    block.type === 'sound_effect' &&
    typeof block.sfxDurationSec === 'number' &&
    block.sfxDurationSec > 0
  ) {
    const sfxDur = Number(block.sfxDurationSec.toFixed(3));
    const estimatedDurationSec = Number((sfxDur + pauseDurationSec).toFixed(3));
    return {
      wordCount,
      spokenDurationSec: sfxDur,
      pauseDurationSec: Number(pauseDurationSec.toFixed(3)),
      estimatedDurationSec,
      audioTokenEstimate:
        block.sfxCategory === 'custom_upload'
          ? 0
          : Math.ceil(estimatedDurationSec * AUDIO_TOKENS_PER_SECOND),
    };
  }

  const speakingRate = Math.max(0.25, Math.min(4.0, speaker?.voice.speakingRate ?? 1.0));
  const effectiveWpm = Math.max(30, targetWpm) * speakingRate;

  const spokenDurationSec = wordCount > 0 ? (wordCount / effectiveWpm) * 60 : 0;
  const estimatedDurationSec = Number((spokenDurationSec + pauseDurationSec).toFixed(3));
  const audioTokenEstimate = Math.ceil(estimatedDurationSec * AUDIO_TOKENS_PER_SECOND);

  return {
    wordCount,
    spokenDurationSec: Number(spokenDurationSec.toFixed(3)),
    pauseDurationSec: Number(pauseDurationSec.toFixed(3)),
    estimatedDurationSec,
    audioTokenEstimate,
  };
}

/**
 * Recomputes contiguous [startTimeSec, endTimeSec], order, duration, and token estimates
 * across the entire ordered script sequence.
 */
export function recalculateProjectTimeline(
  blocks: ScriptBlock[],
  speakers: Speaker[],
  targetWpm: number = DEFAULT_TARGET_WPM
): TimelineSummaryResult {
  const speakerMap = new Map<string, Speaker>(speakers.map((s) => [s.id, s]));
  const speakerStats: Record<
    string,
    { lineCount: number; durationSec: number; audioTokens: number }
  > = {};

  for (const spk of speakers) {
    speakerStats[spk.id] = { lineCount: 0, durationSec: 0, audioTokens: 0 };
  }

  let cursorSec = 0;
  let totalAudioTokens = 0;

  const updatedBlocks: ScriptBlock[] = blocks.map((block, index) => {
    const speaker = block.speakerId ? speakerMap.get(block.speakerId) : undefined;
    const pacing = calculateBlockPacing(block, speaker, targetWpm);

    // If block has already rendered real audio or has extracted waveform peaks,
    // preserve its exact duration and token counts instead of overwriting with word count estimates!
    let renderedDurationSec: number | null = null;

    if (
      block.waveformPeaks &&
      typeof block.waveformPeaks === 'object' &&
      'length' in block.waveformPeaks &&
      'sampleRate' in block.waveformPeaks &&
      block.waveformPeaks.sampleRate > 0 &&
      block.waveformPeaks.length > 0
    ) {
      renderedDurationSec = Number(
        (block.waveformPeaks.length / block.waveformPeaks.sampleRate).toFixed(3)
      );
    } else if (
      (block.ttsStatus === 'ok' || Boolean(block.generatedAudioUrl)) &&
      typeof block.estimatedDurationSec === 'number' &&
      block.estimatedDurationSec > 0
    ) {
      renderedDurationSec = Number(block.estimatedDurationSec.toFixed(3));
    }

    const hasRenderedAudio = renderedDurationSec !== null && renderedDurationSec > 0;
    const effectiveDurationSec: number =
      hasRenderedAudio && renderedDurationSec !== null
        ? renderedDurationSec
        : pacing.estimatedDurationSec;

    const effectiveAudioTokens =
      hasRenderedAudio &&
      typeof block.audioTokenEstimate === 'number' &&
      block.audioTokenEstimate > 0
        ? block.audioTokenEstimate
        : pacing.audioTokenEstimate;

    const startTimeSec = Number(cursorSec.toFixed(3));
    const endTimeSec = Number((cursorSec + effectiveDurationSec).toFixed(3));
    cursorSec = endTimeSec;

    totalAudioTokens += effectiveAudioTokens;

    if (block.speakerId) {
      if (!speakerStats[block.speakerId]) {
        speakerStats[block.speakerId] = { lineCount: 0, durationSec: 0, audioTokens: 0 };
      }
      speakerStats[block.speakerId].lineCount += 1;
      speakerStats[block.speakerId].durationSec = Number(
        (speakerStats[block.speakerId].durationSec + effectiveDurationSec).toFixed(3)
      );
      speakerStats[block.speakerId].audioTokens += effectiveAudioTokens;
    }

    return {
      ...block,
      order: index,
      estimatedDurationSec: effectiveDurationSec,
      audioTokenEstimate: effectiveAudioTokens,
      startTimeSec,
      endTimeSec,
    };
  });

  const totalDurationSec = Number(cursorSec.toFixed(3));
  const estimatedCostUsd = Number(
    ((totalAudioTokens / 1_000_000) * AUDIO_TOKEN_PRICE_PER_MILLION_USD).toFixed(4)
  );

  return {
    blocks: updatedBlocks,
    totalDurationSec,
    totalAudioTokens,
    estimatedCostUsd,
    speakerStats,
  };
}

/**
 * Formats seconds into MM:SS.d or MM:SS studio readout
 */
export function formatDurationReadout(seconds: number, includeTenths = false): string {
  const safeSec = Math.max(0, seconds || 0);
  const mins = Math.floor(safeSec / 60);
  const remSec = safeSec - mins * 60;
  const mm = String(mins).padStart(2, '0');
  if (includeTenths) {
    const wholeSec = Math.floor(remSec);
    const tenths = Math.floor((remSec - wholeSec) * 10);
    return `${mm}:${String(wholeSec).padStart(2, '0')}.${tenths}`;
  }
  return `${mm}:${String(Math.floor(remSec)).padStart(2, '0')}`;
}

