import React from 'react';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Power,
  RotateCcw,
} from 'lucide-react';
import { useStoriaStore } from '../../store/useStoriaStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  AudioEffectConfig,
  BiquadEqEffectConfig,
  DynamicsEffectConfig,
  StateVariableFilterEffectConfig,
  GainTrimEffectConfig,
} from '../../types/storia';

export const AuxBusRackModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useStoriaStore((s) => s.isAuxBusModalOpen);
  const setOpen = useStoriaStore((s) => s.setAuxBusModalOpen);
  const project = useStoriaStore((s) => s.project);
  const toggleAuxBusModule = useStoriaStore((s) => s.toggleAuxBusModule);
  const setAuxBusReturnGainDb = useStoriaStore((s) => s.setAuxBusReturnGainDb);
  const updateAuxBusModuleConfig = useStoriaStore(
    (s) => s.updateAuxBusModuleConfig
  );
  const addAuxBusModule = useStoriaStore((s) => s.addAuxBusModule);
  const removeAuxBusModule = useStoriaStore((s) => s.removeAuxBusModule);

  if (!isOpen) return null;

  const mainBus =
    project.auxBusses?.find((b) => b.id === 'aux_bus_main') ?? {
      id: 'aux_bus_main',
      name: 'Main FX Bus',
      color: '#10b981',
      enabled: true,
      returnGainDb: 0.0,
      modules: [],
    };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddModule = (type: string) => {
    const id = `fx_${type}_${Date.now()}`;
    let newMod: AudioEffectConfig;
    if (type === 'filter') {
      newMod = {
        id,
        name: 'State-Variable Filter',
        type: 'state_variable_filter',
        enabled: true,
        filterType: 'lowpass',
        frequencyHz: 1200,
        q: 1.0,
      };
    } else if (type === 'gain') {
      newMod = {
        id,
        name: 'Gain Trim & Polarity',
        type: 'gain_trim',
        enabled: true,
        gainDb: 0.0,
        invertPolarity: false,
      };
    } else if (type === 'eq') {
      newMod = {
        id,
        name: 'Parametric EQ',
        type: 'biquad_eq',
        enabled: true,
        lowShelfFreqHz: 100,
        lowShelfGainDb: 0,
        midPeakFreqHz: 1000,
        midPeakGainDb: 0,
        midPeakQ: 1.0,
        highShelfFreqHz: 6000,
        highShelfGainDb: 0,
      };
    } else {
      newMod = {
        id,
        name: 'Bus Compressor',
        type: 'dynamics_compressor',
        enabled: true,
        thresholdDb: -16,
        ratio: 3.0,
        attackMs: 10,
        releaseMs: 120,
        kneeDb: 4,
      };
    }
    addAuxBusModule('aux_bus_main', newMod);
  };

  return (
    <div
      data-testid="aux-bus-rack-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-3xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-950/80 border border-emerald-600/50 text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{t('auxBusModalTitle')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 font-semibold">
                  {mainBus.name}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Modular zero-latency DSP effects chain routed via script block Aux Send knobs.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-aux-bus-modal"
            onClick={handleClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Signal Chain Flow & Effect Modules */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Signal Chain Flow Ribbon */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono overflow-x-auto">
            <span className="text-slate-500 uppercase tracking-wider font-semibold">Signal:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300">
              Aux Send
            </span>
            <span className="text-slate-600">➔</span>
            {mainBus.modules.map((m, idx) => (
              <React.Fragment key={m.id}>
                <span
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    m.enabled
                      ? 'bg-slate-800 border-indigo-500/60 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                  }`}
                >
                  {m.name}
                </span>
                {idx < mainBus.modules.length - 1 && (
                  <span className="text-slate-600">➔</span>
                )}
              </React.Fragment>
            ))}
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              Return Gain ({mainBus.returnGainDb > 0 ? `+${mainBus.returnGainDb}` : mainBus.returnGainDb} dB)
            </span>
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-bold">
              Master Output
            </span>
          </div>

          {/* Module Cards */}
          <div className="space-y-3">
            {mainBus.modules.map((mod) => {
              if (mod.type === 'biquad_eq') {
                const eq = mod as BiquadEqEffectConfig;
                return (
                  <div
                    key={eq.id}
                    data-testid={`aux-module-${eq.id}`}
                    className={`rounded-lg border p-3.5 transition-all ${
                      eq.enabled
                        ? 'bg-slate-950/80 border-indigo-800/60 shadow-xs'
                        : 'bg-slate-950/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="text-xs font-bold text-slate-200">
                          {eq.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                          Biquad EQ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAuxBusModule('aux_bus_main', eq.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                          eq.enabled
                            ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{eq.enabled ? 'ACTIVE' : 'BYPASS'}</span>
                      </button>
                    </div>

                    {/* 3-Band EQ Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Low Shelf */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Low Shelf ({eq.lowShelfFreqHz} Hz)</span>
                          <span className="text-indigo-400 font-bold">
                            {eq.lowShelfGainDb > 0 ? `+${eq.lowShelfGainDb}` : eq.lowShelfGainDb} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={eq.lowShelfGainDb}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', eq.id, {
                              ...eq,
                              lowShelfGainDb: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* Mid Peak */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Mid Peak ({eq.midPeakFreqHz} Hz)</span>
                          <span className="text-indigo-400 font-bold">
                            {eq.midPeakGainDb > 0 ? `+${eq.midPeakGainDb}` : eq.midPeakGainDb} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={eq.midPeakGainDb}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', eq.id, {
                              ...eq,
                              midPeakGainDb: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* High Shelf */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>High Shelf ({eq.highShelfFreqHz} Hz)</span>
                          <span className="text-indigo-400 font-bold">
                            {eq.highShelfGainDb > 0 ? `+${eq.highShelfGainDb}` : eq.highShelfGainDb} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={eq.highShelfGainDb}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', eq.id, {
                              ...eq,
                              highShelfGainDb: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (mod.type === 'dynamics_compressor') {
                const comp = mod as DynamicsEffectConfig;
                return (
                  <div
                    key={comp.id}
                    data-testid={`aux-module-${comp.id}`}
                    className={`rounded-lg border p-3.5 transition-all ${
                      comp.enabled
                        ? 'bg-slate-950/80 border-emerald-800/60 shadow-xs'
                        : 'bg-slate-950/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">
                          {comp.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                          Compressor
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAuxBusModule('aux_bus_main', comp.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                          comp.enabled
                            ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{comp.enabled ? 'ACTIVE' : 'BYPASS'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {/* Threshold */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Threshold</span>
                          <span className="text-emerald-400 font-bold">{comp.thresholdDb} dB</span>
                        </div>
                        <input
                          type="range"
                          min="-60"
                          max="0"
                          step="1"
                          value={comp.thresholdDb}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', comp.id, {
                              ...comp,
                              thresholdDb: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Ratio */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Ratio</span>
                          <span className="text-emerald-400 font-bold">{comp.ratio}:1</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="0.5"
                          value={comp.ratio}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', comp.id, {
                              ...comp,
                              ratio: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Attack */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Attack</span>
                          <span className="text-emerald-400 font-bold">{comp.attackMs} ms</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={comp.attackMs}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', comp.id, {
                              ...comp,
                              attackMs: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Release */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Release</span>
                          <span className="text-emerald-400 font-bold">{comp.releaseMs} ms</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="1000"
                          step="10"
                          value={comp.releaseMs}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', comp.id, {
                              ...comp,
                              releaseMs: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (mod.type === 'state_variable_filter') {
                const svf = mod as StateVariableFilterEffectConfig;
                return (
                  <div
                    key={svf.id}
                    data-testid={`aux-module-${svf.id}`}
                    className={`rounded-lg border p-3.5 transition-all ${
                      svf.enabled
                        ? 'bg-slate-950/80 border-cyan-800/60 shadow-xs'
                        : 'bg-slate-950/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-xs font-bold text-slate-200">{svf.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                          Filter
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAuxBusModule('aux_bus_main', svf.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                            svf.enabled
                              ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{svf.enabled ? 'ACTIVE' : 'BYPASS'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAuxBusModule('aux_bus_main', svf.id)}
                          title="Remove module"
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Filter Type */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1">
                        <label className="text-[11px] font-mono text-slate-400">Filter Type</label>
                        <select
                          value={svf.filterType}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', svf.id, {
                              ...svf,
                              filterType: e.target.value as any,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="lowpass">Lowpass</option>
                          <option value="highpass">Highpass</option>
                          <option value="bandpass">Bandpass</option>
                          <option value="notch">Notch</option>
                        </select>
                      </div>

                      {/* Cutoff Freq */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Cutoff</span>
                          <span className="text-cyan-400 font-bold">{svf.frequencyHz} Hz</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="12000"
                          step="50"
                          value={svf.frequencyHz}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', svf.id, {
                              ...svf,
                              frequencyHz: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>

                      {/* Resonance */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Resonance (Q)</span>
                          <span className="text-cyan-400 font-bold">{svf.q ?? 1.0}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="8.0"
                          step="0.1"
                          value={svf.q ?? 1.0}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', svf.id, {
                              ...svf,
                              q: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (mod.type === 'gain_trim') {
                const trim = mod as GainTrimEffectConfig;
                return (
                  <div
                    key={trim.id}
                    data-testid={`aux-module-${trim.id}`}
                    className={`rounded-lg border p-3.5 transition-all ${
                      trim.enabled
                        ? 'bg-slate-950/80 border-amber-800/60 shadow-xs'
                        : 'bg-slate-950/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-bold text-slate-200">{trim.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300">
                          Trim
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAuxBusModule('aux_bus_main', trim.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                            trim.enabled
                              ? 'bg-amber-950 border-amber-600 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{trim.enabled ? 'ACTIVE' : 'BYPASS'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAuxBusModule('aux_bus_main', trim.id)}
                          title="Remove module"
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Gain Trim Slider */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Gain Trim</span>
                          <span className="text-amber-400 font-bold">
                            {trim.gainDb > 0 ? `+${trim.gainDb}` : trim.gainDb} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-24"
                          max="12"
                          step="0.5"
                          value={trim.gainDb}
                          onChange={(e) =>
                            updateAuxBusModuleConfig('aux_bus_main', trim.id, {
                              ...trim,
                              gainDb: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      {/* Polarity Invert Toggle */}
                      <div className="bg-slate-900/90 rounded border border-slate-800 p-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono font-medium text-slate-300">
                            Polarity Invert (180°)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Flips audio phase (anti-phase cancellation)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateAuxBusModuleConfig('aux_bus_main', trim.id, {
                              ...trim,
                              invertPolarity: !trim.invertPolarity,
                            })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                            trim.invertPolarity
                              ? 'bg-rose-950 border-rose-600 text-rose-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {trim.invertPolarity ? 'INVERTED' : 'NORMAL'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Add Module Strip */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-xs font-semibold text-slate-400">
              {t('auxBusAddModuleLabel')}:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddModule('filter')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>State-Variable Filter</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddModule('gain')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Gain Trim & Polarity</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer: Master Return Gain Control & Close */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              {t('auxBusReturnGainLabel')}:
            </span>
            <input
              type="range"
              min="-24"
              max="6"
              step="0.5"
              value={mainBus.returnGainDb}
              onChange={(e) =>
                setAuxBusReturnGainDb('aux_bus_main', parseFloat(e.target.value))
              }
              className="w-36 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
              {mainBus.returnGainDb > 0
                ? `+${mainBus.returnGainDb.toFixed(1)}`
                : `${mainBus.returnGainDb.toFixed(1)}`}{' '}
              dB
            </span>
            <button
              type="button"
              onClick={() => setAuxBusReturnGainDb('aux_bus_main', 0.0)}
              title="Reset return to 0.0 dB unity"
              className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            data-testid="aux-bus-done-btn"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
