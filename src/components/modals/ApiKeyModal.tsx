import React from 'react';
import {
  Database,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  GEMINI_TEXT_MODELS,
  GEMINI_TTS_MODELS,
  GeminiTextModelId,
  GeminiTtsModelId,
  TtsEngineProvider,
} from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getApiKey } from '../../core/storage/keyVault';

export const ApiKeyModal: React.FC = () => {
  const { t } = useTranslation();
  const isApiKeyModalOpen = useStoriaStore((s) => s.isApiKeyModalOpen);
  const setApiKeyModalOpen = useStoriaStore((s) => s.setApiKeyModalOpen);
  const saveApiConfiguration = useStoriaStore((s) => s.saveApiConfiguration);
  const ttsProvider = useStoriaStore((s) => s.ttsProvider);
  const purgeAudioCache = useStoriaStore((s) => s.purgeAudioCache);
  const project = useStoriaStore((s) => s.project);

  const [keyInput, setKeyInput] = React.useState('');
  const [selectedProvider, setSelectedProvider] =
    React.useState<TtsEngineProvider>(ttsProvider);
  const [selectedTextModel, setSelectedTextModel] = React.useState<GeminiTextModelId>(
    project.aiSettings.textModel
  );
  const [selectedTtsModel, setSelectedTtsModel] = React.useState<GeminiTtsModelId>(
    project.aiSettings.ttsModel
  );

  React.useEffect(() => {
    if (isApiKeyModalOpen) {
      setKeyInput(getApiKey());
      setSelectedProvider(ttsProvider);
      setSelectedTextModel(project.aiSettings.textModel);
      setSelectedTtsModel(project.aiSettings.ttsModel);
    }
  }, [
    isApiKeyModalOpen,
    ttsProvider,
    project.aiSettings.textModel,
    project.aiSettings.ttsModel,
  ]);

  if (!isApiKeyModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveApiConfiguration(
      keyInput,
      selectedProvider,
      selectedTextModel,
      selectedTtsModel
    );
    setApiKeyModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">{t('apiModalTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={() => setApiKeyModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 flex items-start gap-2.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t('apiModalSubtitle')}</p>
          </div>

          {/* Engine Selector: Gemini 2.5 Flash TTS vs Local Browser TTS */}
          <div className="space-y-2">
            <label className="text-slate-300 font-semibold block">
              {t('ttsProviderSelectLabel')}
            </label>

            <div
              onClick={() => setSelectedProvider('gemini_tts')}
              className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
                selectedProvider === 'gemini_tts'
                  ? 'bg-indigo-950/50 border-indigo-500/80'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="ttsProvider"
                checked={selectedProvider === 'gemini_tts'}
                onChange={() => setSelectedProvider('gemini_tts')}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="space-y-1">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('geminiTtsOptionTitle')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t('geminiTtsOptionDesc')}
                </p>
              </div>
            </div>

            <div
              onClick={() => setSelectedProvider('browser_tts')}
              className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
                selectedProvider === 'browser_tts'
                  ? 'bg-emerald-950/50 border-emerald-500/80'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="ttsProvider"
                checked={selectedProvider === 'browser_tts'}
                onChange={() => setSelectedProvider('browser_tts')}
                className="mt-0.5 accent-emerald-500"
              />
              <div className="space-y-1">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('browserTtsOptionTitle')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t('browserTtsOptionDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold block">
              {t('apiKeyInputLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (e.target.value.trim().length >= 16) {
                    setSelectedProvider('gemini_tts');
                  }
                }}
                placeholder={t('apiKeyPlaceholder')}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              {keyInput && (
                <button
                  type="button"
                  onClick={() => setKeyInput('')}
                  className="px-2.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  {t('clearKeyLabel')}
                </button>
              )}
            </div>
          </div>

          {/* Gemini Model Pickers & Engine Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                {t('geminiModelPickerLabel')}
              </label>
              <select
                data-testid="modal-text-model-select"
                value={selectedTextModel}
                onChange={(e) =>
                  setSelectedTextModel(e.target.value as GeminiTextModelId)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
              >
                {GEMINI_TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                {t('geminiTtsModelPickerLabel')}
              </label>
              {selectedProvider === 'gemini_tts' ? (
                <select
                  data-testid="modal-tts-model-select"
                  value={selectedTtsModel}
                  onChange={(e) =>
                    setSelectedTtsModel(e.target.value as GeminiTtsModelId)
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                >
                  {GEMINI_TTS_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} — {m.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-400">
                  window.speechSynthesis (Web Speech API)
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => void purgeAudioCache()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-800 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <Trash2 className="w-3 h-3" />
              <span>{t('clearCacheLabel')}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
              >
                {t('saveApiSettings')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
