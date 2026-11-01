import React from 'react';
import {
  AlertCircle,
  Cpu,
  KeyRound,
  Loader2,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Sparkles,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import {
  StoriaAppBrandIcon,
  MasterBroadcastDiskIcon,
  FlagCroatia,
  FlagUk,
} from '../icons/StoriaIcons';
import {
  GEMINI_TEXT_MODELS,
  GeminiTextModelId,
} from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { recalculateProjectTimeline } from '../../core/pacing/pacingCalculator';

export const TopBar: React.FC = () => {
  const { t, uiLanguage, toggleLanguage } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const projects = useStoriaStore((s) => s.projects);
  const switchProject = useStoriaStore((s) => s.switchProject);
  const createProject = useStoriaStore((s) => s.createProject);
  const setEpisodePropertiesModalOpen = useStoriaStore(
    (s) => s.setEpisodePropertiesModalOpen
  );
  const setExportMasterModalOpen = useStoriaStore(
    (s) => s.setExportMasterModalOpen
  );
  const undoCount = useStoriaStore((s) => s.undoCount);
  const redoCount = useStoriaStore((s) => s.redoCount);
  const undo = useStoriaStore((s) => s.undo);
  const redo = useStoriaStore((s) => s.redo);
  const resetToSampleProject = useStoriaStore((s) => s.resetToSampleProject);
  const loadGeodesicFlameDemo = useStoriaStore((s) => s.loadGeodesicFlameDemo);
  const setApiKeyModalOpen = useStoriaStore((s) => s.setApiKeyModalOpen);
  const hasConfiguredApiKey = useStoriaStore((s) => s.hasConfiguredApiKey);
  const ttsProvider = useStoriaStore((s) => s.ttsProvider);
  const setActiveTtsProvider = useStoriaStore((s) => s.setActiveTtsProvider);
  const setGeminiTextModel = useStoriaStore((s) => s.setGeminiTextModel);
  const isBatchSynthesizing = useStoriaStore((s) => s.isBatchSynthesizing);
  const synthesizeAllBlocks = useStoriaStore((s) => s.synthesizeAllBlocks);
  const ttsErrorMessage = useStoriaStore((s) => s.ttsErrorMessage);
  const clearTtsError = useStoriaStore((s) => s.clearTtsError);

  const summary = React.useMemo(
    () =>
      recalculateProjectTimeline(
        project.blocks,
        project.speakers,
        project.metadata?.targetWpm ?? 140
      ),
    [project.blocks, project.speakers, project.metadata?.targetWpm]
  );

  const formattedTokens =
    summary.totalAudioTokens >= 1000
      ? `${(summary.totalAudioTokens / 1000).toFixed(1)}k`
      : String(summary.totalAudioTokens);

  const apiKeyBadgeText = hasConfiguredApiKey
    ? t('apiKeyOk')
    : ttsProvider === 'browser_tts'
      ? t('apiKeySynth')
      : t('apiKeyMissing');

  return (
    <div className="shrink-0 select-none">
      <header className="h-14 border-b border-slate-800/90 bg-slate-950/95 px-3 sm:px-4 flex items-center justify-between gap-2.5 overflow-x-auto overflow-y-hidden select-none min-w-0">
        {/* Brand & Active Episode Selector */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-lg shadow-indigo-950/60 ring-1 ring-white/10 bg-slate-900/90 hover:scale-105 transition-transform cursor-pointer">
              <StoriaAppBrandIcon size={40} />
            </div>
            <span className="font-bold tracking-tight text-slate-100 text-lg hidden sm:inline">
              {t('appTitle')}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-800 shrink-0" />

          {/* Multi-Episode Switcher & Episode Properties Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium shrink-0 max-w-full shadow-xs">
            <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/50 text-[10px] font-mono text-indigo-300 uppercase shrink-0 font-bold">
              {project.defaultLanguage}
            </span>
            <select
              aria-label={t('episodeLabel')}
              data-testid="episode-switcher-select"
              title={project.title}
              value={project.id}
              onChange={(e) => switchProject(e.target.value)}
              className="bg-transparent text-xs text-slate-100 font-medium focus:outline-none min-w-[140px] max-w-[220px] sm:max-w-[320px] md:max-w-[420px] lg:max-w-[520px] truncate cursor-pointer py-0.5"
            >
              {projects.map((ep) => (
                <option
                  key={ep.id}
                  value={ep.id}
                  className="bg-slate-900 text-slate-100"
                >
                  {ep.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="create-episode-btn"
              onClick={() => createProject()}
              title={t('newEpisodeBtn')}
              className="p-1 rounded hover:bg-slate-800 text-indigo-400 hover:text-indigo-200 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              data-testid="open-episode-properties-btn"
              onClick={() => setEpisodePropertiesModalOpen(true)}
              title={t('episodePropertiesBtn')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bilingual EN / HR Switcher with Flags */}
          <button
            type="button"
            onClick={toggleLanguage}
            title="Switch English / Croatian (EN/HR)"
            data-testid="language-toggle-btn"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-indigo-200 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-xs hover:border-indigo-500/50 active:scale-95"
          >
            {uiLanguage === 'en' ? (
              <div className="flex items-center gap-1.5">
                <FlagUk className="w-4.5 h-3 rounded-[2px] shadow-xs" />
                <span className="font-bold text-slate-100 text-xs">EN</span>
                <span className="text-slate-600 text-[10px]">/</span>
                <FlagCroatia className="w-4 h-2.5 rounded-[2px] opacity-40 hover:opacity-100 transition-opacity" />
                <span className="text-slate-500 text-[10px]">hr</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <FlagCroatia className="w-4.5 h-3 rounded-[2px] shadow-xs" />
                <span className="font-bold text-slate-100 text-xs">HR</span>
                <span className="text-slate-600 text-[10px]">/</span>
                <FlagUk className="w-4 h-2.5 rounded-[2px] opacity-40 hover:opacity-100 transition-opacity" />
                <span className="text-slate-500 text-[10px]">en</span>
              </div>
            )}
          </button>

          {/* Quick Demo: Trijada Geodetskog Plamena Button */}
          <button
            type="button"
            data-testid="load-geodesic-flame-demo-btn"
            onClick={loadGeodesicFlameDemo}
            title={t('loadGeodesicFlameDemoTooltip')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              project.id === 'proj_geodesic_flame_demo'
                ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 shadow-sm shadow-amber-950/40'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-amber-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden xl:inline">{t('geodesicFlameBadge')}</span>
          </button>
        </div>

        {/* Center Command History Stack Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={undo}
            disabled={undoCount === 0}
            title={`${t('undo')} (Ctrl+Z)`}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden xl:inline">{t('undo')}</span>
            <span className="text-[10px] text-slate-500 font-mono hidden 2xl:inline">(Ctrl+Z)</span>
            {undoCount > 0 && (
              <span className="px-1 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                {undoCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={redoCount === 0}
            title={`${t('redo')} (Ctrl+Y)`}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden xl:inline">{t('redo')}</span>
            <span className="text-[10px] text-slate-500 font-mono hidden 2xl:inline">(Ctrl+Y)</span>
            {redoCount > 0 && (
              <span className="px-1 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                {redoCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={resetToSampleProject}
            title={t('resetSample')}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Studio Actions: Gemini Model Picker, TTS Engine Switcher, BYOK Status, Batch TTS, Master Export */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Gemini Model Picker */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md px-2 py-1 shrink-0">
            <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              aria-label={t('geminiModelPickerLabel')}
              data-testid="topbar-gemini-model-picker"
              value={project.aiSettings.textModel}
              onChange={(e) =>
                setGeminiTextModel(e.target.value as GeminiTextModelId)
              }
              className="bg-transparent text-[11px] font-mono text-indigo-200 focus:outline-none cursor-pointer max-w-40 sm:max-w-48 truncate"
            >
              {GEMINI_TEXT_MODELS.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-slate-900 text-slate-100"
                >
                  {m.id}
                </option>
              ))}
            </select>
          </div>

          {/* Quick TTS Engine Switcher: Gemini 2.5 TTS vs Local Browser TTS */}
          <div className="flex items-center rounded-md bg-slate-900 border border-slate-800 p-0.5 text-[11px] font-medium shrink-0">
            <button
              type="button"
              onClick={() => setActiveTtsProvider('gemini_tts')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                ttsProvider === 'gemini_tts'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{t('engineGeminiTts')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTtsProvider('browser_tts')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                ttsProvider === 'browser_tts'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Volume2 className="w-3 h-3 shrink-0" />
              <span>{t('engineBrowserTts')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setApiKeyModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              hasConfiguredApiKey
                ? 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-800/60 text-emerald-300'
                : ttsProvider === 'browser_tts'
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-700/70 text-amber-300'
            }`}
          >
            {ttsProvider === 'browser_tts' && !hasConfiguredApiKey ? (
              <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>{apiKeyBadgeText}</span>
          </button>

          <button
            type="button"
            disabled={isBatchSynthesizing}
            onClick={() => void synthesizeAllBlocks()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-60 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isBatchSynthesizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{t('generatingAudio')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t('genAllAudio')} ({formattedTokens} {t('tokensAbbrev')})
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="topbar-export-master-btn"
            onClick={() => setExportMasterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <MasterBroadcastDiskIcon size={16} />
            <span>{t('exportMaster')}</span>
          </button>
        </div>
      </header>

      {/* Dismissible TTS Error Notification Banner */}
      {ttsErrorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 py-1.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{ttsErrorMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTtsProvider('browser_tts')}
              className="px-2 py-0.5 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 font-medium cursor-pointer"
            >
              Switch to {t('engineBrowserTts')}
            </button>
            <button
              type="button"
              onClick={clearTtsError}
              className="p-0.5 rounded hover:bg-rose-900 text-rose-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
