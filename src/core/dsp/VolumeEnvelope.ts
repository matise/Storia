/**
 * Applies volume gain and Adobe Audition-style fade-in / fade-out curves
 * to a Float32Array audio buffer in-place.
 *
 * Curve parameter c in [-1.0, 1.0]:
 * - c === 0: Pure linear fade
 * - c > 0: Convex logarithmic fade (fast start / smooth finish, matching Audition drag UP)
 * - c < 0: Concave exponential fade (slow start / steep finish, matching Audition drag DOWN)
 */
export function applyVolumeEnvelope(
  samples: Float32Array,
  sampleRate: number,
  gainLinear = 1.0,
  fadeInMs = 0,
  fadeInCurve = 0,
  fadeOutMs = 0,
  fadeOutCurve = 0
): void {
  const totalSamples = samples.length;
  if (totalSamples === 0) return;

  const fadeInSamples = Math.min(
    Math.floor(totalSamples / 2),
    Math.round(((fadeInMs || 0) / 1000) * sampleRate)
  );
  const fadeOutSamples = Math.min(
    Math.floor(totalSamples / 2),
    Math.round(((fadeOutMs || 0) / 1000) * sampleRate)
  );

  const pIn = Math.exp(-1.5 * (fadeInCurve || 0));
  const pOut = Math.exp(-1.5 * (fadeOutCurve || 0));

  for (let i = 0; i < totalSamples; i++) {
    let env = 1.0;
    if (i < fadeInSamples && fadeInSamples > 0) {
      const t = i / fadeInSamples;
      env = Math.pow(t, pIn);
    } else if (i >= totalSamples - fadeOutSamples && fadeOutSamples > 0) {
      const tau = (i - (totalSamples - fadeOutSamples)) / fadeOutSamples;
      env = Math.pow(1.0 - tau, pOut);
    }
    samples[i] = samples[i] * gainLinear * env;
  }
}

/**
 * Schedules or updates real-time Adobe Audition-style volume fade curves
 * directly on a Web Audio GainNode.
 *
 * Starts from true zero amplitude (-infinity dB) at the starting corner and
 * calculates power curve transitions v(t) = t^p with live real-time parameter tuning.
 */
export function scheduleFadeEnvelope(
  gainNode: GainNode | null | undefined,
  ctx: BaseAudioContext | null | undefined,
  durationSec: number,
  fadeInMs: number = 0,
  fadeInCurve: number = 0,
  fadeOutMs: number = 0,
  fadeOutCurve: number = 0,
  startOffsetSec: number = 0,
  startContextTime?: number
): void {
  if (!gainNode || !ctx || !gainNode.gain) return;

  const now = ctx.currentTime;
  const startCtx = typeof startContextTime === 'number' ? startContextTime : now;
  const currentOffset = Math.max(0, startOffsetSec + (now - startCtx));
  const remainingSec = Math.max(0.02, durationSec - currentOffset);

  // Cancel any previously scheduled curve/events safely
  try {
    gainNode.gain.cancelScheduledValues?.(now);
  } catch {}

  const fadeInSec = Math.max(0, (fadeInMs || 0) / 1000);
  const fadeOutSec = Math.max(0, (fadeOutMs || 0) / 1000);
  const pIn = Math.exp(-1.5 * Math.max(-1, Math.min(1, fadeInCurve || 0)));
  const pOut = Math.exp(-1.5 * Math.max(-1, Math.min(1, fadeOutCurve || 0)));

  // If no active fades, set or transition smoothly to 1.0
  if (fadeInSec <= 0.005 && fadeOutSec <= 0.005) {
    try {
      if (typeof gainNode.gain.setTargetAtTime === 'function') {
        gainNode.gain.setTargetAtTime(1.0, now, 0.005);
      } else {
        gainNode.gain.value = 1.0;
      }
    } catch {
      gainNode.gain.value = 1.0;
    }
    return;
  }

  // Generate an envelope curve buffer from currentOffset to durationSec
  const steps = Math.min(256, Math.max(32, Math.round(remainingSec * 120)));
  const curve = new Float32Array(steps);

  for (let i = 0; i < steps; i++) {
    const tSec = currentOffset + (i / (steps - 1)) * remainingSec;
    let env = 1.0;

    // Fade-in region: starts at zero amplitude (-infinity dB) and curves up
    if (fadeInSec > 0.001 && tSec < fadeInSec) {
      const normT = Math.max(0, Math.min(1, tSec / fadeInSec));
      env = Math.pow(normT, pIn);
    }

    // Fade-out region: curves down to zero amplitude (-infinity dB)
    const fadeOutStart = durationSec - fadeOutSec;
    if (fadeOutSec > 0.001 && tSec >= fadeOutStart) {
      const normTau = Math.max(0, Math.min(1, (tSec - fadeOutStart) / fadeOutSec));
      const outEnv = Math.pow(1.0 - normTau, pOut);
      env = Math.min(env, outEnv);
    }

    curve[i] = Math.max(0.0, Math.min(1.0, env));
  }

  try {
    if (typeof gainNode.gain.setValueCurveAtTime === 'function') {
      gainNode.gain.setValueCurveAtTime(curve, now, remainingSec);
    } else if (typeof gainNode.gain.setTargetAtTime === 'function') {
      gainNode.gain.setTargetAtTime(curve[0], now, 0.005);
    } else {
      gainNode.gain.value = curve[0];
    }
  } catch {
    try {
      if (typeof gainNode.gain.setTargetAtTime === 'function') {
        gainNode.gain.setTargetAtTime(curve[0], now, 0.005);
      } else {
        gainNode.gain.value = curve[0];
      }
    } catch {}
  }
}

