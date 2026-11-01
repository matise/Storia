import React from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from 'lucide-react';
import { ScriptBlock } from '../../types/storia';
import { transientPlaybackRef, useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ScriptBlockCard } from '../workbench/ScriptBlockCard';
import { EpisodeWaveformTransport } from '../workbench/EpisodeWaveformTransport';
import { TemporalBVH } from '../../core/spatial/TemporalBVH';
import {
  ClockInterpolator,
  DemandFrameLoop,
} from '../../core/spatial/ClockInterpolator';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';
import { studioTransportEngine } from '../../core/dsp/StudioTransportEngine';
import { getActivePreviewElapsedSec } from '../../core/dsp/LiveAudioPreviewer';

export const ScriptWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const selectedBlockId = useStoriaStore((s) => s.selectedBlockId);
  const playingBlockId = useStoriaStore((s) => s.playingBlockId);
  const stopAudioPreview = useStoriaStore((s) => s.stopAudioPreview);
  const selectBlock = useStoriaStore((s) => s.selectBlock);
  const addBlock = useStoriaStore((s) => s.addBlock);
  const isBatchSynthesizing = useStoriaStore((s) => s.isBatchSynthesizing);
  const regenerateAllBlocksAudio = useStoriaStore((s) => s.regenerateAllBlocksAudio);
  const rebuildAllWaveforms = useStoriaStore((s) => s.rebuildAllWaveforms);
  const purgeAudioCache = useStoriaStore((s) => s.purgeAudioCache);
  const updateProjectProperties = useStoriaStore((s) => s.updateProjectProperties);
  const setEpisodePropertiesModalOpen = useStoriaStore(
    (s) => s.setEpisodePropertiesModalOpen
  );
  const updateBlock = useStoriaStore((s) => s.updateBlock);
  const reorderBlocks = useStoriaStore((s) => s.reorderBlocks);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll to selected block when selectedBlockId changes
  const scrollToBlock = React.useCallback((blockId: string | null) => {
    if (!blockId) return;
    const el = document.getElementById(`script-block-card-${blockId}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  React.useEffect(() => {
    if (selectedBlockId) {
      scrollToBlock(selectedBlockId);
    }
  }, [selectedBlockId, scrollToBlock]);

  // Episode "Play All" state lives in the store so single-block audition can stop it atomically
  const isPlaying = useStoriaStore((s) => s.isMasterPlaying);
  const setMasterPlaying = useStoriaStore((s) => s.setMasterPlaying);
  const [isLooping, setIsLooping] = React.useState(false);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [playheadSec, setPlayheadSec] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0);
  const [showEpisodeBanner, setShowEpisodeBanner] = React.useState(true);
  const [showWaveformTransport, setShowWaveformTransport] = React.useState(true);

  // Build 1D Temporal BVH over ordered project blocks in O(N) whenever blocks or durations change
  const temporalBvh = React.useMemo(
    () => new TemporalBVH(project.blocks),
    [project.blocks]
  );

  const totalDurationSec = temporalBvh.getTotalDurationSec();

  // Decoupled Clock Interpolator & On-Demand FrameLoop
  const clockRef = React.useRef<ClockInterpolator>(new ClockInterpolator());
  const frameLoopRef = React.useRef<DemandFrameLoop | null>(null);
  const isLoopingRef = React.useRef(isLooping);
  isLoopingRef.current = isLooping;
  const playbackSpeedRef = React.useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const totalDurationRef = React.useRef(totalDurationSec);
  totalDurationRef.current = totalDurationSec;
  const playingBlockRef = React.useRef<ScriptBlock | null>(null);
  playingBlockRef.current = project.blocks.find((b) => b.id === playingBlockId) ?? null;

  React.useEffect(() => {
    const loop = new DemandFrameLoop((deltaSec) => {
      if (deltaSec <= 0) return;

      // If a single block is being auditioned, synchronize its current seconds from LiveAudioPreviewer or frame delta
      const singleBlock = playingBlockRef.current;
      if (singleBlock && !transientPlaybackRef.current.isPlaying) {
        const blkStart = singleBlock.startTimeSec ?? 0;
        const blkDur = Math.max(0.1, singleBlock.estimatedDurationSec ?? 1);
        const liveElapsed = getActivePreviewElapsedSec();
        let nextTimeSec: number;
        if (liveElapsed !== null) {
          nextTimeSec = blkStart + Math.min(blkDur, liveElapsed);
        } else {
          const { renderTimeSec } = clockRef.current.stepFrame(
            deltaSec,
            blkStart + blkDur
          );
          nextTimeSec = Math.max(blkStart, Math.min(blkStart + blkDur, renderTimeSec));
        }
        clockRef.current.seek(nextTimeSec);
        transientPlaybackRef.current.playheadTimeSec = nextTimeSec;
        setPlayheadSec(nextTimeSec);
        return;
      }

      const maxDur = totalDurationRef.current;
      const scaledDelta = deltaSec * playbackSpeedRef.current;
      const { renderTimeSec } = clockRef.current.stepFrame(scaledDelta, maxDur);

      if (maxDur > 0 && renderTimeSec >= maxDur - 0.005) {
        if (isLoopingRef.current) {
          clockRef.current.seek(0);
          transientPlaybackRef.current.playheadTimeSec = 0;
          setPlayheadSec(0);
        } else {
          useStoriaStore.getState().setMasterPlaying(false);
          loop.pause();
          transientPlaybackRef.current.playheadTimeSec = maxDur;
          setPlayheadSec(maxDur);
        }
        return;
      }

      transientPlaybackRef.current.playheadTimeSec = renderTimeSec;
      setPlayheadSec(renderTimeSec);
    });

    frameLoopRef.current = loop;
    return () => loop.dispose();
  }, []);

  // When a single block starts auditioning, position playhead at that block's start if outside its bounds
  React.useEffect(() => {
    if (!playingBlockId) return;
    const blk = project.blocks.find((b) => b.id === playingBlockId);
    if (!blk) return;
    const start = blk.startTimeSec ?? 0;
    const end = blk.endTimeSec ?? start + (blk.estimatedDurationSec ?? 0);
    const current = clockRef.current.getRenderTimeSec();
    if (current < start || current >= end - 0.05) {
      clockRef.current.seek(start);
      transientPlaybackRef.current.playheadTimeSec = start;
      setPlayheadSec(start);
    }
  }, [playingBlockId, project.blocks]);

  React.useEffect(() => {
    const loop = frameLoopRef.current;
    if (!loop) return;
    const isAnyPlaying = isPlaying || Boolean(playingBlockId);
    transientPlaybackRef.current.isPlaying = isPlaying;
    transientPlaybackRef.current.frameloopMode =
      isAnyPlaying || isScrubbing ? 'active' : 'demand';

    if (isAnyPlaying) {
      loop.start();
    } else {
      loop.pause();
      studioTransportEngine.stop();
    }
  }, [isPlaying, playingBlockId, isScrubbing]);

  const handleToggleMasterPlay = React.useCallback(() => {
    if (isPlaying) {
      setMasterPlaying(false);
      return;
    }
    // Starting Play All: setMasterPlaying(true) also stops any block audition / speaker preview
    const current = clockRef.current.getRenderTimeSec();
    if (current >= totalDurationSec - 0.05 && totalDurationSec > 0) {
      clockRef.current.seek(0);
      transientPlaybackRef.current.playheadTimeSec = 0;
      setPlayheadSec(0);
    }
    setMasterPlaying(true);
  }, [isPlaying, setMasterPlaying, totalDurationSec]);

  // O(log N) 1D BVH lookup at current interpolated playhead
  const bvhHit = React.useMemo(
    () => temporalBvh.findBlockAtTime(playheadSec),
    [temporalBvh, playheadSec]
  );

  // Trigger multi-speaker sequential DSP playback & ITU-R BS.1770-4 loudness metering when playhead enters a block
  React.useEffect(() => {
    if (!isPlaying || !bvhHit.block) return;
    const blockStart = bvhHit.block.startTimeSec ?? 0;
    const pauseSec = Math.max(0, (bvhHit.block.pauseAfterMs ?? 0) / 1000);
    const totalBlkDur = bvhHit.block.estimatedDurationSec ?? 0;
    const spokenDur = Math.max(0.1, totalBlkDur - pauseSec);
    const spokenEnd = blockStart + spokenDur;
    if (playheadSec > spokenEnd) {
      studioTransportEngine.stop();
      return;
    }
    const offsetSec = Math.max(0, playheadSec - blockStart);
    void studioTransportEngine.triggerBlockOnTimeline(
      bvhHit.block,
      project,
      offsetSec
    );
  }, [isPlaying, bvhHit.block, project, playheadSec]);

  const activeTimepointHit = React.useMemo(() => {
    if (!bvhHit.block) return { timepoint: null, wordIndex: -1 };
    return temporalBvh.findActiveTimepoint(bvhHit.block, playheadSec);
  }, [temporalBvh, bvhHit.block, playheadSec]);

  const handleSeekEpisodeTime = React.useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, Math.min(totalDurationSec, targetSec));
      clockRef.current.seek(clamped);
      transientPlaybackRef.current.playheadTimeSec = clamped;
      setPlayheadSec(clamped);
      const hit = temporalBvh.findBlockAtTime(clamped);
      if (hit.block) {
        selectBlock(hit.block.id);
      }
      frameLoopRef.current?.invalidate();
    },
    [totalDurationSec, temporalBvh, selectBlock]
  );

  const handleJumpBlockIndex = React.useCallback(
    (blockIndex: number) => {
      const targetBlock = project.blocks[blockIndex];
      if (!targetBlock) return;
      const startSec = targetBlock.startTimeSec ?? 0;
      clockRef.current.seek(startSec);
      transientPlaybackRef.current.playheadTimeSec = startSec;
      setPlayheadSec(startSec);
      selectBlock(targetBlock.id);
      frameLoopRef.current?.invalidate();
    },
    [project.blocks, selectBlock]
  );

  const handleStopTransport = React.useCallback(() => {
    setMasterPlaying(false);
    if (useStoriaStore.getState().playingBlockId) {
      stopAudioPreview();
    }
    studioTransportEngine.stop();
    clockRef.current.seek(0);
    transientPlaybackRef.current.playheadTimeSec = 0;
    setPlayheadSec(0);
    frameLoopRef.current?.invalidate();
  }, []);

  const handleSeekWithinBlock = React.useCallback(
    (block: ScriptBlock, progress: number) => {
      const start = block.startTimeSec ?? 0;
      const dur = Math.max(0.01, block.estimatedDurationSec ?? 0);
      const clampedProg = Math.max(0, Math.min(1, progress));
      // Keep targetSec strictly within [start, start + dur) so 1D BVH stays on this block at progress=1
      const safeLocalOffset = Math.min(dur - 0.0005, dur * clampedProg);
      const targetSec = start + Math.max(0, safeLocalOffset);
      clockRef.current.seek(targetSec);
      transientPlaybackRef.current.playheadTimeSec = targetSec;
      setPlayheadSec(targetSec);
      selectBlock(block.id);
      frameLoopRef.current?.invalidate();
    },
    [selectBlock]
  );

  const handleScrubStateChange = React.useCallback((scrubbing: boolean) => {
    setIsScrubbing(scrubbing);
    frameLoopRef.current?.setScrubbing(scrubbing);
  }, []);

  const activeBlockIndex = bvhHit.blockIndex >= 0 ? bvhHit.blockIndex : 0;

  return (
    <main className="flex-1 flex flex-col bg-slate-950 min-w-0 overflow-hidden">
      {/* Studio Transport, Batch Waveform / Audio Data Tools & Quick Block Insertion Header */}
      <div className="min-h-12 py-1.5 border-b border-slate-800/90 bg-slate-900/40 px-4 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMasterPlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 shrink-0" />
                <span>{t('pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>{t('playAll')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsLooping((l) => !l)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isLooping
                ? 'bg-indigo-950/80 border-indigo-500/70 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5 shrink-0" />
            <span>{t('loop')}</span>
          </button>

          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 whitespace-nowrap shrink-0">
            {formatDurationReadout(playheadSec, true)} /{' '}
            {formatDurationReadout(totalDurationSec, true)}
          </span>

          <div className="h-4 w-px bg-slate-800 mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={() => addBlock('dialogue')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{t('addLine')}</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5 shrink-0" />

          {/* Episode-Wide Audio & Waveform Management Tools */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-md p-0.5 shrink-0">
            <button
              type="button"
              data-testid="regen-all-audio-btn"
              disabled={isBatchSynthesizing}
              onClick={() => void regenerateAllBlocksAudio()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-indigo-300 hover:bg-indigo-950/80 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 shrink-0" />
              <span>{t('regenAllAudio')}</span>
            </button>

            <button
              type="button"
              data-testid="rebuild-all-waveforms-btn"
              disabled={isBatchSynthesizing}
              onClick={() => void rebuildAllWaveforms()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-300 hover:bg-emerald-950/80 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3 shrink-0" />
              <span>{t('rebuildAllWaveforms')}</span>
            </button>

            <button
              type="button"
              data-testid="clear-all-audio-btn"
              disabled={isBatchSynthesizing}
              onClick={() => void purgeAudioCache()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-rose-300 hover:bg-rose-950/80 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              <span>{t('clearAllAudio')}</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="toggle-episode-banner-btn"
            onClick={() => setShowEpisodeBanner((prev) => !prev)}
            title={t('toggleEpisodeMetaTooltip')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              showEpisodeBanner
                ? 'bg-indigo-950/70 border-indigo-500/50 text-indigo-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>{t('episodePropertiesBtn')}</span>
            {showEpisodeBanner ? (
              <ChevronUp className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0" />
            )}
          </button>

          <button
            type="button"
            data-testid="toggle-waveform-transport-btn"
            onClick={() => setShowWaveformTransport((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              showWaveformTransport
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3 shrink-0" />
            <span>{t('waveformTransportBtn')}</span>
            {showWaveformTransport ? (
              <ChevronUp className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0" />
            )}
          </button>
        </div>

        {/* On-Demand Render Loop Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono whitespace-nowrap shrink-0 transition-colors ${
            isPlaying || isScrubbing
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              isPlaying || isScrubbing ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
            }`}
          />
          <span>
            {t('frameloopDemand')}: {isPlaying || isScrubbing ? t('frameloopActive') : t('frameloopIdle')}
          </span>
        </div>
      </div>

      {/* Inline Episode Properties Strip */}
      {showEpisodeBanner && (
        <section
          data-testid="workbench-episode-properties-strip"
          className="border-b border-slate-800/80 bg-slate-900/35 px-4 py-2.5 shrink-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            {/* Episode Title */}
            <div className="md:col-span-4 flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('episodeTitleLabel')}
              </label>
              <input
                type="text"
                data-testid="workbench-episode-title-input"
                value={project.title}
                onChange={(e) => updateProjectProperties({ title: e.target.value })}
                className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Episode Primary Language */}
            {/* Language & Regional Dialect */}
            <div className="md:col-span-2 flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-indigo-400" />
                <span>{t('episodeLanguageLabel')}</span>
              </label>
              <select
                data-testid="workbench-episode-lang-select"
                value={
                  project.defaultLanguage === 'en'
                    ? 'en'
                    : project.dialect === 'dubrovnik'
                      ? 'hr-dubrovnik'
                      : 'hr'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'en') {
                    updateProjectProperties({
                      defaultLanguage: 'en',
                      dialect: 'standard',
                    });
                  } else if (val === 'hr-dubrovnik') {
                    updateProjectProperties({
                      defaultLanguage: 'hr',
                      dialect: 'dubrovnik',
                    });
                  } else {
                    updateProjectProperties({
                      defaultLanguage: 'hr',
                      dialect: 'standard',
                    });
                  }
                }}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-indigo-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="hr">Hrvatski (Standardni HR)</option>
                <option value="hr-dubrovnik">Hrvatski — Dubrovački govor (Ragusa)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>

            {/* Dubrovnik Register Selector (when Dubrovnik dialect is active) */}
            {project.defaultLanguage === 'hr' && project.dialect === 'dubrovnik' && (
              <div className="md:col-span-2 flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <span>{t('dubrovnikRegisterLabel')}</span>
                </label>
                <select
                  data-testid="workbench-dubrovnik-register-select"
                  value={project.dubrovnikRegister ?? 'contemporary'}
                  onChange={(e) =>
                    updateProjectProperties({
                      dubrovnikRegister: e.target.value as 'classical' | 'traditional' | 'contemporary',
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-amber-800/80 text-xs font-medium text-amber-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="contemporary">Suvremeni razgovorni</option>
                  <option value="traditional">Tradicionalni pučki govor Grada (19./20. st.)</option>
                  <option value="classical">Klasični barokni (Držić / Gundulić)</option>
                </select>
              </div>
            )}

            {/* Genre / Format */}
            <div className="md:col-span-2 flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('episodeGenreLabel')}
              </label>
              <input
                type="text"
                data-testid="workbench-episode-genre-input"
                value={project.metadata?.genre ?? ''}
                onChange={(e) => updateProjectProperties({ genre: e.target.value })}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Author / Showrunner */}
            <div className="md:col-span-2 flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('episodeAuthorLabel')}
              </label>
              <input
                type="text"
                data-testid="workbench-episode-author-input"
                value={project.metadata?.author ?? ''}
                onChange={(e) => updateProjectProperties({ author: e.target.value })}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Target WPM + Open Full Properties Modal */}
            <div className="md:col-span-2 flex items-end gap-1.5">
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('episodeTargetWpmLabel')}
                </label>
                <input
                  type="number"
                  min={60}
                  max={260}
                  data-testid="workbench-episode-wpm-input"
                  value={project.metadata?.targetWpm ?? 140}
                  onChange={(e) =>
                    updateProjectProperties({
                      targetWpm: Number(e.target.value) || 140,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                data-testid="workbench-open-episode-modal-btn"
                onClick={() => setEpisodePropertiesModalOpen(true)}
                title={t('episodePropertiesModalTitle')}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-indigo-300 transition-colors cursor-pointer"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Episode Synopsis / Description */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">
              {t('episodeDescriptionLabel')}:
            </span>
            <input
              type="text"
              data-testid="workbench-episode-desc-input"
              value={project.description ?? ''}
              onChange={(e) => updateProjectProperties({ description: e.target.value })}
              className="flex-1 px-2.5 py-1 rounded bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            />
            <span className="hidden lg:inline-block text-[10px] font-mono text-slate-500 shrink-0">
              {project.audioConfig.sampleRate}Hz / {project.audioConfig.bitDepth}-bit /{' '}
              {project.audioConfig.targetLufs} LUFS
            </span>
          </div>
        </section>
      )}

      {/* Master Episode Waveform Timeline & Transport View */}
      {showWaveformTransport && (
        <EpisodeWaveformTransport
          blocks={project.blocks}
          speakers={project.speakers}
          playheadSec={playheadSec}
          totalDurationSec={totalDurationSec}
          activeBlockIndex={activeBlockIndex}
          isPlaying={isPlaying}
          isLooping={isLooping}
          playbackSpeed={playbackSpeed}
          onTogglePlay={handleToggleMasterPlay}
          onStop={handleStopTransport}
          onToggleLoop={() => setIsLooping((l) => !l)}
          onSeekTimeSec={handleSeekEpisodeTime}
          onJumpBlockIndex={(idx) => {
            handleJumpBlockIndex(idx);
            const blk = project.blocks[idx];
            if (blk) scrollToBlock(blk.id);
          }}
          onChangeSpeed={setPlaybackSpeed}
          onScrubStateChange={handleScrubStateChange}
          onUpdatePauseAfterMs={(blockId, pauseAfterMs) => {
            updateBlock(blockId, { pauseAfterMs });
          }}
          onSelectBlockId={(blockId) => {
            selectBlock(blockId);
            scrollToBlock(blockId);
          }}
          onReorderBlocks={reorderBlocks}
        />
      )}

      {/* Script Blocks Scroll Container */}
      <div
        ref={scrollContainerRef}
        data-testid="script-blocks-scroll-container"
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {project.blocks.map((block, index) => {
          const isCurrentPlayheadBlock = bvhHit.block?.id === block.id;
          const blockProgress = isCurrentPlayheadBlock ? bvhHit.blockProgress : 0;

          return (
            <ScriptBlockCard
              key={block.id}
              block={block}
              index={index}
              totalBlocks={project.blocks.length}
              speakers={project.speakers}
              isSelected={block.id === selectedBlockId}
              isActivePlayheadBlock={
                isCurrentPlayheadBlock &&
                (isPlaying || Boolean(playingBlockId) || isScrubbing)
              }
              blockPlayheadProgress={blockProgress}
              activeWordIndex={isCurrentPlayheadBlock ? activeTimepointHit.wordIndex : -1}
              onSeekWithinBlock={handleSeekWithinBlock}
              onScrubStateChange={handleScrubStateChange}
            />
          );
        })}

        {/* Bottom Block Insertion Bar */}
        <div className="pt-2 pb-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => addBlock('dialogue')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('addDialogue')}</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock('narration')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('addNarration')}</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock('sound_effect')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('addSfx')}</span>
          </button>
        </div>
      </div>

      {/* Bottom DOD Waveform & 1D BVH Telemetry Status Bar */}
      <footer className="h-9 border-t border-slate-800/90 bg-slate-900/60 px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 select-none">
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-300">{t('waveformStatusPrefix')}</span>
          <span className="text-slate-600">|</span>
          <span>
            {t('bvhActivePrefix')}: Block #{activeBlockIndex + 1} (t=
            {playheadSec.toFixed(1)}s, depth={bvhHit.depthVisited})
          </span>
        </div>
        <div className="text-slate-500 hidden sm:block">
          Ctrl+Z / Ctrl+Y • Alt+1..9 Speaker • Alt+↑/↓ Reorder
        </div>
      </footer>
    </main>
  );
};
