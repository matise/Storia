import React from 'react';
import {
  Copy,
  FolderKanban,
  Globe,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getApiKey } from '../../core/storage/keyVault';
import { generateEpisodeBlueprintWithAi } from '../../services/geminiAgentService';

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

  const [aiEpisodePrompt, setAiEpisodePrompt] = React.useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = React.useState<boolean>(false);
  const [aiEpisodeRationale, setAiEpisodeRationale] = React.useState<string | null>(
    null
  );

  if (!isOpen) return null;

  const handleGenerateFullAiEpisode = async (overridePrompt?: string) => {
    if (isAiGenerating) return;
    const effectivePrompt = (overridePrompt ?? aiEpisodePrompt).trim();
    if (overridePrompt !== undefined) {
      setAiEpisodePrompt(overridePrompt);
    }

    setIsAiGenerating(true);
    try {
      const blueprint = await generateEpisodeBlueprintWithAi({
        prompt: effectivePrompt,
        language: project.defaultLanguage,
        dialect: project.dialect,
        dubrovnikRegister: project.dubrovnikRegister,
        episodeNumber: projects.length + 1,
        apiKey: getApiKey(),
        textModel: project.aiSettings.textModel,
      });

      createProject({
        title: blueprint.title,
        description: blueprint.description,
        defaultLanguage: blueprint.defaultLanguage,
        dialect: blueprint.dialect,
        dubrovnikRegister: blueprint.dubrovnikRegister,
        genre: blueprint.genre,
        author: blueprint.author,
        targetWpm: blueprint.targetWpm,
        targetLufs: blueprint.targetLufs,
        speakers: blueprint.speakers,
        blocks: blueprint.blocks,
      });
      setAiEpisodeRationale(blueprint.rationale);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAiFillActiveProperties = async () => {
    if (isAiGenerating) return;
    const fallbackContext =
      aiEpisodePrompt.trim() ||
      project.blocks
        .slice(0, 4)
        .map((b) => b.text)
        .join(' ');

    setIsAiGenerating(true);
    try {
      const blueprint = await generateEpisodeBlueprintWithAi({
        prompt: fallbackContext,
        language: project.defaultLanguage,
        dialect: project.dialect,
        dubrovnikRegister: project.dubrovnikRegister,
        episodeNumber: Math.max(
          1,
          projects.findIndex((p) => p.id === project.id) + 1
        ),
        apiKey: getApiKey(),
        textModel: project.aiSettings.textModel,
      });

      updateProjectProperties({
        title: blueprint.title,
        description: blueprint.description,
        genre: blueprint.genre,
        author: blueprint.author,
        targetWpm: blueprint.targetWpm,
        targetLufs: blueprint.targetLufs,
      });
      setAiEpisodeRationale(blueprint.rationale);
    } finally {
      setIsAiGenerating(false);
    }
  };

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
            {/* Gemini AI Episode Architect Card */}
            <div
              data-testid="ai-episode-architect-panel"
              className="p-3 rounded-lg bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/40 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{t('aiEpisodeArchitectTitle')}</span>
                </div>
              </div>

              <input
                type="text"
                data-testid="ai-episode-prompt-input"
                value={aiEpisodePrompt}
                onChange={(e) => setAiEpisodePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleGenerateFullAiEpisode();
                  }
                }}
                placeholder={t('aiEpisodePromptPlaceholder')}
                className="w-full bg-slate-900/95 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />

              {/* Quick Episode Concept Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="ai-episode-template-podcast-btn"
                  onClick={() =>
                    setAiEpisodePrompt(
                      project.defaultLanguage === 'hr'
                        ? 'Analitički podcast o protudronskoj obrani i skrivenoj arhitekturi sustava'
                        : 'Investigative podcast debating autonomous drone defense and analog-digital architectures'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  🎙️ {t('aiTemplatePodcast')}
                </button>
                <button
                  type="button"
                  data-testid="ai-episode-template-dubrovnik-btn"
                  onClick={() =>
                    setAiEpisodePrompt(
                      project.defaultLanguage === 'hr'
                        ? 'Noćna tajna u kamenim svodovima starog Dubrovnika za vrijeme bure'
                        : 'Midnight mystery in the stone quarantine vaults of old Dubrovnik during a coastal storm'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  🏰 {t('aiTemplateDubrovnikDrama')}
                </button>
                <button
                  type="button"
                  data-testid="ai-episode-template-scifi-btn"
                  onClick={() =>
                    setAiEpisodePrompt(
                      project.defaultLanguage === 'hr'
                        ? 'Sci-Fi triler o dekodiranju nepoznatog signala na izoliranoj postaji'
                        : 'Sci-Fi thriller decoding an anomalous deep-spectrum carrier signal at an isolated station'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  🛰️ {t('aiTemplateSciFiThriller')}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  data-testid="ai-create-full-episode-btn"
                  disabled={isAiGenerating}
                  onClick={() => void handleGenerateFullAiEpisode()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-semibold transition-all cursor-pointer shadow-xs"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('aiEpisodeGeneratingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('aiCreateFullEpisodeBtn')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="ai-fill-episode-props-btn"
                  disabled={isAiGenerating}
                  onClick={() => void handleAiFillActiveProperties()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-indigo-500/50 text-indigo-200 font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>{t('aiFillActiveEpisodeBtn')}</span>
                </button>
              </div>

              {aiEpisodeRationale && (
                <div
                  data-testid="ai-episode-rationale-banner"
                  className="px-2.5 py-1.5 rounded bg-emerald-950/50 border border-emerald-700/50 text-[11px] text-emerald-200 leading-relaxed"
                >
                  {aiEpisodeRationale}
                </div>
              )}
            </div>

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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="hr">Hrvatski (Standardni HR)</option>
                  <option value="hr-dubrovnik">Hrvatski — Dubrovački govor (Ragusa)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>

              {project.defaultLanguage === 'hr' && project.dialect === 'dubrovnik' && (
                <div className="space-y-1">
                  <label className="text-amber-400 font-semibold block">
                    {t('dubrovnikRegisterLabel')}
                  </label>
                  <select
                    data-testid="modal-dubrovnik-register-select"
                    value={project.dubrovnikRegister ?? 'contemporary'}
                    onChange={(e) =>
                      updateProjectProperties({
                        dubrovnikRegister: e.target.value as 'classical' | 'traditional' | 'contemporary',
                      })
                    }
                    className="w-full bg-slate-950 border border-amber-800/80 rounded-md px-2.5 py-1.5 text-amber-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="contemporary">Suvremeni razgovorni</option>
                    <option value="traditional">Tradicionalni pučki govor Grada (19./20. st.)</option>
                    <option value="classical">Klasični barokni (Držić / Gundulić)</option>
                  </select>
                </div>
              )}

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

