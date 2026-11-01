import {
  AudioEffectConfig,
  BiquadEqEffectConfig,
  DynamicsEffectConfig,
  EffectModuleType,
  GainTrimEffectConfig,
  PassthroughEffectConfig,
  StateVariableFilterEffectConfig,
} from '../../../types/storia';

export type ParamControlWidget = 'knob' | 'slider' | 'toggle' | 'select' | 'stepper';
export type ParamScale = 'linear' | 'logarithmic' | 'decibel';

export interface EffectParamDescriptor {
  id: string; // e.g. 'lowShelfGainDb', 'thresholdDb', 'cutoffHz'
  label: string; // User-facing label
  widget: ParamControlWidget;
  min: number;
  max: number;
  step: number;
  defaultValue: number | boolean | string;
  unit: 'dB' | 'Hz' | 'ms' | 's' | '%' | 'ratio' | 'Q' | 'deg' | '';
  scale: ParamScale;
  formatDisplay?: (val: any) => string;
  group?: 'pre' | 'main' | 'post';
  options?: { label: string; value: string | number }[]; // For select widgets
}

export type VisualizerType =
  | 'gain_reduction_meter'
  | 'eq_response_curve'
  | 'stereo_vu_meter'
  | 'phase_correlation';

export interface EffectVisualizerDescriptor {
  id: string;
  type: VisualizerType;
  label: string;
  heightPx: number;
}

export interface EffectUIDescriptor {
  type: EffectModuleType;
  name: string;
  category: 'dynamics' | 'eq' | 'filter' | 'utility' | 'spatial';
  accentColor: string; // Hex color for UI branding
  iconName: string; // Lucide icon identifier
  description: string;
  params: EffectParamDescriptor[];
  visualizers?: EffectVisualizerDescriptor[];
}

export const BIQUAD_EQ_DESCRIPTOR: EffectUIDescriptor = {
  type: 'biquad_eq',
  name: '3-Band Biquad EQ',
  category: 'eq',
  accentColor: '#6366f1', // Indigo
  iconName: 'Sliders',
  description: 'Parametric 3-band vocal equalizer with Low Shelf, Mid Peak, and High Shelf filters.',
  visualizers: [
    {
      id: 'eq_curve',
      type: 'eq_response_curve',
      label: 'Frequency Response (20Hz - 20kHz)',
      heightPx: 72,
    },
  ],
  params: [
    {
      id: 'lowShelfFreqHz',
      label: 'Low Freq',
      widget: 'slider',
      min: 40,
      max: 500,
      step: 10,
      defaultValue: 120,
      unit: 'Hz',
      scale: 'logarithmic',
      formatDisplay: (v: number) => `${Math.round(v)} Hz`,
    },
    {
      id: 'lowShelfGainDb',
      label: 'Low Gain',
      widget: 'knob',
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      unit: 'dB',
      scale: 'decibel',
      formatDisplay: (v: number) => (v > 0 ? `+${v.toFixed(1)} dB` : `${v.toFixed(1)} dB`),
    },
    {
      id: 'midPeakFreqHz',
      label: 'Mid Freq',
      widget: 'slider',
      min: 200,
      max: 6000,
      step: 50,
      defaultValue: 2500,
      unit: 'Hz',
      scale: 'logarithmic',
      formatDisplay: (v: number) => `${Math.round(v)} Hz`,
    },
    {
      id: 'midPeakGainDb',
      label: 'Mid Gain',
      widget: 'knob',
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      unit: 'dB',
      scale: 'decibel',
      formatDisplay: (v: number) => (v > 0 ? `+${v.toFixed(1)} dB` : `${v.toFixed(1)} dB`),
    },
    {
      id: 'midPeakQ',
      label: 'Mid Q',
      widget: 'slider',
      min: 0.2,
      max: 6.0,
      step: 0.1,
      defaultValue: 1.0,
      unit: 'Q',
      scale: 'linear',
      formatDisplay: (v: number) => `${v.toFixed(2)} Q`,
    },
    {
      id: 'highShelfFreqHz',
      label: 'High Freq',
      widget: 'slider',
      min: 2000,
      max: 16000,
      step: 200,
      defaultValue: 8000,
      unit: 'Hz',
      scale: 'logarithmic',
      formatDisplay: (v: number) => `${Math.round(v)} Hz`,
    },
    {
      id: 'highShelfGainDb',
      label: 'High Gain',
      widget: 'knob',
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      unit: 'dB',
      scale: 'decibel',
      formatDisplay: (v: number) => (v > 0 ? `+${v.toFixed(1)} dB` : `${v.toFixed(1)} dB`),
    },
  ],
};

export const DYNAMICS_COMPRESSOR_DESCRIPTOR: EffectUIDescriptor = {
  type: 'dynamics_compressor',
  name: 'Studio Dynamics Compressor',
  category: 'dynamics',
  accentColor: '#10b981', // Emerald
  iconName: 'Activity',
  description: 'Feed-forward optical/VCA compressor with variable knee, attack, and release curves.',
  visualizers: [
    {
      id: 'gr_meter',
      type: 'gain_reduction_meter',
      label: 'Gain Reduction (dB)',
      heightPx: 18,
    },
  ],
  params: [
    {
      id: 'thresholdDb',
      label: 'Threshold',
      widget: 'knob',
      min: -60,
      max: 0,
      step: 1,
      defaultValue: -20,
      unit: 'dB',
      scale: 'decibel',
      formatDisplay: (v: number) => `${Math.round(v)} dB`,
    },
    {
      id: 'ratio',
      label: 'Ratio',
      widget: 'knob',
      min: 1.0,
      max: 20.0,
      step: 0.5,
      defaultValue: 2.5,
      unit: 'ratio',
      scale: 'linear',
      formatDisplay: (v: number) => `${v.toFixed(1)}:1`,
    },
    {
      id: 'attackMs',
      label: 'Attack',
      widget: 'slider',
      min: 0.5,
      max: 100,
      step: 0.5,
      defaultValue: 15,
      unit: 'ms',
      scale: 'logarithmic',
      formatDisplay: (v: number) => `${v.toFixed(1)} ms`,
    },
    {
      id: 'releaseMs',
      label: 'Release',
      widget: 'slider',
      min: 10,
      max: 1000,
      step: 10,
      defaultValue: 100,
      unit: 'ms',
      scale: 'logarithmic',
      formatDisplay: (v: number) => `${Math.round(v)} ms`,
    },
    {
      id: 'kneeDb',
      label: 'Knee',
      widget: 'slider',
      min: 0,
      max: 40,
      step: 1,
      defaultValue: 0,
      unit: 'dB',
      scale: 'linear',
      formatDisplay: (v: number) => `${Math.round(v)} dB`,
    },
  ],
};

export const STATE_VARIABLE_FILTER_DESCRIPTOR: EffectUIDescriptor = {
  type: 'state_variable_filter',
  name: 'State-Variable Filter',
  category: 'filter',
  accentColor: '#06b6d4', // Cyan
  iconName: 'Filter',
  description: 'Continuously tunable 2-pole state-variable filter (Lowpass, Highpass, Bandpass, Notch).',
  params: [
    {
      id: 'filterType',
      label: 'Type',
      widget: 'select',
      min: 0,
      max: 3,
      step: 1,
      defaultValue: 'lowpass',
      unit: '',
      scale: 'linear',
      options: [
        { label: 'Lowpass 12dB/oct', value: 'lowpass' },
        { label: 'Highpass 12dB/oct', value: 'highpass' },
        { label: 'Bandpass 6dB/oct', value: 'bandpass' },
        { label: 'Notch / Band Reject', value: 'notch' },
      ],
      formatDisplay: (v: string) => v.toUpperCase(),
    },
    {
      id: 'frequencyHz',
      label: 'Cutoff Freq',
      widget: 'slider',
      min: 40,
      max: 16000,
      step: 20,
      defaultValue: 1200,
      unit: 'Hz',
      scale: 'logarithmic',
      formatDisplay: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`),
    },
    {
      id: 'q',
      label: 'Resonance (Q)',
      widget: 'slider',
      min: 0.1,
      max: 10.0,
      step: 0.1,
      defaultValue: 1.0,
      unit: 'Q',
      scale: 'linear',
      formatDisplay: (v: number) => `${v.toFixed(2)} Q`,
    },
  ],
};

export const GAIN_TRIM_DESCRIPTOR: EffectUIDescriptor = {
  type: 'gain_trim',
  name: 'Gain Trim & Polarity',
  category: 'utility',
  accentColor: '#f59e0b', // Amber
  iconName: 'Volume2',
  description: 'Precision gain trim stage with 180° phase inversion for checking phase cancellation.',
  params: [
    {
      id: 'gainDb',
      label: 'Trim Gain',
      widget: 'slider',
      min: -24,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      unit: 'dB',
      scale: 'decibel',
      formatDisplay: (v: number) => (v > 0 ? `+${v.toFixed(1)} dB` : `${v.toFixed(1)} dB`),
    },
    {
      id: 'invertPolarity',
      label: 'Invert Polarity (180°)',
      widget: 'toggle',
      min: 0,
      max: 1,
      step: 1,
      defaultValue: false,
      unit: '',
      scale: 'linear',
      formatDisplay: (v: boolean) => (v ? 'INVERTED' : 'NORMAL'),
    },
  ],
};

export const PASSTHROUGH_DESCRIPTOR: EffectUIDescriptor = {
  type: 'passthrough',
  name: 'Direct Audio Sync (Passthrough)',
  category: 'utility',
  accentColor: '#94a3b8', // Slate
  iconName: 'ArrowRight',
  description: 'Bit-transparent direct audio sync node with zero latency and zero DSP coloration.',
  params: [],
};

export const EFFECT_DESCRIPTORS: Record<EffectModuleType, EffectUIDescriptor> = {
  biquad_eq: BIQUAD_EQ_DESCRIPTOR,
  dynamics_compressor: DYNAMICS_COMPRESSOR_DESCRIPTOR,
  state_variable_filter: STATE_VARIABLE_FILTER_DESCRIPTOR,
  gain_trim: GAIN_TRIM_DESCRIPTOR,
  passthrough: PASSTHROUGH_DESCRIPTOR,
};

export function getEffectDescriptor(type: EffectModuleType): EffectUIDescriptor | undefined {
  return EFFECT_DESCRIPTORS[type];
}

export function createDefaultEffectConfig(type: EffectModuleType, id?: string): AudioEffectConfig {
  const generatedId = id ?? `fx_${type}_${Date.now()}`;
  switch (type) {
    case 'biquad_eq':
      return {
        id: generatedId,
        name: '3-Band Biquad EQ',
        type: 'biquad_eq',
        enabled: true,
        lowShelfFreqHz: 120,
        lowShelfGainDb: 0,
        midPeakFreqHz: 2500,
        midPeakGainDb: 0,
        midPeakQ: 1.0,
        highShelfFreqHz: 8000,
        highShelfGainDb: 0,
      } as BiquadEqEffectConfig;

    case 'dynamics_compressor':
      return {
        id: generatedId,
        name: 'Studio Dynamics Compressor',
        type: 'dynamics_compressor',
        enabled: true,
        thresholdDb: -20,
        ratio: 2.5,
        attackMs: 15,
        releaseMs: 100,
        kneeDb: 0,
      } as DynamicsEffectConfig;

    case 'state_variable_filter':
      return {
        id: generatedId,
        name: 'State-Variable Filter',
        type: 'state_variable_filter',
        enabled: true,
        filterType: 'lowpass',
        frequencyHz: 1200,
        q: 1.0,
      } as StateVariableFilterEffectConfig;

    case 'gain_trim':
      return {
        id: generatedId,
        name: 'Gain Trim & Polarity',
        type: 'gain_trim',
        enabled: true,
        gainDb: 0,
        invertPolarity: false,
      } as GainTrimEffectConfig;

    case 'passthrough':
      return {
        id: generatedId,
        name: 'Passthrough',
        type: 'passthrough',
        enabled: true,
      } as PassthroughEffectConfig;
  }
}

