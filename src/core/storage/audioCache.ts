import { get, set, del, clear } from 'idb-keyval';
import {
  ScriptBlock,
  ScriptTimepoint,
  Speaker,
  SupportedLanguage,
  TtsBlockStatus,
  WaveformPeakData,
} from '../../types/storia';
import {
  DEFAULT_PEAKS_PER_SECOND,
  DEFAULT_TTS_SAMPLE_RATE,
  extractWaveformPeaksFromPcm,
} from '../../services/geminiTtsService';

export interface CachedBlockAudioEntry {
  blockId: string;
  cacheKey: string;
  audioBlob: Blob;
  durationSec: number;
  tokensUsed: number;
  timepoints: ScriptTimepoint[];
  waveformPeaks: {
    sampleRate: number;
    length: number;
    minPeaks: number[];
    maxPeaks: number[];
    rmsLevels: number[];
  };
  createdAt: number;
}

export interface HydratedCachedAudioEntry {
  blockId: string;
  cacheKey: string;
  audioBlob: Blob;
  audioUrl: string;
  durationSec: number;
  tokensUsed: number;
  timepoints: ScriptTimepoint[];
  waveformPeaks: WaveformPeakData;
  createdAt: number;
}

// In-memory fast L1 cache (also acts as fallback in test environments without IndexedDB)
const memoryCache = new Map<string, CachedBlockAudioEntry>();
const blockLatestEntryMap = new Map<string, CachedBlockAudioEntry>();

/**
 * Computes a deterministic SHA-256 hex digest using Web Crypto API (with pure JS fallback).
 */
export async function sha256Hex(payload: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return hex.repeat(4);
}

/**
 * Generates a content-addressed cache key for a ScriptBlock + Speaker configuration.
 * Any edit to text, directorNotes, pauseAfterMs, or speaker voice parameters invalidates the key.
 */
export async function computeBlockCacheKey(
  block: Pick<
    ScriptBlock,
    | 'id'
    | 'type'
    | 'text'
    | 'directorNotes'
    | 'pauseAfterMs'
    | 'speakerId'
    | 'sfxCategory'
    | 'sfxDurationSec'
    | 'sfxIntensity'
    | 'customAudioFileName'
  >,
  speaker?: Speaker,
  language: SupportedLanguage = 'hr'
): Promise<string> {
  const canonicalPayload = JSON.stringify({
    type: block.type,
    speakerId: block.speakerId ?? null,
    text: block.text.trim(),
    directorNotes: (block.directorNotes ?? '').trim(),
    pauseAfterMs: block.pauseAfterMs ?? 0,
    sfxCategory: block.type === 'sound_effect' ? (block.sfxCategory ?? 'auto') : undefined,
    sfxDurationSec: block.type === 'sound_effect' ? (block.sfxDurationSec ?? null) : undefined,
    sfxIntensity: block.type === 'sound_effect' ? (block.sfxIntensity ?? null) : undefined,
    customAudioFileName:
      block.type === 'sound_effect' ? (block.customAudioFileName ?? null) : undefined,
    language,
    voice: speaker
      ? {
          baseVoice: speaker.voice.baseVoice,
          stylePrompt: speaker.voice.stylePrompt,
          speakingRate: speaker.voice.speakingRate,
          pitchAdjustment: speaker.voice.pitchAdjustment,
          enableDirectorNotes: speaker.voice.enableDirectorNotes,
          ssmlEnabled: speaker.voice.ssmlEnabled,
        }
      : null,
    personaPrompt: speaker?.personaPrompt ?? null,
    actingNotes: speaker?.actingNotes ?? null,
  });

  const digest = await sha256Hex(canonicalPayload);
  return `storia_tts_${block.id}_${digest.slice(0, 16)}`;
}

function hydrateEntry(raw: CachedBlockAudioEntry): HydratedCachedAudioEntry {
  const audioUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(raw.audioBlob)
      : `blob:storia-cached-${raw.cacheKey}`;

  return {
    blockId: raw.blockId,
    cacheKey: raw.cacheKey,
    audioBlob: raw.audioBlob,
    audioUrl,
    durationSec: raw.durationSec,
    tokensUsed: raw.tokensUsed,
    timepoints: raw.timepoints.map((tp) => ({ ...tp })),
    waveformPeaks: {
      sampleRate: raw.waveformPeaks.sampleRate,
      length: raw.waveformPeaks.length,
      minPeaks: new Float32Array(raw.waveformPeaks.minPeaks),
      maxPeaks: new Float32Array(raw.waveformPeaks.maxPeaks),
      rmsLevels: new Float32Array(raw.waveformPeaks.rmsLevels),
    },
    createdAt: raw.createdAt,
  };
}

/**
 * Stores synthesized audio and Structure-of-Arrays (SoA) peaks in IndexedDB & L1 memory cache.
 */
export async function saveBlockAudioToCache({
  blockId,
  cacheKey,
  audioBlob,
  durationSec,
  tokensUsed,
  timepoints,
  waveformPeaks,
}: {
  blockId: string;
  cacheKey: string;
  audioBlob: Blob;
  durationSec: number;
  tokensUsed: number;
  timepoints: ScriptTimepoint[];
  waveformPeaks: WaveformPeakData;
}): Promise<HydratedCachedAudioEntry> {
  const serialized: CachedBlockAudioEntry = {
    blockId,
    cacheKey,
    audioBlob,
    durationSec,
    tokensUsed,
    timepoints: timepoints.map((tp) => ({ ...tp })),
    waveformPeaks: {
      sampleRate: waveformPeaks.sampleRate,
      length: waveformPeaks.length,
      minPeaks: Array.from(waveformPeaks.minPeaks),
      maxPeaks: Array.from(waveformPeaks.maxPeaks),
      rmsLevels: Array.from(waveformPeaks.rmsLevels),
    },
    createdAt: Date.now(),
  };

  memoryCache.set(cacheKey, serialized);
  blockLatestEntryMap.set(blockId, serialized);

  try {
    await set(cacheKey, serialized);
    await set(`storia_tts_latest_${blockId}`, cacheKey);
  } catch {
    // IndexedDB unavailable in JSDOM test runner; memoryCache handles it seamlessly
  }

  return hydrateEntry(serialized);
}

/**
 * Retrieves a cached audio entry by exact content-addressed cacheKey.
 */
export async function getBlockAudioFromCache(
  cacheKey: string
): Promise<HydratedCachedAudioEntry | null> {
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    return hydrateEntry(mem);
  }

  try {
    const stored = await get<CachedBlockAudioEntry>(cacheKey);
    if (stored && stored.cacheKey === cacheKey) {
      memoryCache.set(cacheKey, stored);
      blockLatestEntryMap.set(stored.blockId, stored);
      return hydrateEntry(stored);
    }
  } catch {
    // Ignore IDB errors in restricted environments
  }

  return null;
}

/**
 * Retrieves the most recent cached audio entry for a blockId (even if stale),
 * allowing waveform peak re-extraction without re-calling TTS.
 */
export async function getLatestBlockAudioEntry(
  blockId: string,
  cacheKey?: string
): Promise<HydratedCachedAudioEntry | null> {
  if (cacheKey) {
    const exact = await getBlockAudioFromCache(cacheKey);
    if (exact) return exact;
  }

  const latestMem = blockLatestEntryMap.get(blockId);
  if (latestMem) {
    return hydrateEntry(latestMem);
  }

  try {
    const latestKey = await get<string>(`storia_tts_latest_${blockId}`);
    if (latestKey) {
      return await getBlockAudioFromCache(latestKey);
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Re-extracts Structure-of-Arrays (SoA) WaveformPeakData directly from a 16-bit WAV Blob.
 */
export async function extractWaveformPeaksFromWavBlob(
  wavBlob: Blob,
  peaksPerSecond: number = DEFAULT_PEAKS_PER_SECOND
): Promise<WaveformPeakData | null> {
  try {
    let arrayBuffer: ArrayBuffer | null = null;
    if (typeof wavBlob.arrayBuffer === 'function') {
      arrayBuffer = await wavBlob.arrayBuffer();
    } else if (typeof Response !== 'undefined') {
      arrayBuffer = await new Response(wavBlob).arrayBuffer();
    }
    if (!arrayBuffer || arrayBuffer.byteLength <= 44) return null;

    const view = new DataView(arrayBuffer);
    const sampleRate = view.getUint32(24, true) || DEFAULT_TTS_SAMPLE_RATE;
    const pcmByteLen = arrayBuffer.byteLength - 44;
    const sampleCount = Math.floor(pcmByteLen / 2);
    const int16Samples = new Int16Array(arrayBuffer, 44, sampleCount);

    return extractWaveformPeaksFromPcm(int16Samples, sampleRate, peaksPerSecond);
  } catch {
    return null;
  }
}

/**
 * Evaluates a block's current synthesis cache state:
 * - 'ok' if an exact content-hash match exists in cache
 * - 'stale' if a previous render exists for this blockId but content/voice changed
 * - 'unrendered' if no render exists yet
 */
export async function evaluateBlockCacheStatus(
  block: ScriptBlock,
  speaker?: Speaker,
  language: SupportedLanguage = 'hr'
): Promise<{
  status: TtsBlockStatus;
  computedKey: string;
  cachedEntry: HydratedCachedAudioEntry | null;
}> {
  const computedKey = await computeBlockCacheKey(block, speaker, language);
  const exactMatch = await getBlockAudioFromCache(computedKey);

  if (exactMatch) {
    return {
      status: 'ok',
      computedKey,
      cachedEntry: exactMatch,
    };
  }

  const hadPrevious =
    blockLatestEntryMap.has(block.id) ||
    Boolean(block.cacheKey) ||
    block.ttsStatus === 'ok' ||
    block.ttsStatus === 'stale';

  return {
    status: hadPrevious ? 'stale' : 'unrendered',
    computedKey,
    cachedEntry: null,
  };
}

/**
 * Completely deletes cached audio and waveform data for a specific blockId and cacheKey.
 */
export async function deleteBlockAudioFromCache(
  blockId: string,
  cacheKey?: string
): Promise<void> {
  if (cacheKey) {
    memoryCache.delete(cacheKey);
    try {
      await del(cacheKey);
    } catch {
      // Ignore
    }
  }

  const latest = blockLatestEntryMap.get(blockId);
  if (latest) {
    memoryCache.delete(latest.cacheKey);
    blockLatestEntryMap.delete(blockId);
    try {
      await del(latest.cacheKey);
    } catch {
      // Ignore
    }
  }

  // Also purge any remaining memoryCache keys belonging to this blockId
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(`storia_tts_${blockId}_`)) {
      memoryCache.delete(key);
      try {
        await del(key);
      } catch {
        // Ignore
      }
    }
  }

  try {
    await del(`storia_tts_latest_${blockId}`);
  } catch {
    // Ignore
  }
}

export async function removeBlockAudioFromCache(cacheKey: string): Promise<void> {
  memoryCache.delete(cacheKey);
  try {
    await del(cacheKey);
  } catch {
    // Ignore
  }
}

export async function clearAllAudioCache(): Promise<void> {
  memoryCache.clear();
  blockLatestEntryMap.clear();
  try {
    await clear();
  } catch {
    // Ignore
  }
}
