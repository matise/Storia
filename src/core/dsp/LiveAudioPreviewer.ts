import { Speaker, SupportedLanguage, createDefaultMainAuxBus } from '../../types/storia';
import { stripNonSpokenTokens } from '../pacing/pacingCalculator';
import { registerTtsSpeaker, studioTransportEngine } from './StudioTransportEngine';
import { scheduleFadeEnvelope } from './VolumeEnvelope';
import {
  containsCroatianCharacters,
  prepareTextForTts,
} from '../tts/croatianTextNormalizer';

interface ActiveWebAudioSession {
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  clipFadeGain: GainNode;
  volumeGainNode: GainNode;
  auxSendGainNode?: GainNode;
  directGainNode?: GainNode;
  speakerId: string;
  blockId: string;
  startContextTime: number;
  startOffsetSec: number;
  durationSec: number;
  fadeInMs: number;
  fadeOutMs: number;
  fadeInCurve: number;
  fadeOutCurve: number;
  volumeGainDb: number;
  auxSendDb?: number;
  directMute?: boolean;
}

let activeWebAudioSession: ActiveWebAudioSession | null = null;
let activeBrowserTtsStartMs: number | null = null;
let activeBrowserTtsOffsetSec = 0;
let sharedAudioCtx: AudioContext | null = null;
let previewMeterInterval: ReturnType<typeof setInterval> | null = null;
/** Incremented on every stop; async preview starts compare against it to avoid late, overlapping playback. */
let previewGeneration = 0;

function stopPreviewMeter(): void {
  if (previewMeterInterval) {
    clearInterval(previewMeterInterval);
    previewMeterInterval = null;
  }
}

function getOrCreateAudioContext(): AudioContext | null {
  const engineCtx = studioTransportEngine.getAudioContext();
  if (engineCtx) return engineCtx;
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
  previewGeneration++;
  stopPreviewMeter();
  studioTransportEngine.stop();
  activeBrowserTtsStartMs = null;
  activeBrowserTtsOffsetSec = 0;
  if (activeWebAudioSession) {
    try {
      activeWebAudioSession.source.stop();
      activeWebAudioSession.source.disconnect();
      activeWebAudioSession.clipFadeGain.disconnect();
      activeWebAudioSession.volumeGainNode.disconnect();
      activeWebAudioSession.directGainNode?.disconnect();
      activeWebAudioSession.auxSendGainNode?.disconnect();
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
  _session: ActiveWebAudioSession,
  speaker?: Speaker
): void {
  if (speaker) {
    studioTransportEngine.updateSpeakerDsp(speaker);
  }
}

/**
 * Updates live Web Audio EQ & Dynamics nodes in real time if the given speaker is currently playing.
 */
export function updateLiveDspIfPlaying(speaker: Speaker): void {
  studioTransportEngine.updateSpeakerDsp(speaker);
}

/**
 * Updates volume curve and gain parameters in real-time while audio is playing.
 */
export function updateLiveBlockAudio(
  blockId: string,
  params: {
    volumeGainDb?: number;
    auxSendDb?: number;
    directMute?: boolean;
    fadeInMs?: number;
    fadeOutMs?: number;
    fadeInCurve?: number;
    fadeOutCurve?: number;
  }
): void {
  if (activeWebAudioSession && activeWebAudioSession.blockId === blockId) {
    const session = activeWebAudioSession;
    const now = session.ctx.currentTime;

    if (session.auxSendGainNode && typeof params.auxSendDb === 'number') {
      const auxLin =
        !Number.isFinite(params.auxSendDb) || params.auxSendDb <= -48
          ? 0.0
          : Math.pow(10, params.auxSendDb / 20);
      try {
        if (typeof session.auxSendGainNode.gain.setTargetAtTime === 'function') {
          session.auxSendGainNode.gain.setTargetAtTime(auxLin, now, 0.015);
        } else {
          session.auxSendGainNode.gain.value = auxLin;
        }
      } catch {
        session.auxSendGainNode.gain.value = auxLin;
      }
      session.auxSendDb = params.auxSendDb;
    }

    if (session.directGainNode && typeof params.directMute === 'boolean') {
      const directLin = params.directMute ? 0.0 : 1.0;
      try {
        if (typeof session.directGainNode.gain.setTargetAtTime === 'function') {
          session.directGainNode.gain.setTargetAtTime(directLin, now, 0.015);
        } else {
          session.directGainNode.gain.value = directLin;
        }
      } catch {
        session.directGainNode.gain.value = directLin;
      }
    }

    if (typeof params.volumeGainDb === 'number') {
      const linGain =
        !Number.isFinite(params.volumeGainDb) || params.volumeGainDb <= -48
          ? 0.0
          : Math.pow(10, params.volumeGainDb / 20);
      try {
        if (typeof session.volumeGainNode.gain.setTargetAtTime === 'function') {
          session.volumeGainNode.gain.setTargetAtTime(linGain, now, 0.015);
        } else {
          session.volumeGainNode.gain.value = linGain;
        }
      } catch {
        session.volumeGainNode.gain.value = linGain;
      }
      session.volumeGainDb = params.volumeGainDb;
    }

    if (
      params.fadeInMs !== undefined ||
      params.fadeOutMs !== undefined ||
      params.fadeInCurve !== undefined ||
      params.fadeOutCurve !== undefined
    ) {
      if (params.fadeInMs !== undefined) session.fadeInMs = params.fadeInMs;
      if (params.fadeOutMs !== undefined) session.fadeOutMs = params.fadeOutMs;
      if (params.fadeInCurve !== undefined) session.fadeInCurve = params.fadeInCurve;
      if (params.fadeOutCurve !== undefined) session.fadeOutCurve = params.fadeOutCurve;

      scheduleFadeEnvelope(
        session.clipFadeGain,
        session.ctx,
        session.durationSec,
        session.fadeInMs,
        session.fadeInCurve,
        session.fadeOutMs,
        session.fadeOutCurve,
        session.startOffsetSec,
        session.startContextTime
      );
    }
  }

  // Also update master timeline transport if playing this block
  studioTransportEngine.updateBlockFadesAndGain(blockId, params);
}

/**
 * Plays a synthesized WAV/PCM Audio Blob (or Object URL) through the Speaker's
 * 3-band Biquad EQ, Dynamics Compressor, and Adobe Audition volume fade envelope.
 */
export async function playAudioWithSpeakerDsp({
  audioUrl,
  audioBlob,
  speaker,
  volumeGainDb = 0,
  auxSendDb = 0,
  auxSendBusId = 'aux_bus_main',
  directMute = false,
  blockId = 'preview_block',
  fadeInMs = 0,
  fadeOutMs = 0,
  fadeInCurve = 0,
  fadeOutCurve = 0,
  startOffsetSec = 0,
  onEnded,
  isCancelled,
}: {
  audioUrl?: string;
  audioBlob?: Blob;
  speaker?: Speaker;
  volumeGainDb?: number;
  auxSendDb?: number;
  auxSendBusId?: string;
  directMute?: boolean;
  blockId?: string;
  fadeInMs?: number;
  fadeOutMs?: number;
  fadeInCurve?: number;
  fadeOutCurve?: number;
  startOffsetSec?: number;
  onEnded?: () => void;
  /** Optional caller-side cancellation check evaluated after every async step. */
  isCancelled?: () => boolean;
}): Promise<boolean> {
  stopAllAudioPlayback();
  const myGeneration = previewGeneration;
  const superseded = () =>
    myGeneration !== previewGeneration || Boolean(isCancelled?.());

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
    // Treat a superseded request as "handled" so callers don't start a fallback voice
    if (superseded()) return true;
    if (!arrayBuffer || arrayBuffer.byteLength <= 44) return false;

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (superseded()) return true;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // 0. Clip Fade Envelope Gain Node (Adobe Audition power curve v(t) = t^p)
    const clipFadeGain = ctx.createGain();
    clipFadeGain.gain.value = 1.0;

    // 1. Volume Gain Node (Supports -inf to +10 dB)
    const volumeGainNode = ctx.createGain();
    const linGain =
      !Number.isFinite(volumeGainDb) || volumeGainDb <= -48
        ? 0.0
        : Math.pow(10, volumeGainDb / 20);
    volumeGainNode.gain.value = linGain;

    source.connect(clipFadeGain);
    clipFadeGain.connect(volumeGainNode);

    // 2. Dual-Branch Routing: Direct Dry Path + Aux Send Path
    const directGainNode = ctx.createGain();
    directGainNode.gain.value = directMute ? 0.0 : 1.0;
    volumeGainNode.connect(directGainNode);

    const auxSendGainNode = ctx.createGain();
    const auxLin =
      !Number.isFinite(auxSendDb) || auxSendDb <= -48
        ? 0.0
        : Math.pow(10, auxSendDb / 20);
    auxSendGainNode.gain.value = auxLin;
    volumeGainNode.connect(auxSendGainNode);

    // Direct path into speakerChain -> master limiter
    const speakerChain = studioTransportEngine.getOrCreateSpeakerChain(speaker);
    if (speakerChain) {
      directGainNode.connect(speakerChain.inputNode);
    } else {
      directGainNode.connect(ctx.destination);
    }

    // Aux send path into AuxBusEngine -> master limiter
    const auxBus = studioTransportEngine.getOrCreateAuxBus(
      auxSendBusId && auxSendBusId !== 'aux_bus_main'
        ? { ...createDefaultMainAuxBus(), id: auxSendBusId }
        : undefined
    );
    if (auxBus) {
      auxSendGainNode.connect(auxBus.inputNode);
    }

    void studioTransportEngine.resume();

    const clampedOffset = Math.max(
      0,
      Math.min(Math.max(0, audioBuffer.duration - 0.05), startOffsetSec)
    );

    const session: ActiveWebAudioSession = {
      ctx,
      source,
      clipFadeGain,
      volumeGainNode,
      directGainNode,
      auxSendGainNode,
      speakerId: speaker?.id ?? 'default',
      blockId,
      startContextTime: ctx.currentTime,
      startOffsetSec: clampedOffset,
      durationSec: audioBuffer.duration,
      fadeInMs,
      fadeOutMs,
      fadeInCurve,
      fadeOutCurve,
      volumeGainDb,
      auxSendDb,
      directMute,
    };

    activeWebAudioSession = session;

    // Schedule real-time Adobe Audition fade curves starting from zero (-inf dB)
    scheduleFadeEnvelope(
      clipFadeGain,
      ctx,
      audioBuffer.duration,
      fadeInMs,
      fadeInCurve,
      fadeOutMs,
      fadeOutCurve,
      clampedOffset,
      ctx.currentTime
    );

    stopPreviewMeter();
    studioTransportEngine.startRealtimeMetering(blockId, speaker?.id ?? null);

    source.onended = () => {
      stopPreviewMeter();
      studioTransportEngine.stop();
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

    void studioTransportEngine.resume();
    stopPreviewMeter();
    let ttsStep = 0;
    previewMeterInterval = setInterval(() => {
      ttsStep++;
      // Conversational speech natural dynamic envelope between -17.5 and -13.5 LUFS
      const wave =
        Math.sin(ttsStep * 0.45) * 0.6 + Math.cos(ttsStep * 0.85) * 0.4;
      const momLufs = -15.5 + wave * 2.5;
      const peak = -2.5 + wave * 1.2;
      studioTransportEngine.emitSnapshot({
        momentaryLufs: Math.round(momLufs * 10) / 10,
        integratedLufs: -16.0,
        truePeakDbfs: Math.round(peak * 10) / 10,
        rmsDbfs: Math.round((momLufs - 1.5) * 10) / 10,
        isBroadcastSafe: true,
        activeSpeakerId: speaker?.id ?? null,
        activeBlockId: null,
      });
    }, 50);

    utterance.onend = () => {
      stopPreviewMeter();
      studioTransportEngine.stop();
      activeBrowserTtsStartMs = null;
      activeBrowserTtsOffsetSec = 0;
      onEnded?.();
    };

    utterance.onerror = () => {
      stopPreviewMeter();
      studioTransportEngine.stop();
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

// Register browser TTS playback engine with master StudioTransportEngine
registerTtsSpeaker(speakWithBrowserTts);

