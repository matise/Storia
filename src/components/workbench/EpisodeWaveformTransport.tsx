import React from 'react';
import {
  FastForward,
  Pause,
  Play,
  Repeat,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
} from 'lucide-react';
import { ScriptBlock, Speaker } from '../../types/storia';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';
import { generateSyntheticPreviewPeaks } from './WaveformCanvas';

export interface EpisodeWaveformTransportProps {
  blocks: ScriptBlock[];
  speakers: Speaker[];
  playheadSec: number;
  totalDurationSec: number;
  activeBlockIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSeekTimeSec: (targetSec: number) => void;
  onJumpBlockIndex: (blockIndex: number) => void;
  onChangeSpeed: (speed: number) => void;
  onScrubStateChange?: (isScrubbing: boolean) => void;
  onUpdatePauseAfterMs?: (blockId: string, pauseAfterMs: number) => void;
  onSelectBlockId?: (blockId: string) => void;
}

/**
 * Renders the composite multi-block Episode Timeline Waveform onto a 2D Canvas.
 */
export function renderEpisodeTimelineWaveform(
  ctx: CanvasRenderingContext2D,
  blocks: ScriptBlock[],
  speakers: Speaker[],
  width: number,
  height: number,
  playheadSec: number,
  totalDurationSec: number,
  hoverTimeSec: number | null
): void {
  ctx.clearRect(0, 0, width, height);
  if (width <= 0 || height <= 0 || totalDurationSec <= 0) return;

  const speakerMap = new Map<string, Speaker>();
  for (const s of speakers) {
    speakerMap.set(s.id, s);
  }

  const midY = height / 2;

  // 1. Center zero-crossing reference line
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, midY - 0.5, width, 1);

  // 2. Render each block's waveform segment and boundary divider
  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const blk = blocks[bIdx];
    const startSec = blk.startTimeSec ?? 0;
    const totalBlkDur = blk.estimatedDurationSec ?? 0;
    const pauseSec = Math.max(0, (blk.pauseAfterMs ?? 0) / 1000);
    const spokenDur = Math.max(0.1, totalBlkDur - pauseSec);
    const endSec = blk.endTimeSec ?? startSec + totalBlkDur;

    const xStart = (startSec / totalDurationSec) * width;
    const xSpokenEnd = ((startSec + spokenDur) / totalDurationSec) * width;
    const xBlockEnd = (endSec / totalDurationSec) * width;

    const spk = blk.speakerId ? speakerMap.get(blk.speakerId) : undefined;
    const accentColor =
      blk.type === 'sound_effect' ? '#f59e0b' : (spk?.color ?? '#6366f1');

    // Block divider line
    if (bIdx > 0) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(Math.floor(xStart), 0, 1, height);
    }

    // Trailing pause region shading
    if (xBlockEnd > xSpokenEnd + 1) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(xSpokenEnd, 0, xBlockEnd - xSpokenEnd, height);
    }

    // Spoken / SFX waveform bars
    const segWidth = Math.max(2, xSpokenEnd - xStart);
    const hasAudio =
      blk.ttsStatus === 'ok' ||
      Boolean(blk.waveformPeaks && blk.waveformPeaks.length > 0) ||
      Boolean(blk.generatedAudioUrl);

    if (!hasAudio) {
      // Grayish disabled representation for ungenerated block
      ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.fillRect(xStart, midY - 1, segWidth, 2);
      continue;
    }

    const peaks =
      blk.waveformPeaks && blk.waveformPeaks.length > 0
        ? blk.waveformPeaks
        : generateSyntheticPreviewPeaks(`${blk.id}_${blk.text}`, 96);

    const gainDb = blk.volumeGainDb ?? 0;
    const gainLin = !Number.isFinite(gainDb) || gainDb <= -48 ? 0 : Math.pow(10, gainDb / 20);

    const barCount = Math.min(peaks.length, Math.max(8, Math.floor(segWidth / 2.2)));
    const stepX = segWidth / barCount;
    const barW = Math.max(1, stepX - 0.7);

    for (let i = 0; i < barCount; i++) {
      const peakIdx = Math.min(
        peaks.length - 1,
        Math.floor((i / barCount) * peaks.length)
      );
      const barTimeSec = startSec + (i / barCount) * spokenDur;
      const isPlayed = barTimeSec <= playheadSec;

      ctx.fillStyle = isPlayed
        ? accentColor
        : blk.ttsStatus === 'ok'
          ? '#64748b'
          : '#334155';

      const x = xStart + i * stepX;
      const minY = midY + Math.max(-1.0, Math.min(1.0, peaks.minPeaks[peakIdx] * gainLin)) * (midY * 0.86);
      const maxY = midY + Math.max(-1.0, Math.min(1.0, peaks.maxPeaks[peakIdx] * gainLin)) * (midY * 0.86);
      const barH = Math.max(1.5, minY - maxY);
      ctx.fillRect(x, maxY, barW, barH);
    }
  }

  // 3. Pause Drag Handles between blocks (green accent handle)
  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const blk = blocks[bIdx];
    const totalBlkDur = blk.estimatedDurationSec ?? 0;
    const pauseSec = Math.max(0, (blk.pauseAfterMs ?? 0) / 1000);
    const spokenDur = Math.max(0.1, totalBlkDur - pauseSec);
    const startSec = blk.startTimeSec ?? 0;
    const endSec = blk.endTimeSec ?? startSec + totalBlkDur;

    const xSpokenEnd = ((startSec + spokenDur) / totalDurationSec) * width;
    const xBlockEnd = (endSec / totalDurationSec) * width;

    if (xBlockEnd >= xSpokenEnd) {
      // Draw a subtle vertical drag handle at xBlockEnd
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.fillRect(xBlockEnd - 1, 4, 2, height - 8);
    }
  }

  // 3. Hover timecode guide line
  if (hoverTimeSec !== null && hoverTimeSec >= 0 && hoverTimeSec <= totalDurationSec) {
    const hoverX = (hoverTimeSec / totalDurationSec) * width;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.fillRect(Math.max(0, hoverX - 0.5), 0, 1, height);
  }

  // 4. Active playhead cursor needle
  const playheadX = Math.max(
    0,
    Math.min(width - 2, (playheadSec / totalDurationSec) * width)
  );
  ctx.fillStyle = '#10b981';
  ctx.fillRect(playheadX, 0, 2, height);
}

export const EpisodeWaveformTransport: React.FC<EpisodeWaveformTransportProps> = ({
  blocks,
  speakers,
  playheadSec,
  totalDurationSec,
  activeBlockIndex,
  isPlaying,
  isLooping,
  playbackSpeed,
  onTogglePlay,
  onStop,
  onToggleLoop,
  onSeekTimeSec,
  onJumpBlockIndex,
  onChangeSpeed,
  onScrubStateChange,
  onUpdatePauseAfterMs,
  onSelectBlockId,
}) => {
  const { t } = useTranslation();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = React.useRef(false);
  const isDraggingPauseRef = React.useRef<{
    blockId: string;
    initialPauseMs: number;
    startClientX: number;
    totalDurationSec: number;
    width: number;
  } | null>(null);
  const [hoverTimeSec, setHoverTimeSec] = React.useState<number | null>(null);
  const [isOverPauseHandle, setIsOverPauseHandle] = React.useState(false);

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
    const cssWidth = rect.width > 0 ? rect.width : 640;
    const cssHeight = 46;

    const targetW = Math.round(cssWidth * dpr);
    const targetH = Math.round(cssHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    renderEpisodeTimelineWaveform(
      ctx,
      blocks,
      speakers,
      cssWidth,
      cssHeight,
      playheadSec,
      totalDurationSec,
      hoverTimeSec
    );
    ctx.restore();
  }, [blocks, speakers, playheadSec, totalDurationSec, hoverTimeSec]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [draw]);

  const computeTimeFromClientX = (clientX: number | undefined): number => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 600;
    const safeX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
    const ratio = Math.max(0, Math.min(1, (safeX - rect.left) / width));
    return ratio * totalDurationSec;
  };

  const findPauseHandleAtClientX = (clientX: number | undefined): { block: ScriptBlock; blockIndex: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0 || blocks.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 600;
    const safeX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
    const clickX = safeX - rect.left;

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const startSec = blk.startTimeSec ?? 0;
      const totalBlkDur = blk.estimatedDurationSec ?? 0;
      const pauseSec = Math.max(0, (blk.pauseAfterMs ?? 0) / 1000);
      const spokenDur = Math.max(0.1, totalBlkDur - pauseSec);
      const endSec = blk.endTimeSec ?? startSec + totalBlkDur;

      const xSpokenEnd = ((startSec + spokenDur) / totalDurationSec) * width;
      const xBlockEnd = (endSec / totalDurationSec) * width;

      // Check if clickX is within pause area or +/- 12px near xBlockEnd
      const minX = Math.min(xSpokenEnd, xBlockEnd - 12);
      const maxX = xBlockEnd + 12;
      if (clickX >= minX && clickX <= maxX) {
        return { block: blk, blockIndex: i };
      }
    }
    return null;
  };

  const findBlockAtClientX = (clientX: number | undefined): { block: ScriptBlock; blockIndex: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0 || blocks.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 600;
    const safeX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
    const clickX = safeX - rect.left;

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const startSec = blk.startTimeSec ?? 0;
      const totalBlkDur = blk.estimatedDurationSec ?? 0;
      const endSec = blk.endTimeSec ?? startSec + totalBlkDur;
      const xStart = (startSec / totalDurationSec) * width;
      const xEnd = (endSec / totalDurationSec) * width;

      if (clickX >= xStart && clickX <= xEnd) {
        return { block: blk, blockIndex: i };
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const rawX = (e as unknown as MouseEvent).clientX ?? e.clientX ?? (e.nativeEvent as unknown as MouseEvent)?.clientX;
    const clientX = typeof rawX === 'number' && Number.isFinite(rawX) ? rawX : 0;

    // Check if clicked near a pause handle boundary
    const pauseHit = findPauseHandleAtClientX(clientX);
    if (pauseHit && onUpdatePauseAfterMs) {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const canvasWidth = rect && rect.width > 0 ? rect.width : 600;
      isDraggingPauseRef.current = {
        blockId: pauseHit.block.id,
        initialPauseMs: pauseHit.block.pauseAfterMs ?? 0,
        startClientX: clientX,
        totalDurationSec,
        width: canvasWidth,
      };
      if (typeof e.currentTarget.setPointerCapture === 'function') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore in JSDOM
        }
      }
      onSelectBlockId?.(pauseHit.block.id);
      return;
    }

    isDraggingRef.current = true;
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in JSDOM
      }
    }
    const targetSec = computeTimeFromClientX(clientX);
    onScrubStateChange?.(true);
    onSeekTimeSec(targetSec);

    // Also select and trigger scroll-to-segment
    const blockHit = findBlockAtClientX(clientX);
    if (blockHit) {
      onJumpBlockIndex(blockHit.blockIndex);
      onSelectBlockId?.(blockHit.block.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rawX = (e as unknown as MouseEvent).clientX ?? e.clientX ?? (e.nativeEvent as unknown as MouseEvent)?.clientX;
    const clientX = typeof rawX === 'number' && Number.isFinite(rawX) ? rawX : 0;

    // Canvas or document pointer move support
    if (isDraggingPauseRef.current && onUpdatePauseAfterMs) {
      e.stopPropagation();
      const drag = isDraggingPauseRef.current;
      const deltaX = clientX - drag.startClientX;
      const deltaSec = (deltaX / drag.width) * drag.totalDurationSec;
      const newPauseMs = Math.max(0, Math.min(10000, Math.round(drag.initialPauseMs + deltaSec * 1000)));
      if (newPauseMs !== drag.initialPauseMs || Math.abs(deltaX) > 0) {
        onUpdatePauseAfterMs(drag.blockId, newPauseMs);
      }
      return;
    }

    const pauseHit = findPauseHandleAtClientX(clientX);
    setIsOverPauseHandle(Boolean(pauseHit));

    const targetSec = computeTimeFromClientX(clientX);
    setHoverTimeSec(targetSec);
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    onSeekTimeSec(targetSec);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingPauseRef.current) {
      e.stopPropagation();
      isDraggingPauseRef.current = null;
      return;
    }
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    onScrubStateChange?.(false);
  };

  const activeBlock = blocks[activeBlockIndex] ?? blocks[0];
  const activeSpeaker = speakers.find((s) => s.id === activeBlock?.speakerId);

  return (
    <section
      data-testid="episode-waveform-transport-deck"
      className="border-b border-slate-800/90 bg-slate-900/50 px-4 py-2.5 shrink-0 select-none space-y-2"
    >
      {/* Top Row: Transport Buttons, Timecode Readout, Active Block Indicator & Speed Control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Jump to Start (0:00) */}
          <button
            type="button"
            data-testid="transport-jump-start-btn"
            onClick={() => onSeekTimeSec(0)}
            title={t('transportJumpStart')}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Previous Block */}
          <button
            type="button"
            data-testid="transport-prev-block-btn"
            disabled={activeBlockIndex <= 0}
            onClick={() => onJumpBlockIndex(Math.max(0, activeBlockIndex - 1))}
            title={t('transportPrevBlock')}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Rewind -5s */}
          <button
            type="button"
            data-testid="transport-rewind-btn"
            onClick={() => onSeekTimeSec(Math.max(0, playheadSec - 5))}
            title={t('transportRewind5s')}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Rewind className="w-3 h-3" />
            <span>-5s</span>
          </button>

          {/* Master Play / Pause */}
          <button
            type="button"
            data-testid="transport-play-pause-btn"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>{t('pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t('playAll')}</span>
              </>
            )}
          </button>

          {/* Stop & Return to 0:00 */}
          <button
            type="button"
            data-testid="transport-stop-btn"
            onClick={onStop}
            title={t('transportStop')}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-700/60 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Fast-Forward +5s */}
          <button
            type="button"
            data-testid="transport-forward-btn"
            onClick={() =>
              onSeekTimeSec(Math.min(totalDurationSec, playheadSec + 5))
            }
            title={t('transportForward5s')}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <span>+5s</span>
            <FastForward className="w-3 h-3" />
          </button>

          {/* Next Block */}
          <button
            type="button"
            data-testid="transport-next-block-btn"
            disabled={activeBlockIndex >= blocks.length - 1}
            onClick={() =>
              onJumpBlockIndex(Math.min(blocks.length - 1, activeBlockIndex + 1))
            }
            title={t('transportNextBlock')}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            data-testid="transport-loop-btn"
            onClick={onToggleLoop}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
              isLooping
                ? 'bg-indigo-950/90 border-indigo-500/70 text-indigo-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span>{t('loop')}</span>
          </button>
        </div>

        {/* Right Side: Timecode Counter, Active Speaker/Block Pill, Playback Speed */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeBlock && (
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    activeBlock.type === 'sound_effect'
                      ? '#f59e0b'
                      : (activeSpeaker?.color ?? '#6366f1'),
                }}
              />
              <span>
                #{activeBlockIndex + 1}{' '}
                {activeBlock.type === 'sound_effect'
                  ? 'SFX'
                  : (activeSpeaker?.name ?? 'Narrator')}
              </span>
            </span>
          )}

          <span
            data-testid="transport-timecode-readout"
            className="px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 tabular-nums"
          >
            {formatDurationReadout(playheadSec, true)} /{' '}
            {formatDurationReadout(totalDurationSec, true)}
          </span>

          <label className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-mono text-slate-300">
            <span className="text-slate-500">{t('transportSpeedLabel')}:</span>
            <select
              aria-label={t('transportSpeedLabel')}
              data-testid="transport-speed-select"
              value={String(playbackSpeed)}
              onChange={(e) => onChangeSpeed(Number(e.target.value) || 1.0)}
              className="bg-transparent text-indigo-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="0.75" className="bg-slate-900">
                0.75x
              </option>
              <option value="1" className="bg-slate-900">
                1.0x
              </option>
              <option value="1.25" className="bg-slate-900">
                1.25x
              </option>
              <option value="1.5" className="bg-slate-900">
                1.5x
              </option>
            </select>
          </label>
        </div>
      </div>

      {/* Master Episode Timeline Waveform Canvas + Hover Timecode Pill */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="master-episode-waveform-canvas"
          aria-label={t('masterTimelineWaveformLabel')}
          style={{ height: '46px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            setHoverTimeSec(null);
            setIsOverPauseHandle(false);
          }}
          className={`w-full rounded-lg bg-slate-950 border border-slate-800/90 hover:border-indigo-500/60 transition-colors touch-none ${
            isOverPauseHandle ? 'cursor-col-resize' : 'cursor-ew-resize'
          }`}
        />
        {hoverTimeSec !== null && (
          <span className="pointer-events-none absolute top-1 right-2 px-1.5 py-0.5 rounded bg-slate-900/95 border border-slate-700 text-[10px] font-mono text-indigo-200 shadow">
            {formatDurationReadout(hoverTimeSec, true)}
          </span>
        )}
      </div>

      {/* Block Timeline Marker Strip (Quick-Jump Block Pills aligned with timeline) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {blocks.map((blk, idx) => {
          const spk = speakers.find((s) => s.id === blk.speakerId);
          const isCurrent = idx === activeBlockIndex;
          return (
            <button
              key={blk.id}
              type="button"
              data-testid={`timeline-block-marker-${blk.id}`}
              onClick={() => {
                onJumpBlockIndex(idx);
                onSelectBlockId?.(blk.id);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono shrink-0 border transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-slate-800 border-emerald-500/70 text-emerald-300 font-semibold'
                  : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    blk.type === 'sound_effect'
                      ? '#f59e0b'
                      : (spk?.color ?? '#6366f1'),
                }}
              />
              <span>
                #{idx + 1}{' '}
                {blk.type === 'sound_effect' ? 'SFX' : (spk?.name ?? 'Narrator')}
              </span>
              <span className="text-slate-500">
                ({formatDurationReadout(blk.startTimeSec ?? 0, true)})
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

