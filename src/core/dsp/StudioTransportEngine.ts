import { Project, ScriptBlock, Speaker } from '../../types/storia';
import {
  SpeakerDspChain,
  processSpeakerDspBuffer,
} from './BiquadChain';
import { LoudnessMeasurement, LoudnessMeter } from './LoudnessMeter';
import { getLatestBlockAudioEntry } from '../storage/audioCache';
import { synthesizeProceduralSpeechPcm } from '../../services/geminiTtsService';
import { synthesizeSfxAudio } from '../../services/sfxGeneratorService';

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
  private speakerChains = new Map<string, SpeakerDspChain>();
  private activeSource: AudioBufferSourceNode | null = null;
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
        this.masterLimiter.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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

  private emitSnapshot(snapshot: LiveMeterSnapshot): void {
    this.latestSnapshot = snapshot;
    for (const cb of this.subscribers) {
      cb(snapshot);
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
      source.connect(chain.inputNode);

      this.activeSource = source;
      const clampedOffset = Math.max(
        0,
        Math.min(audioBuffer.duration - 0.02, offsetWithinBlockSec)
      );
      this.activeStartCtxTime = ctx.currentTime;
      this.activeStartOffsetSec = clampedOffset;
      source.start(0, clampedOffset);
    } catch {
      // Ignore Web Audio errors in headless environments
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
  }

  public stop(): void {
    this.triggerGeneration++;
    this.stopCurrentSourceOnly();
    this.activeBlockId = null;
  }
}

export const studioTransportEngine = new StudioTransportEngine();
