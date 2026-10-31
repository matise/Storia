import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Sliders,
  Square,
  Trash2,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { Speaker } from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  formatDurationReadout,
  recalculateProjectTimeline,
} from '../../core/pacing/pacingCalculator';
import {
  LiveMeterSnapshot,
  studioTransportEngine,
} from '../../core/dsp/StudioTransportEngine';

export const CastSidebar: React.FC = () => {
  const { t } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const addSpeaker = useStoriaStore((s) => s.addSpeaker);
  const openSpeakerModal = useStoriaStore((s) => s.openSpeakerModal);
  const updateSpeaker = useStoriaStore((s) => s.updateSpeaker);
  const toggleSpeakerEq = useStoriaStore((s) => s.toggleSpeakerEq);
  const toggleSpeakerDynamics = useStoriaStore((s) => s.toggleSpeakerDynamics);
  const previewSpeakerVoice = useStoriaStore((s) => s.previewSpeakerVoice);
  const previewingSpeakerId = useStoriaStore((s) => s.previewingSpeakerId);
  const regenerateSpeakerAudio = useStoriaStore((s) => s.regenerateSpeakerAudio);
  const deleteSpeakerAudio = useStoriaStore((s) => s.deleteSpeakerAudio);

  const [expandedDspId, setExpandedDspId] = React.useState<string | null>(null);
  const [meterSnapshot, setMeterSnapshot] = React.useState<LiveMeterSnapshot>(() =>
    studioTransportEngine.getLatestSnapshot()
  );

  React.useEffect(() => {
    return studioTransportEngine.subscribeMeter(setMeterSnapshot);
  }, []);

  const summary = React.useMemo(
    () =>
      recalculateProjectTimeline(
        project.blocks,
        project.speakers,
        project.metadata?.targetWpm ?? 140
      ),
    [project.blocks, project.speakers, project.metadata?.targetWpm]
  );

  const handleQuickEqChange = (
    speaker: Speaker,
    band: 'lowShelfGainDb' | 'midPeakGainDb' | 'highShelfGainDb',
    val: number
  ) => {
    const currentEq = speaker.voice.acoustics.biquadEq ?? {
      enabled: true,
      lowShelfGainDb: 0,
      midPeakGainDb: 0,
      highShelfGainDb: 0,
    };
    updateSpeaker({
      ...speaker,
      voice: {
        ...speaker.voice,
        acoustics: {
          ...speaker.voice.acoustics,
          biquadEq: {
            ...currentEq,
            [band]: val,
          },
        },
      },
    });
  };

  return (
    <aside className="w-68 border-r border-slate-800/90 bg-slate-950 flex flex-col justify-between shrink-0 select-none">
      {/* Header & Speaker Roster */}
      <div className="p-3 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
            {t('castAndSpeakers')}
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            {project.speakers.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => addSpeaker()}
          className="w-full py-1.5 px-3 rounded-md border border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-900/60 hover:bg-slate-900 text-xs font-medium text-indigo-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>[{t('newSpeaker')}]</span>
        </button>

        {/* Speaker Cards */}
        <div className="flex flex-col gap-2.5">
          {project.speakers.map((speaker, idx) => {
            const stats = summary.speakerStats[speaker.id] ?? {
              lineCount: 0,
              durationSec: 0,
              audioTokens: 0,
            };
            const eqEnabled = speaker.voice.acoustics.biquadEq?.enabled ?? true;
            const dynEnabled = speaker.voice.acoustics.compression?.enabled ?? true;
            const isPreviewing = previewingSpeakerId === speaker.id;
            const isDspExpanded = expandedDspId === speaker.id;
            const biquad = speaker.voice.acoustics.biquadEq ?? {
              lowShelfGainDb: 0,
              midPeakGainDb: 0,
              highShelfGainDb: 0,
            };

            return (
              <div
                key={speaker.id}
                className="group p-2.5 rounded-lg bg-slate-900/75 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition-all"
              >
                {/* Top Speaker Identity Row (Click to open full modal) */}
                <div
                  onClick={() => openSpeakerModal(speaker.id)}
                  title={t('editSpeakerTooltip')}
                  className="flex items-center justify-between gap-2 mb-1.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: speaker.color }}
                    />
                    <span className="font-semibold text-xs text-slate-100 truncate">
                      {speaker.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({speaker.gender}, {speaker.age})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                      Alt+{idx + 1}
                    </span>
                    <Sliders className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>

                {/* Voice & Style Metadata */}
                <div
                  onClick={() => openSpeakerModal(speaker.id)}
                  className="text-[11px] text-slate-400 space-y-0.5 pl-4 cursor-pointer"
                >
                  <div className="flex items-center gap-1 truncate">
                    <Volume2 className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="text-slate-500">{t('voiceLabel')}:</span>
                    <span className="text-slate-200 font-medium">
                      {speaker.voice.baseVoice}
                    </span>
                    <span className="text-slate-500">({speaker.voice.speakingRate}x)</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">{t('styleLabel')}: </span>
                    <span className="text-slate-300">{speaker.voice.stylePrompt}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 pt-0.5">
                    {stats.lineCount} {t('linesCount')} ({stats.audioTokens}{' '}
                    {t('tokensAbbrev')})
                  </div>
                </div>

                {/* Inline Speaker Preview & EQ / Dynamics Quick Toggles */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  {/* Preview Voice Audition Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void previewSpeakerVoice(speaker.id);
                    }}
                    title={
                      isPreviewing ? t('stopSpeakerPreview') : t('previewSpeakerVoice')
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                      isPreviewing
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-indigo-300'
                    }`}
                  >
                    {isPreviewing ? (
                      <>
                        <Square className="w-2.5 h-2.5 fill-current" />
                        <span>{t('stopSpeakerPreview')}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{t('previewSpeakerVoice')}</span>
                      </>
                    )}
                  </button>

                  {/* EQ & Dynamics Toggles + Quick Trim Drawer Trigger */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSpeakerEq(speaker.id);
                      }}
                      title="Toggle 3-Band Biquad EQ (120Hz / 2.5kHz / 8kHz)"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        eqEnabled
                          ? 'bg-indigo-950/80 border-indigo-600/60 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                      }`}
                    >
                      {t('eqToggleLabel')}:{eqEnabled ? 'ON' : 'OFF'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSpeakerDynamics(speaker.id);
                      }}
                      title="Toggle Dynamics Compressor"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        dynEnabled
                          ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                      }`}
                    >
                      {t('dynToggleLabel')}:{dynEnabled ? 'ON' : 'OFF'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDspId(isDspExpanded ? null : speaker.id);
                      }}
                      title={t('dspQuickSliders')}
                      className="p-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {isDspExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Inline Mini EQ Trim Sliders & Speaker Audio Regeneration/Deletion Tools */}
                {isDspExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 p-2 rounded bg-slate-950 border border-slate-800/90 space-y-2 text-[10px]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>120Hz Low</span>
                        <span className="font-mono text-slate-200">
                          {biquad.lowShelfGainDb > 0 ? '+' : ''}
                          {biquad.lowShelfGainDb.toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        disabled={!eqEnabled}
                        value={biquad.lowShelfGainDb}
                        onChange={(e) =>
                          handleQuickEqChange(
                            speaker,
                            'lowShelfGainDb',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full h-1 accent-indigo-500 disabled:opacity-40"
                      />

                      <div className="flex items-center justify-between text-slate-400">
                        <span>2.5kHz Mid</span>
                        <span className="font-mono text-slate-200">
                          {biquad.midPeakGainDb > 0 ? '+' : ''}
                          {biquad.midPeakGainDb.toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        disabled={!eqEnabled}
                        value={biquad.midPeakGainDb}
                        onChange={(e) =>
                          handleQuickEqChange(
                            speaker,
                            'midPeakGainDb',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full h-1 accent-indigo-500 disabled:opacity-40"
                      />

                      <div className="flex items-center justify-between text-slate-400">
                        <span>8.0kHz Air</span>
                        <span className="font-mono text-slate-200">
                          {biquad.highShelfGainDb > 0 ? '+' : ''}
                          {biquad.highShelfGainDb.toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        disabled={!eqEnabled}
                        value={biquad.highShelfGainDb}
                        onChange={(e) =>
                          handleQuickEqChange(
                            speaker,
                            'highShelfGainDb',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full h-1 accent-indigo-500 disabled:opacity-40"
                      />
                    </div>

                    {/* Per-Speaker Batch Audio & Waveform Regeneration / Deletion */}
                    <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => void regenerateSpeakerAudio(speaker.id)}
                        className="flex-1 py-1 px-1.5 rounded bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-700/50 text-indigo-200 flex items-center justify-center gap-1 font-medium cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span className="truncate">{t('regenSpeakerAudio')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteSpeakerAudio(speaker.id)}
                        className="py-1 px-1.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 flex items-center justify-center gap-1 font-medium cursor-pointer"
                        title={t('clearSpeakerAudio')}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Studio Telemetry & ITU-R BS.1770-4 Loudness Footer */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-900/50 text-xs space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">{t('totalEstimated')}:</span>
          <span className="font-semibold text-slate-100">
            {formatDurationReadout(summary.totalDurationSec)}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">{t('audioTokensLabel')}:</span>
          <span className="text-indigo-300 font-semibold">
            {summary.totalAudioTokens.toLocaleString()} (${summary.estimatedCostUsd.toFixed(2)})
          </span>
        </div>
        <div className="pt-1 border-t border-slate-800/70 space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">{t('lufsLabel')}:</span>
            <span
              data-testid="live-lufs-readout"
              className={`font-semibold ${
                meterSnapshot.isBroadcastSafe ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {(meterSnapshot.activeBlockId
                ? meterSnapshot.integratedLufs
                : project.audioConfig.targetLufs
              ).toFixed(1)}{' '}
              ({t('broadcastOk')})
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>True Peak (4x):</span>
            <span
              data-testid="live-true-peak-readout"
              className={
                meterSnapshot.truePeakDbfs > -1.0
                  ? 'text-rose-400 font-semibold'
                  : 'text-slate-300'
              }
            >
              {meterSnapshot.truePeakDbfs.toFixed(1)} dBFS
            </span>
          </div>
          {/* Live K-Weighted Loudness Bar */}
          <div className="h-1.5 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                meterSnapshot.truePeakDbfs > -1.0
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-emerald-500 to-indigo-400'
              }`}
              style={{
                width: `${Math.max(
                  8,
                  Math.min(
                    100,
                    ((meterSnapshot.momentaryLufs + 50) / 50) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
