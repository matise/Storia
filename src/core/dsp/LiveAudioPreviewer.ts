import { Speaker, SupportedLanguage } from '../../types/storia';
import { stripNonSpokenTokens } from '../pacing/pacingCalculator';
import { studioTransportEngine } from './StudioTransportEngine';
import {
  containsCroatianCharacters,
  prepareTextForTts,
} from '../tts/croatianTextNormalizer';

interface ActiveWebAudioSession {
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  lowShelf: BiquadFilterNode;
  midPeak: BiquadFilterNode;
  highShelf: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  wetCompGain: GainNode;
  speakerId: string;
  startContextTime: number;
  startOffsetSec: number;
  durationSec: number;
}

let activeWebAudioSession: ActiveWebAudioSession | null = null;
let activeBrowserTtsStartMs: number | null = null;
let activeBrowserTtsOffsetSec = 0;
let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => { });
  }
  return sharedAudioCtx;
}

/**
 * Lists available local browser SpeechSynthesis voices.
 */
export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

/**
 * Selects the best matching local browser SpeechSynthesisVoice for a Speaker & Language.
 */
export function selectBrowserVoiceForSpeaker(
  speaker?: Speaker,
  language: SupportedLanguage = 'hr'
): SpeechSynthesisVoice | null {
  const voices = getAvailableBrowserVoices();
  if (voices.length === 0) return null;

  // 1. Check if speaker has an explicitly pinned browserVoiceURI
  if (speaker?.voice.browserVoiceURI) {
    const pinned = voices.find((v) => v.voiceURI === speaker.voice.browserVoiceURI);
    if (pinned) return pinned;
  }

  // 2. Filter by target language ('hr' or 'en')
  const langPrefix = language === 'hr' ? 'hr' : 'en';
  let langMatches = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith(langPrefix) ||
      (language === 'hr' && /croat|hrvatsk/i.test(v.name))
  );
  if (langMatches.length === 0 && language === 'hr') {
    // Fallback to South Slavic voices if hr-HR isn't installed locally
    langMatches = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('sr') ||
        v.lang.toLowerCase().startsWith('bs') ||
        v.lang.toLowerCase().startsWith('sl')
    );
    // Do NOT force an English voice object onto a Croatian utterance, as that overrides utterance.lang = 'hr-HR'
    if (langMatches.length === 0) {
      return null;
    }
  }
  const pool = langMatches.length > 0 ? langMatches : voices;

  // 3. Heuristic match by speaker gender or deterministic index
  if (speaker) {
    const lowerGender = speaker.gender;
    if (lowerGender === 'female') {
      const fem = pool.find((v) =>
        /female|zira|hazel|susan|aria|jenny|katarina|ana|vesna|natural/i.test(v.name)
      );
      if (fem) return fem;
    } else if (lowerGender === 'male') {
      const masc = pool.find((v) =>
        /male|david|mark|george|guy|steffan|matej|ivan|goran/i.test(v.name)
      );
      if (masc) return masc;
    }
    const idx =
      speaker.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % pool.length;
    return pool[idx];
  }

  return pool[0];
}

/**
 * Stops any currently playing Web Audio buffer or Local Browser SpeechSynthesis utterance.
 */
export function stopAllAudioPlayback(): void {
  studioTransportEngine.stop();
  activeBrowserTtsStartMs = null;
  activeBrowserTtsOffsetSec = 0;
  if (activeWebAudioSession) {
    try {
      activeWebAudioSession.source.stop();
      activeWebAudioSession.source.disconnect();
    } catch {
      // Ignore if already stopped
    }
    activeWebAudioSession = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns the real-time elapsed playback seconds for the currently active single-block preview.
 */
export function getActivePreviewElapsedSec(): number | null {
  if (activeWebAudioSession) {
    const elapsed =
      activeWebAudioSession.startOffsetSec +
      Math.max(0, activeWebAudioSession.ctx.currentTime - activeWebAudioSession.startContextTime);
    return Math.min(activeWebAudioSession.durationSec, elapsed);
  }
  if (activeBrowserTtsStartMs !== null) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return activeBrowserTtsOffsetSec + Math.max(0, (now - activeBrowserTtsStartMs) / 1000);
  }
  return null;
}

/**
 * Applies a Speaker's Biquad EQ (120Hz Low-Shelf, 2.5kHz Mid-Peak, 8kHz High-Shelf)
 * and Dynamics Compressor settings (including ON/OFF bypass toggles) to an active Web Audio chain.
 */
export function applySpeakerDspParamsToSession(
  session: ActiveWebAudioSession,
  speaker?: Speaker
): void {
  const now = session.ctx.currentTime;
  const eqConfig = speaker?.voice.acoustics.biquadEq;
  const eqEnabled = eqConfig?.enabled ?? true;

  const lowGain = eqEnabled ? (eqConfig?.lowShelfGainDb ?? 0) : 0;
  const midGain = eqEnabled ? (eqConfig?.midPeakGainDb ?? 0) : 0;
  const highGain = eqEnabled ? (eqConfig?.highShelfGainDb ?? 0) : 0;

  session.lowShelf.gain.setTargetAtTime(lowGain, now, 0.015);
  session.midPeak.gain.setTargetAtTime(midGain, now, 0.015);
  session.highShelf.gain.setTargetAtTime(highGain, now, 0.015);

  const compConfig = speaker?.voice.acoustics.compression;
  const compEnabled = compConfig?.enabled ?? true;

  session.compressor.threshold.setTargetAtTime(
    compConfig?.thresholdDb ?? -20,
    now,
    0.015
  );
  session.compressor.ratio.setTargetAtTime(
    compEnabled ? (compConfig?.ratio ?? 2.5) : 1.0,
    now,
    0.015
  );
  session.compressor.attack.setTargetAtTime(
    (compConfig?.attackMs ?? 15) / 1000,
    now,
    0.015
  );
  session.compressor.release.setTargetAtTime(
    (compConfig?.releaseMs ?? 100) / 1000,
    now,
    0.015
  );

  // Crossfade dry vs compressed wet bus based on compEnabled toggle
  session.dryGain.gain.setTargetAtTime(compEnabled ? 0.0 : 1.0, now, 0.015);
  session.wetCompGain.gain.setTargetAtTime(compEnabled ? 1.0 : 0.0, now, 0.015);
}

/**
 * Updates live Web Audio EQ & Dynamics nodes in real time if the given speaker is currently playing.
 */
export function updateLiveDspIfPlaying(speaker: Speaker): void {
  studioTransportEngine.updateSpeakerDsp(speaker);
  if (activeWebAudioSession && activeWebAudioSession.speakerId === speaker.id) {
    applySpeakerDspParamsToSession(activeWebAudioSession, speaker);
  }
}

/**
 * Plays a synthesized WAV/PCM Audio Blob (or Object URL) through the Speaker's
 * 3-band Biquad EQ and Dynamics Compressor Web Audio graph.
 */
export async function playAudioWithSpeakerDsp({
  audioUrl,
  audioBlob,
  speaker,
  volumeGainDb,
  startOffsetSec = 0,
  onEnded,
}: {
  audioUrl?: string;
  audioBlob?: Blob;
  speaker?: Speaker;
  volumeGainDb?: number;
  startOffsetSec?: number;
  onEnded?: () => void;
}): Promise<boolean> {
  stopAllAudioPlayback();

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    let arrayBuffer: ArrayBuffer | null = null;
    if (audioBlob && typeof audioBlob.arrayBuffer === 'function') {
      arrayBuffer = await audioBlob.arrayBuffer();
    } else if (audioUrl) {
      const resp = await fetch(audioUrl);
      arrayBuffer = await resp.arrayBuffer();
    }
    if (!arrayBuffer || arrayBuffer.byteLength <= 44) return false;

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // 1. 120 Hz Low-Shelf Biquad Filter
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 120;

    // 2. 2.5 kHz Mid-Peak Biquad Filter (Dialogue clarity)
    const midPeak = ctx.createBiquadFilter();
    midPeak.type = 'peaking';
    midPeak.frequency.value = 2500;
    midPeak.Q.value = 1.0;

    // 3. 8.0 kHz High-Shelf Biquad Filter (Air & Presence)
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 8000;

    // 4. Dynamics Compressor + Bypassable Dry/Wet Routing
    const compressor = ctx.createDynamicsCompressor();
    const dryGain = ctx.createGain();
    const wetCompGain = ctx.createGain();

    // 5. Volume Gain Node (Supports -inf to +10 dB)
    const volumeGainNode = ctx.createGain();
    if (typeof volumeGainDb === 'number') {
      const linGain = !Number.isFinite(volumeGainDb) || volumeGainDb <= -48
        ? 0.0
        : Math.pow(10, volumeGainDb / 20);
      volumeGainNode.gain.value = linGain;
    } else {
      volumeGainNode.gain.value = 1.0;
    }

    source.connect(lowShelf);
    lowShelf.connect(midPeak);
    midPeak.connect(highShelf);

    highShelf.connect(dryGain);
    highShelf.connect(compressor);
    compressor.connect(wetCompGain);

    dryGain.connect(volumeGainNode);
    wetCompGain.connect(volumeGainNode);
    volumeGainNode.connect(ctx.destination);

    const clampedOffset = Math.max(
      0,
      Math.min(Math.max(0, audioBuffer.duration - 0.05), startOffsetSec)
    );

    const session: ActiveWebAudioSession = {
      ctx,
      source,
      lowShelf,
      midPeak,
      highShelf,
      compressor,
      dryGain,
      wetCompGain,
      speakerId: speaker?.id ?? 'default',
      startContextTime: ctx.currentTime,
      startOffsetSec: clampedOffset,
      durationSec: audioBuffer.duration,
    };

    applySpeakerDspParamsToSession(session, speaker);
    activeWebAudioSession = session;

    source.onended = () => {
      if (activeWebAudioSession === session) {
        activeWebAudioSession = null;
      }
      onEnded?.();
    };

    source.start(0, clampedOffset);
    return true;
  } catch {
    return false;
  }
}

/**
 * Speaks text immediately using the Local Browser Web Speech API (`window.speechSynthesis`),
 * applying speaker rate, pitch, language, Croatian character normalization, and optional word-boundary callbacks.
 */
export function speakWithBrowserTts({
  text,
  speaker,
  language = 'hr',
  startOffsetSec = 0,
  onWordBoundary,
  onEnded,
}: {
  text: string;
  speaker?: Speaker;
  language?: SupportedLanguage;
  startOffsetSec?: number;
  onWordBoundary?: (wordIndex: number, charIndex: number) => void;
  onEnded?: () => void;
}): boolean {
  stopAllAudioPlayback();

  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    onEnded?.();
    return false;
  }

  const rawClean = stripNonSpokenTokens(text);
  if (!rawClean) {
    onEnded?.();
    return false;
  }

  const effectiveLang: SupportedLanguage =
    language === 'hr' || containsCroatianCharacters(rawClean) ? 'hr' : 'en';
  const preparedText = prepareTextForTts(rawClean, effectiveLang);

  try {
    const utterance = new SpeechSynthesisUtterance(preparedText);
    utterance.lang = effectiveLang === 'hr' ? 'hr-HR' : 'en-US';

    const matchedVoice = selectBrowserVoiceForSpeaker(speaker, effectiveLang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      if (matchedVoice.lang) {
        utterance.lang = matchedVoice.lang;
      }
    }

    const rate = Math.max(0.5, Math.min(2.0, speaker?.voice.speakingRate ?? 1.0));
    // Map [-10st, +10st] to Web Speech pitch [0.5, 1.5]
    const pitchSt = speaker?.voice.pitchAdjustment ?? 0;
    const pitch = Math.max(0.5, Math.min(1.5, 1.0 + pitchSt * 0.05));

    utterance.rate = rate;
    utterance.pitch = pitch;

    activeBrowserTtsStartMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    activeBrowserTtsOffsetSec = Math.max(0, startOffsetSec);

    let wordIdx = 0;
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.charIndex !== undefined) {
        onWordBoundary?.(wordIdx, event.charIndex ?? 0);
        wordIdx += 1;
      }
    };

    utterance.onend = () => {
      activeBrowserTtsStartMs = null;
      activeBrowserTtsOffsetSec = 0;
      onEnded?.();
    };

    utterance.onerror = () => {
      activeBrowserTtsStartMs = null;
      activeBrowserTtsOffsetSec = 0;
      onEnded?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    activeBrowserTtsStartMs = null;
    activeBrowserTtsOffsetSec = 0;
    onEnded?.();
    return false;
  }
}

