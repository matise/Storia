/**
 * Hardware audio buffer quantum at 48kHz (128 samples ≈ 2.6667ms)
 */
export const DEFAULT_AUDIO_QUANTUM_SEC = 128 / 48000;

/**
 * Decoupled Audio Clock Accumulator & Linear State Interpolator (Lerp).
 * Bridges discrete hardware Web Audio buffer steps with variable high-refresh
 * displays (60Hz / 120Hz ProMotion / 144Hz) to eliminate playhead jitter.
 */
export class ClockInterpolator {
  private prevAudioTimeSec = 0;
  private currAudioTimeSec = 0;
  private lastRenderTimeSec = 0;
  private accumulatedSec = 0;
  private fixedStepSec: number;
  private playbackRate = 1.0;

  constructor(fixedStepSec: number = DEFAULT_AUDIO_QUANTUM_SEC) {
    this.fixedStepSec = Math.max(0.0005, fixedStepSec);
  }

  /**
   * Resets or seeks the interpolator to an exact timeline position.
   */
  seek(timeSec: number): void {
    const clamped = Math.max(0, timeSec);
    this.prevAudioTimeSec = clamped;
    this.currAudioTimeSec = clamped;
    this.lastRenderTimeSec = clamped;
    this.accumulatedSec = 0;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(4.0, rate));
  }

  /**
   * Feeds a new authoritative hardware AudioContext timestamp.
   */
  pushHardwareAudioTime(hardwareTimeSec: number): void {
    const safeTime = Math.max(0, hardwareTimeSec);
    if (safeTime < this.currAudioTimeSec) {
      // Loop wrap-around or backward seek
      this.seek(safeTime);
      return;
    }
    this.prevAudioTimeSec = this.lastRenderTimeSec;
    this.currAudioTimeSec = safeTime;
    this.accumulatedSec = 0;
  }

  /**
   * Advances the display accumulator by `frameDeltaSec` (from requestAnimationFrame)
   * and returns the smoothly interpolated playhead timestamp:
   *   alpha = clamp(accumulated / fixedStep, 0, 1)
   *   pos_render = pos_prev * (1 - alpha) + pos_curr * alpha
   */
  stepFrame(frameDeltaSec: number, maxDurationSec?: number): {
    renderTimeSec: number;
    alpha: number;
  } {
    const safeDelta = Math.max(0, Math.min(0.1, frameDeltaSec)) * this.playbackRate;
    this.accumulatedSec += safeDelta;

    // If hardware audio clock hasn't pushed a newer packet yet, advance target smoothly
    if (this.accumulatedSec >= this.fixedStepSec) {
      const steps = Math.floor(this.accumulatedSec / this.fixedStepSec);
      this.prevAudioTimeSec = this.currAudioTimeSec;
      this.currAudioTimeSec += steps * this.fixedStepSec;
      this.accumulatedSec -= steps * this.fixedStepSec;
    }

    const alpha = Math.max(0, Math.min(1, this.accumulatedSec / this.fixedStepSec));
    let interpolated =
      this.prevAudioTimeSec * (1 - alpha) + this.currAudioTimeSec * alpha;

    // Guarantee monotonic forward progress during continuous playback
    if (interpolated < this.lastRenderTimeSec) {
      interpolated = this.lastRenderTimeSec;
    }

    if (maxDurationSec !== undefined && maxDurationSec > 0) {
      interpolated = Math.min(maxDurationSec, interpolated);
    }

    this.lastRenderTimeSec = interpolated;
    return {
      renderTimeSec: interpolated,
      alpha,
    };
  }

  getRenderTimeSec(): number {
    return this.lastRenderTimeSec;
  }
}

export type FrameCallback = (deltaSec: number, timestampMs: number) => void;

/**
 * On-Demand Render Loop Controller (`frameloop="demand"`).
 * Automatically sleeps (0% CPU/GPU usage) when playback is paused and user is not scrubbing,
 * waking immediately on `start()`, `setScrubbing(true)`, or single-frame `invalidate()`.
 */
export class DemandFrameLoop {
  private callback: FrameCallback;
  private isPlaying = false;
  private isScrubbing = false;
  private rafId: number | null = null;
  private lastTimestampMs: number | null = null;

  constructor(callback: FrameCallback) {
    this.callback = callback;
  }

  private scheduleNext(): void {
    if (this.rafId !== null) return;
    if (!this.isPlaying && !this.isScrubbing) return;

    if (typeof requestAnimationFrame === 'function') {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private cancelCurrent(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.lastTimestampMs = null;
  }

  private tick = (nowMs: number): void => {
    this.rafId = null;
    if (!this.isPlaying && !this.isScrubbing) {
      this.lastTimestampMs = null;
      return;
    }

    const deltaSec =
      this.lastTimestampMs !== null ? Math.max(0, (nowMs - this.lastTimestampMs) / 1000) : 1 / 60;
    this.lastTimestampMs = nowMs;

    this.callback(deltaSec, nowMs);
    this.scheduleNext();
  };

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.scheduleNext();
  }

  pause(): void {
    this.isPlaying = false;
    if (!this.isScrubbing) {
      this.cancelCurrent();
    }
  }

  setScrubbing(scrubbing: boolean): void {
    this.isScrubbing = scrubbing;
    if (scrubbing) {
      this.scheduleNext();
    } else if (!this.isPlaying) {
      this.cancelCurrent();
    }
  }

  /**
   * Triggers a single on-demand frame render while sleeping (`frameloop="demand"`).
   */
  invalidate(nowMs: number = typeof performance !== 'undefined' ? performance.now() : 0): void {
    this.callback(0, nowMs);
  }

  isActive(): boolean {
    return this.isPlaying || this.isScrubbing;
  }

  dispose(): void {
    this.isPlaying = false;
    this.isScrubbing = false;
    this.cancelCurrent();
  }
}

