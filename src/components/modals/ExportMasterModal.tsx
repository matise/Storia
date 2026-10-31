import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCode,
  FileJson,
  FileText,
  Layers,
  Loader2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  MasterBroadcastDiskIcon,
  StorybookIcon,
} from '../icons/StoriaIcons';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  RenderedMasterEpisode,
  renderMasterEpisodeMix,
  renderSpeakerStems,
} from '../../services/masterExportService';
import {
  exportProjectJson,
  exportToFountain,
  exportToMarkdown,
  importProjectJson,
  triggerBrowserFileDownload,
} from '../../services/scriptExportService';

export const ExportMasterModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useStoriaStore((s) => s.isExportMasterModalOpen);
  const setOpen = useStoriaStore((s) => s.setExportMasterModalOpen);
  const project = useStoriaStore((s) => s.project);
  const updateProjectProperties = useStoriaStore(
    (s) => s.updateProjectProperties
  );
  const importProjectFromBundle = useStoriaStore(
    (s) => s.importProjectFromBundle
  );

  const [activeTab, setActiveTab] = React.useState<'audio' | 'script'>('audio');
  const [isRenderingMaster, setIsRenderingMaster] = React.useState(false);
  const [isRenderingStems, setIsRenderingStems] = React.useState(false);
  const [renderProgress, setRenderProgress] = React.useState(0);
  const [masterResult, setMasterResult] =
    React.useState<RenderedMasterEpisode | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const audioConfig = project.audioConfig;

  const handleRenderMasterWav = async () => {
    setIsRenderingMaster(true);
    setRenderProgress(0);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await renderMasterEpisodeMix(project, (pct) => {
        setRenderProgress(pct);
      });
      setMasterResult(result);
      triggerBrowserFileDownload(result.wavBlob, result.filename, 'audio/wav');
      setSuccessMessage(t('exportMasterSuccessNotice'));
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Master rendering failed.'
      );
    } finally {
      setIsRenderingMaster(false);
    }
  };

  const handleRenderStems = async () => {
    setIsRenderingStems(true);
    setRenderProgress(0);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const stems = await renderSpeakerStems(project, (pct) => {
        setRenderProgress(pct);
      });

      // Download each stem sequentially with a slight delay
      for (let i = 0; i < stems.length; i++) {
        setTimeout(() => {
          triggerBrowserFileDownload(
            stems[i].wavBlob,
            stems[i].filename,
            'audio/wav'
          );
        }, i * 250);
      }

      setSuccessMessage(
        `${t('exportStemsSuccessNotice')} (${stems.length} stems)`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Stem rendering failed.'
      );
    } finally {
      setIsRenderingStems(false);
    }
  };

  const handleExportFountain = () => {
    const text = exportToFountain(project);
    const safeTitle = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    triggerBrowserFileDownload(text, `${safeTitle}.fountain`, 'text/plain');
  };

  const handleExportMarkdown = () => {
    const text = exportToMarkdown(project);
    const safeTitle = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    triggerBrowserFileDownload(text, `${safeTitle}.md`, 'text/markdown');
  };

  const handleExportProjectJson = () => {
    const jsonStr = exportProjectJson(project);
    const safeTitle = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    triggerBrowserFileDownload(
      jsonStr,
      `${safeTitle}.storia.json`,
      'application/json'
    );
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const imported = importProjectJson(text);
        importProjectFromBundle(imported);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Import failed: invalid file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      data-testid="export-master-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/50 border border-indigo-700/50 flex items-center justify-center shrink-0 shadow-xs">
              <MasterBroadcastDiskIcon size={22} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                {t('exportMasterModalTitle')}
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                {project.title} &bull; {project.blocks.length} blocks &bull;{' '}
                {project.speakers.length} speakers
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-export-modal-btn"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-5 pt-2">
          <button
            type="button"
            data-testid="export-tab-audio"
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{t('tabAudioMastering')}</span>
          </button>
          <button
            type="button"
            data-testid="export-tab-script"
            onClick={() => setActiveTab('script')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <StorybookIcon size={16} />
            <span>{t('tabScriptArchive')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'audio' ? (
            <div className="space-y-4">
              {/* Audio Mastering Configuration Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                {/* Sample Rate */}
                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-slate-400">
                    {t('exportSampleRateLabel')}:
                  </span>
                  <select
                    aria-label={t('exportSampleRateLabel')}
                    data-testid="export-sample-rate-select"
                    value={String(audioConfig.sampleRate)}
                    onChange={(e) =>
                      updateProjectProperties({
                        sampleRate: Number(e.target.value) as 44100 | 48000,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="48000">48000 Hz (Broadcast & Video)</option>
                    <option value="44100">44100 Hz (CD & Distribution)</option>
                  </select>
                </label>

                {/* Bit Depth */}
                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-slate-400">
                    {t('exportBitDepthLabel')}:
                  </span>
                  <select
                    aria-label={t('exportBitDepthLabel')}
                    data-testid="export-bit-depth-select"
                    value={String(audioConfig.bitDepth)}
                    onChange={(e) =>
                      updateProjectProperties({
                        bitDepth: Number(e.target.value) as 16 | 24 | 32,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="24">24-bit PCM (Studio Standard)</option>
                    <option value="16">16-bit PCM (CD Standard)</option>
                    <option value="32">32-bit Float (Master Archive)</option>
                  </select>
                </label>

                {/* Dithering Mode */}
                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-slate-400">
                    {t('exportDitherLabel')}:
                  </span>
                  <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="ditherMode"
                        checked={audioConfig.dither === 'tpdf'}
                        onChange={() =>
                          updateProjectProperties({
                            sampleRate: audioConfig.sampleRate,
                          })
                        }
                        className="accent-indigo-500"
                      />
                      <span>{t('exportDitherTpdf')}</span>
                    </label>
                  </div>
                </label>

                {/* Integrated LUFS Target */}
                <label className="space-y-1 block">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>{t('exportTargetLufsLabel')}:</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {audioConfig.targetLufs.toFixed(1)} LUFS
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="-12"
                    step="0.5"
                    value={audioConfig.targetLufs}
                    onChange={(e) =>
                      updateProjectProperties({
                        targetLufs: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>-24 (AES)</span>
                    <span>-16 (Podcasts)</span>
                    <span>-14 (Streaming)</span>
                  </div>
                </label>
              </div>

              {/* Progress bar when rendering */}
              {(isRenderingMaster || isRenderingStems) && (
                <div className="p-3.5 rounded-lg bg-indigo-950/50 border border-indigo-700/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-indigo-200">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>{t('exportRenderingNotice')}</span>
                    </span>
                    <span>{renderProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-200"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Master Output Measurement Stats Card (Post-render) */}
              {masterResult && (
                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-emerald-800/60 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span>Broadcast Master Analysis:</span>
                    <span>{masterResult.filename}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Integrated:</span>
                      <span className="font-semibold text-emerald-400">
                        {masterResult.integratedLufs.toFixed(1)} LUFS
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">True Peak:</span>
                      <span className="font-semibold text-slate-200">
                        {masterResult.truePeakDbfs.toFixed(2)} dBFS
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Makeup Gain:</span>
                      <span className="font-semibold text-slate-200">
                        {masterResult.appliedMakeupGainDb >= 0 ? '+' : ''}
                        {masterResult.appliedMakeupGainDb.toFixed(2)} dB
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Length:</span>
                      <span className="font-semibold text-slate-200">
                        {masterResult.totalDurationSec.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Master Audio Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  data-testid="export-master-wav-btn"
                  disabled={isRenderingMaster || isRenderingStems}
                  onClick={handleRenderMasterWav}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('exportDownloadMasterBtn')}</span>
                </button>

                <button
                  type="button"
                  data-testid="export-stems-wav-btn"
                  disabled={isRenderingMaster || isRenderingStems}
                  onClick={handleRenderStems}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>{t('exportDownloadStemsBtn')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Script & Project Bundle Archive Tab */
            <div className="space-y-3.5">
              <p className="text-xs text-slate-400">
                Export human-readable production scripts or lossless Storia
                project bundles for backup and cross-machine restoration.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Fountain Screenplay */}
                <button
                  type="button"
                  data-testid="export-fountain-btn"
                  onClick={handleExportFountain}
                  className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/60 flex flex-col items-center gap-2 text-center transition-all cursor-pointer group"
                >
                  <FileText className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-slate-200">
                    Fountain (.fountain)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Standard screenplay format for Final Draft / Highland
                  </span>
                </button>

                {/* Markdown Production Manuscript */}
                <button
                  type="button"
                  data-testid="export-markdown-btn"
                  onClick={handleExportMarkdown}
                  className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/60 flex flex-col items-center gap-2 text-center transition-all cursor-pointer group"
                >
                  <FileCode className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-slate-200">
                    Markdown (.md)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Cast table, timestamps, token counts & notebook appendix
                  </span>
                </button>

                {/* Portable Project Bundle */}
                <button
                  type="button"
                  data-testid="export-project-json-btn"
                  onClick={handleExportProjectJson}
                  className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/60 flex flex-col items-center gap-2 text-center transition-all cursor-pointer group"
                >
                  <FileJson className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-slate-200">
                    Project (.storia.json)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Lossless bundle of speakers, blocks, EQ & research data
                  </span>
                </button>
              </div>

              {/* Import Project Bundle Dropzone */}
              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.storia.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  data-testid="import-project-json-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 rounded-lg border-2 border-dashed border-slate-800 hover:border-indigo-500/70 bg-slate-950/40 hover:bg-slate-950 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>{t('exportImportProjectJsonBtn')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">
            Storia Studio Audio Engine v1.0 &bull; ITU-R BS.1770-4
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
