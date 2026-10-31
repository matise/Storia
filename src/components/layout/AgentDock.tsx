import React from 'react';
import {
  BookOpen,
  Check,
  Cpu,
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  MessageSquarePlus,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AIAgentMode,
  BilingualAdaptationResult,
  CoWriterBeatCandidate,
  GEMINI_TEXT_MODELS,
  GeminiTextModelId,
  ScriptDoctorOption,
  SupportedLanguage,
} from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getApiKey } from '../../core/storage/keyVault';
import {
  adaptBlockBilingually,
  doctorDialogueBlock,
  generateNextSceneBeats,
  runPersonaResearch,
} from '../../services/geminiAgentService';
import { formatDurationReadout } from '../../core/pacing/pacingCalculator';

export const AgentDock: React.FC = () => {
  const { t } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const selectedBlockId = useStoriaStore((s) => s.selectedBlockId);
  const addBlock = useStoriaStore((s) => s.addBlock);
  const updateBlock = useStoriaStore((s) => s.updateBlock);
  const setGeminiTextModel = useStoriaStore((s) => s.setGeminiTextModel);
  const setEnableSearchGrounding = useStoriaStore((s) => s.setEnableSearchGrounding);
  const addResearchRecord = useStoriaStore((s) => s.addResearchRecord);
  const insertSceneBeatBlocks = useStoriaStore((s) => s.insertSceneBeatBlocks);

  const [activeMode, setActiveMode] = React.useState<AIAgentMode>('persona_research');
  const [isLoading, setIsLoading] = React.useState(false);

  // Mode 1: Persona Research State
  const [selectedSpeakerId, setSelectedSpeakerId] = React.useState<string>(
    project.speakers[0]?.id ?? ''
  );
  const [queryText, setQueryText] = React.useState<string>(
    project.researchNotebook?.[0]?.query ??
      'Kakve je pištolje koristila zagrebačka policija 1938. godine?'
  );
  const [activeRecordId, setActiveRecordId] = React.useState<string | null>(
    project.researchNotebook?.[0]?.id ?? null
  );

  // Mode 2: Co-Writer State
  const [directionHint, setDirectionHint] = React.useState<string>('');
  const [sceneBeats, setSceneBeats] = React.useState<CoWriterBeatCandidate[]>([]);

  // Mode 3: Script Doctor State
  const [doctorOptions, setDoctorOptions] = React.useState<ScriptDoctorOption[]>([]);

  // Mode 4: Bilingual Adapter State
  const [targetLang, setTargetLang] = React.useState<SupportedLanguage>(
    project.defaultLanguage === 'hr' ? 'en' : 'hr'
  );
  const [adaptationResult, setAdaptationResult] =
    React.useState<BilingualAdaptationResult | null>(null);

  const activeBlock =
    project.blocks.find((b) => b.id === selectedBlockId) ?? project.blocks[0];
  const activeBlockSpeaker = project.speakers.find(
    (s) => s.id === activeBlock?.speakerId
  );

  const notebook = project.researchNotebook ?? [];
  const displayedRecord =
    notebook.find((r) => r.id === activeRecordId) ?? notebook[0] ?? null;

  const activeTextModel = project.aiSettings.textModel;
  const searchGroundingEnabled = project.aiSettings.enableSearchGrounding;

  // Handlers
  const handleRunPersonaResearch = async () => {
    const speaker =
      project.speakers.find((s) => s.id === selectedSpeakerId) ??
      project.speakers[0];
    if (!speaker || !queryText.trim()) return;

    setIsLoading(true);
    try {
      const record = await runPersonaResearch({
        speaker,
        query: queryText,
        language: project.defaultLanguage,
        apiKey: getApiKey(),
        modelId: activeTextModel,
        enableSearchGrounding: searchGroundingEnabled,
      });
      addResearchRecord(record);
      setActiveRecordId(record.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertAsDialogue = () => {
    if (!displayedRecord) return;
    addBlock('dialogue', selectedBlockId ?? undefined, {
      speakerId: displayedRecord.speakerId || selectedSpeakerId,
      text: displayedRecord.personaResponse,
      directorNotes: 'znalački / knowingly',
    });
  };

  const handleGenerateSceneBeats = async () => {
    setIsLoading(true);
    try {
      const beats = await generateNextSceneBeats({
        precedingBlocks: project.blocks,
        speakers: project.speakers,
        language: project.defaultLanguage,
        apiKey: getApiKey(),
        modelId: activeTextModel,
        directionHint,
      });
      setSceneBeats(beats);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunScriptDoctor = async () => {
    if (!activeBlock) return;
    setIsLoading(true);
    try {
      const options = await doctorDialogueBlock({
        block: activeBlock,
        speaker: activeBlockSpeaker,
        targetWpm: project.metadata?.targetWpm ?? 140,
        language: project.defaultLanguage,
        apiKey: getApiKey(),
        modelId: activeTextModel,
      });
      setDoctorOptions(options);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyDoctorOption = (opt: ScriptDoctorOption) => {
    if (!activeBlock) return;
    updateBlock(activeBlock.id, {
      text: opt.text,
      directorNotes: opt.directorNotes,
    });
  };

  const handleRunBilingualAdapter = async () => {
    if (!activeBlock) return;
    const sourceLang: SupportedLanguage = targetLang === 'en' ? 'hr' : 'en';
    setIsLoading(true);
    try {
      const adapted = await adaptBlockBilingually({
        block: activeBlock,
        speaker: activeBlockSpeaker,
        sourceLang,
        targetLang,
        apiKey: getApiKey(),
        modelId: activeTextModel,
      });
      setAdaptationResult(adapted);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAdaptation = () => {
    if (!activeBlock || !adaptationResult) return;
    updateBlock(activeBlock.id, {
      text: adaptationResult.adaptedText,
      directorNotes:
        adaptationResult.adaptedDirectorNotes ?? activeBlock.directorNotes,
    });
  };

  return (
    <aside className="w-85 border-l border-slate-800/90 bg-slate-950 flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 flex flex-col gap-3 overflow-y-auto">
        {/* Header + Inline Gemini Model Picker */}
        <div className="space-y-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              {t('aiDockTitle')}
            </h2>
            <button
              type="button"
              data-testid="search-grounding-toggle"
              onClick={() => setEnableSearchGrounding(!searchGroundingEnabled)}
              title={t('searchGroundingToggle')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                searchGroundingEnabled
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <Globe className="w-2.5 h-2.5" />
              <span>Grounding:{searchGroundingEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Gemini Model Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              aria-label={t('geminiModelPickerLabel')}
              data-testid="agent-dock-model-picker"
              value={activeTextModel}
              onChange={(e) =>
                setGeminiTextModel(e.target.value as GeminiTextModelId)
              }
              className="w-full bg-transparent text-[11px] font-mono text-indigo-200 focus:outline-none cursor-pointer"
            >
              {GEMINI_TEXT_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                  {m.id} ({m.badge})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium">
          <button
            type="button"
            data-testid="tab-persona-research"
            onClick={() => setActiveMode('persona_research')}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeMode === 'persona_research'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3 h-3" />
            <span className="truncate">{t('tabPersonaPov')}</span>
          </button>

          <button
            type="button"
            data-testid="tab-cowriter"
            onClick={() => setActiveMode('cowriter')}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeMode === 'cowriter'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="truncate">{t('tabCoWriter')}</span>
          </button>

          <button
            type="button"
            data-testid="tab-dialogue-doctor"
            onClick={() => setActiveMode('dialogue_doctor')}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeMode === 'dialogue_doctor'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3 h-3" />
            <span className="truncate">{t('tabDoctor')}</span>
          </button>

          <button
            type="button"
            data-testid="tab-bilingual-adapter"
            onClick={() => setActiveMode('bilingual_adapter')}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeMode === 'bilingual_adapter'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Languages className="w-3 h-3" />
            <span className="truncate">{t('tabAdapter')}</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: PERSONA-GROUNDED RESEARCH                                  */}
        {/* ================================================================= */}
        {activeMode === 'persona_research' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-medium border-b border-slate-800/80 pb-2">
              <span>{t('modePersonaResearch')}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                {t('speakerSelectLabel')}:
              </label>
              <select
                data-testid="persona-research-speaker-select"
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {project.speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.age})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                {t('queryLabel')}:
              </label>
              <textarea
                rows={3}
                data-testid="persona-research-query-input"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder={t('queryPlaceholder')}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              type="button"
              data-testid="run-persona-research-btn"
              disabled={isLoading || !queryText.trim()}
              onClick={() => void handleRunPersonaResearch()}
              className="w-full py-1.5 px-3 rounded-md bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>[ {t('researchViaGoogle')} ]</span>
            </button>

            {displayedRecord && (
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{t('inCharacterResponse')}:</span>
                  </div>
                  {displayedRecord.modelUsed && (
                    <span className="text-[9px] font-mono text-slate-500">
                      {displayedRecord.modelUsed}
                    </span>
                  )}
                </div>

                <p
                  data-testid="persona-research-response-text"
                  className="text-xs text-slate-200 italic leading-relaxed bg-slate-950/70 p-2.5 rounded border border-slate-800/80"
                >
                  "{displayedRecord.personaResponse}"
                </p>

                {displayedRecord.objectiveSummary && (
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {displayedRecord.objectiveSummary}
                  </p>
                )}

                {displayedRecord.sources.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {t('citationsLabel')}:
                    </div>
                    <ul className="space-y-1">
                      {displayedRecord.sources.map((src, idx) => (
                        <li key={idx}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 truncate"
                          >
                            <span>
                              [{idx + 1}] {src.title}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="insert-research-dialogue-btn"
                  onClick={handleInsertAsDialogue}
                  className="w-full py-1.5 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[ {t('insertAsDialogue')} ]</span>
                </button>
              </div>
            )}

            {/* Research Notebook History */}
            {notebook.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t('researchNotebookTitle')} ({notebook.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {notebook.map((rec) => {
                    const spk = project.speakers.find((s) => s.id === rec.speakerId);
                    return (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => setActiveRecordId(rec.id)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] border truncate transition-colors cursor-pointer ${
                          displayedRecord?.id === rec.id
                            ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-semibold">{spk?.name ?? 'Speaker'}:</span>{' '}
                        {rec.query}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: SCENE CO-WRITER                                            */}
        {/* ================================================================= */}
        {activeMode === 'cowriter' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-medium border-b border-slate-800/80 pb-2">
              <span>{t('modeCoWriter')}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                {t('coWriterDirectionHintLabel')}:
              </label>
              <input
                type="text"
                data-testid="cowriter-direction-input"
                value={directionHint}
                onChange={(e) => setDirectionHint(e.target.value)}
                placeholder={t('coWriterDirectionHintPlaceholder')}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              data-testid="generate-beats-btn"
              disabled={isLoading}
              onClick={() => void handleGenerateSceneBeats()}
              className="w-full py-1.5 px-3 rounded-md bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>[ {t('generateBeatsBtn')} ]</span>
            </button>

            <div className="space-y-2.5">
              {sceneBeats.map((beat, bIdx) => (
                <div
                  key={beat.id}
                  data-testid={`cowriter-beat-card-${bIdx}`}
                  className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 space-y-2"
                >
                  <div className="font-semibold text-indigo-300 text-xs">
                    {beat.title}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {beat.rationale}
                  </p>
                  <div className="space-y-1 bg-slate-950/80 rounded p-2 border border-slate-800/80">
                    {beat.blocks.map((blk, i) => {
                      const spk = project.speakers.find((s) => s.id === blk.speakerId);
                      return (
                        <div key={i} className="text-[11px] text-slate-200 leading-snug">
                          <span className="font-mono text-emerald-400">
                            [{blk.type === 'sound_effect' ? 'SFX' : (spk?.name ?? blk.type)}]:
                          </span>{' '}
                          {blk.text}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    data-testid={`insert-beat-btn-${bIdx}`}
                    onClick={() => insertSceneBeatBlocks(beat.blocks)}
                    className="w-full py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3 h-3 text-emerald-400" />
                    <span>[ {t('insertBeatBtn')} ({beat.blocks.length}) ]</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SCRIPT DOCTOR & VOCAL CADENCE POLISHER                     */}
        {/* ================================================================= */}
        {activeMode === 'dialogue_doctor' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-medium border-b border-slate-800/80 pb-2">
              <span>{t('modeScriptDoctor')}</span>
            </div>

            {activeBlock && (
              <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>
                    {t('targetBlockLabel')}: #{activeBlock.order + 1} (
                    {activeBlockSpeaker?.name ?? activeBlock.type})
                  </span>
                  <span>
                    {formatDurationReadout(activeBlock.estimatedDurationSec ?? 0, true)} |{' '}
                    {activeBlock.audioTokenEstimate ?? 0} {t('tokensAbbrev')}
                  </span>
                </div>
                <p className="text-xs text-slate-200 italic truncate">
                  "{activeBlock.text}"
                </p>
              </div>
            )}

            <button
              type="button"
              data-testid="run-doctor-btn"
              disabled={isLoading || !activeBlock}
              onClick={() => void handleRunScriptDoctor()}
              className="w-full py-1.5 px-3 rounded-md bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              <span>[ {t('runDoctorBtn')} ]</span>
            </button>

            <div className="space-y-2">
              {doctorOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  data-testid={`doctor-option-card-${idx}`}
                  className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 text-[11px]">
                      {opt.styleLabel}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">
                      {formatDurationReadout(opt.estimatedDurationSec, true)} ({opt.audioTokenEstimate}{' '}
                      {t('tokensAbbrev')})
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 bg-slate-950/80 p-2 rounded border border-slate-800/80">
                    "{opt.text}"
                  </p>
                  <div className="text-[10px] font-mono text-indigo-300">
                    [{opt.directorNotes}]
                  </div>
                  <p className="text-[11px] text-slate-400">{opt.rationale}</p>
                  <button
                    type="button"
                    data-testid={`apply-doctor-option-${idx}`}
                    onClick={() => handleApplyDoctorOption(opt)}
                    className="w-full py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>[ {t('applyPolishBtn')} ]</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: BILINGUAL CULTURAL & GRAMMATICAL ADAPTER (EN <-> HR)       */}
        {/* ================================================================= */}
        {activeMode === 'bilingual_adapter' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-medium border-b border-slate-800/80 pb-2">
              <span>{t('modeBilingualAdapter')}</span>
            </div>

            {activeBlock && (
              <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-2.5 space-y-1">
                <div className="text-[10px] font-mono text-slate-400">
                  {t('targetBlockLabel')}: #{activeBlock.order + 1} (
                  {activeBlockSpeaker?.name ?? activeBlock.type} —{' '}
                  {activeBlockSpeaker?.gender ?? 'neutral'})
                </div>
                <p className="text-xs text-slate-200 italic">"{activeBlock.text}"</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                {t('translationDirectionLabel')}:
              </label>
              <select
                data-testid="adapter-direction-select"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="en">Croatian (HR) → English (EN)</option>
                <option value="hr">English (EN) → Croatian (HR)</option>
              </select>
            </div>

            <button
              type="button"
              data-testid="run-adapter-btn"
              disabled={isLoading || !activeBlock}
              onClick={() => void handleRunBilingualAdapter()}
              className="w-full py-1.5 px-3 rounded-md bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              <span>[ {t('runAdapterBtn')} ]</span>
            </button>

            {adaptationResult && (
              <div
                data-testid="adapter-result-card"
                className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 space-y-2"
              >
                <div className="text-[10px] font-mono text-emerald-400">
                  {t('genderMorphologyLabel')}: {adaptationResult.genderAgreementApplied}
                </div>
                <p
                  data-testid="adapter-result-text"
                  className="text-xs text-slate-100 bg-slate-950/80 p-2.5 rounded border border-slate-800/80 leading-relaxed"
                >
                  "{adaptationResult.adaptedText}"
                </p>
                <p className="text-[11px] text-slate-400">
                  {adaptationResult.culturalNotes}
                </p>
                <button
                  type="button"
                  data-testid="apply-adapter-btn"
                  onClick={handleApplyAdaptation}
                  className="w-full py-1.5 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[ {t('applyTranslationBtn')} ]</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="truncate">{t('phase4PreviewNotice')}</span>
        <span className="font-mono text-[10px] text-indigo-400 shrink-0 ml-2">
          {GEMINI_TEXT_MODELS.find((m) => m.id === activeTextModel)?.badge ?? activeTextModel}
        </span>
      </div>
    </aside>
  );
};
