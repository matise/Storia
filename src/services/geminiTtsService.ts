import {
  GeminiTtsModelId,
  ScriptBlock,
  ScriptTimepoint,
  Speaker,
  SupportedLanguage,
  TtsEngineProvider,
  WaveformPeakData,
} from '../types/storia';
import {
  AUDIO_TOKENS_PER_SECOND,
  calculateBlockPacing,
  stripNonSpokenTokens,
} from '../core/pacing/pacingCalculator';
import { speakWithBrowserTts } from '../core/dsp/LiveAudioPreviewer';
import {
  containsCroatianCharacters,
  localizeDirectorCueForLanguage,
  normalizeCroatianUnicode,
  prepareTextForTts,
} from '../core/tts/croatianTextNormalizer';

export const DEFAULT_TTS_SAMPLE_RATE = 48000;
export const GEMINI_NATIVE_TTS_SAMPLE_RATE = 24000;
export const DEFAULT_PEAKS_PER_SECOND = 100;

export interface SynthesisPipelineResult {
  audioBlob: Blob;
  timepoints: ScriptTimepoint[];
  tokensUsed: number;
  waveformPeaks: WaveformPeakData;
  durationSec: number;
  providerUsed: TtsEngineProvider;
  usedProceduralFallback: boolean;
}

/**
 * Extracts both block-level directorNotes and any inline bracketed [...] cues
 * from the block text so they can be fed as invisible style vectors.
 */
export function extractDirectorNotes(block: Pick<ScriptBlock, 'text' | 'directorNotes'>): string[] {
  const cues: string[] = [];
  if (block.directorNotes && block.directorNotes.trim()) {
    cues.push(block.directorNotes.trim().replace(/^\[|\]$/g, '').trim());
  }

  const inlineRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(block.text)) !== null) {
    const inner = match[1].trim();
    if (inner && !cues.includes(inner)) {
      cues.push(inner);
    }
  }
  return cues;
}

/**
 * Constructs the system-level acoustic directive combining:
 * 1. Target Language ('Croatian' | 'English')
 * 2. Speaker identity, age, gender, LLM personaPrompt & human actingNotes
 * 3. Cross-modal vocal stylePrompt
 * 4. Multi-speaker conversational handoff context from preceding lines
 * 5. Immediate bracketed director's notes (didaskalije)
 */
export function buildAcousticDirective({
  block,
  speaker,
  language,
  precedingBlocks = [],
  allSpeakers = [],
}: {
  block: ScriptBlock;
  speaker?: Speaker;
  language: SupportedLanguage;
  precedingBlocks?: ScriptBlock[];
  allSpeakers?: Speaker[];
}): string {
  const cues = extractDirectorNotes(block);
  const langName = language === 'hr' ? 'Croatian (hr-HR)' : 'English (en-US)';

  const parts: string[] = [`Language: ${langName}.`];

  if (speaker) {
    parts.push(
      `Character: ${speaker.name}, Age: ${speaker.age}, Gender: ${speaker.gender}.`,
      `Persona: ${speaker.personaPrompt}.`,
      `Acting style: ${speaker.actingNotes}.`,
      `Line emotional tone: ${speaker.voice.stylePrompt}.`
    );
  } else {
    parts.push(`Block type: ${block.type}. Deliver with clear studio narration dynamics.`);
  }

  if (cues.length > 0 && (speaker?.voice.enableDirectorNotes ?? true)) {
    parts.push(`Immediate direction: [${cues.join('; ')}].`);
  }

  // Multi-speaker conversational handoff context (last 1-2 lines)
  const recentDialogue = precedingBlocks.slice(-2).filter((b) => b.text.trim().length > 0);
  if (recentDialogue.length > 0) {
    const speakerMap = new Map(allSpeakers.map((s) => [s.id, s.name]));
    const contextLines = recentDialogue
      .map((b) => {
        const spkName = (b.speakerId && speakerMap.get(b.speakerId)) || b.type.toUpperCase();
        const cleanText = stripNonSpokenTokens(b.text);
        return `${spkName}: "${cleanText}"`;
      })
      .join(' | ');
    parts.push(`Conversational handoff context (match prosodic continuity): ${contextLines}`);
  }

  return parts.filter(Boolean).join(' ');
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generates SSML payload with:
 * - <prosody rate="..." pitch="...st">
 * - Optional invisible director note prefix
 * - <mark name="start_{block.id}"/> and <mark name="end_{block.id}"/>
 * - Word-level <mark name="blk_{block.id}_w_{idx}"/> markers for timeline sync
 * - Trailing <break time="{pauseAfterMs}ms"/>
 */
export function buildSsmlPayload(block: ScriptBlock, speaker?: Speaker): string {
  const rate = speaker?.voice.speakingRate ?? 1.0;
  const pitch = speaker?.voice.pitchAdjustment ?? 0;
  const pitchStr = `${pitch >= 0 ? '+' : ''}${pitch}st`;
  const cues = extractDirectorNotes(block);
  const includeDirectorCue =
    cues.length > 0 && (speaker?.voice.enableDirectorNotes ?? true);

  const cleanSpoken = normalizeCroatianUnicode(stripNonSpokenTokens(block.text));
  const words = cleanSpoken ? cleanSpoken.split(/\s+/).filter(Boolean) : [];

  const markedWords = words
    .map((word, idx) => `<mark name="blk_${block.id}_w_${idx}"/>${escapeXmlText(word)}`)
    .join(' ');

  const pauseTag =
    block.pauseAfterMs && block.pauseAfterMs > 0
      ? `<break time="${Math.round(block.pauseAfterMs)}ms"/>`
      : '';

  const directorPrefix = includeDirectorCue
    ? `(${escapeXmlText(cues.join(', '))}) `
    : '';

  return [
    '<speak>',
    `  <prosody rate="${rate}" pitch="${pitchStr}">`,
    `    ${directorPrefix}<mark name="start_${block.id}"/>`,
    `    ${markedWords}`,
    `    <mark name="end_${block.id}"/>`,
    pauseTag ? `    ${pauseTag}` : '',
    '  </prosody>',
    '</speak>',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Downsamples 16-bit PCM audio samples into Structure-of-Arrays (SoA)
 * Float32Array peak buffers (minPeaks, maxPeaks, rmsLevels) for zero-allocation Canvas 2D rendering.
 */
export function extractWaveformPeaksFromPcm(
  int16Samples: Int16Array,
  sampleRate: number = DEFAULT_TTS_SAMPLE_RATE,
  peaksPerSecond: number = DEFAULT_PEAKS_PER_SECOND
): WaveformPeakData {
  const totalSamples = int16Samples.length;
  const blockSize = Math.max(1, Math.floor(sampleRate / peaksPerSecond));
  const peakCount = Math.max(1, Math.floor(totalSamples / blockSize));

  const minPeaks = new Float32Array(peakCount);
  const maxPeaks = new Float32Array(peakCount);
  const rmsLevels = new Float32Array(peakCount);

  if (totalSamples === 0) {
    return {
      sampleRate: peaksPerSecond,
      length: 0,
      minPeaks: new Float32Array(0),
      maxPeaks: new Float32Array(0),
      rmsLevels: new Float32Array(0),
    };
  }

  for (let p = 0; p < peakCount; p++) {
    let min = 1.0;
    let max = -1.0;
    let sumSq = 0;
    const start = p * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    const count = Math.max(1, end - start);

    for (let s = start; s < end; s++) {
      const val = Math.max(-1.0, Math.min(1.0, int16Samples[s] / 32768.0));
      if (val < min) min = val;
      if (val > max) max = val;
      sumSq += val * val;
    }

    minPeaks[p] = min > 0 ? 0 : min;
    maxPeaks[p] = max < 0 ? 0 : max;
    rmsLevels[p] = Math.sqrt(sumSq / count);
  }

  return {
    sampleRate: peaksPerSecond,
    length: peakCount,
    minPeaks,
    maxPeaks,
    rmsLevels,
  };
}

/**
 * Wraps raw 16-bit signed little-endian PCM bytes in a standard 44-byte RIFF/WAVE header
 * and returns the complete WAV byte buffer.
 */
export function encodePcm16ToWavBytes(
  pcmBytes: Uint8Array,
  sampleRate: number = DEFAULT_TTS_SAMPLE_RATE,
  numChannels: number = 1
): Uint8Array {
  if (
    pcmBytes.byteLength >= 44 &&
    pcmBytes[0] === 0x52 && // 'R'
    pcmBytes[1] === 0x49 && // 'I'
    pcmBytes[2] === 0x46 && // 'F'
    pcmBytes[3] === 0x46 // 'F'
  ) {
    return pcmBytes;
  }

  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // WAVE_FORMAT_PCM = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

/**
 * Wraps raw 16-bit signed little-endian PCM bytes in a standard 44-byte RIFF/WAVE Blob.
 */
export function encodePcm16ToWavBlob(
  pcmBytes: Uint8Array,
  sampleRate: number = DEFAULT_TTS_SAMPLE_RATE,
  numChannels: number = 1
): Blob {
  const wavBytes = encodePcm16ToWavBytes(pcmBytes, sampleRate, numChannels);
  return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
}

/**
 * Computes word-level SSML timepoints distributed proportionally across a known spoken duration.
 */
export function buildWordTimepointsForDuration(
  block: ScriptBlock,
  spokenDurationSec: number
): ScriptTimepoint[] {
  const cleanSpoken = normalizeCroatianUnicode(stripNonSpokenTokens(block.text));
  const words = cleanSpoken ? cleanSpoken.split(/\s+/).filter(Boolean) : [];
  const wordCount = Math.max(1, words.length);
  const wordDur = spokenDurationSec / wordCount;

  const timepoints: ScriptTimepoint[] = [
    { markName: `start_${block.id}`, timeSeconds: 0 },
  ];

  for (let w = 0; w < words.length; w++) {
    timepoints.push({
      markName: `blk_${block.id}_w_${w}`,
      timeSeconds: Number((w * wordDur).toFixed(3)),
    });
  }

  timepoints.push({
    markName: `end_${block.id}`,
    timeSeconds: Number(spokenDurationSec.toFixed(3)),
  });

  return timepoints;
}

/**
 * Generates an acoustic speech-cadence PCM buffer & timepoint envelope for Local Browser TTS
 * timeline representation and headless test environments.
 */
export function synthesizeProceduralSpeechPcm({
  block,
  speaker,
  sampleRate = DEFAULT_TTS_SAMPLE_RATE,
  targetWpm = 140,
}: {
  block: ScriptBlock;
  speaker?: Speaker;
  sampleRate?: number;
  targetWpm?: number;
}): {
  pcmInt16: Int16Array;
  pcmBytes: Uint8Array;
  timepoints: ScriptTimepoint[];
  durationSec: number;
} {
  const pacing = calculateBlockPacing(block, speaker, targetWpm);
  const spokenDurationSec = Math.max(0.35, pacing.spokenDurationSec || 0.6);
  const pauseDurationSec = pacing.pauseDurationSec;
  const totalDurationSec = Number((spokenDurationSec + pauseDurationSec).toFixed(3));

  const totalSamples = Math.max(480, Math.floor(totalDurationSec * sampleRate));
  const spokenSamples = Math.min(totalSamples, Math.floor(spokenDurationSec * sampleRate));
  const pcmInt16 = new Int16Array(totalSamples);

  const baseF0 =
    speaker?.gender === 'female' ? 210 : speaker?.gender === 'male' ? 115 : 160;
  const pitchSemitones = speaker?.voice.pitchAdjustment ?? 0;
  const f0 = baseF0 * Math.pow(2, pitchSemitones / 12);

  const cleanSpoken = normalizeCroatianUnicode(stripNonSpokenTokens(block.text));
  const words = cleanSpoken ? cleanSpoken.split(/\s+/).filter(Boolean) : [];
  const wordCount = Math.max(1, words.length);
  const wordDurationSec = spokenDurationSec / wordCount;
  const timepoints = buildWordTimepointsForDuration(block, spokenDurationSec);

  const cues = extractDirectorNotes(block).join(' ').toLowerCase();
  const isWhispered = cues.includes('šapat') || cues.includes('whisper');

  let phase1 = 0;
  let phase2 = 0;
  let phase3 = 0;
  let prngState = 0x12345678 ^ block.id.charCodeAt(0);

  for (let s = 0; s < spokenSamples; s++) {
    const tSec = s / sampleRate;
    const wordPos = (tSec / wordDurationSec) % 1.0;

    const syllableEnv =
      wordPos < 0.85
        ? Math.sin((wordPos / 0.85) * Math.PI) * (0.75 + 0.25 * Math.sin(tSec * 19.0))
        : 0.03;

    const contour = 1.0 + 0.06 * Math.sin(tSec * 4.5) - 0.08 * (s / spokenSamples);
    const instF0 = f0 * contour;

    phase1 += (2 * Math.PI * instF0) / sampleRate;
    phase2 += (2 * Math.PI * instF0 * 2.0) / sampleRate;
    phase3 += (2 * Math.PI * instF0 * 3.0) / sampleRate;

    prngState ^= prngState << 13;
    prngState ^= prngState >>> 17;
    prngState ^= prngState << 5;
    const noise = ((prngState & 0xffff) / 32768.0 - 1.0) * (isWhispered ? 0.35 : 0.04);

    const harmonic = isWhispered
      ? Math.sin(phase1) * 0.15
      : Math.sin(phase1) * 0.55 + Math.sin(phase2) * 0.28 + Math.sin(phase3) * 0.12;

    const sampleFloat = Math.max(-0.95, Math.min(0.95, (harmonic + noise) * syllableEnv * 0.7));
    pcmInt16[s] = Math.round(sampleFloat * 32767);
  }

  const pcmBytes = new Uint8Array(pcmInt16.buffer, pcmInt16.byteOffset, pcmInt16.byteLength);
  return {
    pcmInt16,
    pcmBytes,
    timepoints,
    durationSec: totalDurationSec,
  };
}

/**
 * Synthesizes a ScriptBlock using either:
 * 1. **Gemini 2.5 Flash Preview TTS (`gemini_tts`)**: Official `:generateContent` multimodal AUDIO endpoint
 *    with `prebuiltVoiceConfig` and acoustic style conditioning.
 * 2. **Local Browser TTS (`browser_tts`)**: Web Speech API (`window.speechSynthesis`) alternative.
 */
export async function synthesizeGeminiAudioWithPeaks({
  block,
  speaker,
  apiKey,
  language,
  precedingBlocks = [],
  allSpeakers = [],
  provider = 'gemini_tts',
  ttsModel = 'gemini-2.5-flash-preview-tts',
  speakImmediatelyOnBrowserTts = false,
  forceProcedural = false,
  abortSignal,
}: {
  block: ScriptBlock;
  speaker?: Speaker;
  apiKey?: string;
  language: SupportedLanguage;
  precedingBlocks?: ScriptBlock[];
  allSpeakers?: Speaker[];
  provider?: TtsEngineProvider;
  ttsModel?: GeminiTtsModelId;
  speakImmediatelyOnBrowserTts?: boolean;
  forceProcedural?: boolean;
  abortSignal?: AbortSignal;
}): Promise<SynthesisPipelineResult> {
  const effectiveProvider: TtsEngineProvider = forceProcedural ? 'browser_tts' : provider;

  // 1. GEMINI 2.5 PREVIEW TTS (`gemini-2.5-flash-preview-tts` or `gemini-2.5-pro-preview-tts`)
  if (effectiveProvider === 'gemini_tts') {
    const trimmedKey = (apiKey ?? '').trim();
    if (trimmedKey.length < 16) {
      throw new Error(
        language === 'hr'
          ? 'Nedostaje Gemini API ključ. Unesite API ključ u postavkama ili prebacite na Lokalni Preglednik TTS.'
          : 'Gemini API key is required for Gemini 2.5 TTS. Please configure your API key or switch to Local Browser TTS.'
      );
    }

    const effectiveLang: SupportedLanguage =
      language === 'hr' || containsCroatianCharacters(block.text) ? 'hr' : 'en';

    const acousticDirective = buildAcousticDirective({
      block,
      speaker,
      language: effectiveLang,
      precedingBlocks,
      allSpeakers,
    });

    const rawCues = extractDirectorNotes(block);
    const localizedCues = rawCues
      .map((c) => localizeDirectorCueForLanguage(c, effectiveLang))
      .filter(Boolean);
    const cleanSpoken = prepareTextForTts(
      stripNonSpokenTokens(block.text),
      effectiveLang
    );

    const promptText =
      effectiveLang === 'hr'
        ? [
            `Upute za glasovnu glumu (standardni hrvatski književni izgovor, čisto izgovori hrvatske glasove č, ć, dž, đ, š, ž, lj, nj bez stranog naglaska): ${acousticDirective}`,
            localizedCues.length > 0 && (speaker?.voice.enableDirectorNotes ?? true)
              ? `Način izvedbe: ${localizedCues.join(', ')}.`
              : '',
            `Pročitaj naglas na hrvatskom jeziku isključivo sljedeći tekst:`,
            cleanSpoken,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            `Audio Directing Instructions: ${acousticDirective}`,
            localizedCues.length > 0 && (speaker?.voice.enableDirectorNotes ?? true)
              ? `Delivery style: ${localizedCues.join(', ')}.`
              : '',
            `Read the following line aloud in English:`,
            cleanSpoken,
          ]
            .filter(Boolean)
            .join('\n');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      ttsModel
    )}:generateContent?key=${encodeURIComponent(trimmedKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: speaker?.voice.baseVoice || 'Kore',
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `Gemini 2.5 TTS error (${response.status})`
      );
    }

    const result = await response.json();
    const inlineAudioPart = result?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) => p?.inlineData?.data
    );
    const base64Audio: string =
      inlineAudioPart?.inlineData?.data || result?.audioContent || '';

    if (!base64Audio) {
      throw new Error('Gemini 2.5 TTS returned an empty audio stream.');
    }

    // Parse sample rate from mimeType (default 24000 Hz for Gemini 2.5 Flash TTS)
    const mimeType: string = inlineAudioPart?.inlineData?.mimeType || '';
    const rateMatch = /rate=(\d+)/i.exec(mimeType);
    const pcmSampleRate = rateMatch
      ? parseInt(rateMatch[1], 10)
      : GEMINI_NATIVE_TTS_SAMPLE_RATE;

    const binaryAudio = atob(base64Audio);
    const evenLen = binaryAudio.length - (binaryAudio.length % 2);
    const spokenPcmBytes = new Uint8Array(evenLen);
    for (let i = 0; i < evenLen; i++) {
      spokenPcmBytes[i] = binaryAudio.charCodeAt(i);
    }

    const spokenSamples = new Int16Array(spokenPcmBytes.buffer);
    const pauseMs = Math.max(0, block.pauseAfterMs ?? 0);
    const pauseSampleCount = Math.floor((pauseMs / 1000) * pcmSampleRate);

    const fullSamples = new Int16Array(spokenSamples.length + pauseSampleCount);
    fullSamples.set(spokenSamples, 0);

    const fullPcmBytes = new Uint8Array(
      fullSamples.buffer,
      fullSamples.byteOffset,
      fullSamples.byteLength
    );

    const waveformPeaks = extractWaveformPeaksFromPcm(
      fullSamples,
      pcmSampleRate,
      DEFAULT_PEAKS_PER_SECOND
    );
    const audioBlob = encodePcm16ToWavBlob(fullPcmBytes, pcmSampleRate, 1);

    const spokenDurationSec = Number((spokenSamples.length / pcmSampleRate).toFixed(3));
    const totalDurationSec = Number((fullSamples.length / pcmSampleRate).toFixed(3));
    const tokensUsed = Math.ceil(totalDurationSec * AUDIO_TOKENS_PER_SECOND);

    const timepoints: ScriptTimepoint[] = Array.isArray(result.timepoints)
      ? result.timepoints.map((tp: { markName?: string; timeSeconds?: number }) => ({
          markName: String(tp.markName ?? ''),
          timeSeconds: Number(tp.timeSeconds ?? 0),
        }))
      : buildWordTimepointsForDuration(block, spokenDurationSec);

    return {
      audioBlob,
      timepoints,
      tokensUsed,
      waveformPeaks,
      durationSec: totalDurationSec,
      providerUsed: 'gemini_tts',
      usedProceduralFallback: false,
    };
  }

  // 2. LOCAL BROWSER TTS ALTERNATIVE (`window.speechSynthesis`)
  if (speakImmediatelyOnBrowserTts) {
    speakWithBrowserTts({
      text: block.text,
      speaker,
      language,
    });
  }

  const envelope = synthesizeProceduralSpeechPcm({
    block,
    speaker,
    sampleRate: DEFAULT_TTS_SAMPLE_RATE,
  });

  const waveformPeaks = extractWaveformPeaksFromPcm(
    envelope.pcmInt16,
    DEFAULT_TTS_SAMPLE_RATE,
    DEFAULT_PEAKS_PER_SECOND
  );
  const audioBlob = encodePcm16ToWavBlob(envelope.pcmBytes, DEFAULT_TTS_SAMPLE_RATE, 1);
  const tokensUsed = Math.ceil(envelope.durationSec * AUDIO_TOKENS_PER_SECOND);

  return {
    audioBlob,
    timepoints: envelope.timepoints,
    tokensUsed,
    waveformPeaks,
    durationSec: envelope.durationSec,
    providerUsed: 'browser_tts',
    usedProceduralFallback: true,
  };
}
