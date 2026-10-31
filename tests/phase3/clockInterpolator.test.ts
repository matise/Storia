import { describe, expect, it, vi } from 'vitest';
import {
  ClockInterpolator,
  DemandFrameLoop,
} from '../../src/core/spatial/ClockInterpolator';

describe('Phase 3 — Decoupled Audio Clock Interpolator & Demand FrameLoop', () => {
  it('maintains strictly monotonic interpolated playhead positions across 60Hz, 120Hz, and 144Hz display steps', () => {
    const clock = new ClockInterpolator(128 / 48000); // ~2.667ms audio quantum
    const ratesHz = [60, 120, 144];

    for (const hz of ratesHz) {
      clock.seek(0);
      const dt = 1 / hz;
      let prevRender = 0;

      for (let frame = 0; frame < 300; frame++) {
        // Simulate jittery display frame delta (+/- 10%)
        const jitteredDelta = dt * (0.9 + ((frame % 5) * 0.05));
        const { renderTimeSec, alpha } = clock.stepFrame(jitteredDelta, 100);

        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);
        expect(renderTimeSec).toBeGreaterThanOrEqual(prevRender);
        prevRender = renderTimeSec;
      }

      expect(prevRender).toBeGreaterThan(1.5);
    }
  });

  it('sleeps when paused (frameloop="demand") and fires single-frame callback on invalidate()', () => {
    const callback = vi.fn();
    const loop = new DemandFrameLoop(callback);

    expect(loop.isActive()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(0);

    // Single-frame on-demand render while sleeping
    loop.invalidate(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(loop.isActive()).toBe(false);

    // Activate via scrubbing and then release
    loop.setScrubbing(true);
    expect(loop.isActive()).toBe(true);
    loop.setScrubbing(false);
    expect(loop.isActive()).toBe(false);

    loop.dispose();
  });
});

