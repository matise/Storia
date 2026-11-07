import React from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Copy,
  Download,
  FolderKanban,
  Globe,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getApiKey } from '../../core/storage/keyVault';
import { generateEpisodeBlueprintWithAi } from '../../services/geminiAgentService';
import {
  exportEpisodesBundleJson,
  exportProjectJson,
  importEpisodesBundleJson,
  triggerBrowserFileDownload,
} from '../../services/scriptExportService';
import { Project } from '../../types/storia';

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
  const deleteProjectsBulk = useStoriaStore((s) => s.deleteProjectsBulk);
  const clearEntireLibrary = useStoriaStore((s) => s.clearEntireLibrary);
  const importProjectsBundle = useStoriaStore((s) => s.importProjectsBundle);
  const resetToSampleProject = useStoriaStore((s) => s.resetToSampleProject);
  const updateProjectProperties = useStoriaStore((s) => s.updateProjectProperties);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [languageFilter, setLanguageFilter] = React.useState<'all' | 'hr' | 'en'>('all');
  const [selectedEpisodeIds, setSelectedEpisodeIds] = React.useState<Set<string>>(
    () => new Set()
  );

  // Dialog & Notification state
  const [showConfirmReset, setShowConfirmReset] = React.useState<boolean>(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = React.useState<boolean>(false);
  const [showConfirmClearEntire, setShowConfirmClearEntire] = React.useState<boolean>(false);
  const [importNotification, setImportNotification] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // AI Architect state
  const [aiEpisodePrompt, setAiEpisodePrompt] = React.useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = React.useState<boolean>(false);
  const [aiEpisodeRationale, setAiEpisodeRationale] = React.useState<string | null>(null);

  // Hidden file input ref for JSON import
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filtered episodes list
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      if (languageFilter !== 'all' && p.defaultLanguage !== languageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesAuthor = (p.metadata?.author || '').toLowerCase().includes(q);
        const matchesGenre = (p.metadata?.genre || '').toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesAuthor || matchesGenre;
      }
      return true;
    });
  }, [projects, languageFilter, searchQuery]);

  if (!isOpen) return null;

  // Toggle selection for single episode
  const handleToggleSelectEpisode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle Select All / Deselect All
  const areAllFilteredSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((p) => selectedEpisodeIds.has(p.id));

  const handleSelectAllToggle = () => {
    if (areAllFilteredSelected) {
      setSelectedEpisodeIds(new Set());
    } else {
      setSelectedEpisodeIds(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  // Export Selected or All Episodes as JSON Bundle
  const handleExportBundle = (onlySelected: boolean) => {
    const targets = onlySelected
      ? projects.filter((p) => selectedEpisodeIds.has(p.id))
      : projects;

    if (targets.length === 0) return;

    if (targets.length === 1) {
      const ep = targets[0];
      const jsonStr = exportProjectJson(ep);
      const safeTitle = ep.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
      triggerBrowserFileDownload(jsonStr, `${safeTitle}.storia.json`, 'application/json');
    } else {
      const jsonStr = exportEpisodesBundleJson(targets);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = onlySelected
        ? `storia-episodes-selected-${targets.length}-${dateStr}.json`
        : `storia-episodes-library-bundle-${dateStr}.json`;
      triggerBrowserFileDownload(jsonStr, filename, 'application/json');
    }
  };

  // Export a single episode directly
  const handleExportSingle = (ep: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = exportProjectJson(ep);
    const safeTitle = ep.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
    triggerBrowserFileDownload(jsonStr, `${safeTitle}.storia.json`, 'application/json');
  };

  // Trigger file dialog
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Handle picked JSON file
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Could not read file text.');
        }
        const importedEpisodes = importEpisodesBundleJson(text);
        if (importedEpisodes.length === 0) {
          throw new Error('No valid episodes found in the selected file.');
        }
        const count = importProjectsBundle(importedEpisodes, true);
        setImportNotification({
          type: 'success',
          message:
            project.defaultLanguage === 'hr'
              ? `Uspješno uvezeno ${count} epizoda!`
              : `Successfully imported ${count} episode(s)!`,
        });
      } catch (err) {
        setImportNotification({
          type: 'error',
          message: err instanceof Error ? err.message : 'Import failed.',
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Confirm delete selected
  const handleConfirmDeleteSelected = () => {
    deleteProjectsBulk(Array.from(selectedEpisodeIds));
    setSelectedEpisodeIds(new Set());
    setShowConfirmDeleteSelected(false);
  };

  // Confirm reset library
  const handleConfirmResetLibrary = () => {
    resetToSampleProject();
    setSelectedEpisodeIds(new Set());
    setShowConfirmReset(false);
  };

  // AI Generation Handlers
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-5xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Hidden File Input for JSON Bundle Import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFilePicked}
          className="hidden"
          data-testid="library-import-file-input"
        />

        {/* Modal Top Header */}
        <div className="px-5 py-3 border-b border-slate-800/90 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>{t('episodePropertiesModalTitle')}</span>
                <span className="px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                  {projects.length}
                </span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-episode-properties-btn"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs min-h-0">
          {/* ======================================================== */}
          {/* Left Column: Upgraded Episode Library Manager (6 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-6 flex flex-col gap-3 pb-4 lg:pb-0 lg:border-r lg:border-slate-800/90 lg:pr-5 min-h-0">
            {/* Library Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/80 p-2 rounded-lg border border-slate-800 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* 1. New Episode */}
                <button
                  type="button"
                  data-testid="modal-create-episode-btn"
                  onClick={() => createProject()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('newEpisodeBtn')}</span>
                </button>

                {/* 2. Import JSON */}
                <button
                  type="button"
                  data-testid="library-toolbar-import-btn"
                  onClick={handleTriggerImport}
                  title="Import single episode or multi-episode bundle JSON"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('importEpisodesBtn')}</span>
                </button>

                {/* 3. Export (Selective or All) */}
                {selectedEpisodeIds.size > 0 ? (
                  <button
                    type="button"
                    data-testid="library-toolbar-export-selected-btn"
                    onClick={() => handleExportBundle(true)}
                    title={`Export ${selectedEpisodeIds.size} selected episode(s) as JSON bundle`}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {t('exportSelectedEpisodesBtn')} ({selectedEpisodeIds.size})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="library-toolbar-export-all-btn"
                    onClick={() => handleExportBundle(false)}
                    title="Export entire episode library as JSON bundle"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('exportAllEpisodesBtn')}</span>
                  </button>
                )}
              </div>

              {/* Right Side Tools: Delete Selected / Reset Library */}
              <div className="flex items-center gap-1">
                {selectedEpisodeIds.size > 0 && selectedEpisodeIds.size < projects.length && (
                  <button
                    type="button"
                    data-testid="library-toolbar-delete-selected-btn"
                    onClick={() => setShowConfirmDeleteSelected(true)}
                    title={`Delete ${selectedEpisodeIds.size} selected episode(s)`}
                    className="p-1.5 rounded-md hover:bg-rose-950/70 border border-transparent hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                )}

                <button
                  type="button"
                  data-testid="library-toolbar-clear-btn"
                  onClick={() => setShowConfirmReset(true)}
                  title={t('clearLibraryBtn')}
                  className="p-1.5 rounded-md hover:bg-slate-800 border border-transparent hover:border-slate-700 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {projects.length > 0 && (
                  <button
                    type="button"
                    data-testid="library-toolbar-clear-entire-btn"
                    onClick={() => setShowConfirmClearEntire(true)}
                    title={t('clearEntireLibraryBtn')}
                    className="p-1.5 rounded-md hover:bg-rose-950/70 border border-transparent hover:border-rose-700/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification Alert Banner */}
            {importNotification && (
              <div
                className={`px-3 py-2 rounded-lg border flex items-center justify-between text-xs transition-all ${
                  importNotification.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-700 text-rose-200'
                }`}
              >
                <span>{importNotification.message}</span>
                <button
                  type="button"
                  onClick={() => setImportNotification(null)}
                  className="p-0.5 rounded hover:bg-black/30 cursor-pointer ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Confirmation Banner: Reset Library to Samples */}
            {showConfirmReset && (
              <div className="p-3 rounded-lg bg-amber-950/70 border border-amber-600/70 text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('confirmResetLibrary')}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="confirm-reset-library-btn"
                    onClick={handleConfirmResetLibrary}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    OK, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmReset(false)}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Banner: Clear Entire Library (Delete All) */}
            {showConfirmClearEntire && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t('confirmClearEntireLibrary')}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="confirm-clear-entire-library-btn"
                    onClick={() => {
                      clearEntireLibrary();
                      setSelectedEpisodeIds(new Set());
                      setShowConfirmClearEntire(false);
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer shadow-xs"
                  >
                    {t('clearEntireLibraryBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmClearEntire(false)}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Banner: Delete Selected */}
            {showConfirmDeleteSelected && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700 text-rose-200 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    {t('confirmDeleteSelected')} ({selectedEpisodeIds.size})
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmDeleteSelected}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDeleteSelected(false)}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Search Input & Language Filters */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-testid="library-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchEpisodesPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Language Filters */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5 shrink-0 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLanguageFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    languageFilter === 'all'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageFilter('hr')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    languageFilter === 'hr'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  HR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageFilter('en')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    languageFilter === 'en'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Select All Row */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 shrink-0">
              <label
                data-testid="library-select-all-checkbox"
                onClick={handleSelectAllToggle}
                className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 select-none"
              >
                {areAllFilteredSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>{t('selectAll')}</span>
              </label>

              <div className="flex items-center gap-2">
                <span>
                  {selectedEpisodeIds.size} {t('selectedCount')}
                </span>
                {selectedEpisodeIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedEpisodeIds(new Set())}
                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            {/* Episode Cards Scroll List */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-60 max-h-[50vh]">
              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No episodes match your search or filter.
                </div>
              ) : (
                filteredProjects.map((ep) => {
                  const isActive = ep.id === project.id;
                  const isSelected = selectedEpisodeIds.has(ep.id);
                  return (
                    <div
                      key={ep.id}
                      data-testid={`episode-library-card-${ep.id}`}
                      onClick={() => switchProject(ep.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer space-y-2 relative group ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-950/60 to-slate-900 border-indigo-500/80 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-400/30'
                          : isSelected
                            ? 'bg-slate-900/90 border-slate-700'
                            : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800/90'
                      }`}
                    >
                      {/* Top Card Row: Selection Checkbox + Title + Language Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            data-testid={`episode-select-checkbox-${ep.id}`}
                            onClick={(e) => handleToggleSelectEpisode(ep.id, e)}
                            className="mt-0.5 text-slate-500 hover:text-indigo-400 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100 text-xs truncate">
                                {ep.title}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 border border-indigo-500/50 text-[10px] font-mono text-indigo-300 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>{t('activeEpisodeBadge')}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Language & Dialect Badge */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] uppercase text-indigo-300 font-bold">
                            {ep.defaultLanguage}
                          </span>
                          {ep.dialect === 'dubrovnik' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 font-mono text-[10px] text-amber-300 font-medium">
                              Ragusa
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description Snippet */}
                      {ep.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 pl-6">
                          {ep.description}
                        </p>
                      )}

                      {/* Card Bottom Row: Metrics & Quick Actions */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60 pl-6">
                        <div className="flex items-center gap-2">
                          <span>
                            {ep.blocks.length} {t('linesCount')}
                          </span>
                          <span>•</span>
                          <span>{ep.speakers.length} cast</span>
                          {ep.metadata?.genre && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 truncate max-w-24">
                                {ep.metadata.genre}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Quick Card Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Export single episode */}
                          <button
                            type="button"
                            data-testid={`export-single-episode-btn-${ep.id}`}
                            onClick={(e) => handleExportSingle(ep, e)}
                            title="Export this episode as JSON"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-300 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          {/* Duplicate */}
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

                          {/* Delete */}
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
                })
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* Right Column: Active Episode Properties & AI Architect  */}
          {/* ======================================================== */}
          <div className="lg:col-span-6 space-y-4">
            {/* Gemini AI Episode Architect Card */}
            <div
              data-testid="ai-episode-architect-panel"
              className="p-3.5 rounded-lg bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/40 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-xs">
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
                className="w-full bg-slate-900/95 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-semibold transition-all cursor-pointer shadow-xs text-xs"
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-indigo-500/50 text-indigo-200 font-medium transition-colors cursor-pointer disabled:opacity-50 text-xs"
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

            {/* Active Episode Properties Header */}
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-300 pt-1">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                <span>{t('episodePropertiesBtn')}</span>
              </div>
              <span className="text-slate-400 font-mono text-[10px] normal-case">
                ID: {project.id}
              </span>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">
                {t('episodeTitleLabel')}
              </label>
              <input
                type="text"
                data-testid="modal-episode-title-input"
                value={project.title}
                onChange={(e) => updateProjectProperties({ title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            {/* Description / Synopsis */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">
                {t('episodeDescriptionLabel')}
              </label>
              <textarea
                rows={2}
                data-testid="modal-episode-desc-input"
                value={project.description}
                onChange={(e) =>
                  updateProjectProperties({ description: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none text-xs"
              />
            </div>

            {/* Language & Genre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1 text-xs">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="hr">Hrvatski (Standardni HR)</option>
                  <option value="hr-dubrovnik">Hrvatski — Dubrovački govor (Ragusa)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>

              {project.defaultLanguage === 'hr' && project.dialect === 'dubrovnik' && (
                <div className="space-y-1">
                  <label className="text-amber-400 font-semibold block text-xs">
                    {t('dubrovnikRegisterLabel')}
                  </label>
                  <select
                    data-testid="modal-dubrovnik-register-select"
                    value={project.dubrovnikRegister ?? 'contemporary'}
                    onChange={(e) =>
                      updateProjectProperties({
                        dubrovnikRegister: e.target.value as
                          | 'classical'
                          | 'traditional'
                          | 'contemporary',
                      })
                    }
                    className="w-full bg-slate-950 border border-amber-800/80 rounded-md px-2.5 py-1.5 text-amber-200 focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
                  >
                    <option value="contemporary">Suvremeni razgovorni</option>
                    <option value="traditional">Tradicionalni pučki govor Grada (19./20. st.)</option>
                    <option value="classical">Klasični barokni (Držić / Gundulić)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block text-xs">
                  {t('episodeGenreLabel')}
                </label>
                <input
                  type="text"
                  data-testid="modal-episode-genre-input"
                  value={project.metadata?.genre ?? ''}
                  onChange={(e) =>
                    updateProjectProperties({ genre: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            {/* Author & Target WPM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block text-xs">
                  {t('episodeAuthorLabel')}
                </label>
                <input
                  type="text"
                  data-testid="modal-episode-author-input"
                  value={project.metadata?.author ?? ''}
                  onChange={(e) =>
                    updateProjectProperties({ author: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block text-xs">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-indigo-500 text-xs"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-100 font-mono text-xs cursor-pointer"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-100 font-mono text-xs cursor-pointer"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-emerald-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            {project.defaultLanguage.toUpperCase()} • {project.blocks.length} blocks •{' '}
            {project.speakers.length} speakers
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
