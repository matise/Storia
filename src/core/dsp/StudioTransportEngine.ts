import { Project, ScriptBlock, Speaker, SupportedLanguage } from '../../types/storia';
import {
  SpeakerDspChain,
  processSpeakerDspBuffer,
} from './BiquadChain';
import { LoudnessMeasurement, LoudnessMeter } from './LoudnessMeter';
import { scheduleFadeEnvelope } from './VolumeEnvelope';
import { getLatestBlockAudioEntry } from '../storage/audioCache';
import { synthesizeProceduralSpeechPcm } from '../../services/geminiTtsService';
import { synthesizeSfxAudio } from '../../services/sfxGeneratorService';

export type TtsSpeakerFn = (params: {
  text: string;
  speaker?: Speaker;
  language?: SupportedLanguage;
  startOffsetSec?: number;
  onEnded?: () => void;
}) => boolean;

export function registerTtsSpeaker(fn: TtsSpeakerFn): void {
  (globalThis as unknown as { __storia_tts_speaker?: TtsSpeakerFn }).__storia_tts_speaker = fn;
}

export function getRegisteredTtsSpeaker(): TtsSpeakerFn | null {
  return (globalThis as unknown as { __storia_tts_speaker?: TtsSpeakerFn }).__storia_tts_speaker ?? null;
}

export interface LiveMeterSnapshot {
  momentaryLufs: number;
  integratedLufs: number;
  truePeakDbfs: number;
  rmsDbfs: number;
  isBroadcastSafe: boolean;
  activeSpeakerId: string | null;
  activeBlockId: string | null;
}

type MeterSubscriber = (snapshot: LiveMeterSnapshot) => void;

/**
 * Decodes a standard 16-bit PCM RIFF/WAV ArrayBuffer into a normalized Float32Array [-1.0, 1.0]
 * and its sample rate without requiring an active DOM AudioContext (works in both Browser & Vitest).
 */
export function decodeWavBufferToFloat32(buffer: ArrayBuffer): {
  samples: Float32Array;
  sampleRate: number;
} {
  if (buffer.byteLength <= 44) {
    return { samples: new Float32Array(0), sampleRate: 24000 };
  }
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true) || 24000;
  const bitsPerSample = view.getUint16(34, true) || 16;

  // Locate 'data' chunk or default to offset 44
  let dataOffset = 44;
  let dataBytes = buffer.byteLength - 44;
  for (let offset = 12; offset + 8 <= Math.min(buffer.byteLength, 128); ) {
    const chunkId =
      String.fromCharCode(view.getUint8(offset)) +
      String.fromCharCode(view.getUint8(offset + 1)) +
      String.fromCharCode(view.getUint8(offset + 2)) +
      String.fromCharCode(view.getUint8(offset + 3));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataBytes = Math.min(chunkSize, buffer.byteLength - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (bitsPerSample === 32) {
    const count = Math.floor(dataBytes / 4);
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = view.getFloat32(dataOffset + i * 4, true);
    }
    return { samples: out, sampleRate };
  }

  if (bitsPerSample === 24) {
    const count = Math.floor(dataBytes / 3);
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const b0 = view.getUint8(dataOffset + i * 3);
      const b1 = view.getUint8(dataOffset + i * 3 + 1);
      const b2 = view.getInt8(dataOffset + i * 3 + 2);
      const int24 = (b2 << 16) | (b1 << 8) | b0;
      out[i] = int24 / 8388608.0;
    }
    return { samples: out, sampleRate };
  }

  const count = Math.floor(dataBytes / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const int16 = view.getInt16(dataOffset + i * 2, true);
    out[i] = int16 / 32768.0;
  }
  return { samples: out, sampleRate };
}

/**
 * Multi-Speaker Sequential Lookahead Transport & Master Broadcast Bus Engine.
 * Routes each speaker's voice through its dedicated `SpeakerDspChain` (120Hz Low-Shelf,
 * 2.5kHz Mid-Peak, 8kHz High-Shelf, Dynamics Compressor) into a -1.0 dBFS Brickwall Master Limiter
 * and ITU-R BS.1770-4 Loudness Meter.
 */
export class StudioTransportEngine {
  private ctx: AudioContext | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private meterTimer: ReturnType<typeof setInterval> | null = null;
  private pcmDataArray: Float32Array | null = null;
  private speakerChains = new Map<string, SpeakerDspChain>();
  private activeSource: AudioBufferSourceNode | null = null;
  private activeBlockFadeGain: GainNode | null = null;
  private activeBlockVolumeGain: GainNode | null = null;
  private activeBlockDurationSec = 0;
  private activeBlockFadeInMs = 0;
  private activeBlockFadeOutMs = 0;
  private activeBlockFadeInCurve = 0;
  private activeBlockFadeOutCurve = 0;
  private activeBlockId: string | null = null;
  /** Bumped on every trigger/stop so stale async triggers never start audio. */
  private triggerGeneration = 0;
  private activeStartCtxTime = 0;
  private activeStartOffsetSec = 0;
  private activeRawPcmCache = new Map<
    string,
    { samples: Float32Array; sampleRate: number }
  >();
  private subscribers = new Set<MeterSubscriber>();
  private latestSnapshot: LiveMeterSnapshot = {
    momentaryLufs: -16.0,
    integratedLufs: -16.0,
    truePeakDbfs: -1.8,
    rmsDbfs: -18.5,
    isBroadcastSafe: true,
    activeSpeakerId: null,
    activeBlockId: null,
  };

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterLimiter = this.ctx.createDynamicsCompressor();
        this.masterLimiter.threshold.value = -1.5;
        this.masterLimiter.knee.value = 0.0;
        this.masterLimiter.ratio.value = 20.0;
        this.masterLimiter.attack.value = 0.001;
        this.masterLimiter.release.value = 0.05;

        // Master AnalyserNode for continuous real-time broadcast VU metering
        this.masterAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser.fftSize = 256;

        this.masterLimiter.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getAudioContext(): AudioContext | null {
    return this.ensureAudioContext();
  }

  /**
   * Resumes the shared Web Audio context synchronously during user gestures
   * to satisfy strict browser autoplay policies.
   */
  public async resume(): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  public getOrCreateSpeakerChain(speaker?: Speaker): SpeakerDspChain | null {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterLimiter) return null;

    const key = speaker?.id ?? 'default_bus';
    let chain = this.speakerChains.get(key);
    if (!chain) {
      chain = new SpeakerDspChain(ctx, speaker);
      chain.connect(this.masterLimiter);
      this.speakerChains.set(key, chain);
    } else {
      chain.applySpeakerSettings(speaker);
    }
    return chain;
  }

  /**
   * Subscribes UI components (e.g. CastSidebar VU/LUFS meter) to live loudness snapshots.
   */
  public subscribeMeter(cb: MeterSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.latestSnapshot);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public getLatestSnapshot(): LiveMeterSnapshot {
    return this.latestSnapshot;
  }

  public emitSnapshot(snapshot: LiveMeterSnapshot): void {
    this.latestSnapshot = snapshot;
    for (const cb of this.subscribers) {
      cb(snapshot);
    }
  }

  /**
   * Starts real-time 50ms periodic sampling from the master bus AnalyserNode
   * so the VU meter and LUFS readout continuously reflect live audio dynamics during playback.
   */
  public startRealtimeMetering(
    activeBlockId: string | null,
    activeSpeakerId: string | null
  ): void {
    this.stopRealtimeMetering();
    if (!this.masterAnalyser) return;

    if (
      !this.pcmDataArray ||
      this.pcmDataArray.length !== this.masterAnalyser.frequencyBinCount
    ) {
      this.pcmDataArray = new Float32Array(this.masterAnalyser.frequencyBinCount);
    }

    this.meterTimer = setInterval(() => {
      if (!this.masterAnalyser || !this.pcmDataArray) return;
      try {
        if (typeof this.masterAnalyser.getFloatTimeDomainData === 'function') {
          this.masterAnalyser.getFloatTimeDomainData(this.pcmDataArray);
        } else {
          return;
        }

        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < this.pcmDataArray.length; i++) {
          const s = this.pcmDataArray[i];
          const abs = Math.abs(s);
          if (abs > peak) peak = abs;
          sumSq += s * s;
        }
        const meanSq = sumSq / this.pcmDataArray.length;
        const rmsDbfs = meanSq > 1e-10 ? 10 * Math.log10(meanSq) : -100;
        const peakDbfs = peak > 1e-5 ? 20 * Math.log10(peak) : -100;
        const momentaryLufs =
          meanSq > 1e-10 ? -0.691 + 10 * Math.log10(meanSq) : -70.0;

        this.emitSnapshot({
          momentaryLufs: Math.round(momentaryLufs * 10) / 10,
          integratedLufs: this.latestSnapshot.integratedLufs,
          truePeakDbfs: Math.round(peakDbfs * 10) / 10,
          rmsDbfs: Math.round(rmsDbfs * 10) / 10,
          isBroadcastSafe: peakDbfs <= -0.9,
          activeSpeakerId,
          activeBlockId,
        });
      } catch {
        // Safe fallback in headless / test environments
      }
    }, 50);
  }

  public stopRealtimeMetering(): void {
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
  }

  /**
   * Resolves or generates mono Float32Array samples for a ScriptBlock so both
   * real-time playback and ITU-R BS.1770-4 loudness metering operate on exact audio data.
   */
  public async resolveBlockPcm(
    block: ScriptBlock,
    speaker?: Speaker
  ): Promise<{ samples: Float32Array; sampleRate: number }> {
    const cachedMem = this.activeRawPcmCache.get(block.id);
    if (cachedMem && cachedMem.samples.length > 0) {
      return cachedMem;
    }

    // 0. Try block.generatedAudioUrl if present (e.g. object URL or external URL)
    if (block.generatedAudioUrl) {
      try {
        const resp = await fetch(block.generatedAudioUrl);
        const ab = await resp.arrayBuffer();
        const decoded = decodeWavBufferToFloat32(ab);
        if (decoded.samples.length > 0) {
          this.activeRawPcmCache.set(block.id, decoded);
          return decoded;
        }
      } catch {
        // Fall through
      }
    }

    // 1. Try IndexedDB audio cache
    try {
      const entry = await getLatestBlockAudioEntry(block.id);
      if (entry?.audioBlob && typeof entry.audioBlob.arrayBuffer === 'function') {
        const ab = await entry.audioBlob.arrayBuffer();
        const decoded = decodeWavBufferToFloat32(ab);
        if (decoded.samples.length > 0) {
          this.activeRawPcmCache.set(block.id, decoded);
          return decoded;
        }
      }
    } catch {
      // Fall through to procedural synthesis
    }

    // 2. Fallback to fast procedural speech / SFX buffer for immediate transport auditioning
    if (block.type === 'sound_effect') {
      const sfx = await synthesizeSfxAudio({
        block,
        language: 'hr',
        useAiCompiler: false,
      });

      let ab: ArrayBuffer | null = null;
      if (sfx.audioBlob && typeof sfx.audioBlob.arrayBuffer === 'function') {
        ab = await sfx.audioBlob.arrayBuffer();
      } else if (typeof Response !== 'undefined') {
        ab = await new Response(sfx.audioBlob).arrayBuffer();
      }

      if (ab) {
        const decoded = decodeWavBufferToFloat32(ab);
        this.activeRawPcmCache.set(block.id, decoded);
        return decoded;
      }
    }

    const proc = synthesizeProceduralSpeechPcm({
      block,
      speaker,
      sampleRate: 24000,
    });
    const floatSamples = new Float32Array(proc.pcmInt16.length);
    for (let i = 0; i < proc.pcmInt16.length; i++) {
      floatSamples[i] = proc.pcmInt16[i] / 32768.0;
    }
    const result = { samples: floatSamples, sampleRate: 24000 };
    this.activeRawPcmCache.set(block.id, result);

    // Apply per-block volume gain if set
    let blockGainLin = 1.0;
    if (typeof block.volumeGainDb === 'number') {
      blockGainLin = !Number.isFinite(block.volumeGainDb) || block.volumeGainDb <= -48
        ? 0.0
        : Math.pow(10, block.volumeGainDb / 20);
    }

    if (Math.abs(blockGainLin - 1.0) > 1e-4) {
      const scaledSamples = new Float32Array(result.samples.length);
      for (let i = 0; i < result.samples.length; i++) {
        scaledSamples[i] = result.samples[i] * blockGainLin;
      }
      return { samples: scaledSamples, sampleRate: result.sampleRate };
    }

    return result;
  }

  /**
   * Computes ITU-R BS.1770-4 Loudness & True Peak after applying the speaker's
   * 3-band RBJ Biquad EQ and Dynamics Compressor.
   */
  public measureSpeakerProcessedLoudness(
    rawSamples: Float32Array,
    sampleRate: number,
    speaker?: Speaker,
    targetLufs = -16.0
  ): LoudnessMeasurement {
    const dspProcessed = processSpeakerDspBuffer(rawSamples, speaker, sampleRate);
    const meter = new LoudnessMeter(sampleRate);
    return meter.analyzeBuffer(dspProcessed, targetLufs, -1.0);
  }

  /**
   * Triggered during sequential timeline playback when the playhead enters a block.
   */
  public async triggerBlockOnTimeline(
    block: ScriptBlock,
    project: Project,
    offsetWithinBlockSec = 0
  ): Promise<void> {
    if (this.activeBlockId === block.id) {
      if (this.ctx) {
        const expectedOffset =
          this.activeStartOffsetSec +
          Math.max(0, this.ctx.currentTime - this.activeStartCtxTime);
        if (Math.abs(offsetWithinBlockSec - expectedOffset) <= 0.35) {
          return;
        }
      } else {
        return;
      }
    }
    this.stopCurrentSourceOnly();
    const myTrigger = ++this.triggerGeneration;
    this.activeBlockId = block.id;
    this.activeStartOffsetSec = offsetWithinBlockSec;
    this.activeStartCtxTime = this.ctx ? this.ctx.currentTime : 0;

    const speaker = project.speakers.find((s) => s.id === block.speakerId);

    // Check if the block has actual pre-rendered audio (WAV blob/URL or SFX)
    let hasAudioData =
      Boolean(block.generatedAudioUrl) || block.type === 'sound_effect';
    if (!hasAudioData) {
      try {
        const cached = await getLatestBlockAudioEntry(block.id);
        if (cached?.audioBlob) {
          hasAudioData = true;
        }
      } catch {
        // Fall through
      }
    }

    // Abort if stop() or a newer trigger (seek / next block) happened while querying cache
    if (myTrigger !== this.triggerGeneration || this.activeBlockId !== block.id) return;

    const ttsSpeaker = getRegisteredTtsSpeaker();
    if (!hasAudioData && block.type !== 'sound_effect' && ttsSpeaker) {
      // Unrendered dialogue or Local Browser TTS: speak with matching browser voice
      const spoke = ttsSpeaker({
        text: block.text,
        speaker,
        language: project.defaultLanguage,
        startOffsetSec: offsetWithinBlockSec,
      });
      if (spoke) return;
    }

    // Cancel any active SpeechSynthesis utterance before playing Web Audio stream
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const { samples, sampleRate } = await this.resolveBlockPcm(block, speaker);
    // Abort if stop() or a newer trigger (seek / next block) happened while decoding,
    // otherwise two sources of the same or adjacent blocks would overlap.
    if (myTrigger !== this.triggerGeneration || this.activeBlockId !== block.id) return;
    if (samples.length === 0) return;

    // Measure post-DSP ITU-R BS.1770-4 loudness & True Peak
    const measurement = this.measureSpeakerProcessedLoudness(
      samples,
      sampleRate,
      speaker,
      project.audioConfig.targetLufs
    );

    this.emitSnapshot({
      momentaryLufs: measurement.momentaryLufs,
      integratedLufs: measurement.integratedLufs,
      truePeakDbfs: measurement.truePeakDbfs,
      rmsDbfs: measurement.rmsDbfs,
      isBroadcastSafe: measurement.isBroadcastSafe,
      activeSpeakerId: speaker?.id ?? null,
      activeBlockId: block.id,
    });

    // Schedule Web Audio playback through SpeakerDspChain -> Master Limiter
    const ctx = this.ensureAudioContext();
    const chain = this.getOrCreateSpeakerChain(speaker);
    if (!ctx || !chain) return;

    try {
      const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Real-time clip fade envelope & volume gain nodes
      const fadeGain = ctx.createGain();
      fadeGain.gain.value = 1.0;

      const volGain = ctx.createGain();
      const linGain =
        !Number.isFinite(block.volumeGainDb) || (block.volumeGainDb ?? 0) <= -48
          ? 0.0
          : Math.pow(10, (block.volumeGainDb ?? 0) / 20);
      volGain.gain.value = linGain;

      source.connect(fadeGain);
      fadeGain.connect(volGain);
      volGain.connect(chain.inputNode);

      this.activeBlockFadeGain = fadeGain;
      this.activeBlockVolumeGain = volGain;
      this.activeBlockDurationSec = audioBuffer.duration;
      this.activeBlockFadeInMs = block.fadeInMs ?? 0;
      this.activeBlockFadeOutMs = block.fadeOutMs ?? 0;
      this.activeBlockFadeInCurve = block.fadeInCurve ?? 0;
      this.activeBlockFadeOutCurve = block.fadeOutCurve ?? 0;

      this.activeSource = source;
      const clampedOffset = Math.max(
        0,
        Math.min(audioBuffer.duration - 0.02, offsetWithinBlockSec)
      );
      this.activeStartCtxTime = ctx.currentTime;
      this.activeStartOffsetSec = clampedOffset;

      scheduleFadeEnvelope(
        fadeGain,
        ctx,
        audioBuffer.duration,
        block.fadeInMs ?? 0,
        block.fadeInCurve ?? 0,
        block.fadeOutMs ?? 0,
        block.fadeOutCurve ?? 0,
        clampedOffset,
        ctx.currentTime
      );

      source.start(0, clampedOffset);
      this.startRealtimeMetering(block.id, speaker?.id ?? null);
    } catch {
      // Ignore Web Audio errors in headless environments
    }
  }

  /**
   * Real-time click-free update when a playing block's volume knob or fade handles are dragged.
   */
  public updateBlockFadesAndGain(
    blockId: string,
    params: {
      volumeGainDb?: number;
      fadeInMs?: number;
      fadeOutMs?: number;
      fadeInCurve?: number;
      fadeOutCurve?: number;
    }
  ): void {
    if (this.activeBlockId !== blockId || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.activeBlockVolumeGain && typeof params.volumeGainDb === 'number') {
      const lin =
        !Number.isFinite(params.volumeGainDb) || params.volumeGainDb <= -48
          ? 0
          : Math.pow(10, params.volumeGainDb / 20);
      try {
        if (typeof this.activeBlockVolumeGain.gain.setTargetAtTime === 'function') {
          this.activeBlockVolumeGain.gain.setTargetAtTime(lin, now, 0.015);
        } else {
          this.activeBlockVolumeGain.gain.value = lin;
        }
      } catch {
        this.activeBlockVolumeGain.gain.value = lin;
      }
    }

    if (
      this.activeBlockFadeGain &&
      (params.fadeInMs !== undefined ||
        params.fadeOutMs !== undefined ||
        params.fadeInCurve !== undefined ||
        params.fadeOutCurve !== undefined)
    ) {
      if (params.fadeInMs !== undefined) this.activeBlockFadeInMs = params.fadeInMs;
      if (params.fadeOutMs !== undefined) this.activeBlockFadeOutMs = params.fadeOutMs;
      if (params.fadeInCurve !== undefined) this.activeBlockFadeInCurve = params.fadeInCurve;
      if (params.fadeOutCurve !== undefined) this.activeBlockFadeOutCurve = params.fadeOutCurve;

      scheduleFadeEnvelope(
        this.activeBlockFadeGain,
        this.ctx,
        this.activeBlockDurationSec,
        this.activeBlockFadeInMs,
        this.activeBlockFadeInCurve,
        this.activeBlockFadeOutMs,
        this.activeBlockFadeOutCurve,
        this.activeStartOffsetSec,
        this.activeStartCtxTime
      );
    }
  }

  /**
   * Real-time click-free update when a speaker's EQ or Dynamics sliders are dragged.
   */
  public updateSpeakerDsp(speaker: Speaker, targetLufs = -16.0): void {
    const chain = this.speakerChains.get(speaker.id);
    if (chain) {
      chain.applySpeakerSettings(speaker, false);
    }

    // Recompute live LUFS meter readout immediately so user sees EQ gain effect on loudness
    if (this.activeBlockId) {
      const cached = this.activeRawPcmCache.get(this.activeBlockId);
      if (cached && cached.samples.length > 0) {
        const m = this.measureSpeakerProcessedLoudness(
          cached.samples,
          cached.sampleRate,
          speaker,
          targetLufs
        );
        this.emitSnapshot({
          momentaryLufs: m.momentaryLufs,
          integratedLufs: m.integratedLufs,
          truePeakDbfs: m.truePeakDbfs,
          rmsDbfs: m.rmsDbfs,
          isBroadcastSafe: m.isBroadcastSafe,
          activeSpeakerId: speaker.id,
          activeBlockId: this.activeBlockId,
        });
      }
    }
  }

  public invalidateBlockCache(blockId?: string): void {
    if (blockId) {
      this.activeRawPcmCache.delete(blockId);
    } else {
      this.activeRawPcmCache.clear();
    }
  }

  private stopCurrentSourceOnly(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.activeSource = null;
    }
    if (this.activeBlockFadeGain) {
      try {
        this.activeBlockFadeGain.disconnect();
      } catch {}
      this.activeBlockFadeGain = null;
    }
    if (this.activeBlockVolumeGain) {
      try {
        this.activeBlockVolumeGain.disconnect();
      } catch {}
      this.activeBlockVolumeGain = null;
    }
  }

  public stop(): void {
    this.triggerGeneration++;
    this.stopCurrentSourceOnly();
    this.stopRealtimeMetering();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.activeBlockId = null;
    this.emitSnapshot({
      momentaryLufs: -70.0,
      integratedLufs:
        this.latestSnapshot.integratedLufs > -60
          ? this.latestSnapshot.integratedLufs
          : -16.0,
      truePeakDbfs: -100,
      rmsDbfs: -100,
      isBroadcastSafe: true,
      activeSpeakerId: null,
      activeBlockId: null,
    });
  }
}

export const studioTransportEngine = new StudioTransportEngine();
