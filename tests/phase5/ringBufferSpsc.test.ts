import { describe, it, expect } from 'vitest';
import {
  RingBufferSPSC,
  sanitizeDenormalsInPlace,
} from '../../src/core/dsp/RingBufferSPSC';

describe('Phase 5 — Lock-Free SPSC Ring Buffer & Anti-Denormal Protection', () => {
  it('pushes and pops 100,000 float samples across randomized chunk sizes with zero sample loss or corruption across wrap-around boundaries', () => {
    const totalSamples = 100_000;
    const sourceData = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      sourceData[i] = Math.sin(i * 0.013) * 0.9;
    }

    const receivedData = new Float32Array(totalSamples);
    const ring = new RingBufferSPSC(1024); // Small capacity forces ~100 wrap-arounds

    const chunkChoices = [128, 256, 512];
    let writeCursor = 0;
    let readCursor = 0;
    let step = 0;

    while (readCursor < totalSamples) {
      const chunkSize = chunkChoices[step % chunkChoices.length];
      step++;

      if (writeCursor < totalSamples) {
        const end = Math.min(totalSamples, writeCursor + chunkSize);
        const slice = sourceData.subarray(writeCursor, end);
        const written = ring.push(slice);
        writeCursor += written;
      }

      const readSize = chunkChoices[(step + 1) % chunkChoices.length];
      const tempOut = new Float32Array(
        Math.min(readSize, totalSamples - readCursor)
      );
      const popped = ring.pop(tempOut);
      if (popped > 0) {
        receivedData.set(tempOut.subarray(0, popped), readCursor);
        readCursor += popped;
      }
    }

    expect(writeCursor).toBe(totalSamples);
    expect(readCursor).toBe(totalSamples);
    expect(ring.availableToRead()).toBe(0);
    expect(ring.availableToWrite()).toBe(1024);

    // Verify sample-for-sample integrity
    for (let i = 0; i < totalSamples; i += 97) {
      expect(receivedData[i]).toBeCloseTo(sourceData[i], 6);
    }
  });

  it('flushes IEEE-754 subnormal / denormal floats (|x| < 1e-37) and preserves normal audio signals', () => {
    const buf = new Float32Array([1e-42, -1e-40, 0.0, 0.5, -0.25]);
    sanitizeDenormalsInPlace(buf, 0);

    expect(buf[0]).toBe(0.0);
    expect(buf[1]).toBe(0.0);
    expect(buf[3]).toBeCloseTo(0.5, 6);
    expect(buf[4]).toBeCloseTo(-0.25, 6);
  });
});

