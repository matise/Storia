import React from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Feather,
  Headphones,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  BlockType,
  ScriptBlock,
  SfxCategoryPreset,
  Speaker,
} from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  formatDurationReadout,
  stripNonSpokenTokens,
} from '../../core/pacing/pacingCalculator';
import { restoreCroatianDiacritics } from '../../core/tts/croatianTextNormalizer';
import { transformToDubrovnikDialect } from '../../core/dubrovnik/dubrovnikPhonetics';
import { WaveformCanvas } from './WaveformCanvas';

interface ScriptBlockCardProps {
  block: ScriptBlock;
  index: number;
  totalBlocks: number;
  speakers: Speaker[];
  isSelected: boolean;
  isActivePlayheadBlock?: boolean;
  blockPlayheadProgress?: number; // 0.0 to 1.0
  activeWordIndex?: number; // >= 0 when karaoke highlight is active
  onSeekWithinBlock?: (block: ScriptBlock, progress: number) => void;
  onScrubStateChange?: (isScrubbing: boolean) => void;
}

export const ScriptBlockCard: React.FC<ScriptBlockCardProps> = ({
  block,
  index,
  totalBlocks,
  speakers,
  isSelected,
  isActivePlayheadBlock = false,
  blockPlayheadProgress = 0,
  activeWordIndex = -1,
  onSeekWithinBlock,
  onScrubStateChange,
}) => {
  const { t } = useTranslation();
  const selectBlock = useStoriaStore((s) => s.selectBlock);
  const updateBlock = useStoriaStore((s) => s.updateBlock);
  const deleteBlock = useStoriaStore((s) => s.deleteBlock);
  const moveBlockRelative = useStoriaStore((s) => s.moveBlockRelative);
  const addBlock = useStoriaStore((s) => s.addBlock);
  const synthesizeBlock = useStoriaStore((s) => s.synthesizeBlock);
  const importSfxAudioFile = useStoriaStore((s) => s.importSfxAudioFile);
  const regenerateBlockAudio = useStoriaStore((s) => s.regenerateBlockAudio);
  const rebuildBlockWaveform = useStoriaStore((s) => s.rebuildBlockWaveform);
  const deleteBlockAudio = useStoriaStore((s) => s.deleteBlockAudio);
  const auditionBlock = useStoriaStore((s) => s.auditionBlock);
  const playingBlockId = useStoriaStore((s) => s.playingBlockId);
  const previewSpeakerVoice = useStoriaStore((s) => s.previewSpeakerVoice);
  const previewingSpeakerId = useStoriaStore((s) => s.previewingSpeakerId);
  const toggleSpeakerEq = useStoriaStore((s) => s.toggleSpeakerEq);
  const toggleSpeakerDynamics = useStoriaStore((s) => s.toggleSpeakerDynamics);
  const sfxFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [localScrubProgress, setLocalScrubProgress] = React.useState(0);

  React.useEffect(() => {
    if (isSelected || isActivePlayheadBlock) {
      setLocalScrubProgress(blockPlayheadProgress);
    }
  }, [blockPlayheadProgress, isSelected, isActivePlayheadBlock]);

  const activeSpeaker = speakers.find((s) => s.id === block.speakerId);
  const durationSec = block.estimatedDurationSec ?? 0;
  const tokens = block.audioTokenEstimate ?? 0;
  const effectiveProgress =
    isSelected || isActivePlayheadBlock || playingBlockId === block.id
      ? blockPlayheadProgress
      : localScrubProgress;
  const isPlayingThisBlock = playingBlockId === block.id;
  const isPreviewingThisSpeaker =
    Boolean(activeSpeaker) && previewingSpeakerId === activeSpeaker?.id;

  const eqEnabled = activeSpeaker?.voice.acoustics.biquadEq?.enabled ?? true;
  const dynEnabled = activeSpeaker?.voice.acoustics.compression?.enabled ?? true;
  const hasGeneratedAudioOrPeaks =
    block.ttsStatus === 'ok' ||
    block.ttsStatus === 'stale' ||
    Boolean(block.waveformPeaks) ||
    Boolean(block.generatedAudioUrl);

  const placeholder =
    block.type === 'dialogue'
      ? t('dialoguePlaceholder')
      : block.type === 'narration'
        ? t('narrationPlaceholder')
        : block.type === 'sound_effect'
          ? t('sfxPlaceholder')
          : t('directionPlaceholder');

  const statusBadge =
    block.ttsStatus === 'ok' ? (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/70 border border-emerald-700/60 text-emerald-300">
        {t('ttsOk')}
      </span>
    ) : block.ttsStatus === 'stale' ? (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/70 border border-amber-700/60 text-amber-300">
        {t('ttsStale')}
      </span>
    ) : block.ttsStatus === 'rendering' ? (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-950/80 border border-indigo-600/60 text-indigo-300 flex items-center gap-1">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        <span>{t('ttsRendering')}</span>
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-900 border border-slate-800 text-slate-400">
        {t('ttsUnrendered')}
      </span>
    );

  const spokenWords = React.useMemo(() => {
    const cleaned = stripNonSpokenTokens(block.text);
    return cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
  }, [block.text]);

  const handleAutoRestoreCroatianDiacritics = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fixedText = restoreCroatianDiacritics(block.text);
    const fixedNotes = block.directorNotes
      ? restoreCroatianDiacritics(block.directorNotes)
      : block.directorNotes;
    updateBlock(block.id, {
      text: fixedText,
      directorNotes: fixedNotes,
    });
  };

  const project = useStoriaStore((s) => s.project);

  const handleApplyDubrovnikDialect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!block.text) return;
    const transformed = transformToDubrovnikDialect(
      block.text,
      project.dubrovnikRegister ?? 'contemporary'
    );
    updateBlock(block.id, {
      text: transformed,
    });
  };

  const isCollapsed = Boolean(block.isCollapsed);

  return (
    <div
      id={`script-block-card-${block.id}`}
      data-testid={`script-block-card-${block.id}`}
      onClick={() => selectBlock(block.id)}
      className={`rounded-xl border transition-all p-3.5 ${
        isActivePlayheadBlock || isPlayingThisBlock
          ? 'bg-slate-900/95 border-emerald-500/70 shadow-sm shadow-emerald-950/40'
          : isSelected
            ? 'bg-slate-900/95 border-indigo-500/70 shadow-sm shadow-indigo-950/50'
            : 'bg-slate-900/50 hover:bg-slate-900/75 border-slate-800/80'
      }`}
    >
      {/* Top Bar: Block Index + Collapse Toggle, Type, Speaker, Didaskalije, Status, Tools, Reorder & Delete */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        {/* Left Side: Collapse Button, Index, Type, Speaker, SFX Controls, Director Notes */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Collapse / Expand Toggle Button + Index Pill */}
          <div className="flex items-center rounded-md bg-slate-950 border border-slate-800 p-0.5">
            <button
              type="button"
              data-testid={`toggle-collapse-block-${block.id}`}
              onClick={(e) => {
                e.stopPropagation();
                updateBlock(block.id, { isCollapsed: !isCollapsed });
              }}
              title={isCollapsed ? t('expandBlockTooltip') : t('collapseBlockTooltip')}
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="px-1.5 py-0.5 font-mono text-xs font-bold text-slate-300">
              #{index + 1}
            </span>
          </div>

          {/* Block Type Selector */}
          <select
            aria-label="Block Type"
            value={block.type}
            onChange={(e) =>
              updateBlock(block.id, { type: e.target.value as BlockType })
            }
            className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="dialogue">{t('typeDialogue')}</option>
            <option value="narration">{t('typeNarration')}</option>
            <option value="sound_effect">{t('typeSfx')}</option>
            <option value="direction">{t('typeDirection')}</option>
          </select>

          {/* Speaker Selector + Inline Speaker Preview & EQ/Dynamics Toggles */}
          {(block.type === 'dialogue' || block.type === 'narration') && activeSpeaker && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeSpeaker.color }}
              />
              <select
                aria-label="Speaker"
                value={block.speakerId ?? ''}
                onChange={(e) =>
                  updateBlock(block.id, { speakerId: e.target.value })
                }
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Inline Speaker Preview Audition Tool on Block Editor */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void previewSpeakerVoice(activeSpeaker.id, block.text);
                }}
                title={`${t('previewSpeakerVoice')}: ${activeSpeaker.name}`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                  isPreviewingThisSpeaker
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <Headphones className="w-3 h-3 text-indigo-400" />
                <span>{activeSpeaker.voice.baseVoice}</span>
              </button>

              {/* Inline Speaker EQ Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSpeakerEq(activeSpeaker.id);
                }}
                title="Toggle Speaker 3-Band Biquad EQ"
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                  eqEnabled
                    ? 'bg-indigo-950/70 border-indigo-700/60 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                }`}
              >
                {t('eqToggleLabel')}:{eqEnabled ? 'ON' : 'OFF'}
              </button>

              {/* Inline Speaker Dynamics Compressor Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSpeakerDynamics(activeSpeaker.id);
                }}
                title="Toggle Speaker Dynamics Compressor"
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                  dynEnabled
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                }`}
              >
                {t('dynToggleLabel')}:{dynEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          {/* Inline SFX Studio Controls for sound_effect Blocks */}
          {block.type === 'sound_effect' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-amber-950/30 border border-amber-700/40 rounded-md px-2 py-0.5">
              <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                aria-label="SFX Category Preset"
                data-testid={`sfx-category-select-${block.id}`}
                value={block.sfxCategory ?? 'auto'}
                onChange={(e) =>
                  updateBlock(block.id, {
                    sfxCategory: e.target.value as SfxCategoryPreset,
                  })
                }
                className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-medium text-amber-200 focus:outline-none focus:border-amber-500"
              >
                <option value="auto">{t('sfxPresetAuto')}</option>
                <option value="tram_rail">{t('sfxPresetTramRail')}</option>
                <option value="footsteps">{t('sfxPresetFootsteps')}</option>
                <option value="weather_rain">{t('sfxPresetWeatherRain')}</option>
                <option value="wind_storm">{t('sfxPresetWindStorm')}</option>
                <option value="thunder">{t('sfxPresetThunder')}</option>
                <option value="door_creak">{t('sfxPresetDoorCreak')}</option>
                <option value="impact_knock">{t('sfxPresetImpactKnock')}</option>
                <option value="cinematic_drone">{t('sfxPresetCinematicDrone')}</option>
                <option value="radio_static">{t('sfxPresetRadioStatic')}</option>
                {block.sfxCategory === 'custom_upload' && (
                  <option value="custom_upload">
                    {t('sfxPresetCustomUpload')}{' '}
                    {block.customAudioFileName ? `(${block.customAudioFileName})` : ''}
                  </option>
                )}
              </select>

              <label className="flex items-center gap-1 text-[10px] font-mono text-amber-300/90">
                <span>{t('sfxDurationLabel')}:</span>
                <input
                  type="number"
                  data-testid={`sfx-duration-input-${block.id}`}
                  min={1.0}
                  max={15.0}
                  step={0.5}
                  value={block.sfxDurationSec ?? 3.5}
                  onChange={(e) =>
                    updateBlock(block.id, {
                      sfxDurationSec: Math.min(
                        15.0,
                        Math.max(1.0, Number(e.target.value) || 3.5)
                      ),
                    })
                  }
                  className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-right text-amber-100 focus:outline-none focus:border-amber-500"
                />
              </label>

              {/* Upload Custom Audio File (.wav, .mp3, .ogg) */}
              <input
                ref={sfxFileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a"
                data-testid={`sfx-file-input-${block.id}`}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importSfxAudioFile(block.id, file);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                data-testid={`sfx-import-btn-${block.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  sfxFileInputRef.current?.click();
                }}
                title={t('importSfxTooltip')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-medium text-amber-200 transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3 text-amber-400" />
                <span>{t('importSfxBtn')}</span>
              </button>
            </div>
          )}

          {/* Clean Director's Notes (Didaskalije) Input — square brackets removed from UI */}
          <div className="flex items-center bg-slate-950/90 border border-slate-800/90 rounded-md px-2.5 py-0.5 text-xs text-indigo-300">
            <input
              type="text"
              value={block.directorNotes ?? ''}
              onChange={(e) =>
                updateBlock(block.id, { directorNotes: e.target.value })
              }
              placeholder={t('directorNotesPlaceholder')}
              className="bg-transparent text-xs text-indigo-200 placeholder:text-slate-600 focus:outline-none w-40 sm:w-56 font-mono"
            />
          </div>
        </div>

        {/* Right Side: Status Badge, Audio Tools, Order Buttons & Delete Block together at the top */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {statusBadge}

          {/* Per-Block Audio & Waveform Regeneration / Deletion Toolbar in Top Bar */}
          <div className="flex items-center gap-0.5 bg-slate-950/90 border border-slate-800/90 rounded-md p-0.5">
            {/* Force Regenerate Audio & Waveform */}
            <button
              type="button"
              data-testid={`regen-block-audio-${block.id}`}
              disabled={block.ttsStatus === 'rendering'}
              onClick={(e) => {
                e.stopPropagation();
                void regenerateBlockAudio(block.id);
              }}
              title={t('regenerateAudioTooltip')}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-indigo-300 hover:bg-indigo-950/80 hover:text-indigo-200 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">{t('regenerateAudioBtn')}</span>
            </button>

            {/* Rebuild SoA Waveform Peaks */}
            <button
              type="button"
              data-testid={`rebuild-block-waveform-${block.id}`}
              disabled={block.ttsStatus === 'rendering'}
              onClick={(e) => {
                e.stopPropagation();
                void rebuildBlockWaveform(block.id);
              }}
              title={t('rebuildWaveformTooltip')}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-emerald-300 hover:bg-emerald-950/80 hover:text-emerald-200 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3" />
              <span className="hidden sm:inline">{t('rebuildWaveformBtn')}</span>
            </button>

            {/* Delete / Clear Block Audio & Waveform Data */}
            <button
              type="button"
              data-testid={`delete-block-audio-${block.id}`}
              disabled={!hasGeneratedAudioOrPeaks || block.ttsStatus === 'rendering'}
              onClick={(e) => {
                e.stopPropagation();
                void deleteBlockAudio(block.id);
              }}
              title={t('deleteAudioTooltip')}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-rose-300 hover:bg-rose-950/80 hover:text-rose-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <XCircle className="w-3 h-3" />
              <span className="hidden sm:inline">{t('deleteAudioBtn')}</span>
            </button>
          </div>

          {/* Reorder & Delete Block Controls */}
          <div className="flex items-center gap-0.5 bg-slate-950/90 border border-slate-800/90 rounded-md p-0.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                moveBlockRelative(block.id, 'up');
              }}
              title={t('moveUp')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === totalBlocks - 1}
              onClick={(e) => {
                e.stopPropagation();
                moveBlockRelative(block.id, 'down');
              }}
              title={t('moveDown')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={totalBlocks <= 1}
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(block.id);
              }}
              title={t('deleteBlock')}
              className="p-1 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsed Compact Preview Bar */}
      {isCollapsed && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/40">
          <div className="flex items-center gap-2 truncate mr-3">
            <span className="font-semibold text-slate-300 shrink-0">
              {block.type === 'sound_effect' ? 'SFX' : (activeSpeaker?.name ?? 'Narrator')}:
            </span>
            <span className="truncate text-slate-400 italic">
              {block.text || placeholder}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 shrink-0">
            {formatDurationReadout(durationSec, true)}
          </span>
        </div>
      )}

      {/* Expanded Block Body */}
      {!isCollapsed && (
        <>

      {/* Script Textarea + Live Karaoke Word Synchronizer Strip */}
      <div className="mb-2.5 space-y-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            data-testid={`transform-dubrovnik-dialect-${block.id}`}
            onClick={handleApplyDubrovnikDialect}
            title={t('dubrovnikDialectButtonTooltip')}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-amber-950/70 border border-slate-800 hover:border-amber-600/50 text-[10px] text-amber-300 font-mono transition-colors cursor-pointer"
          >
            <Feather className="w-2.5 h-2.5 text-amber-400" />
            <span>Dubrovački</span>
          </button>

          <button
            type="button"
            data-testid={`restore-croatian-diacritics-${block.id}`}
            onClick={handleAutoRestoreCroatianDiacritics}
            title="Automatski dodaj hrvatske dijakritičke znakove (č, ć, ž, š, đ) / Auto-restore Croatian diacritics"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-indigo-950/70 border border-slate-800 hover:border-indigo-600/50 text-[10px] text-indigo-300 font-mono transition-colors cursor-pointer"
          >
            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
            <span>Auto čćžšđ</span>
          </button>
        </div>

        <textarea
          ref={textareaRef}
          rows={2}
          value={block.text}
          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              addBlock('dialogue', block.id);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-indigo-500/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed"
        />

        {/* Spoken Word Karaoke & Timing Strip — Always visible for dialogue and narration blocks */}
        {spokenWords.length > 0 && (
          <div
            data-testid={`karaoke-words-${block.id}`}
            className={`px-2.5 py-1.5 rounded-md border text-xs flex flex-wrap gap-1 items-center transition-colors ${
              isActivePlayheadBlock || isPlayingThisBlock
                ? 'bg-slate-950/95 border-emerald-800/60 shadow-xs shadow-emerald-950/40'
                : 'bg-slate-950/60 border-slate-800/60'
            }`}
          >
            {spokenWords.map((w, wIdx) => {
              const isCurrent =
                (isActivePlayheadBlock || isPlayingThisBlock) &&
                wIdx === activeWordIndex;
              const isPast =
                (isActivePlayheadBlock || isPlayingThisBlock) &&
                activeWordIndex >= 0 &&
                wIdx < activeWordIndex;

              return (
                <span
                  key={wIdx}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    isCurrent
                      ? 'bg-emerald-500/35 text-emerald-200 font-semibold ring-1 ring-emerald-400/60 shadow-xs shadow-emerald-900/50'
                      : isPast
                        ? 'text-slate-200 font-medium'
                        : 'text-slate-400'
                  }`}
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Strip: DOD Canvas 2D SoA Waveform, Audition/Render, Regenerate/Waveform/Delete Audio Tools, Pause & Timing */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <WaveformCanvas
            peaks={block.waveformPeaks}
            fallbackSeed={`${block.id}_${block.text}`}
            playheadProgress={effectiveProgress}
            accentColor={
              block.type === 'sound_effect'
                ? '#f59e0b'
                : (activeSpeaker?.color ?? '#6366f1')
            }
            isRenderedAudio={hasGeneratedAudioOrPeaks}
            blockId={block.id}
            durationSec={durationSec}
            height={44}
            isPlaying={isPlayingThisBlock || isActivePlayheadBlock}
            showTransportControls={true}
            playTooltip={t('blockWaveformPlayTooltip')}
            restartTooltip={t('blockWaveformRestartTooltip')}
            volumeGainDb={block.volumeGainDb ?? 0}
            onChangeGainDb={(gainDb) => updateBlock(block.id, { volumeGainDb: gainDb })}
            gainKnobLabel={t('gainKnobLabel')}
            fadeInMs={block.fadeInMs ?? 0}
            fadeOutMs={block.fadeOutMs ?? 0}
            fadeInCurve={block.fadeInCurve ?? 0}
            fadeOutCurve={block.fadeOutCurve ?? 0}
            onUpdateFade={(fades) => updateBlock(block.id, fades)}
            onTogglePlay={() => {
              selectBlock(block.id);
              const startOffset =
                effectiveProgress >= 0.98 ? 0 : effectiveProgress * durationSec;
              if (effectiveProgress >= 0.98) {
                setLocalScrubProgress(0);
                onSeekWithinBlock?.(block, 0);
              } else {
                onSeekWithinBlock?.(block, effectiveProgress);
              }
              void auditionBlock(block.id, startOffset);
            }}
            onRestart={() => {
              selectBlock(block.id);
              setLocalScrubProgress(0);
              onSeekWithinBlock?.(block, 0);
            }}
            onSeekProgress={(prog) => {
              setLocalScrubProgress(prog);
              onSeekWithinBlock?.(block, prog);
            }}
            onScrubStateChange={onScrubStateChange}
          />

          {/* Primary Generation / Synthesis Button (shown when unrendered or stale) */}
          {block.ttsStatus !== 'ok' && (
            <button
              type="button"
              data-testid={`generate-block-btn-${block.id}`}
              disabled={block.ttsStatus === 'rendering'}
              onClick={(e) => {
                e.stopPropagation();
                void synthesizeBlock(block.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] shrink-0 disabled:opacity-50 transition-colors cursor-pointer ${
                block.type === 'sound_effect'
                  ? 'bg-amber-950/70 hover:bg-amber-900/80 border border-amber-700/50 text-amber-200'
                  : 'bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-700/50 text-indigo-200'
              }`}
            >
              <Sparkles
                className={`w-3 h-3 ${
                  block.type === 'sound_effect' ? 'text-amber-400' : 'text-indigo-400'
                }`}
              />
              <span>
                ▶{' '}
                {block.type === 'sound_effect'
                  ? block.ttsStatus === 'stale'
                    ? t('reGenerateSfxBtn')
                    : t('generateSfxBtn')
                  : block.ttsStatus === 'stale'
                    ? t('reRenderLine')
                    : t('renderLine')}{' '}
                ({tokens} {t('tokensAbbrev')})
              </span>
            </button>
          )}
        </div>

        {/* Trailing Pause & Timeline Interval Metadata */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <label className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{t('pauseMsLabel')}:</span>
            <input
              type="number"
              min={0}
              max={10000}
              step={50}
              value={block.pauseAfterMs ?? 0}
              onChange={(e) =>
                updateBlock(block.id, {
                  pauseAfterMs: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-right text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </label>

          <span className="text-slate-500">
            {formatDurationReadout(block.startTimeSec ?? 0, true)} –{' '}
            {formatDurationReadout(block.endTimeSec ?? 0, true)}
          </span>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
