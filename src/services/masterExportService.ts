import { Project, Speaker } from '../types/storia';
import { studioTransportEngine } from '../core/dsp/StudioTransportEngine';
import { processSpeakerDspBuffer } from '../core/dsp/BiquadChain';
import { LoudnessMeter } from '../core/dsp/LoudnessMeter';
import { encodeMasterWavBuffer, resampleFloat32Buffer } from '../core/dsp/TpdfDither';
import { Mp3Encoder } from '@breezystack/lamejs';

export interface RenderedMasterEpisode {
  wavBlob: Blob;
  mp3Blob: Blob;
  totalDurationSec: number;
  integratedLufs: number;
  truePeakDbfs: number;
  appliedMakeupGainDb: number;
  sampleRate: number;
  bitDepth: number;
  filename: string;
  mp3Filename: string;
}

export interface RenderedSpeakerStem {
  speakerId: string;
  speakerName: string;
  wavBlob: Blob;
  mp3Blob: Blob;
  totalDurationSec: number;
  filename: string;
  mp3Filename: string;
}

/**
 * Encodes a mono Float32Array buffer into raw MP3 chunk arrays at 320 kbps CBR
 * using the pure JavaScript lamejs MP3 encoder.
 */
export function encodeMasterMp3Chunks(
  samples: Float32Array,
  sampleRate: number,
  kbps = 320
): Uint8Array[] {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);

  // Convert Float32 [-1.0, 1.0] to 16-bit signed PCM [-32768, 32767]
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }

  const mp3Chunks: Uint8Array[] = [];
  const blockSize = 1152; // LAME standard MP3 frame sample size
  for (let i = 0; i < int16Samples.length; i += blockSize) {
    const chunk = int16Samples.subarray(i, i + blockSize);
    const mp3Buf = encoder.encodeBuffer(chunk);
    if (mp3Buf && mp3Buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3Buf));
    }
  }

  const finalChunk = encoder.flush();
  if (finalChunk && finalChunk.length > 0) {
    mp3Chunks.push(new Uint8Array(finalChunk));
  }

  return mp3Chunks;
}

/**
 * Encodes a mono Float32Array buffer into a high-fidelity MP3 Blob at 320 kbps CBR
 * using the pure JavaScript lamejs MP3 encoder.
 */
export function encodeMasterMp3Buffer(
  samples: Float32Array,
  sampleRate: number,
  kbps = 320
): Blob {
  const mp3Chunks = encodeMasterMp3Chunks(samples, sampleRate, kbps);
  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}

/**
 * Normalizes an audio buffer to target LUFS with a brickwall peak limit in dBFS.
 */
export function normalizeBufferToLufs(
  buffer: Float32Array,
  sampleRate: number,
  targetLufs = -16.0,
  truePeakCeilingDb = -1.0
): {
  normalized: Float32Array;
  measuredLufs: number;
  truePeakDbfs: number;
  appliedGainDb: number;
} {
  const meter = new LoudnessMeter(sampleRate);
  const initial = meter.analyzeBuffer(buffer, targetLufs, truePeakCeilingDb);

  // If silent or extremely quiet, return early
  if (!Number.isFinite(initial.integratedLufs) || initial.integratedLufs <= -70) {
    return {
      normalized: new Float32Array(buffer),
      measuredLufs: -70.0,
      truePeakDbfs: -70.0,
      appliedGainDb: 0.0,
    };
  }

  // Calculate needed gain delta
  let gainDeltaDb = targetLufs - initial.integratedLufs;
  const ceilingLin = Math.pow(10, truePeakCeilingDb / 20); // e.g. -1.0 dBFS ≈ 0.89125

  // Check if target gain would cause true peak to overshoot ceiling
  const projectedPeakDbfs = initial.truePeakDbfs + gainDeltaDb;
  if (projectedPeakDbfs > truePeakCeilingDb) {
    gainDeltaDb = truePeakCeilingDb - initial.truePeakDbfs;
  }

  const gainLin = Math.pow(10, gainDeltaDb / 20);
  const normalized = new Float32Array(buffer.length);

  // Apply gain with soft-knee brickwall limiter ceiling
  for (let i = 0; i < buffer.length; i++) {
    let s = buffer[i] * gainLin;
    if (Math.abs(s) > ceilingLin) {
      s = Math.sign(s) * (ceilingLin - 0.0001);
    }
    normalized[i] = s;
  }

  // Re-measure post-gain
  const finalMeasurement = meter.analyzeBuffer(normalized, targetLufs, truePeakCeilingDb);

  return {
    normalized,
    measuredLufs: finalMeasurement.integratedLufs,
    truePeakDbfs: finalMeasurement.truePeakDbfs,
    appliedGainDb: gainDeltaDb,
  };
}

/**
 * Concatenates and renders the complete multi-block episode master mix,
 * applying individual speaker Biquad EQ & Dynamics chains, pauses,
 * ITU-R BS.1770-4 LUFS normalization, True Peak limiting, and TPDF dithering.
 */
export async function renderMasterEpisodeMix(
  project: Project,
  onProgress?: (progressPct: number) => void
): Promise<RenderedMasterEpisode> {
  const internalSampleRate = 48000;
  const blocks = project.blocks;
  const totalBlocks = Math.max(1, blocks.length);

  const speakerMap = new Map<string, Speaker>();
  for (const s of project.speakers) {
    speakerMap.set(s.id, s);
  }

  // 1. Resolve and render each block's DSP-processed audio samples
  const processedSegments: Float32Array[] = [];
  let totalSampleCount = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const speaker = block.speakerId ? speakerMap.get(block.speakerId) : undefined;

    // Resolve raw PCM samples for this block
    const { samples: rawSamples, sampleRate: srcRate } =
      await studioTransportEngine.resolveBlockPcm(block, speaker);

    let dspSamples: Float32Array;
    if (rawSamples.length > 0) {
      // Process through speaker's 3-band Biquad EQ and compressor
      const processed = processSpeakerDspBuffer(rawSamples, speaker, srcRate);

      // Resample to internal 48 kHz if needed
      if (srcRate !== internalSampleRate) {
        const ratio = srcRate / internalSampleRate;
        const newLen = Math.round(processed.length / ratio);
        dspSamples = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const srcIdx = i * ratio;
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(processed.length - 1, i0 + 1);
          const frac = srcIdx - i0;
          dspSamples[i] = processed[i0] * (1.0 - frac) + processed[i1] * frac;
        }
      } else {
        dspSamples = processed;
      }
    } else {
      dspSamples = new Float32Array(0);
    }

    processedSegments.push(dspSamples);
    totalSampleCount += dspSamples.length;

    // Append trailing pause silence interval
    const pauseMs = Math.max(0, block.pauseAfterMs ?? 0);
    const pauseSamplesCount = Math.round((pauseMs / 1000) * internalSampleRate);
    if (pauseSamplesCount > 0) {
      processedSegments.push(new Float32Array(pauseSamplesCount)); // Zeroes = silence
      totalSampleCount += pauseSamplesCount;
    }

    onProgress?.(Math.round(((idx + 1) / totalBlocks) * 50));
  }

  // 2. Concatenate into continuous master Float32Array buffer
  const concatenated = new Float32Array(totalSampleCount);
  let writeOffset = 0;
  for (const seg of processedSegments) {
    concatenated.set(seg, writeOffset);
    writeOffset += seg.length;
  }

  onProgress?.(65);

  // 3. Normalize integrated loudness to project target LUFS (default -16.0 LUFS) with -1.0 dBFS ceiling
  const targetLufs = project.audioConfig.targetLufs ?? -16.0;
  const truePeakCeilingDb = project.audioConfig.truePeakLimitDb ?? -1.0;

  const normalizedResult = normalizeBufferToLufs(
    concatenated,
    internalSampleRate,
    targetLufs,
    truePeakCeilingDb
  );

  onProgress?.(85);

  // 4. Encode to broadcast-standard multi-bit-depth WAV with TPDF dither
  const wavArrayBuffer = encodeMasterWavBuffer(
    normalizedResult.normalized,
    project.audioConfig,
    internalSampleRate
  );

  // 5. Encode to high-quality 320 kbps MP3 using lamejs
  const exportMp3Samples =
    internalSampleRate !== project.audioConfig.sampleRate
      ? resampleFloat32Buffer(
          normalizedResult.normalized,
          internalSampleRate,
          project.audioConfig.sampleRate
        )
      : normalizedResult.normalized;

  const mp3Blob = encodeMasterMp3Buffer(
    exportMp3Samples,
    project.audioConfig.sampleRate,
    320
  );

  onProgress?.(100);

  const totalDurationSec = totalSampleCount / internalSampleRate;
  const safeTitle = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'storia_master';
  const filename = `${safeTitle}_master_${project.audioConfig.sampleRate}hz_${project.audioConfig.bitDepth}bit.wav`;
  const mp3Filename = `${safeTitle}_master_${project.audioConfig.sampleRate}hz_320kbps.mp3`;

  const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

  return {
    wavBlob,
    mp3Blob,
    totalDurationSec,
    integratedLufs: normalizedResult.measuredLufs,
    truePeakDbfs: normalizedResult.truePeakDbfs,
    appliedMakeupGainDb: normalizedResult.appliedGainDb,
    sampleRate: project.audioConfig.sampleRate,
    bitDepth: project.audioConfig.bitDepth,
    filename,
    mp3Filename,
  };
}

/**
 * Renders individual time-aligned per-speaker stems (DAW track exports).
 * Each stem contains that speaker's dialogue with silence during other speakers' lines,
 * allowing effortless multi-track mixing in external DAWs (Reaper, Pro Tools, etc.).
 */
export async function renderSpeakerStems(
  project: Project,
  onProgress?: (progressPct: number) => void
): Promise<RenderedSpeakerStem[]> {
  const internalSampleRate = 48000;
  const blocks = project.blocks;
  const speakers = project.speakers;

  if (speakers.length === 0 || blocks.length === 0) {
    return [];
  }

  // Pre-calculate block durations and pause sample offsets
  interface BlockSegment {
    blockId: string;
    speakerId?: string;
    samples: Float32Array;
    pauseSamplesCount: number;
  }

  const segmentList: BlockSegment[] = [];
  let totalEpisodeSamples = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const blk = blocks[idx];
    const spk = blk.speakerId ? speakers.find((s) => s.id === blk.speakerId) : undefined;
    const { samples: rawSamples, sampleRate: srcRate } =
      await studioTransportEngine.resolveBlockPcm(blk, spk);

    let dspSamples: Float32Array;
    if (rawSamples.length > 0) {
      const processed = processSpeakerDspBuffer(rawSamples, spk, srcRate);
      if (srcRate !== internalSampleRate) {
        const ratio = srcRate / internalSampleRate;
        const newLen = Math.round(processed.length / ratio);
        dspSamples = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const srcIdx = i * ratio;
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(processed.length - 1, i0 + 1);
          const frac = srcIdx - i0;
          dspSamples[i] = processed[i0] * (1.0 - frac) + processed[i1] * frac;
        }
      } else {
        dspSamples = processed;
      }
    } else {
      dspSamples = new Float32Array(0);
    }

    const pauseMs = Math.max(0, blk.pauseAfterMs ?? 0);
    const pauseSamplesCount = Math.round((pauseMs / 1000) * internalSampleRate);

    segmentList.push({
      blockId: blk.id,
      speakerId: blk.speakerId,
      samples: dspSamples,
      pauseSamplesCount,
    });

    totalEpisodeSamples += dspSamples.length + pauseSamplesCount;
  }

  const stems: RenderedSpeakerStem[] = [];
  const totalDurationSec = totalEpisodeSamples / internalSampleRate;
  const safeProjectTitle = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'storia';

  // Render a time-aligned stem for each speaker
  for (let sIdx = 0; sIdx < speakers.length; sIdx++) {
    const speaker = speakers[sIdx];
    const stemBuffer = new Float32Array(totalEpisodeSamples);
    let offset = 0;

    for (const seg of segmentList) {
      if (seg.speakerId === speaker.id) {
        stemBuffer.set(seg.samples, offset);
      }
      // Advance offset for speech + pause whether this speaker spoke or not (time alignment)
      offset += seg.samples.length + seg.pauseSamplesCount;
    }

    const wavArrayBuffer = encodeMasterWavBuffer(
      stemBuffer,
      project.audioConfig,
      internalSampleRate
    );

    const stemMp3Samples =
      internalSampleRate !== project.audioConfig.sampleRate
        ? resampleFloat32Buffer(
            stemBuffer,
            internalSampleRate,
            project.audioConfig.sampleRate
          )
        : stemBuffer;

    const mp3Blob = encodeMasterMp3Buffer(
      stemMp3Samples,
      project.audioConfig.sampleRate,
      320
    );

    const safeSpeakerName = speaker.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `${safeProjectTitle}_stem_${safeSpeakerName}.wav`;
    const mp3Filename = `${safeProjectTitle}_stem_${safeSpeakerName}_320kbps.mp3`;
    const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

    stems.push({
      speakerId: speaker.id,
      speakerName: speaker.name,
      wavBlob,
      mp3Blob,
      totalDurationSec,
      filename,
      mp3Filename,
    });

    onProgress?.(Math.round(((sIdx + 1) / speakers.length) * 100));
  }

  return stems;
}

