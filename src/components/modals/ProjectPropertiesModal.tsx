import React from 'react';
import {
  Copy,
  FolderKanban,
  Globe,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';

export const ProjectPropertiesModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useStoriaStore((s) => s.isEpisodePropertiesModalOpen);
  const setOpen = useStoriaStore((s) => s.setEpisodePropertiesModalOpen);
  const project = useStoriaStore((s) => s.project);
  const projects = useStoriaStore((s) => s.projects);
  const switchProject = useStoriaStore((s) => s.switchProject);
  const createProject = useStoriaStore((s) => s.createProject);
  const duplicateProject = useStoriaStore((s) => s.duplicateProject);
  const deleteProject = useStoriaStore((s) => s.deleteProject);
  const updateProjectProperties = useStoriaStore((s) => s.updateProjectProperties);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">
              {t('episodePropertiesModalTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
          {/* Left Column: Studio Episodes Library (5 cols) */}
          <div className="md:col-span-5 space-y-3 border-b md:border-b-0 md:border-r border-slate-800/80 pb-4 md:pb-0 md:pr-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('episodesLibraryTitle')} ({projects.length})
              </span>
              <button
                type="button"
                data-testid="modal-create-episode-btn"
                onClick={() => createProject()}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{t('newEpisodeBtn')}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {projects.map((ep) => {
                const isActive = ep.id === project.id;
                return (
                  <div
                    key={ep.id}
                    data-testid={`episode-library-card-${ep.id}`}
                    onClick={() => switchProject(ep.id)}
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                      isActive
                        ? 'bg-indigo-950/60 border-indigo-500/80'
                        : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100 truncate">
                        {ep.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] uppercase text-indigo-300 shrink-0">
                        {ep.defaultLanguage}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {ep.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                      <span>
                        {ep.blocks.length} {t('linesCount')} • {ep.speakers.length} cast
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`duplicate-episode-btn-${ep.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateProject(ep.id);
                          }}
                          title={t('duplicateEpisodeBtn')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            data-testid={`delete-episode-btn-${ep.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(ep.id);
                            }}
                            title={t('deleteEpisodeBtn')}
                            className="p-1 rounded hover:bg-rose-950/70 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Episode Properties Editor (7 cols) */}
          <div className="md:col-span-7 space-y-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
              <Settings2 className="w-3.5 h-3.5" />
              <span>{t('episodePropertiesBtn')}</span>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {t('episodeTitleLabel')}
              </label>
              <input
                type="text"
                data-testid="modal-episode-title-input"
                value={project.title}
                onChange={(e) =>
                  updateProjectProperties({ title: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description / Synopsis */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {t('episodeDescriptionLabel')}
              </label>
              <textarea
                rows={2}
                data-testid="modal-episode-desc-input"
                value={project.description}
                onChange={(e) =>
                  updateProjectProperties({ description: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Language & Genre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <Globe className="w-3 h-3 text-indigo-400" />
                  <span>{t('episodeLanguageLabel')}</span>
                </label>
                <select
                  data-testid="modal-episode-lang-select"
                  value={project.defaultLanguage}
                  onChange={(e) =>
                    updateProjectProperties({
                      defaultLanguage: e.target.value as SupportedLanguage,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="hr">Hrvatski (HR)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  {t('episodeGenreLabel')}
                </label>
                <input
                  type="text"
                  data-testid="modal-episode-genre-input"
                  value={project.metadata?.genre ?? ''}
                  onChange={(e) =>
                    updateProjectProperties({ genre: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Author & Target WPM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  {t('episodeAuthorLabel')}
                </label>
                <input
                  type="text"
                  data-testid="modal-episode-author-input"
                  value={project.metadata?.author ?? ''}
                  onChange={(e) =>
                    updateProjectProperties({ author: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  {t('episodeTargetWpmLabel')}
                </label>
                <input
                  type="number"
                  data-testid="modal-episode-wpm-input"
                  min={60}
                  max={260}
                  step={5}
                  value={project.metadata?.targetWpm ?? 140}
                  onChange={(e) =>
                    updateProjectProperties({
                      targetWpm: Number(e.target.value) || 140,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Audio Mastering Config: Sample Rate, Bit Depth, Target LUFS */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                  {t('episodeSampleRateLabel')}
                </label>
                <select
                  value={project.audioConfig.sampleRate}
                  onChange={(e) =>
                    updateProjectProperties({
                      sampleRate: Number(e.target.value) as 44100 | 48000,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-100 font-mono"
                >
                  <option value={48000}>48000 Hz</option>
                  <option value={44100}>44100 Hz</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                  {t('episodeBitDepthLabel')}
                </label>
                <select
                  value={project.audioConfig.bitDepth}
                  onChange={(e) =>
                    updateProjectProperties({
                      bitDepth: Number(e.target.value) as 16 | 24 | 32,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-100 font-mono"
                >
                  <option value={24}>24-bit PCM</option>
                  <option value={16}>16-bit PCM</option>
                  <option value={32}>32-bit Float</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                  {t('episodeTargetLufsLabel')}
                </label>
                <input
                  type="number"
                  min={-24}
                  max={-12}
                  step={0.5}
                  value={project.audioConfig.targetLufs}
                  onChange={(e) =>
                    updateProjectProperties({
                      targetLufs: Number(e.target.value) || -16,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-emerald-300 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            data-testid="close-episode-properties-btn"
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

