import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { WaveformPeakData } from '../../types/storia';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';
import { VolumeGainKnob } from './VolumeGainKnob';
import { useTranslation } from '../../i18n/useTranslation';

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

/**
 * Zero-allocation Canvas 2D waveform rendering loop for Storia (Design Doc Section 6.3).
 * Reads directly from Structure-of-Arrays Float32Array buffers.
 * Features:
 * - Oscilloscope studio green / accent-tinted grid lines.
 * - Center zero-crossing line.
 * - High-resolution vertical spikes styled like professional DAW waveform displays (Adobe Audition / Pro Tools).
 * - Plays forward with solid vibrant highlight and trailing progress playhead cursor.
 * - Displays a sleek "ungenerated / empty data" pattern when isRenderedAudio is false.
 */
export function renderWaveformToCanvas(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeakData | undefined,
  width: number,
  height: number,
  playheadProgress: number,
  accentColor: string,
  isRenderedAudio = true,
  gainDb = 0
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

  // Center zero-crossing line (accented with subtle glow)
  ctx.strokeStyle = isRenderedAudio ? 'rgba(56, 189, 248, 0.28)' : 'rgba(51, 65, 85, 0.4)';
  ctx.beginPath?.();
  ctx.moveTo?.(0, midY);
  ctx.lineTo?.(width, midY);
  ctx.stroke?.();
  ctx.restore?.();

  // 2. If no rendered wave data, draw disabled / ungenerated grayish placeholder
  if (!isRenderedAudio || !peaks || peaks.length === 0) {
    ctx.save?.();
    // Dashed center line indicating silence/unrendered
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.setLineDash?.([4, 4]);
    ctx.beginPath?.();
    ctx.moveTo?.(8, midY);
    ctx.lineTo?.(width - 8, midY);
    ctx.stroke?.();

    // Subtle ghost placeholder wave bars with low opacity
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

  // Background unplayed spikes (studio cyan/teal or speaker accent tinted slate)
  const unplayedFill = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  const playedFill = accentColor;

  ctx.save?.();
  for (let i = 0; i < count; i++) {
    const x = i * stepX;
    const isPlayed = i / count <= clampedProgress;

    // Apply volume gain scaling clamped to canvas bounds
    const rawMin = peaks.minPeaks[i] * gainLinear;
    const rawMax = peaks.maxPeaks[i] * gainLinear;

    const clampedMin = Math.max(-1.0, Math.min(1.0, rawMin));
    const clampedMax = Math.max(-1.0, Math.min(1.0, rawMax));

    const minY = midY + clampedMin * (midY * 0.92);
    const maxY = midY + clampedMax * (midY * 0.92);
    const barH = Math.max(1.2, minY - maxY);

    ctx.fillStyle = isPlayed ? playedFill : unplayedFill;
    ctx.fillRect(x, maxY, barWidth, barH);
  }

  // 4. Draw vibrant playhead cursor needle if active
  if (clampedProgress > 0 && clampedProgress < 1) {
    const playedWidth = width * clampedProgress;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(Math.max(0, playedWidth - 1), 0, 2, height);

    // Glow line on playhead
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
  height = 28,
  blockId,
  durationSec = 0,
  isPlaying = false,
  showTransportControls = false,
  playTooltip = 'Play / Pause block',
  restartTooltip = 'Restart block (0:00)',
  volumeGainDb = 0,
  onChangeGainDb,
  gainKnobLabel = 'Gain',
  onTogglePlay,
  onRestart,
  onSeekProgress,
  onScrubStateChange,
}) => {
  const { t } = useTranslation();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = React.useRef(false);
  const [hoverProgress, setHoverProgress] = React.useState<number | null>(null);

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
    const cssWidth = rect.width > 0 ? rect.width : 240;
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
      volumeGainDb
    );
    ctx.restore();
  }, [peaks, playheadProgress, accentColor, isRenderedAudio, height, volumeGainDb]);

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
    const safeClientX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
    const ratio = (safeClientX - rect.left) / width;
    if (!Number.isFinite(ratio)) return 0;
    return Math.max(0, Math.min(1, ratio));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isRenderedAudio) return; // Don't scrub unrendered waveforms
    e.stopPropagation();
    isDraggingRef.current = true;
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in synthetic test events
      }
    }
    const clientX =
      e.clientX ?? (e.nativeEvent as unknown as { clientX?: number })?.clientX ?? 0;
    onScrubStateChange?.(true);
    onSeekProgress?.(computeProgressFromClientX(clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isRenderedAudio) return;
    const clientX =
      e.clientX ?? (e.nativeEvent as unknown as { clientX?: number })?.clientX ?? 0;
    const prog = computeProgressFromClientX(clientX);
    setHoverProgress(prog);
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    onSeekProgress?.(prog);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    onScrubStateChange?.(false);
  };

  const handlePointerLeave = () => {
    setHoverProgress(null);
  };

  const canvasElement = (
    <div className="relative flex-1 min-w-[160px] flex items-center">
      <canvas
        ref={canvasRef}
        style={{ height: `${height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label="Waveform Scrubber"
        className={`w-full max-w-xs rounded border transition-colors touch-none ${
          isRenderedAudio
            ? 'bg-slate-950 border-slate-800/90 hover:border-indigo-500/50 cursor-ew-resize'
            : 'bg-slate-950/60 border-slate-800/40 cursor-default opacity-60'
        }`}
      />
      {!isRenderedAudio && (
        <span
          data-testid={blockId ? `waveform-unrendered-badge-${blockId}` : 'waveform-unrendered-badge'}
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-mono text-slate-500 italic select-none"
        >
          {t('unrenderedWaveformNotice')}
        </span>
      )}
      {hoverProgress !== null && durationSec > 0 && isRenderedAudio && (
        <span className="pointer-events-none absolute -top-5 right-1 px-1.5 py-0.2 rounded bg-slate-900/95 border border-slate-700 text-[9px] font-mono text-indigo-200 shadow">
          {formatDurationReadout(hoverProgress * durationSec, true)}
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
      data-testid={blockId ? `block-waveform-transport-${blockId}` : 'block-waveform-transport'}
      className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800/90 rounded-lg px-2 py-1"
    >
      {/* Inline Waveform Play / Pause Button */}
      <button
        type="button"
        data-testid={blockId ? `waveform-play-btn-${blockId}` : 'waveform-play-btn'}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay?.();
        }}
        title={playTooltip}
        className={`p-1 rounded transition-colors cursor-pointer ${
          isPlaying
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-3 h-3 fill-current" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
      </button>

      {/* Inline Waveform Restart (0:00) Button */}
      <button
        type="button"
        data-testid={blockId ? `waveform-restart-btn-${blockId}` : 'waveform-restart-btn'}
        onClick={(e) => {
          e.stopPropagation();
          onRestart?.();
        }}
        title={restartTooltip}
        className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
      </button>

      {/* Volume Gain Knob for Generated Part (Only active / visible on generated audio) */}
      {isRenderedAudio && onChangeGainDb && (
        <div className="flex items-center px-1 border-r border-slate-800/80 mr-0.5">
          <VolumeGainKnob
            testId={blockId ? `gain-knob-${blockId}` : 'gain-knob'}
            valueDb={volumeGainDb}
            onChange={onChangeGainDb}
            size={24}
            label={gainKnobLabel}
          />
        </div>
      )}

      {/* Scrubbable Canvas 2D SoA Waveform or Grayed Disabled Placeholder */}
      {canvasElement}

      {/* Live Block Waveform Timecode Readout */}
      <span
        data-testid={blockId ? `waveform-timecode-${blockId}` : 'waveform-timecode'}
        className="text-[10px] font-mono text-slate-300 tabular-nums shrink-0 pl-0.5"
      >
        {formatDurationReadout(currentSec, true)} /{' '}
        {formatDurationReadout(durationSec, true)}
      </span>
    </div>
  );
};

