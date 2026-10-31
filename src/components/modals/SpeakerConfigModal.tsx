import React from 'react';
import { Headphones, Play, Sliders, Square, Trash2, X } from 'lucide-react';
import { GEMINI_BASE_VOICES, Gender, Speaker } from '../../types/storia';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getAvailableBrowserVoices,
  updateLiveDspIfPlaying,
} from '../../core/dsp/LiveAudioPreviewer';

export const SpeakerConfigModal: React.FC = () => {
  const { t } = useTranslation();
  const project = useStoriaStore((s) => s.project);
  const editingSpeakerId = useStoriaStore((s) => s.editingSpeakerId);
  const openSpeakerModal = useStoriaStore((s) => s.openSpeakerModal);
  const updateSpeaker = useStoriaStore((s) => s.updateSpeaker);
  const removeSpeaker = useStoriaStore((s) => s.removeSpeaker);
  const previewSpeakerVoice = useStoriaStore((s) => s.previewSpeakerVoice);
  const stopAudioPreview = useStoriaStore((s) => s.stopAudioPreview);
  const previewingSpeakerId = useStoriaStore((s) => s.previewingSpeakerId);

  const targetSpeaker = React.useMemo(
    () => project.speakers.find((s) => s.id === editingSpeakerId) ?? null,
    [project.speakers, editingSpeakerId]
  );

  const [draft, setDraft] = React.useState<Speaker | null>(null);
  const [samplePhrase, setSamplePhrase] = React.useState<string>('');
  const [browserVoices, setBrowserVoices] = React.useState<SpeechSynthesisVoice[]>([]);

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
    if (targetSpeaker) {
      setDraft(JSON.parse(JSON.stringify(targetSpeaker)) as Speaker);
      const existingLine = project.blocks.find(
        (b) => b.speakerId === targetSpeaker.id
      )?.text;
      setSamplePhrase(
        existingLine ||
          (project.defaultLanguage === 'hr'
            ? `Pozdrav, ja sam ${targetSpeaker.name}. Provjera glasa i Biquad ekvalizatora u studiju.`
            : `Hello, I am ${targetSpeaker.name}. Testing vocal timbre and Biquad EQ in the studio.`)
      );
    } else {
      setDraft(null);
    }
  }, [targetSpeaker, project.blocks, project.defaultLanguage]);

  if (!draft) return null;

  const isPreviewing = previewingSpeakerId === draft.id;

  const updateDraft = (next: Speaker) => {
    setDraft(next);
    updateLiveDspIfPlaying(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    stopAudioPreview();
    updateSpeaker(draft);
    openSpeakerModal(null);
  };

  const biquad = draft.voice.acoustics.biquadEq ?? {
    enabled: true,
    lowShelfGainDb: 0,
    midPeakGainDb: 0,
    highShelfGainDb: 0,
  };
  const eqEnabled = biquad.enabled ?? true;

  const comp = draft.voice.acoustics.compression ?? {
    enabled: true,
    thresholdDb: -20,
    ratio: 2.5,
    attackMs: 15,
    releaseMs: 100,
  };
  const compEnabled = comp.enabled ?? true;

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
                value={draft.voice.baseVoice}
                onChange={(e) =>
                  updateDraft({
                    ...draft,
                    voice: { ...draft.voice, baseVoice: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {GEMINI_BASE_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
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

          {/* Style Prompt, Persona Prompt & Acting Notes */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">{t('personaPrompt')}</label>
              <textarea
                rows={2}
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
                rows={2}
                value={draft.actingNotes}
                onChange={(e) =>
                  updateDraft({ ...draft, actingNotes: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Biquad 3-Band EQ & Dynamics Compressor Section with Master ON/OFF Toggles */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                <Sliders className="w-3.5 h-3.5" />
                <span>{t('dspEqSection')}</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eqEnabled}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          acoustics: {
                            ...draft.voice.acoustics,
                            biquadEq: {
                              ...biquad,
                              enabled: e.target.checked,
                            },
                          },
                        },
                      })
                    }
                    className="accent-indigo-500"
                  />
                  <span className="text-slate-200 font-medium">
                    {t('enableEqChain')}
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compEnabled}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        voice: {
                          ...draft.voice,
                          acoustics: {
                            ...draft.voice.acoustics,
                            compression: {
                              ...comp,
                              enabled: e.target.checked,
                            },
                          },
                        },
                      })
                    }
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-200 font-medium">
                    {t('enableDynamicsComp')}
                  </span>
                </label>
              </div>
            </div>

            {/* 3-Band Biquad EQ Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className={`p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 transition-opacity ${
                  eqEnabled ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{t('lowShelf120Hz')}</span>
                  <span className="font-mono text-slate-200">
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
                    updateDraft({
                      ...draft,
                      voice: {
                        ...draft.voice,
                        acoustics: {
                          ...draft.voice.acoustics,
                          biquadEq: {
                            ...biquad,
                            lowShelfGainDb: parseFloat(e.target.value),
                          },
                        },
                      },
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              <div
                className={`p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 transition-opacity ${
                  eqEnabled ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{t('midPeak2500Hz')}</span>
                  <span className="font-mono text-slate-200">
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
                    updateDraft({
                      ...draft,
                      voice: {
                        ...draft.voice,
                        acoustics: {
                          ...draft.voice.acoustics,
                          biquadEq: {
                            ...biquad,
                            midPeakGainDb: parseFloat(e.target.value),
                          },
                        },
                      },
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              <div
                className={`p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 transition-opacity ${
                  eqEnabled ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{t('highShelf8000Hz')}</span>
                  <span className="font-mono text-slate-200">
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
                    updateDraft({
                      ...draft,
                      voice: {
                        ...draft.voice,
                        acoustics: {
                          ...draft.voice.acoustics,
                          biquadEq: {
                            ...biquad,
                            highShelfGainDb: parseFloat(e.target.value),
                          },
                        },
                      },
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            {/* Dynamics Compressor Sliders */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${
                compEnabled ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{t('compressorThreshold')}</span>
                  <span className="font-mono text-slate-200">
                    {comp.thresholdDb} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-48}
                  max={0}
                  step={1}
                  disabled={!compEnabled}
                  value={comp.thresholdDb}
                  onChange={(e) =>
                    updateDraft({
                      ...draft,
                      voice: {
                        ...draft.voice,
                        acoustics: {
                          ...draft.voice.acoustics,
                          compression: {
                            ...comp,
                            thresholdDb: parseInt(e.target.value, 10),
                          },
                        },
                      },
                    })
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{t('compressorRatio')}</span>
                  <span className="font-mono text-slate-200">
                    {comp.ratio.toFixed(1)}:1
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={12.0}
                  step={0.5}
                  disabled={!compEnabled}
                  value={comp.ratio}
                  onChange={(e) =>
                    updateDraft({
                      ...draft,
                      voice: {
                        ...draft.voice,
                        acoustics: {
                          ...draft.voice.acoustics,
                          compression: {
                            ...comp,
                            ratio: parseFloat(e.target.value),
                          },
                        },
                      },
                    })
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          </div>

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
