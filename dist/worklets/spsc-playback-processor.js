/**
 * Storia Real-Time Lock-Free SPSC AudioWorkletProcessor
 * Pulls 128-sample render quanta from a SharedArrayBuffer SPSC ring buffer
 * (or queued message chunks) and injects a +1e-25 DC offset to prevent CPU denormals.
 */
const DENORMAL_OFFSET = 1e-25;

class SpscPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.indices = null;
    this.ring = null;
    this.storageSize = 0;
    this.fallbackQueue = [];
    this.fallbackOffset = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'INIT_SAB' && data.buffer && data.capacity) {
        this.storageSize = data.capacity + 1;
        this.indices = new Int32Array(data.buffer, 0, 2);
        this.ring = new Float32Array(
          data.buffer,
          2 * Int32Array.BYTES_PER_ELEMENT,
          this.storageSize
        );
      } else if (data.type === 'PUSH_SAMPLES' && data.samples instanceof Float32Array) {
        this.fallbackQueue.push(data.samples);
      } else if (data.type === 'CLEAR') {
        if (this.indices) {
          Atomics.store(this.indices, 0, 0);
          Atomics.store(this.indices, 1, 0);
        }
        this.fallbackQueue = [];
        this.fallbackOffset = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel0 = output[0];
    const frameCount = channel0.length;

    if (this.indices && this.ring) {
      const w = Atomics.load(this.indices, 0);
      const r = Atomics.load(this.indices, 1);
      const avail = w >= r ? w - r : this.storageSize - r + w;
      const toRead = Math.min(avail, frameCount);

      for (let i = 0; i < toRead; i++) {
        const idx = (r + i) % this.storageSize;
        const val = this.ring[idx] + DENORMAL_OFFSET;
        channel0[i] = Math.abs(val) < 1e-37 ? 0.0 : val;
      }
      for (let i = toRead; i < frameCount; i++) {
        channel0[i] = DENORMAL_OFFSET;
      }

      if (toRead > 0) {
        Atomics.store(this.indices, 1, (r + toRead) % this.storageSize);
      }
    } else if (this.fallbackQueue.length > 0) {
      let written = 0;
      while (written < frameCount && this.fallbackQueue.length > 0) {
        const current = this.fallbackQueue[0];
        const remInChunk = current.length - this.fallbackOffset;
        const copyCount = Math.min(frameCount - written, remInChunk);

        for (let i = 0; i < copyCount; i++) {
          const val = current[this.fallbackOffset + i] + DENORMAL_OFFSET;
          channel0[written + i] = Math.abs(val) < 1e-37 ? 0.0 : val;
        }

        written += copyCount;
        this.fallbackOffset += copyCount;
        if (this.fallbackOffset >= current.length) {
          this.fallbackQueue.shift();
          this.fallbackOffset = 0;
        }
      }
      for (let i = written; i < frameCount; i++) {
        channel0[i] = DENORMAL_OFFSET;
      }
    } else {
      for (let i = 0; i < frameCount; i++) {
        channel0[i] = DENORMAL_OFFSET;
      }
    }

    // Copy mono processed channel to any additional output channels
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(channel0);
    }

    return true;
  }
}

registerProcessor('spsc-playback-processor', SpscPlaybackProcessor);

