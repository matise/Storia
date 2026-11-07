import React from 'react';
import {
  Headphones,
  Play,
  Sliders,
  Square,
  Trash2,
  X,
  Mic,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  GEMINI_VOICE_CATALOG,
  Gender,
  normalizeGeminiVoiceName,
  Speaker,
  AudioEffectConfig,
  BiquadEqEffectConfig,
  DynamicsEffectConfig,
} from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getAvailableBrowserVoices,
  updateLiveDspIfPlaying,
} from '../../core/dsp/LiveAudioPreviewer';
import { getApiKey } from '../../core/storage/keyVault';
import { designSpeakerProfileWithAi } from '../../services/geminiAgentService';
import { EffectStackEditor } from '../dsp/EffectStackEditor';

export const SpeakerConfigModal: React.FC = () => {
  const { t } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const editingSpeakerId = useStoriaStore((s) => s.editingSpeakerId);
  const editingSpeakerInitialTab = useStoriaStore((s) => s.editingSpeakerInitialTab);
  const openSpeakerModal = useStoriaStore((s) => s.openSpeakerModal);
  const updateSpeaker = useStoriaStore((s) => s.updateSpeaker);
  const removeSpeaker = useStoriaStore((s) => s.removeSpeaker);
  const previewSpeakerVoice = useStoriaStore((s) => s.previewSpeakerVoice);
  const stopAudioPreview = useStoriaStore((s) => s.stopAudioPreview);
  const previewingSpeakerId = useStoriaStore((s) => s.previewingSpeakerId);

  const [draft, setDraft] = React.useState<Speaker | null>(null);
  const [samplePhrase, setSamplePhrase] = React.useState<string>('');
  const [browserVoices, setBrowserVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [activeTab, setActiveTab] = React.useState<'voice' | 'dsp' | 'persona'>('voice');
  const [aiPrompt, setAiPrompt] = React.useState<string>('');
  const [aiScope, setAiScope] = React.useState<'all' | 'dsp' | 'voice_persona'>('all');
  const [isAiDesigning, setIsAiDesigning] = React.useState<boolean>(false);
  const [aiRationale, setAiRationale] = React.useState<string | null>(null);
  const currentLoadedSpeakerIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const loadVoices = () => {
      setBrowserVoices(getAvailableBrowserVoices());
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  React.useEffect(() => {
    if (editingSpeakerId) {
      if (editingSpeakerId !== currentLoadedSpeakerIdRef.current) {
        currentLoadedSpeakerIdRef.current = editingSpeakerId;
        const speaker = project.speakers.find((s) => s.id === editingSpeakerId);
        if (speaker) {
          setDraft(JSON.parse(JSON.stringify(speaker)) as Speaker);
          const existingLine = project.blocks.find(
            (b) => b.speakerId === speaker.id
          )?.text;
          setSamplePhrase(
            existingLine ||
              (project.defaultLanguage === 'hr'
                ? `Pozdrav, ja sam ${speaker.name}. Provjera glasa i Biquad ekvalizatora u studiju.`
                : `Hello, I am ${speaker.name}. Testing vocal timbre and Biquad EQ in the studio.`)
          );
          setActiveTab(editingSpeakerInitialTab ?? 'voice');
          setAiPrompt('');
          setAiRationale(null);
        } else {
          setDraft(null);
        }
      }
    } else {
      currentLoadedSpeakerIdRef.current = null;
      setDraft(null);
      setAiPrompt('');
      setAiRationale(null);
    }
  }, [editingSpeakerId, editingSpeakerInitialTab, project.speakers, project.blocks, project.defaultLanguage]);

  const speakerEffectStack: AudioEffectConfig[] = React.useMemo(() => {
    if (!draft) return [];
    if (Array.isArray(draft.voice.acoustics.effectStack)) {
      return draft.voice.acoustics.effectStack;
    }
    const stack: AudioEffectConfig[] = [
      {
        id: `fx_eq_${draft.id}`,
        name: '3-Band Biquad EQ',
        type: 'biquad_eq',
        enabled: draft.voice.acoustics.biquadEq?.enabled ?? true,
        lowShelfFreqHz: 120,
        lowShelfGainDb: draft.voice.acoustics.biquadEq?.lowShelfGainDb ?? 0,
        midPeakFreqHz: 2500,
        midPeakGainDb: draft.voice.acoustics.biquadEq?.midPeakGainDb ?? 0,
        midPeakQ: 1.0,
        highShelfFreqHz: 8000,
        highShelfGainDb: draft.voice.acoustics.biquadEq?.highShelfGainDb ?? 0,
      },
      {
        id: `fx_dyn_${draft.id}`,
        name: 'Studio Dynamics Compressor',
        type: 'dynamics_compressor',
        enabled: draft.voice.acoustics.compression?.enabled ?? true,
        thresholdDb: draft.voice.acoustics.compression?.thresholdDb ?? -20,
        ratio: draft.voice.acoustics.compression?.ratio ?? 2.5,
        attackMs: draft.voice.acoustics.compression?.attackMs ?? 15,
        releaseMs: draft.voice.acoustics.compression?.releaseMs ?? 100,
        kneeDb: 0,
      },
    ];
    return stack;
  }, [draft?.id, draft?.voice?.acoustics]);

  if (!draft) return null;

  const isPreviewing = previewingSpeakerId === draft.id;

  const updateDraft = (next: Speaker) => {
    setDraft(next);
    updateLiveDspIfPlaying(next);
  };

  const handleUpdateEffectStack = (newStack: AudioEffectConfig[]) => {
    const eqMod = newStack.find((m) => m.type === 'biquad_eq') as BiquadEqEffectConfig | undefined;
    const dynMod = newStack.find((m) => m.type === 'dynamics_compressor') as DynamicsEffectConfig | undefined;

    const nextDraft: Speaker = {
      ...draft,
      voice: {
        ...draft.voice,
        acoustics: {
          ...draft.voice.acoustics,
          effectStack: newStack,
          biquadEq: eqMod
            ? {
                enabled: eqMod.enabled,
                lowShelfGainDb: eqMod.lowShelfGainDb,
                midPeakGainDb: eqMod.midPeakGainDb,
                highShelfGainDb: eqMod.highShelfGainDb,
              }
            : {
                enabled: false,
                lowShelfGainDb: 0,
                midPeakGainDb: 0,
                highShelfGainDb: 0,
              },
          compression: dynMod
            ? {
                enabled: dynMod.enabled,
                thresholdDb: dynMod.thresholdDb,
                ratio: dynMod.ratio,
                attackMs: dynMod.attackMs,
                releaseMs: dynMod.releaseMs,
              }
            : {
                enabled: false,
                thresholdDb: -20,
                ratio: 2.5,
                attackMs: 15,
                releaseMs: 100,
              },
        },
      },
    };
    updateDraft(nextDraft);
  };

  const handleToggleModule = (moduleId: string) => {
    const nextStack = speakerEffectStack.map((m) =>
      m.id === moduleId ? { ...m, enabled: !m.enabled } : m
    );
    handleUpdateEffectStack(nextStack);
  };

  const handleUpdateModuleConfig = (moduleId: string, updates: Partial<AudioEffectConfig>) => {
    const nextStack = speakerEffectStack.map((m) =>
      m.id === moduleId ? ({ ...m, ...updates } as AudioEffectConfig) : m
    );
    handleUpdateEffectStack(nextStack);
  };

  const handleRunAiSpeakerArchitect = async (overridePrompt?: string) => {
    if (!draft || isAiDesigning) return;
    const effectivePrompt = (overridePrompt ?? aiPrompt).trim();
    if (overridePrompt !== undefined) {
      setAiPrompt(overridePrompt);
    }

    setIsAiDesigning(true);
    try {
      const design = await designSpeakerProfileWithAi({
        prompt: effectivePrompt,
        speaker: draft,
        language: project.defaultLanguage,
        dialect: project.dialect,
        dubrovnikRegister: project.dubrovnikRegister,
        apiKey: getApiKey(),
        textModel: project.aiSettings.textModel,
      });

      const applyVoicePersona = aiScope === 'all' || aiScope === 'voice_persona';
      const applyDsp = aiScope === 'all' || aiScope === 'dsp';

      const eqMod = design.effectStack.find(
        (m) => m.type === 'biquad_eq'
      ) as BiquadEqEffectConfig | undefined;
      const dynMod = design.effectStack.find(
        (m) => m.type === 'dynamics_compressor'
      ) as DynamicsEffectConfig | undefined;

      const nextAcoustics = applyDsp
        ? {
            ...draft.voice.acoustics,
            effectStack: design.effectStack,
            biquadEq: eqMod
              ? {
                  enabled: eqMod.enabled,
                  lowShelfGainDb: eqMod.lowShelfGainDb,
                  midPeakGainDb: eqMod.midPeakGainDb,
                  highShelfGainDb: eqMod.highShelfGainDb,
                }
              : draft.voice.acoustics.biquadEq,
            compression: dynMod
              ? {
                  enabled: dynMod.enabled,
                  thresholdDb: dynMod.thresholdDb,
                  ratio: dynMod.ratio,
                  attackMs: dynMod.attackMs,
                  releaseMs: dynMod.releaseMs,
                }
              : draft.voice.acoustics.compression,
          }
        : draft.voice.acoustics;

      const nextDraft: Speaker = {
        ...draft,
        gender: applyVoicePersona ? design.gender : draft.gender,
        age: applyVoicePersona ? design.age : draft.age,
        personaPrompt: applyVoicePersona ? design.personaPrompt : draft.personaPrompt,
        actingNotes: applyVoicePersona ? design.actingNotes : draft.actingNotes,
        voice: {
          ...draft.voice,
          baseVoice: applyVoicePersona ? design.baseVoice : draft.voice.baseVoice,
          speakingRate: applyVoicePersona
            ? design.speakingRate
            : draft.voice.speakingRate,
          pitchAdjustment: applyVoicePersona
            ? design.pitchAdjustment
            : draft.voice.pitchAdjustment,
          stylePrompt: applyVoicePersona ? design.stylePrompt : draft.voice.stylePrompt,
          acoustics: nextAcoustics,
        },
      };

      updateDraft(nextDraft);
      if (applyVoicePersona && design.samplePhrase) {
        setSamplePhrase(design.samplePhrase);
      }
      setAiRationale(design.acousticRationale);
    } finally {
      setIsAiDesigning(false);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    stopAudioPreview();
    updateSpeaker(draft);
    openSpeakerModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: draft.color }}
            />
            <h3 className="font-bold text-sm text-slate-100">
              {t('speakerModalTitle')} — {draft.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudioPreview();
              openSpeakerModal(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-2 gap-2 text-xs font-medium">
          <button
            type="button"
            data-testid="speaker-tab-voice"
            onClick={() => setActiveTab('voice')}
            className={`pb-2 px-3 border-b-2 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'voice'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{t('speakerTabVoice')}</span>
          </button>

          <button
            type="button"
            data-testid="speaker-tab-dsp"
            onClick={() => setActiveTab('dsp')}
            className={`pb-2 px-3 border-b-2 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dsp'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('speakerTabDsp')}</span>
            <span className="text-[10px] font-mono px-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400">
              {speakerEffectStack.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="speaker-tab-persona"
            onClick={() => setActiveTab('persona')}
            className={`pb-2 px-3 border-b-2 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'persona'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('speakerTabPersona')}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Live Speaker Voice Audition & Test Phrase Tool */}
          <div className="p-3 rounded-lg bg-slate-950 border border-indigo-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                <Headphones className="w-3.5 h-3.5" />
                <span>{t('speakerAuditionTitle')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isPreviewing) {
                    stopAudioPreview();
                  } else {
                    void previewSpeakerVoice(draft.id, samplePhrase, draft);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  isPreviewing
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isPreviewing ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <span>{t('stopSpeakerPreview')}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>{t('previewSpeakerVoice')}</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={samplePhrase}
              onChange={(e) => setSamplePhrase(e.target.value)}
              placeholder={t('speakerAuditionSamplePlaceholder')}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Gemini AI Voice, Persona & DSP Architect Panel */}
          <div
            data-testid="ai-speaker-architect-panel"
            className="p-3 rounded-lg bg-gradient-to-b from-indigo-950/35 via-slate-950 to-slate-950 border border-indigo-500/40 space-y-2.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{t('aiSpeakerArchitectTitle')}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  aria-label="AI Speaker Scope"
                  data-testid="ai-speaker-scope-select"
                  value={aiScope}
                  onChange={(e) =>
                    setAiScope(e.target.value as 'all' | 'dsp' | 'voice_persona')
                  }
                  className="bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-[11px] text-indigo-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">{t('aiSpeakerScopeAll')}</option>
                  <option value="dsp">{t('aiSpeakerScopeDspOnly')}</option>
                  <option value="voice_persona">
                    {t('aiSpeakerScopeVoicePersona')}
                  </option>
                </select>

                <button
                  type="button"
                  data-testid="ai-speaker-architect-btn"
                  disabled={isAiDesigning}
                  onClick={() => void handleRunAiSpeakerArchitect()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-semibold transition-all cursor-pointer shadow-xs"
                >
                  {isAiDesigning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t('aiSpeakerGeneratingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>{t('aiSpeakerGenerateBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <input
              type="text"
              data-testid="ai-speaker-prompt-input"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleRunAiSpeakerArchitect();
                }
              }}
              placeholder={t('aiSpeakerPromptPlaceholder')}
              className="w-full bg-slate-900/95 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />

            {/* Quick Acoustic & Character Archetype Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="ai-preset-broadcast-btn"
                onClick={() =>
                  void handleRunAiSpeakerArchitect(
                    'Warm articulate studio broadcast podcast host with clear midrange presence'
                  )
                }
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                🎙️ {t('aiPresetBroadcastHost')}
              </button>
              <button
                type="button"
                data-testid="ai-preset-radio-btn"
                onClick={() =>
                  void handleRunAiSpeakerArchitect(
                    'Urgent voice over vintage narrowband telephone and radio static line'
                  )
                }
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                📻 {t('aiPresetVintageRadio')}
              </button>
              <button
                type="button"
                data-testid="ai-preset-vault-btn"
                onClick={() =>
                  void handleRunAiSpeakerArchitect(
                    'Resonant theatrical voice inside ancient stone vaults and cathedral echo'
                  )
                }
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                🏛️ {t('aiPresetStoneVault')}
              </button>
              <button
                type="button"
                data-testid="ai-preset-noir-btn"
                onClick={() =>
                  void handleRunAiSpeakerArchitect(
                    'Intimate close-mic noir detective whisper in the shadows'
                  )
                }
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                🕵️ {t('aiPresetNoirDetective')}
              </button>
            </div>

            {aiRationale && (
              <div
                data-testid="ai-speaker-rationale-banner"
                className="px-2.5 py-1.5 rounded bg-emerald-950/50 border border-emerald-700/50 text-[11px] text-emerald-200 leading-relaxed"
              >
                {aiRationale}
              </div>
            )}
          </div>

          {/* TAB 1: Voice & TTS Profile */}
          {activeTab === 'voice' && (
            <div data-testid="speaker-voice-tab-content" className="space-y-4">
              {/* Identity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-400 font-medium">{t('speakerName')}</label>
                  <input
                    type="text"
                    required
                    value={draft.name}
                    onChange={(e) => updateDraft({ ...draft, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">{t('speakerGender')}</label>
                  <select
                    value={draft.gender}
                    onChange={(e) =>
                      updateDraft({ ...draft, gender: e.target.value as Gender })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="male">{t('genderMale')}</option>
                    <option value="female">{t('genderFemale')}</option>
                    <option value="non-binary">{t('genderNonBinary')}</option>
                    <option value="neutral">{t('genderNeutral')}</option>
                    <option value="other">{t('genderOther')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">{t('speakerAge')}</label>
                  <input
                    type="text"
                    value={draft.age}
                    onChange={(e) => updateDraft({ ...draft, age: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Gemini TTS Voice & Local Browser TTS Voice Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">{t('baseVoice')}</label>
                  <select
                    data-testid="speaker-base-voice-select"
                    value={normalizeGeminiVoiceName(draft.voice.baseVoice, draft.gender)}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          baseVoice: normalizeGeminiVoiceName(
                            e.target.value,
                            draft.gender
                          ),
                        },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {GEMINI_VOICE_CATALOG.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id} — {project.defaultLanguage === 'hr' ? v.descriptionHr : v.descriptionEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">
                    {t('browserVoiceLabel')}
                  </label>
                  <select
                    value={draft.voice.browserVoiceURI ?? ''}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          browserVoiceURI: e.target.value || undefined,
                        },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{t('browserVoiceAuto')}</option>
                    {browserVoices.map((bv) => (
                      <option key={bv.voiceURI} value={bv.voiceURI}>
                        {bv.name} ({bv.lang})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rate & Pitch Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">
                    {t('speakingRate')} ({draft.voice.speakingRate.toFixed(2)}x)
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={draft.voice.speakingRate}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          speakingRate: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">
                    {t('pitchAdjustment')} ({draft.voice.pitchAdjustment > 0 ? '+' : ''}
                    {draft.voice.pitchAdjustment} st)
                  </label>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={draft.voice.pitchAdjustment}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          pitchAdjustment: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              {/* Style Prompt */}
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{t('stylePrompt')}</label>
                <input
                  type="text"
                  value={draft.voice.stylePrompt}
                  onChange={(e) =>
                    updateDraft({
                      ...draft,
                      voice: { ...draft.voice, stylePrompt: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Modular DSP Effect Stack */}
          {activeTab === 'dsp' && (
            <div data-testid="speaker-dsp-tab-content" className="space-y-3">
              <EffectStackEditor
                modules={speakerEffectStack}
                onChangeModules={handleUpdateEffectStack}
                onToggleModule={handleToggleModule}
                onUpdateModuleConfig={handleUpdateModuleConfig}
                title={`${draft.name} — Channel Insert Effects`}
                testId="speaker-effect-stack-editor"
              />
            </div>
          )}

          {/* TAB 3: Persona & Notes */}
          {activeTab === 'persona' && (
            <div data-testid="speaker-persona-tab-content" className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{t('personaPrompt')}</label>
                <textarea
                  rows={4}
                  value={draft.personaPrompt}
                  onChange={(e) =>
                    updateDraft({ ...draft, personaPrompt: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{t('actingNotes')}</label>
                <textarea
                  rows={4}
                  value={draft.actingNotes}
                  onChange={(e) =>
                    updateDraft({ ...draft, actingNotes: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {project.speakers.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  stopAudioPreview();
                  removeSpeaker(draft.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('deleteSpeaker')}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopAudioPreview();
                  openSpeakerModal(null);
                }}
                className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                onClick={handleSave}
                data-testid="save-speaker-btn"
                className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
              >
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
