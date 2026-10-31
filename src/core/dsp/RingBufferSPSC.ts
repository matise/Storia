import { ANTI_DENORMAL_OFFSET } from './BiquadChain';

/**
 * Flushes IEEE-754 subnormal / denormal numbers (|x| < 1e-37) to zero after adding
 * a +1e-25 DC offset, preventing CPU microcode stalls in recursive IIR/Biquad filters.
 */
export function sanitizeDenormalsInPlace(
  samples: Float32Array,
  dcOffset = ANTI_DENORMAL_OFFSET
): Float32Array {
  for (let i = 0; i < samples.length; i++) {
    const val = samples[i] + dcOffset;
    samples[i] = Math.abs(val) < 1e-37 ? 0.0 : val;
  }
  return samples;
}

/**
 * Lock-Free Single-Producer Single-Consumer (SPSC) Audio Ring Buffer.
 * Uses SharedArrayBuffer + Atomics when cross-origin isolated, with automatic
 * fallback to standard ArrayBuffer so it works in all browser and test environments.
 *
 * Memory layout inside backing buffer:
 * - Bytes 0..7: Int32Array(2) -> [0] = writeIndex, [1] = readIndex
 * - Bytes 8..end: Float32Array(storageLength) -> circular sample ring
 *
 * Note: Internal storage allocates `capacity + 1` slots so `writeIndex === readIndex`
 * unambiguously represents an empty buffer and `(writeIndex + 1) % size === readIndex`
 * represents a full buffer of exact usable `capacity`.
 */
export class RingBufferSPSC {
  public readonly capacity: number;
  private readonly storageSize: number;
  private readonly backingBuffer: SharedArrayBuffer | ArrayBuffer;
  private readonly indices: Int32Array;
  private readonly ring: Float32Array;
  public readonly isSharedMemory: boolean;

  constructor(capacity = 16384, existingBuffer?: SharedArrayBuffer | ArrayBuffer) {
    if (capacity < 16) {
      throw new Error('RingBufferSPSC capacity must be at least 16 samples');
    }
    this.capacity = capacity;
    this.storageSize = capacity + 1;

    const totalBytes = 2 * Int32Array.BYTES_PER_ELEMENT + this.storageSize * Float32Array.BYTES_PER_ELEMENT;

    if (existingBuffer) {
      this.backingBuffer = existingBuffer;
      this.isSharedMemory =
        typeof SharedArrayBuffer !== 'undefined' &&
        existingBuffer instanceof SharedArrayBuffer;
    } else if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        this.backingBuffer = new SharedArrayBuffer(totalBytes);
        this.isSharedMemory = true;
      } catch {
        this.backingBuffer = new ArrayBuffer(totalBytes);
        this.isSharedMemory = false;
      }
    } else {
      this.backingBuffer = new ArrayBuffer(totalBytes);
      this.isSharedMemory = false;
    }

    this.indices = new Int32Array(this.backingBuffer, 0, 2);
    this.ring = new Float32Array(
      this.backingBuffer,
      2 * Int32Array.BYTES_PER_ELEMENT,
      this.storageSize
    );
  }

  public get buffer(): SharedArrayBuffer | ArrayBuffer {
    return this.backingBuffer;
  }

  private loadIndex(slot: 0 | 1): number {
    if (this.isSharedMemory && typeof Atomics !== 'undefined') {
      return Atomics.load(this.indices, slot);
    }
    return this.indices[slot];
  }

  private storeIndex(slot: 0 | 1, value: number): void {
    if (this.isSharedMemory && typeof Atomics !== 'undefined') {
      Atomics.store(this.indices, slot, value);
    } else {
      this.indices[slot] = value;
    }
  }

  /**
   * Number of samples currently queued and available for the consumer to pop.
   */
  public availableToRead(): number {
    const w = this.loadIndex(0);
    const r = this.loadIndex(1);
    if (w >= r) {
      return w - r;
    }
    return this.storageSize - r + w;
  }

  /**
   * Number of free sample slots available for the producer to push.
   */
  public availableToWrite(): number {
    return this.capacity - this.availableToRead();
  }

  /**
   * Producer: pushes up to `samples.length` float samples into the ring buffer.
   * Returns the exact number of samples written.
   */
  public push(samples: Float32Array): number {
    const free = this.availableToWrite();
    const toWrite = Math.min(free, samples.length);
    if (toWrite <= 0) return 0;

    const w = this.loadIndex(0);
    const firstChunk = Math.min(toWrite, this.storageSize - w);

    for (let i = 0; i < firstChunk; i++) {
      const s = samples[i];
      this.ring[w + i] = Math.abs(s) < 1e-37 ? 0.0 : s;
    }

    const secondChunk = toWrite - firstChunk;
    for (let i = 0; i < secondChunk; i++) {
      const s = samples[firstChunk + i];
      this.ring[i] = Math.abs(s) < 1e-37 ? 0.0 : s;
    }

    const nextW = (w + toWrite) % this.storageSize;
    this.storeIndex(0, nextW);
    return toWrite;
  }

  /**
   * Consumer: pops up to `out.length` float samples from the ring buffer into `out`.
   * Returns the exact number of samples read.
   */
  public pop(out: Float32Array): number {
    const avail = this.availableToRead();
    const toRead = Math.min(avail, out.length);
    if (toRead <= 0) return 0;

    const r = this.loadIndex(1);
    const firstChunk = Math.min(toRead, this.storageSize - r);

    for (let i = 0; i < firstChunk; i++) {
      const val = this.ring[r + i] + ANTI_DENORMAL_OFFSET;
      out[i] = Math.abs(val) < 1e-37 ? 0.0 : val;
    }

    const secondChunk = toRead - firstChunk;
    for (let i = 0; i < secondChunk; i++) {
      const val = this.ring[i] + ANTI_DENORMAL_OFFSET;
      out[firstChunk + i] = Math.abs(val) < 1e-37 ? 0.0 : val;
    }

    const nextR = (r + toRead) % this.storageSize;
    this.storeIndex(1, nextR);
    return toRead;
  }

  /**
   * Resets read and write pointers to empty.
   */
  public clear(): void {
    this.storeIndex(0, 0);
    this.storeIndex(1, 0);
  }
}

