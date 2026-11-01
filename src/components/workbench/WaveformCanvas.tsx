import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { WaveformPeakData } from '../../types/storia';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';
import { VolumeGainKnob } from './VolumeGainKnob';
import { useTranslation } from '../../i18n/useTranslation';
import { updateLiveBlockAudio } from '../../core/dsp/LiveAudioPreviewer';

/**
 * Computes Y coordinates for volume curve gain plateau and zero amplitude baseline (-infinity dB).
 * Perceptual power curve distribution matching Adobe Audition.
 */
export function computeGainY(
  canvasHeight: number,
  gainDb: number
): { yGain: number; bottomY: number } {
  const bottomY = Math.max(10, canvasHeight - 2);
  const topY = 3;
  const unityY = Math.max(topY + 3, Math.round(canvasHeight * 0.20));

  let yGain: number;
  if (!Number.isFinite(gainDb) || gainDb <= -48) {
    yGain = bottomY;
  } else if (gainDb >= 0) {
    const ratio = Math.min(1.0, gainDb / 10);
    yGain = unityY - ratio * (unityY - topY);
  } else {
    const ratio = Math.max(0, (gainDb + 48) / 48);
    const pGain = Math.pow(ratio, 0.75);
    yGain = bottomY - pGain * (bottomY - unityY);
  }
  return { yGain, bottomY };
}

/**
 * Generates a deterministic Structure-of-Arrays (SoA) preview peak buffer
 * from block ID & text when TTS audio has not yet been rendered.
 */
export function generateSyntheticPreviewPeaks(
  seedStr: string,
  sliceCount = 96
): WaveformPeakData {
  const minPeaks = new Float32Array(sliceCount);
  const maxPeaks = new Float32Array(sliceCount);
  const rmsLevels = new Float32Array(sliceCount);

  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let i = 0; i < sliceCount; i++) {
    const t = i / Math.max(1, sliceCount - 1);
    const windowEnv = Math.sin(t * Math.PI);
    const syllabic =
      0.35 +
      0.35 * Math.abs(Math.sin(i * 0.42 + (hash & 0xff))) +
      0.25 * Math.abs(Math.cos(i * 0.91 + ((hash >>> 8) & 0xff)));
    const amp = Math.max(0.08, Math.min(0.95, syllabic * (0.3 + 0.7 * windowEnv)));

    minPeaks[i] = -amp;
    maxPeaks[i] = amp;
    rmsLevels[i] = amp * 0.68;
  }

  return {
    sampleRate: 100,
    length: sliceCount,
    minPeaks,
    maxPeaks,
    rmsLevels,
  };
}

/**
 * Converts a hex or rgb string into rgb components for opacity manipulation.
 */
function parseColorToRgb(colorStr: string): { r: number; g: number; b: number } {
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    }
  }
  return { r: 99, g: 102, b: 241 }; // Default indigo-500
}

export interface FadeConfig {
  fadeInMs?: number;
  fadeOutMs?: number;
  fadeInCurve?: number;
  fadeOutCurve?: number;
  durationSec?: number;
  activeHandle?: 'in' | 'out' | null;
  hoverHandle?: 'in' | 'out' | null;
}

/**
 * Zero-allocation Canvas 2D waveform rendering loop for Storia.
 * Features:
 * - Oscilloscope studio green / accent-tinted grid lines.
 * - Center zero-crossing line.
 * - High-resolution vertical spikes scaled by Volume Gain dB.
 * - Active playhead cursor needle.
 * - Adobe Audition-style Yellow Volume Envelope & Fade Curves (#facc15):
 *   - Fade-In with adjustable curvature (-1.0 concave exp to +1.0 convex log)
 *   - Plateau at clip volume gain level
 *   - Fade-Out with adjustable curvature
 *   - Diagonal-split drag handle boxes (gray/silver square) for Fade-In & Fade-Out
 */
export function renderWaveformToCanvas(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeakData | undefined,
  width: number,
  height: number,
  playheadProgress: number,
  accentColor: string,
  isRenderedAudio = true,
  gainDb = 0,
  fadeConfig?: FadeConfig
): void {
  ctx.clearRect(0, 0, width, height);
  if (width <= 0 || height <= 0) return;

  const midY = height / 2;

  // 1. Draw subtle studio grid lines (horizontal decibel reference + center line)
  ctx.save?.();
  ctx.strokeStyle = '#0f172a'; // Deep slate
  ctx.lineWidth = 1;

  // Quarter lines (-6dB / +6dB visual guidelines)
  ctx.beginPath?.();
  ctx.moveTo?.(0, Math.round(height * 0.25) + 0.5);
  ctx.lineTo?.(width, Math.round(height * 0.25) + 0.5);
  ctx.moveTo?.(0, Math.round(height * 0.75) + 0.5);
  ctx.lineTo?.(width, Math.round(height * 0.75) + 0.5);
  ctx.stroke?.();

  // Subtle vertical time divisions (every ~40px)
  const vertSpacing = 40;
  ctx.beginPath?.();
  for (let x = vertSpacing; x < width; x += vertSpacing) {
    ctx.moveTo?.(x + 0.5, 0);
    ctx.lineTo?.(x + 0.5, height);
  }
  ctx.stroke?.();

  // Center zero-crossing line
  ctx.strokeStyle = isRenderedAudio ? 'rgba(56, 189, 248, 0.28)' : 'rgba(51, 65, 85, 0.4)';
  ctx.beginPath?.();
  ctx.moveTo?.(0, midY);
  ctx.lineTo?.(width, midY);
  ctx.stroke?.();
  ctx.restore?.();

  // 2. If no rendered wave data, draw disabled / ungenerated grayish placeholder
  if (!isRenderedAudio || !peaks || peaks.length === 0) {
    ctx.save?.();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.setLineDash?.([4, 4]);
    ctx.beginPath?.();
    ctx.moveTo?.(8, midY);
    ctx.lineTo?.(width - 8, midY);
    ctx.stroke?.();

    const ghostCount = Math.max(12, Math.floor(width / 6));
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < ghostCount; i++) {
      const gx = (i / ghostCount) * width + 2;
      const gh = 3 + Math.sin(i * 0.3) * 2;
      ctx.fillRect(gx, midY - gh / 2, 2, gh);
    }
    ctx.restore?.();
    return;
  }

  // 3. Render actual waveform spikes with gain scaling
  const count = peaks.length;
  const clampedProgress = Math.min(1, Math.max(0, playheadProgress));
  const gainLinear = !Number.isFinite(gainDb) || gainDb <= -48 ? 0 : Math.pow(10, gainDb / 20);

  const stepX = width / count;
  const barWidth = Math.max(1, Math.min(3, stepX - 0.5));
  const rgb = parseColorToRgb(accentColor);

  const unplayedFill = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  const playedFill = accentColor;

  ctx.save?.();
  for (let i = 0; i < count; i++) {
    const x = i * stepX;
    const isPlayed = i / count <= clampedProgress;

    const rawMin = peaks.minPeaks[i] * gainLinear;
    const rawMax = peaks.maxPeaks[i] * gainLinear;

    const clampedMin = Math.max(-1.0, Math.min(1.0, rawMin));
    const clampedMax = Math.max(-1.0, Math.min(1.0, rawMax));

    const topY = midY + clampedMin * (midY * 0.88);
    const bottomY = midY + clampedMax * (midY * 0.88);
    const barH = Math.max(1.5, bottomY - topY);

    ctx.fillStyle = isPlayed ? playedFill : unplayedFill;
    ctx.fillRect(x, topY, barWidth, barH);
  }

  // 4. Draw Adobe Audition Volume Envelope Curve & Drag Handles (Yellow) if configured
  if (fadeConfig) {
    const dur = Math.max(0.1, fadeConfig.durationSec ?? 1.0);
    const fadeInSec = Math.max(0, (fadeConfig.fadeInMs ?? 0) / 1000);
    const fadeOutSec = Math.max(0, (fadeConfig.fadeOutMs ?? 0) / 1000);

    const xIn = Math.min(width * 0.49, (fadeInSec / dur) * width);
    const xOut = Math.max(width * 0.51, width - (fadeOutSec / dur) * width);

    const curveIn = Math.max(-1.0, Math.min(1.0, fadeConfig.fadeInCurve ?? 0));
    const curveOut = Math.max(-1.0, Math.min(1.0, fadeConfig.fadeOutCurve ?? 0));

    // Gain line Y and zero amplitude (-infinity dB) baseline Y
    const { yGain, bottomY } = computeGainY(height, gainDb);

    // Draw translucent envelope wash & yellow curve
    ctx.beginPath?.();

    // Fade In curve: starts from true zero (-infinity dB) at corner (0, bottomY)
    if (xIn > 1) {
      ctx.moveTo?.(0, bottomY);
      const pIn = Math.exp(-1.5 * curveIn);
      const steps = Math.max(12, Math.floor(xIn));
      for (let s = 1; s <= steps; s++) {
        const curX = (s / steps) * xIn;
        const t = curX / xIn;
        const v = Math.pow(t, pIn);
        const curY = bottomY - (bottomY - yGain) * v;
        ctx.lineTo?.(curX, curY);
      }
    } else {
      ctx.moveTo?.(0, yGain);
    }

    // Gain plateau
    ctx.lineTo?.(xOut, yGain);

    // Fade Out curve: curves down to true zero (-infinity dB) at corner (width, bottomY)
    if (width - xOut > 1) {
      const pOut = Math.exp(-1.5 * curveOut);
      const steps = Math.max(12, Math.floor(width - xOut));
      for (let s = 1; s <= steps; s++) {
        const curX = xOut + (s / steps) * (width - xOut);
        const tau = (curX - xOut) / (width - xOut);
        const v = Math.pow(1 - tau, pOut);
        const curY = bottomY - (bottomY - yGain) * v;
        ctx.lineTo?.(curX, curY);
      }
    } else {
      ctx.lineTo?.(width, yGain);
    }

    // Stroke yellow volume curve
    ctx.strokeStyle = '#facc15'; // Adobe Audition Golden Yellow
    ctx.lineWidth = 2;
    ctx.stroke?.();

    // Close path down to zero amplitude baseline (-infinity dB) to fill subtle golden wash
    ctx.lineTo?.(width, bottomY);
    ctx.lineTo?.(0, bottomY);
    ctx.closePath?.();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.09)';
    ctx.fill?.();

    // Render Adobe Audition diagonal split drag handle box (12x12)
    const drawAuditionHandle = (hx: number, hy: number, isActive: boolean) => {
      const boxSize = 12;
      const bx = Math.max(1, Math.min(width - boxSize - 1, hx - boxSize / 2));
      const by = Math.max(1, Math.min(height - boxSize - 1, hy - boxSize / 2));

      // Outer border & glow
      ctx.fillStyle = isActive ? '#facc15' : '#475569';
      ctx.fillRect?.(bx - 1, by - 1, boxSize + 2, boxSize + 2);

      // Top-left triangle (light silver)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath?.();
      ctx.moveTo?.(bx, by);
      ctx.lineTo?.(bx + boxSize, by);
      ctx.lineTo?.(bx, by + boxSize);
      ctx.closePath?.();
      ctx.fill?.();

      // Bottom-right triangle (slate gray)
      ctx.fillStyle = '#334155';
      ctx.beginPath?.();
      ctx.moveTo?.(bx + boxSize, by);
      ctx.lineTo?.(bx + boxSize, by + boxSize);
      ctx.lineTo?.(bx, by + boxSize);
      ctx.closePath?.();
      ctx.fill?.();

      // Diagonal divider line
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath?.();
      ctx.moveTo?.(bx + boxSize, by);
      ctx.lineTo?.(bx, by + boxSize);
      ctx.stroke?.();
    };

    // Draw Fade-In and Fade-Out Handles
    const isFadeInActive =
      fadeConfig.activeHandle === 'in' || fadeConfig.hoverHandle === 'in';
    const isFadeOutActive =
      fadeConfig.activeHandle === 'out' || fadeConfig.hoverHandle === 'out';

    drawAuditionHandle(xIn, yGain, Boolean(isFadeInActive));
    drawAuditionHandle(xOut, yGain, Boolean(isFadeOutActive));
  }

  // 5. Draw vibrant playhead cursor needle if active
  if (clampedProgress > 0 && clampedProgress < 1) {
    const playedWidth = width * clampedProgress;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(Math.max(0, playedWidth - 1), 0, 2, height);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.fillRect(Math.max(0, playedWidth - 2), 0, 4, height);
  }

  ctx.restore?.();
}

export interface WaveformCanvasProps {
  peaks?: WaveformPeakData;
  fallbackSeed?: string;
  playheadProgress: number; // 0.0 to 1.0
  accentColor: string;
  isRenderedAudio: boolean;
  height?: number;
  blockId?: string;
  durationSec?: number;
  isPlaying?: boolean;
  showTransportControls?: boolean;
  playTooltip?: string;
  restartTooltip?: string;
  volumeGainDb?: number; // Volume gain knob value in dB (-inf to +10dB, default 0)
  onChangeGainDb?: (gainDb: number) => void;
  gainKnobLabel?: string;
  fadeInMs?: number;
  fadeOutMs?: number;
  fadeInCurve?: number;
  fadeOutCurve?: number;
  onUpdateFade?: (fades: {
    fadeInMs?: number;
    fadeOutMs?: number;
    fadeInCurve?: number;
    fadeOutCurve?: number;
  }) => void;
  onTogglePlay?: () => void;
  onRestart?: () => void;
  onSeekProgress?: (progress: number) => void;
  onScrubStateChange?: (isScrubbing: boolean) => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks,
  fallbackSeed: _fallbackSeed,
  playheadProgress,
  accentColor,
  isRenderedAudio,
  height = 44, // Expanded height for rich waveform & Adobe Audition volume fade handles
  blockId,
  durationSec = 0,
  isPlaying = false,
  showTransportControls = false,
  playTooltip = 'Play / Pause block',
  restartTooltip = 'Restart block (0:00)',
  volumeGainDb = 0,
  onChangeGainDb,
  gainKnobLabel = 'Gain',
  fadeInMs = 0,
  fadeOutMs = 0,
  fadeInCurve = 0,
  fadeOutCurve = 0,
  onUpdateFade,
  onTogglePlay,
  onRestart,
  onSeekProgress,
  onScrubStateChange,
}) => {
  const { t } = useTranslation();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = React.useRef(false);

  const isDraggingFadeInRef = React.useRef<{
    startX: number;
    startY: number;
    initialMs: number;
    initialCurve: number;
  } | null>(null);

  const isDraggingFadeOutRef = React.useRef<{
    startX: number;
    startY: number;
    initialMs: number;
    initialCurve: number;
  } | null>(null);

  const [hoverProgress, setHoverProgress] = React.useState<number | null>(null);
  const [hoverHandle, setHoverHandle] = React.useState<'in' | 'out' | null>(null);
  const [activeDragHandle, setActiveDragHandle] = React.useState<'in' | 'out' | null>(
    null
  );

  const getHandlePositions = React.useCallback(
    (width: number, canvasHeight: number) => {
      const dur = Math.max(0.1, durationSec);
      const xIn = Math.min(width * 0.49, ((fadeInMs || 0) / 1000 / dur) * width);
      const xOut = Math.max(
        width * 0.51,
        width - ((fadeOutMs || 0) / 1000 / dur) * width
      );
      const { yGain, bottomY } = computeGainY(canvasHeight, volumeGainDb);
      const midY = canvasHeight / 2;
      return { xIn, xOut, yGain, bottomY, midY, dur };
    },
    [durationSec, fadeInMs, fadeOutMs, volumeGainDb]
  );

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent.toLowerCase().includes('jsdom')
    ) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? rect.width : 280;
    const cssHeight = height;

    const targetW = Math.round(cssWidth * dpr);
    const targetH = Math.round(cssHeight * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    renderWaveformToCanvas(
      ctx,
      peaks,
      cssWidth,
      cssHeight,
      playheadProgress,
      accentColor,
      isRenderedAudio,
      volumeGainDb,
      {
        fadeInMs,
        fadeOutMs,
        fadeInCurve,
        fadeOutCurve,
        durationSec,
        activeHandle: activeDragHandle,
        hoverHandle,
      }
    );
    ctx.restore();
  }, [
    peaks,
    playheadProgress,
    accentColor,
    isRenderedAudio,
    height,
    volumeGainDb,
    fadeInMs,
    fadeOutMs,
    fadeInCurve,
    fadeOutCurve,
    durationSec,
    activeDragHandle,
    hoverHandle,
  ]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const computeProgressFromClientX = (clientX: number | undefined): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const safeClientX =
      typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
    const ratio = (safeClientX - rect.left) / width;
    if (!Number.isFinite(ratio)) return 0;
    return Math.max(0, Math.min(1, ratio));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isRenderedAudio) return;
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width > 0 ? rect.width : 280);
    const canvasH = Math.max(1, rect.height > 0 ? rect.height : height);

    const safeClientX =
      typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : 0;
    const safeClientY =
      typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : 22;

    const canvasX = safeClientX - (rect.left || 0);
    const canvasY = safeClientY - (rect.top || 0);

    const { xIn, xOut, yGain } = getHandlePositions(width, canvasH);

    // Hit test Fade-In handle (14px radius)
    const distIn = Math.hypot(canvasX - xIn, canvasY - yGain);
    if (distIn <= 14 && onUpdateFade) {
      isDraggingFadeInRef.current = {
        startX: canvasX,
        startY: canvasY,
        initialMs: fadeInMs,
        initialCurve: fadeInCurve,
      };
      setActiveDragHandle('in');
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // Hit test Fade-Out handle (14px radius)
    const distOut = Math.hypot(canvasX - xOut, canvasY - yGain);
    if (distOut <= 14 && onUpdateFade) {
      isDraggingFadeOutRef.current = {
        startX: canvasX,
        startY: canvasY,
        initialMs: fadeOutMs,
        initialCurve: fadeOutCurve,
      };
      setActiveDragHandle('out');
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // Standard audio seek / scrub
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    onScrubStateChange?.(true);
    onSeekProgress?.(computeProgressFromClientX(safeClientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isRenderedAudio) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width > 0 ? rect.width : 280);
    const canvasH = Math.max(1, rect.height > 0 ? rect.height : height);

    const safeClientX =
      typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : 0;
    const safeClientY =
      typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : 22;

    const canvasX = safeClientX - (rect.left || 0);
    const canvasY = safeClientY - (rect.top || 0);

    const { xIn, xOut, yGain, dur } = getHandlePositions(width, canvasH);

    // 1. Dragging Fade-In handle (Audition interaction)
    if (isDraggingFadeInRef.current && onUpdateFade) {
      e.stopPropagation();
      const drag = isDraggingFadeInRef.current;
      const deltaX = canvasX - drag.startX;
      const deltaMs = (deltaX / width) * dur * 1000;
      const newMs = Math.max(
        0,
        Math.min(Math.round(dur * 1000 * 0.49), Math.round(drag.initialMs + deltaMs))
      );

      // Dragging UP raises curve towards +1.0 (log/convex), DOWN towards -1.0 (exp/concave)
      const deltaY = drag.startY - canvasY;
      const deltaCurve = deltaY / (canvasH * 0.4);
      const newCurve = Math.max(
        -1.0,
        Math.min(1.0, Number((drag.initialCurve + deltaCurve).toFixed(2)))
      );

      onUpdateFade({ fadeInMs: newMs, fadeInCurve: newCurve });
      if (blockId) {
        updateLiveBlockAudio(blockId, { fadeInMs: newMs, fadeInCurve: newCurve });
      }
      return;
    }

    // 2. Dragging Fade-Out handle (Audition interaction)
    if (isDraggingFadeOutRef.current && onUpdateFade) {
      e.stopPropagation();
      const drag = isDraggingFadeOutRef.current;
      const deltaX = drag.startX - canvasX;
      const deltaMs = (deltaX / width) * dur * 1000;
      const newMs = Math.max(
        0,
        Math.min(Math.round(dur * 1000 * 0.49), Math.round(drag.initialMs + deltaMs))
      );

      const deltaY = drag.startY - canvasY;
      const deltaCurve = deltaY / (canvasH * 0.4);
      const newCurve = Math.max(
        -1.0,
        Math.min(1.0, Number((drag.initialCurve + deltaCurve).toFixed(2)))
      );

      onUpdateFade({ fadeOutMs: newMs, fadeOutCurve: newCurve });
      if (blockId) {
        updateLiveBlockAudio(blockId, { fadeOutMs: newMs, fadeOutCurve: newCurve });
      }
      return;
    }

    // Hover handle detection
    const distIn = Math.hypot(canvasX - xIn, canvasY - yGain);
    const distOut = Math.hypot(canvasX - xOut, canvasY - yGain);
    if (distIn <= 14) {
      setHoverHandle('in');
    } else if (distOut <= 14) {
      setHoverHandle('out');
    } else {
      setHoverHandle(null);
    }

    // Standard scrub update
    const prog = computeProgressFromClientX(safeClientX);
    setHoverProgress(prog);
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    onSeekProgress?.(prog);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingFadeInRef.current) {
      e.stopPropagation();
      isDraggingFadeInRef.current = null;
      setActiveDragHandle(null);
      return;
    }

    if (isDraggingFadeOutRef.current) {
      e.stopPropagation();
      isDraggingFadeOutRef.current = null;
      setActiveDragHandle(null);
      return;
    }

    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    onScrubStateChange?.(false);
  };

  const handlePointerLeave = () => {
    setHoverProgress(null);
    setHoverHandle(null);
  };

  // Double-click on handles resets fade to 0
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onUpdateFade) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const width = Math.max(1, rect.width);
    const { xIn, xOut, yGain } = getHandlePositions(width, rect.height);

    if (Math.hypot(canvasX - xIn, canvasY - yGain) <= 16) {
      onUpdateFade({ fadeInMs: 0, fadeInCurve: 0 });
      if (blockId) {
        updateLiveBlockAudio(blockId, { fadeInMs: 0, fadeInCurve: 0 });
      }
    } else if (Math.hypot(canvasX - xOut, canvasY - yGain) <= 16) {
      onUpdateFade({ fadeOutMs: 0, fadeOutCurve: 0 });
      if (blockId) {
        updateLiveBlockAudio(blockId, { fadeOutMs: 0, fadeOutCurve: 0 });
      }
    }
  };

  const canvasElement = (
    <div className="relative flex-1 min-w-[200px] flex items-center h-full">
      <canvas
        ref={canvasRef}
        style={{ height: `${height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        aria-label="Waveform Scrubber"
        className={`w-full rounded border transition-colors touch-none ${
          isRenderedAudio
            ? activeDragHandle || hoverHandle
              ? 'bg-slate-950 border-amber-500/70 cursor-all-scroll shadow-xs shadow-amber-950/40'
              : 'bg-slate-950 border-slate-800/90 hover:border-indigo-500/50 cursor-ew-resize'
            : 'bg-slate-950/60 border-slate-800/40 cursor-default opacity-60'
        }`}
      />
      {!isRenderedAudio && (
        <span
          data-testid={
            blockId
              ? `waveform-unrendered-badge-${blockId}`
              : 'waveform-unrendered-badge'
          }
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-mono text-slate-500 italic select-none"
        >
          {t('unrenderedWaveformNotice')}
        </span>
      )}

      {/* Scrub Hover Timecode Badge */}
      {hoverProgress !== null &&
        durationSec > 0 &&
        isRenderedAudio &&
        !activeDragHandle && (
          <span className="pointer-events-none absolute -top-5 right-1 px-1.5 py-0.2 rounded bg-slate-900/95 border border-slate-700 text-[9px] font-mono text-indigo-200 shadow z-10">
            {formatDurationReadout(hoverProgress * durationSec, true)}
          </span>
        )}

      {/* Fade In Live Readout Badge */}
      {(activeDragHandle === 'in' || hoverHandle === 'in') && (
        <span className="pointer-events-none absolute -top-6 left-1 px-1.5 py-0.5 rounded bg-amber-950/95 border border-amber-500/80 text-[10px] font-mono text-amber-200 shadow z-20">
          Fade In: {((fadeInMs || 0) / 1000).toFixed(2)}s (
          {fadeInCurve > 0
            ? `+${fadeInCurve} log`
            : fadeInCurve === 0
              ? 'Linear'
              : `${fadeInCurve} exp`}
          )
        </span>
      )}

      {/* Fade Out Live Readout Badge */}
      {(activeDragHandle === 'out' || hoverHandle === 'out') && (
        <span className="pointer-events-none absolute -top-6 right-1 px-1.5 py-0.5 rounded bg-amber-950/95 border border-amber-500/80 text-[10px] font-mono text-amber-200 shadow z-20">
          Fade Out: {((fadeOutMs || 0) / 1000).toFixed(2)}s (
          {fadeOutCurve > 0
            ? `+${fadeOutCurve} log`
            : fadeOutCurve === 0
              ? 'Linear'
              : `${fadeOutCurve} exp`}
          )
        </span>
      )}
    </div>
  );

  if (!showTransportControls) {
    return canvasElement;
  }

  const currentSec = Math.max(0, Math.min(1, playheadProgress)) * durationSec;

  return (
    <div
      data-testid={
        blockId
          ? `block-waveform-transport-${blockId}`
          : 'block-waveform-transport'
      }
      className="flex items-center gap-2 bg-slate-950/95 border border-slate-800/90 rounded-lg px-2.5 py-1.5 flex-1 min-w-[260px] shadow-xs"
    >
      {/* Inline Waveform Play / Pause Button */}
      <button
        type="button"
        data-testid={
          blockId ? `waveform-play-btn-${blockId}` : 'waveform-play-btn'
        }
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay?.();
        }}
        title={playTooltip}
        className={`p-1.5 rounded transition-colors cursor-pointer ${
          isPlaying
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current" />
        )}
      </button>

      {/* Inline Waveform Restart (0:00) Button */}
      <button
        type="button"
        data-testid={
          blockId ? `waveform-restart-btn-${blockId}` : 'waveform-restart-btn'
        }
        onClick={(e) => {
          e.stopPropagation();
          onRestart?.();
        }}
        title={restartTooltip}
        className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Volume Gain Knob for Generated Part */}
      {isRenderedAudio && onChangeGainDb && (
        <div className="flex items-center px-1 border-r border-slate-800/80 mr-0.5">
          <VolumeGainKnob
            testId={blockId ? `gain-knob-${blockId}` : 'gain-knob'}
            valueDb={volumeGainDb}
            onChange={(gain) => {
              onChangeGainDb(gain);
              if (blockId) {
                updateLiveBlockAudio(blockId, { volumeGainDb: gain });
              }
            }}
            size={26}
            label={gainKnobLabel}
          />
        </div>
      )}

      {/* Scrubbable Canvas 2D SoA Waveform with Volume Envelope & Fade Curves */}
      {canvasElement}

      {/* Live Block Waveform Timecode Readout */}
      <span
        data-testid={
          blockId ? `waveform-timecode-${blockId}` : 'waveform-timecode'
        }
        className="text-[10px] font-mono text-slate-300 tabular-nums shrink-0 pl-1"
      >
        {formatDurationReadout(currentSec, true)} /{' '}
        {formatDurationReadout(durationSec, true)}
      </span>
    </div>
  );
};
