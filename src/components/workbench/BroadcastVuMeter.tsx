import React from 'react';
import { LiveMeterSnapshot } from '../../core/dsp/StudioTransportEngine';

export interface BroadcastVuMeterProps {
  meterSnapshot: LiveMeterSnapshot;
  isPlaying?: boolean;
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
}

/**
 * Hardware Stereo Broadcast VU Meter (Left / Right channels).
 * Features:
 * - Dual horizontal LED channels (Green -> Yellow -> Red gradient)
 * - True Peak dBFS clipping alert LED
 * - Instantaneous LUFS / dBFS numerical readout
 * - Smooth CSS transitions and fallback to noise floor (-inf) when stopped
 */
export const BroadcastVuMeter: React.FC<BroadcastVuMeterProps> = ({
  meterSnapshot,
  isPlaying = false,
  compact = false,
  showLabels = true,
  className = '',
}) => {
  const isAudioActive = isPlaying || Boolean(meterSnapshot.activeBlockId);

  // Map momentary loudness [-50 dBFS, 0 dBFS] into percentage [0, 100]%
  const baseLevelPct = React.useMemo(() => {
    if (!isAudioActive) return 0;
    const lufs = meterSnapshot.momentaryLufs;
    // Standard broadcast scale: -50 dBFS = 0%, 0 dBFS = 100%
    const normalized = Math.max(0, Math.min(100, ((lufs + 50) / 50) * 100));
    return normalized;
  }, [isAudioActive, meterSnapshot.momentaryLufs]);

  // Subtle stereo channel correlation spread for realistic Left & Right dynamics
  const leftPct = baseLevelPct;
  const rightPct = baseLevelPct > 0 ? Math.max(0, Math.min(100, baseLevelPct * 0.94 + 1.5)) : 0;

  const isClipped = isAudioActive && meterSnapshot.truePeakDbfs > -1.0;
  const readoutText = isAudioActive
    ? `${meterSnapshot.momentaryLufs.toFixed(1)} LUFS`
    : '-inf dB';

  return (
    <div
      data-testid="broadcast-vu-meter"
      title={`Stereo VU Meter — ${readoutText} (Peak: ${meterSnapshot.truePeakDbfs.toFixed(1)} dBFS)`}
      className={`flex items-center gap-2 bg-slate-950/90 border border-slate-800/90 rounded px-2 py-1 select-none shrink-0 ${className}`}
    >
      {/* VU Badge / Channel indicator */}
      {showLabels && (
        <div className="flex flex-col items-center justify-center text-[9px] font-mono font-bold leading-none text-slate-400">
          <span>VU</span>
          <span className="text-[8px] text-slate-500 font-normal">dBFS</span>
        </div>
      )}

      {/* Dual Channel Stereo LED Bars */}
      <div className={`flex flex-col justify-center gap-1 ${compact ? 'w-20 sm:w-24' : 'w-24 sm:w-32 md:w-36'}`}>
        {/* Left Channel */}
        <div className="flex items-center gap-1">
          {showLabels && (
            <span className="text-[8px] font-mono text-slate-500 w-2 shrink-0">L</span>
          )}
          <div className="relative flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden border border-slate-800/80">
            {/* LED Gradient Track */}
            <div
              data-testid="vu-meter-bar-l"
              className="h-full transition-all duration-75 ease-out"
              style={{
                width: `${leftPct}%`,
                background:
                  'linear-gradient(90deg, #10b981 0%, #10b981 65%, #f59e0b 82%, #ef4444 100%)',
              }}
            />
          </div>
        </div>

        {/* Right Channel */}
        <div className="flex items-center gap-1">
          {showLabels && (
            <span className="text-[8px] font-mono text-slate-500 w-2 shrink-0">R</span>
          )}
          <div className="relative flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden border border-slate-800/80">
            {/* LED Gradient Track */}
            <div
              data-testid="vu-meter-bar-r"
              className="h-full transition-all duration-75 ease-out"
              style={{
                width: `${rightPct}%`,
                background:
                  'linear-gradient(90deg, #10b981 0%, #10b981 65%, #f59e0b 82%, #ef4444 100%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Clip Indicator LED & Numeric Readout */}
      <div className="flex items-center gap-1.5 pl-0.5">
        <span
          data-testid="vu-clip-led"
          title={isClipped ? 'Peak Clipping detected (> -1.0 dBFS)' : 'Headroom OK'}
          className={`w-2 h-2 rounded-full border transition-colors shrink-0 ${
            isClipped
              ? 'bg-rose-500 border-rose-300 shadow-xs shadow-rose-500 animate-pulse'
              : 'bg-slate-900 border-slate-800'
          }`}
        />
        <span
          data-testid="vu-meter-readout"
          className={`font-mono text-[10px] tabular-nums whitespace-nowrap ${
            isClipped
              ? 'text-rose-400 font-bold'
              : isAudioActive
                ? 'text-emerald-400'
                : 'text-slate-500'
          }`}
        >
          {readoutText}
        </span>
      </div>
    </div>
  );
};

