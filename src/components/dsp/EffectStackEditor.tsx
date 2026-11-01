import React from 'react';
import {
  Power,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Sliders,
  Activity,
  Filter,
  Volume2,
  ArrowRight,
} from 'lucide-react';
import { AudioEffectConfig, EffectModuleType } from '../../types/storia';
import {
  createDefaultEffectConfig,
  getEffectDescriptor,
} from '../../core/dsp/modular/EffectDescriptorRegistry';
import { EqResponseCurve } from './visualizers/EqResponseCurve';
import { GainReductionMeter } from './visualizers/GainReductionMeter';

export interface EffectStackEditorProps {
  modules: AudioEffectConfig[];
  onChangeModules: (modules: AudioEffectConfig[]) => void;
  onUpdateModuleConfig?: (moduleId: string, updates: Partial<AudioEffectConfig>) => void;
  onToggleModule?: (moduleId: string) => void;
  title?: string;
  allowReorder?: boolean;
  allowAddRemove?: boolean;
  testId?: string;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sliders,
  Activity,
  Filter,
  Volume2,
  ArrowRight,
};

/**
 * Universal Studio DSP Effect Stack Editor.
 * Renders reorderable effect modules, interactive parameter controls (knobs, sliders, toggles),
 * and real-time visualizers (EQ transfer curves, Dynamics Gain Reduction meters).
 */
export const EffectStackEditor: React.FC<EffectStackEditorProps> = ({
  modules,
  onChangeModules,
  onUpdateModuleConfig,
  onToggleModule,
  title,
  allowReorder = true,
  allowAddRemove = true,
  testId = 'effect-stack-editor',
}) => {
  const handleToggle = (moduleId: string) => {
    if (onToggleModule) {
      onToggleModule(moduleId);
      return;
    }
    const next = modules.map((m) =>
      m.id === moduleId ? { ...m, enabled: !m.enabled } : m
    );
    onChangeModules(next);
  };

  const handleUpdateParam = (
    moduleId: string,
    paramId: string,
    value: number | boolean | string
  ) => {
    if (onUpdateModuleConfig) {
      onUpdateModuleConfig(moduleId, { [paramId]: value });
      return;
    }
    const next = modules.map((m) =>
      m.id === moduleId ? { ...m, [paramId]: value } : m
    );
    onChangeModules(next);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const next = [...modules];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onChangeModules(next);
  };

  const handleRemove = (moduleId: string) => {
    const next = modules.filter((m) => m.id !== moduleId);
    onChangeModules(next);
  };

  const handleAddModule = (type: EffectModuleType) => {
    const newConfig = createDefaultEffectConfig(type);
    onChangeModules([...modules, newConfig]);
  };

  return (
    <div data-testid={testId} className="space-y-3.5 select-none text-xs">
      {/* Header & Flow Ribbon */}
      <div className="flex flex-col gap-2">
        {title && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 tracking-wide">
              {title}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {modules.length} {modules.length === 1 ? 'module' : 'modules'} in series
            </span>
          </div>
        )}

        {/* Signal Flow Strip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] font-mono overflow-x-auto scrollbar-none">
          <span className="text-slate-500 font-semibold uppercase">In</span>
          <span className="text-slate-600">➔</span>
          {modules.map((m, idx) => {
            const desc = getEffectDescriptor(m.type);
            return (
              <React.Fragment key={m.id}>
                <span
                  style={{ borderColor: m.enabled ? `${desc?.accentColor ?? '#6366f1'}80` : undefined }}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    m.enabled
                      ? 'bg-slate-900 text-slate-200 font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                  }`}
                >
                  {m.name}
                </span>
                {idx < modules.length - 1 && <span className="text-slate-600">➔</span>}
              </React.Fragment>
            );
          })}
          <span className="text-slate-600">➔</span>
          <span className="text-slate-400 font-semibold uppercase">Out</span>
        </div>
      </div>

      {/* Modules Stack */}
      <div className="space-y-2.5">
        {modules.map((mod, index) => {
          const desc = getEffectDescriptor(mod.type);
          const IconComp = desc ? ICON_MAP[desc.iconName] ?? Sliders : Sliders;
          const accentColor = desc?.accentColor ?? '#6366f1';

          return (
            <div
              key={mod.id}
              data-testid={`effect-module-${mod.id}`}
              className={`rounded-lg border transition-all overflow-hidden ${
                mod.enabled
                  ? 'bg-slate-900/90 border-slate-800 shadow-xs'
                  : 'bg-slate-950/40 border-slate-800/70 opacity-60'
              }`}
            >
              {/* Module Header Bar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: mod.enabled ? accentColor : '#64748b' }}
                  />
                  <IconComp className="w-3.5 h-3.5 text-slate-300" />
                  <span className="font-bold text-slate-100 text-xs">{mod.name}</span>
                  <span
                    style={{
                      color: accentColor,
                      borderColor: `${accentColor}50`,
                      backgroundColor: `${accentColor}15`,
                    }}
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold uppercase"
                  >
                    {desc?.category ?? mod.type}
                  </span>
                </div>

                {/* Module Action Controls */}
                <div className="flex items-center gap-1.5">
                  {allowReorder && (
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        title="Move module earlier in signal chain"
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === modules.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        title="Move module later in signal chain"
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Bypass / Direct Audio Sync Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(mod.id)}
                    title={mod.enabled ? 'Bypass effect (Direct Audio Sync)' : 'Activate effect'}
                    style={{
                      borderColor: mod.enabled ? `${accentColor}80` : undefined,
                      color: mod.enabled ? accentColor : undefined,
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                      mod.enabled
                        ? 'bg-slate-900'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{mod.enabled ? 'ACTIVE' : 'BYPASS'}</span>
                  </button>

                  {allowAddRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemove(mod.id)}
                      title="Remove module"
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Module Content Body */}
              <div className="p-3.5 space-y-3">
                {/* 1. Visualizers (if registered) */}
                {mod.type === 'biquad_eq' && (
                  <EqResponseCurve
                    lowShelfFreqHz={(mod as any).lowShelfFreqHz}
                    lowShelfGainDb={(mod as any).lowShelfGainDb}
                    midPeakFreqHz={(mod as any).midPeakFreqHz}
                    midPeakGainDb={(mod as any).midPeakGainDb}
                    midPeakQ={(mod as any).midPeakQ}
                    highShelfFreqHz={(mod as any).highShelfFreqHz}
                    highShelfGainDb={(mod as any).highShelfGainDb}
                    enabled={mod.enabled}
                    height={64}
                  />
                )}

                {mod.type === 'dynamics_compressor' && (
                  <GainReductionMeter height={16} />
                )}

                {/* 2. Interactive Parameter Controls Grid */}
                {desc && desc.params.length > 0 && (
                  <div
                    className={`grid gap-2.5 ${
                      desc.params.length <= 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : desc.params.length <= 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-1 sm:grid-cols-3'
                    }`}
                  >
                    {desc.params.map((param) => {
                      const curVal = (mod as any)[param.id] ?? param.defaultValue;

                      if (param.widget === 'toggle') {
                        const boolVal = Boolean(curVal);
                        return (
                          <div
                            key={param.id}
                            className="bg-slate-950 rounded border border-slate-800/80 p-2.5 flex items-center justify-between"
                          >
                            <span className="text-[11px] font-medium text-slate-300">
                              {param.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateParam(mod.id, param.id, !boolVal)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                boolVal
                                  ? 'bg-rose-950 border-rose-600 text-rose-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              {param.formatDisplay ? param.formatDisplay(boolVal) : boolVal ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        );
                      }

                      if (param.widget === 'select') {
                        return (
                          <div
                            key={param.id}
                            className="bg-slate-950 rounded border border-slate-800/80 p-2.5 space-y-1"
                          >
                            <label className="text-[11px] font-medium text-slate-400 block">
                              {param.label}
                            </label>
                            <select
                              value={String(curVal)}
                              onChange={(e) =>
                                handleUpdateParam(mod.id, param.id, e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              {param.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      // Standard Slider / Knob widget
                      const numVal = Number(curVal);
                      const displayStr = param.formatDisplay
                        ? param.formatDisplay(numVal)
                        : `${numVal} ${param.unit}`;

                      return (
                        <div
                          key={param.id}
                          className="bg-slate-950 rounded border border-slate-800/80 p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">{param.label}</span>
                            <span
                              style={{ color: accentColor }}
                              className="font-bold tabular-nums"
                            >
                              {displayStr}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={numVal}
                            disabled={!mod.enabled}
                            onChange={(e) =>
                              handleUpdateParam(
                                mod.id,
                                param.id,
                                parseFloat(e.target.value)
                              )
                            }
                            style={{ accentColor }}
                            className="w-full cursor-pointer disabled:opacity-40"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Module Bar */}
      {allowAddRemove && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Effect Module:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleAddModule('biquad_eq')}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-indigo-900/60 hover:border-indigo-600 text-xs font-medium text-indigo-300 transition-colors cursor-pointer"
            >
              + Biquad EQ
            </button>
            <button
              type="button"
              onClick={() => handleAddModule('dynamics_compressor')}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-900/60 hover:border-emerald-600 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
            >
              + Compressor
            </button>
            <button
              type="button"
              onClick={() => handleAddModule('state_variable_filter')}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-900/60 hover:border-cyan-600 text-xs font-medium text-cyan-300 transition-colors cursor-pointer"
            >
              + SVF Filter
            </button>
            <button
              type="button"
              onClick={() => handleAddModule('gain_trim')}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-900/60 hover:border-amber-600 text-xs font-medium text-amber-300 transition-colors cursor-pointer"
            >
              + Gain Trim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
