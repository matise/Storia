import React from 'react';
import {
  ChevronUp,
  FastForward,
  Pause,
  Play,
  Repeat,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  ZoomIn,
  ZoomOut,
  ArrowLeftRight,
  Sliders,
} from 'lucide-react';
import { ScriptBlock, Speaker } from '../../types/storia';
import { useTranslation } from '../../i18n/useTranslation';
import { useStoriaStore } from '../../store/useStoriaStore';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';
import { generateSyntheticPreviewPeaks } from './WaveformCanvas';
import { BroadcastVuMeter } from './BroadcastVuMeter';
import { LiveMeterSnapshot, studioTransportEngine } from '../../core/dsp/StudioTransportEngine';

export interface EpisodeWaveformTransportProps {
  blocks: ScriptBlock[];
  speakers: Speaker[];
  playheadSec: number;
  totalDurationSec: number;
  activeBlockIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  isAutoAdvance?: boolean;
  onToggleAutoAdvance?: () => void;
  playbackSpeed: number;
  meterSnapshot?: LiveMeterSnapshot;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSeekTimeSec: (targetSec: number) => void;
  onJumpBlockIndex: (blockIndex: number) => void;
  onChangeSpeed: (speed: number) => void;
  onScrubStateChange?: (isScrubbing: boolean) => void;
  onUpdatePauseAfterMs?: (blockId: string, pauseAfterMs: number) => void;
  onSelectBlockId?: (blockId: string) => void;
  onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
  onToggleCollapse?: () => void;
}

export interface DragReorderState {
  sourceIndex: number;
  targetIndex: number;
  currentCanvasX: number;
}

/**
 * Renders the composite multi-block Episode Timeline Waveform onto a 2D Canvas.
 * Features:
 * - Top 15px block header strip with drag handles for swapping/reordering parts
 * - Waveform peak SoA rendering with speaker color highlights & played status
 * - Pause duration shading & draggable green pause boundary handles
 * - Target insertion drop indicators when dragging blocks to switch places
 */
export function renderEpisodeTimelineWaveform(
  ctx: CanvasRenderingContext2D,
  blocks: ScriptBlock[],
  speakers: Speaker[],
  width: number,
  height: number,
  playheadSec: number,
  totalDurationSec: number,
  hoverTimeSec: number | null,
  dragReorderState?: DragReorderState | null
): void {
  ctx.clearRect(0, 0, width, height);
  if (width <= 0 || height <= 0 || totalDurationSec <= 0) return;

  const speakerMap = new Map<string, Speaker>();
  for (const s of speakers) {
    speakerMap.set(s.id, s);
  }

  const headerH = 15;
  const waveformAreaTop = headerH;
  const waveformAreaH = height - headerH;
  const midY = waveformAreaTop + waveformAreaH / 2;

  // 1. Center zero-crossing reference line
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, midY - 0.5, width, 1);

  // 2. Render each block's waveform segment, header drag pill, and boundary divider
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
    const segWidth = Math.max(2, xSpokenEnd - xStart);
    const blockTotalWidth = Math.max(2, xBlockEnd - xStart);

    const spk = blk.speakerId ? speakerMap.get(blk.speakerId) : undefined;
    const accentColor =
      blk.type === 'sound_effect' ? '#f59e0b' : (spk?.color ?? '#6366f1');

    const isBeingDragged = dragReorderState?.sourceIndex === bIdx;
    const isTargetDrop =
      dragReorderState?.targetIndex === bIdx &&
      dragReorderState?.sourceIndex !== bIdx;

    // A. Top Header Pill for block reordering & drag handle (Green requirement)
    ctx.fillStyle = isBeingDragged
      ? 'rgba(99, 102, 241, 0.45)'
      : 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(xStart, 0, blockTotalWidth, headerH);

    // Bottom border of header
    ctx.fillStyle = isBeingDragged ? '#818cf8' : '#1e293b';
    ctx.fillRect(xStart, headerH - 1, blockTotalWidth, 1);

    // Header label text if width > 28px
    if (blockTotalWidth > 28) {
      // Speaker color dot
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(xStart + 6, 7.5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isBeingDragged ? '#ffffff' : '#94a3b8';
      ctx.font = '9px monospace';
      const label = `#${bIdx + 1} ${
        blockTotalWidth > 60
          ? blk.type === 'sound_effect'
            ? 'SFX'
            : (spk?.name ?? '')
          : ''
      }`;
      ctx.fillText(label, xStart + 12, 10.5);

      // Drag grip dots icon if wide enough (> 75px)
      if (blockTotalWidth > 75) {
        ctx.fillStyle = isBeingDragged ? '#c7d2fe' : '#64748b';
        ctx.fillRect(xBlockEnd - 12, 5, 1.5, 5);
        ctx.fillRect(xBlockEnd - 9, 5, 1.5, 5);
        ctx.fillRect(xBlockEnd - 6, 5, 1.5, 5);
      }
    }

    // Block divider line
    if (bIdx > 0) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(Math.floor(xStart), 0, 1, height);
    }

    // Trailing pause region shading
    if (xBlockEnd > xSpokenEnd + 1) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(xSpokenEnd, headerH, xBlockEnd - xSpokenEnd, height - headerH);
    }

    // Spoken / SFX waveform bars
    const hasAudio =
      blk.ttsStatus === 'ok' ||
      Boolean(blk.waveformPeaks && blk.waveformPeaks.length > 0) ||
      Boolean(blk.generatedAudioUrl);

    if (!hasAudio) {
      ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.fillRect(xStart, midY - 1, segWidth, 2);
    } else {
      const peaks =
        blk.waveformPeaks && blk.waveformPeaks.length > 0
          ? blk.waveformPeaks
          : generateSyntheticPreviewPeaks(`${blk.id}_${blk.text}`, 96);

      const gainDb = blk.volumeGainDb ?? 0;
      const gainLin =
        !Number.isFinite(gainDb) || gainDb <= -48 ? 0 : Math.pow(10, gainDb / 20);

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

        ctx.fillStyle = isBeingDragged
          ? '#818cf8'
          : isPlayed
            ? accentColor
            : blk.ttsStatus === 'ok'
              ? '#64748b'
              : '#334155';

        const x = xStart + i * stepX;
        const topY =
          midY +
          Math.max(-1.0, Math.min(1.0, peaks.minPeaks[peakIdx] * gainLin)) *
            (waveformAreaH * 0.42);
        const bottomY =
          midY +
          Math.max(-1.0, Math.min(1.0, peaks.maxPeaks[peakIdx] * gainLin)) *
            (waveformAreaH * 0.42);
        const barH = Math.max(1.5, bottomY - topY);
        ctx.fillRect(x, topY, barW, barH);
      }
    }

    // Highlight target drop slot when dragging over
    if (isTargetDrop) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.fillRect(xStart, 0, blockTotalWidth, height);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(xStart + 1, 1, blockTotalWidth - 2, height - 2);
      ctx.setLineDash([]);
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
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.fillRect(xBlockEnd - 1, headerH + 2, 2, height - headerH - 4);
    }
  }

  // 4. Hover timecode guide line
  if (
    hoverTimeSec !== null &&
    hoverTimeSec >= 0 &&
    hoverTimeSec <= totalDurationSec &&
    !dragReorderState
  ) {
    const hoverX = (hoverTimeSec / totalDurationSec) * width;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.fillRect(Math.max(0, hoverX - 0.5), 0, 1, height);
  }

  // 5. Active playhead cursor needle
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
  isAutoAdvance = true,
  onToggleAutoAdvance,
  playbackSpeed,
  meterSnapshot,
  onTogglePlay,
  onStop,
  onToggleLoop,
  onSeekTimeSec,
  onJumpBlockIndex,
  onChangeSpeed,
  onScrubStateChange,
  onUpdatePauseAfterMs,
  onSelectBlockId,
  onReorderBlocks,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(640);
  const [zoomLevel, setZoomLevel] = React.useState<number>(1.0);
  const [internalMeterSnapshot, setInternalMeterSnapshot] = React.useState<LiveMeterSnapshot>(() =>
    studioTransportEngine.getLatestSnapshot()
  );

  React.useEffect(() => {
    if (!meterSnapshot) {
      return studioTransportEngine.subscribeMeter(setInternalMeterSnapshot);
    }
  }, [meterSnapshot]);

  const activeMeterSnapshot = meterSnapshot ?? internalMeterSnapshot;
  const setAuxBusModalOpen = useStoriaStore((s) => s.setAuxBusModalOpen);

  const isDraggingRef = React.useRef(false);
  const isDraggingPauseRef = React.useRef<{
    blockId: string;
    initialPauseMs: number;
    startClientX: number;
    totalDurationSec: number;
    width: number;
  } | null>(null);

  const isDraggingBlockRef = React.useRef<{
    sourceIndex: number;
    targetIndex: number;
    startX: number;
  } | null>(null);
  const [dragReorderState, setDragReorderState] =
    React.useState<DragReorderState | null>(null);

  const [hoverTimeSec, setHoverTimeSec] = React.useState<number | null>(null);
  const [isOverPauseHandle, setIsOverPauseHandle] = React.useState(false);
  const [isOverHeaderHandle, setIsOverHeaderHandle] = React.useState(false);

  const [draggingPillIndex, setDraggingPillIndex] = React.useState<number | null>(
    null
  );
  const [dragOverPillIndex, setDragOverPillIndex] = React.useState<number | null>(
    null
  );

  // Measure scroll container width with ResizeObserver
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  const effectiveCanvasWidth = Math.max(
    containerWidth,
    Math.round(containerWidth * zoomLevel)
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
    const cssWidth = effectiveCanvasWidth;
    const cssHeight = 52;

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
      hoverTimeSec,
      dragReorderState
    );
    ctx.restore();
  }, [
    blocks,
    speakers,
    playheadSec,
    totalDurationSec,
    hoverTimeSec,
    effectiveCanvasWidth,
    dragReorderState,
  ]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  // Smooth auto-scroll following playhead during playback when zoomed
  React.useEffect(() => {
    if (
      !isPlaying ||
      zoomLevel <= 1 ||
      !scrollContainerRef.current ||
      totalDurationSec <= 0
    ) {
      return;
    }
    const container = scrollContainerRef.current;
    const playheadPixelX =
      (playheadSec / totalDurationSec) * effectiveCanvasWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    if (playheadPixelX > viewRight - 60 || playheadPixelX < viewLeft) {
      container.scrollTo({
        left: Math.max(0, playheadPixelX - container.clientWidth / 2),
        behavior: 'smooth',
      });
    }
  }, [playheadSec, isPlaying, zoomLevel, totalDurationSec, effectiveCanvasWidth]);

  // Coordinates extraction supporting zoom & horizontal scroll
  const getCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement> | PointerEvent
  ) => {
    const canvas = canvasRef.current;
    const rawX = e.clientX ?? (e as unknown as MouseEvent).clientX ?? 0;
    const rawY =
      e.clientY !== undefined
        ? e.clientY
        : (e as unknown as MouseEvent).clientY ?? 25;
    if (!canvas) return { canvasX: rawX, canvasY: rawY, clientX: rawX };

    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : effectiveCanvasWidth;
    const height = rect.height > 0 ? rect.height : 52;
    const canvasX = Math.max(0, Math.min(width, rawX - (rect.left || 0)));
    const canvasY = Math.max(0, Math.min(height, rawY - (rect.top || 0)));
    return { canvasX, canvasY, clientX: rawX };
  };

  const computeTimeFromCanvasX = (canvasX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : effectiveCanvasWidth;
    const ratio = Math.max(0, Math.min(1, canvasX / width));
    return ratio * totalDurationSec;
  };

  const findPauseHandleAtCanvasX = (
    canvasX: number
  ): { block: ScriptBlock; blockIndex: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0 || blocks.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : effectiveCanvasWidth;

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const startSec = blk.startTimeSec ?? 0;
      const totalBlkDur = blk.estimatedDurationSec ?? 0;
      const pauseSec = Math.max(0, (blk.pauseAfterMs ?? 0) / 1000);
      const spokenDur = Math.max(0.1, totalBlkDur - pauseSec);
      const endSec = blk.endTimeSec ?? startSec + totalBlkDur;

      const xSpokenEnd = ((startSec + spokenDur) / totalDurationSec) * width;
      const xBlockEnd = (endSec / totalDurationSec) * width;

      const minX = Math.min(xSpokenEnd, xBlockEnd - 12);
      const maxX = xBlockEnd + 12;
      if (canvasX >= minX && canvasX <= maxX) {
        return { block: blk, blockIndex: i };
      }
    }
    return null;
  };

  const findBlockAtCanvasX = (
    canvasX: number
  ): { block: ScriptBlock; blockIndex: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || totalDurationSec <= 0 || blocks.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : effectiveCanvasWidth;

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const startSec = blk.startTimeSec ?? 0;
      const totalBlkDur = blk.estimatedDurationSec ?? 0;
      const endSec = blk.endTimeSec ?? startSec + totalBlkDur;
      const xStart = (startSec / totalDurationSec) * width;
      const xEnd = (endSec / totalDurationSec) * width;

      if (canvasX >= xStart && canvasX <= xEnd) {
        return { block: blk, blockIndex: i };
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const { canvasX, canvasY, clientX } = getCanvasCoords(e);

    // 1. Pause handle drag check (high priority for boundary editing)
    const pauseHit = findPauseHandleAtCanvasX(canvasX);
    if (pauseHit && onUpdatePauseAfterMs) {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const canvasWidth = rect && rect.width > 0 ? rect.width : effectiveCanvasWidth;
      isDraggingPauseRef.current = {
        blockId: pauseHit.block.id,
        initialPauseMs: pauseHit.block.pauseAfterMs ?? 0,
        startClientX: clientX,
        totalDurationSec,
        width: canvasWidth,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      onSelectBlockId?.(pauseHit.block.id);
      return;
    }

    // 2. Block header drag check (switching places / reordering - Green requirement)
    if (canvasY <= 16 && onReorderBlocks) {
      const blockHit = findBlockAtCanvasX(canvasX);
      if (blockHit) {
        isDraggingBlockRef.current = {
          sourceIndex: blockHit.blockIndex,
          targetIndex: blockHit.blockIndex,
          startX: canvasX,
        };
        setDragReorderState({
          sourceIndex: blockHit.blockIndex,
          targetIndex: blockHit.blockIndex,
          currentCanvasX: canvasX,
        });
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        onSelectBlockId?.(blockHit.block.id);
        return;
      }
    }

    // 3. Scrub / Seek time
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const targetSec = computeTimeFromCanvasX(canvasX);
    onScrubStateChange?.(true);
    onSeekTimeSec(targetSec);

    // Also select and trigger scroll-to-segment
    const blockHit = findBlockAtCanvasX(canvasX);
    if (blockHit) {
      onJumpBlockIndex(blockHit.blockIndex);
      onSelectBlockId?.(blockHit.block.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { canvasX, canvasY, clientX } = getCanvasCoords(e);

    // If dragging block to switch places
    if (isDraggingBlockRef.current && onReorderBlocks) {
      e.stopPropagation();
      const targetHit = findBlockAtCanvasX(canvasX);
      const targetIdx = targetHit
        ? targetHit.blockIndex
        : isDraggingBlockRef.current.sourceIndex;
      isDraggingBlockRef.current.targetIndex = targetIdx;
      setDragReorderState({
        sourceIndex: isDraggingBlockRef.current.sourceIndex,
        targetIndex: targetIdx,
        currentCanvasX: canvasX,
      });

      // Auto-scroll when dragging near viewport edges
      if (scrollContainerRef.current && zoomLevel > 1) {
        const container = scrollContainerRef.current;
        const viewLeft = container.scrollLeft;
        const viewRight = viewLeft + container.clientWidth;
        if (canvasX < viewLeft + 40) {
          container.scrollLeft -= 10;
        } else if (canvasX > viewRight - 40) {
          container.scrollLeft += 10;
        }
      }
      return;
    }

    // If dragging pause handle
    if (isDraggingPauseRef.current && onUpdatePauseAfterMs) {
      e.stopPropagation();
      const drag = isDraggingPauseRef.current;
      const deltaX = clientX - drag.startClientX;
      const deltaSec = (deltaX / drag.width) * drag.totalDurationSec;
      const newPauseMs = Math.max(
        0,
        Math.min(10000, Math.round(drag.initialPauseMs + deltaSec * 1000))
      );
      if (newPauseMs !== drag.initialPauseMs || Math.abs(deltaX) > 0) {
        onUpdatePauseAfterMs(drag.blockId, newPauseMs);
      }
      return;
    }

    // Hover indicators
    const pauseHit = findPauseHandleAtCanvasX(canvasX);
    setIsOverPauseHandle(Boolean(pauseHit));
    setIsOverHeaderHandle(canvasY <= 16);

    const targetSec = computeTimeFromCanvasX(canvasX);
    setHoverTimeSec(targetSec);
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    onSeekTimeSec(targetSec);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Complete block reorder drag
    if (isDraggingBlockRef.current) {
      e.stopPropagation();
      const { sourceIndex, targetIndex } = isDraggingBlockRef.current;
      isDraggingBlockRef.current = null;
      setDragReorderState(null);
      if (sourceIndex !== targetIndex && onReorderBlocks) {
        onReorderBlocks(sourceIndex, targetIndex);
      }
      return;
    }

    // Complete pause drag
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

  // Horizontal mouse scroll & Ctrl+Wheel zooming (Purple & Red requirements)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Zooming with wheel (Red requirement)
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.5 : -0.5;
      setZoomLevel((z) =>
        Math.max(1, Math.min(8, Number((z + zoomStep).toFixed(1))))
      );
    } else if (zoomLevel > 1) {
      // Scrolling with wheel horizontally (Purple requirement)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft +=
          e.deltaY !== 0 ? e.deltaY : e.deltaX;
      }
    }
  };

  const activeBlock = blocks[activeBlockIndex] ?? blocks[0];
  const activeSpeaker = speakers.find((s) => s.id === activeBlock?.speakerId);

  return (
    <section
      data-testid="episode-waveform-transport-deck"
      className="border-b border-slate-800/90 bg-slate-900/50 px-4 py-2.5 shrink-0 select-none space-y-2.5"
    >
      {/* Top Row: Transport Buttons, Zoom Controls, Timecode Readout & Speed Control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Collapse Deck Button (integrated directly into the transport panel) */}
          {onToggleCollapse && (
            <button
              type="button"
              data-testid="transport-collapse-btn"
              onClick={onToggleCollapse}
              title={t('collapseWaveformTransportTooltip')}
              className="p-1.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer mr-0.5"
            >
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}

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

          {/* Auto Advance Toggle */}
          <button
            type="button"
            data-testid="transport-auto-advance-btn"
            onClick={onToggleAutoAdvance}
            title={t('autoAdvanceTooltip')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
              isAutoAdvance
                ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 shadow-xs shadow-amber-950/40'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FastForward className="w-3 h-3 text-amber-400" />
            <span>{t('autoAdvance')}</span>
          </button>
        </div>

        {/* Center: Timeline Zoom Controls (Red requirement) */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800/90 rounded-md px-1.5 py-0.5 text-xs text-slate-300">
          <button
            type="button"
            data-testid="transport-zoom-out-btn"
            disabled={zoomLevel <= 1}
            onClick={() =>
              setZoomLevel((z) => Math.max(1, Number((z - 0.5).toFixed(1))))
            }
            title={t('transportZoomOut')}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="transport-zoom-reset-btn"
            onClick={() => setZoomLevel(1)}
            title={t('transportZoomReset')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold hover:bg-slate-800 text-indigo-300 cursor-pointer min-w-9 text-center transition-colors"
          >
            {zoomLevel === 1 ? '1x (Fit)' : `${zoomLevel.toFixed(1)}x`}
          </button>

          <button
            type="button"
            data-testid="transport-zoom-in-btn"
            disabled={zoomLevel >= 8}
            onClick={() =>
              setZoomLevel((z) => Math.min(8, Number((z + 0.5).toFixed(1))))
            }
            title={t('transportZoomIn')}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Side: Active Block Pill, Timecode Counter, Playback Speed */}
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

          {/* Broadcast Stereo VU Meter transferred directly onto timeline transport deck */}
          <BroadcastVuMeter
            meterSnapshot={activeMeterSnapshot}
            isPlaying={isPlaying}
            compact
          />

          {/* Modular Aux Bus DSP Rack Inspector Trigger */}
          <button
            type="button"
            data-testid="timeline-aux-bus-btn"
            onClick={() => setAuxBusModalOpen(true)}
            title={t('auxBusRackTooltip')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-800/60 hover:border-emerald-600/80 text-[11px] font-mono font-semibold text-emerald-400 transition-colors cursor-pointer shrink-0 ml-1"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>FX Bus</span>
          </button>
        </div>
      </div>

      {/* Master Episode Timeline Waveform Canvas + Scroll & Zoom Viewport (Purple & Red requirements) */}
      <div
        ref={scrollContainerRef}
        data-testid="master-waveform-scroll-container"
        onWheel={handleWheel}
        className="relative overflow-x-auto overflow-y-hidden rounded-lg bg-slate-950 border border-slate-800/90 hover:border-indigo-500/60 transition-colors scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950 select-none"
        style={{ maxWidth: '100%' }}
      >
        <div
          style={{ width: `${effectiveCanvasWidth}px`, minWidth: '100%' }}
          className="relative"
        >
          <canvas
            ref={canvasRef}
            data-testid="master-episode-waveform-canvas"
            aria-label={t('masterTimelineWaveformLabel')}
            style={{ width: `${effectiveCanvasWidth}px`, height: '52px' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
              setHoverTimeSec(null);
              setIsOverPauseHandle(false);
              setIsOverHeaderHandle(false);
            }}
            className={`block w-full touch-none ${
              dragReorderState
                ? 'cursor-grabbing'
                : isOverHeaderHandle
                  ? 'cursor-grab'
                  : isOverPauseHandle
                    ? 'cursor-col-resize'
                    : 'cursor-ew-resize'
            }`}
          />
          {hoverTimeSec !== null && !dragReorderState && (
            <span className="pointer-events-none absolute top-1 right-2 px-1.5 py-0.5 rounded bg-slate-900/95 border border-slate-700 text-[10px] font-mono text-indigo-200 shadow z-10">
              {formatDurationReadout(hoverTimeSec, true)}
            </span>
          )}
          {dragReorderState && (
            <div className="pointer-events-none absolute bottom-1 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-950/95 border border-indigo-500 text-[10px] font-mono text-indigo-200 shadow z-10 animate-pulse">
              <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
              <span>
                Switch #{dragReorderState.sourceIndex + 1} with #
                {dragReorderState.targetIndex + 1}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Block Timeline Marker Strip (Quick-Jump & Drag-to-Switch-Places Pills - Green requirement) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {blocks.map((blk, idx) => {
          const spk = speakers.find((s) => s.id === blk.speakerId);
          const isCurrent = idx === activeBlockIndex;
          const isDraggingThis = draggingPillIndex === idx;
          const isDragOverThis =
            dragOverPillIndex === idx && draggingPillIndex !== idx;

          return (
            <button
              key={blk.id}
              type="button"
              draggable={Boolean(onReorderBlocks)}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(idx));
                setDraggingPillIndex(idx);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverPillIndex(idx);
              }}
              onDragLeave={() => {
                if (dragOverPillIndex === idx) setDragOverPillIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (
                  draggingPillIndex !== null &&
                  draggingPillIndex !== idx &&
                  onReorderBlocks
                ) {
                  onReorderBlocks(draggingPillIndex, idx);
                }
                setDraggingPillIndex(null);
                setDragOverPillIndex(null);
              }}
              onDragEnd={() => {
                setDraggingPillIndex(null);
                setDragOverPillIndex(null);
              }}
              data-testid={`timeline-block-marker-${blk.id}`}
              onClick={() => {
                onJumpBlockIndex(idx);
                onSelectBlockId?.(blk.id);
              }}
              title={t('transportDragReorderTooltip')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono shrink-0 border transition-all cursor-grab active:cursor-grabbing ${
                isDragOverThis
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/50 scale-105'
                  : isDraggingThis
                    ? 'opacity-40 border-dashed border-indigo-400'
                    : isCurrent
                      ? 'bg-slate-800 border-emerald-500/70 text-emerald-300 font-semibold'
                      : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isDragOverThis ? (
                <ArrowLeftRight className="w-3 h-3 text-emerald-400 animate-spin" />
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      blk.type === 'sound_effect'
                        ? '#f59e0b'
                        : (spk?.color ?? '#6366f1'),
                  }}
                />
              )}
              <span>
                #{idx + 1}{' '}
                {blk.type === 'sound_effect'
                  ? 'SFX'
                  : (spk?.name ?? 'Narrator')}
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
