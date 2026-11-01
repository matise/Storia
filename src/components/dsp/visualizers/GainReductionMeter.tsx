import React from 'react';

export interface GainReductionMeterProps {
  /** Real-time reduction in dB (typically negative or zero: e.g. -4.5 dB). Default: 0 */
  reductionDb?: number;
  /** Optional active DynamicsCompressorNode to poll reduction live */
  compressorNode?: DynamicsCompressorNode | null;
  /** Height in pixels (default: 16) */
  height?: number;
  /** Max meter scale in dB (default: 24, meaning 0 to -24 dB) */
  maxReductionDb?: number;
  testId?: string;
}

/**
 * Professional Studio Dynamics Gain Reduction (GR) Meter.
 * Displays real-time compressor attenuation with decay ballistics and tick markers.
 * Scale: 0 dB (idle / unattenuated) down to -24 dBFS.
 */
export const GainReductionMeter: React.FC<GainReductionMeterProps> = ({
  reductionDb: propReductionDb = 0,
  compressorNode,
  height = 16,
  maxReductionDb = 24,
  testId = 'gain-reduction-meter',
}) => {
  const [liveReduction, setLiveReduction] = React.useState<number>(0);
  const animFrameRef = React.useRef<number | null>(null);

  // Poll Web Audio compressorNode.reduction if available
  React.useEffect(() => {
    if (!compressorNode) {
      setLiveReduction(propReductionDb);
      return;
    }

    let isMounted = true;
    const poll = () => {
      if (!isMounted) return;
      try {
        // compressorNode.reduction is a float in dB (negative or zero)
        const val = compressorNode.reduction;
        if (typeof val === 'number' && Number.isFinite(val)) {
          setLiveReduction(val);
        }
      } catch {
        // Node might be disconnected or disposed
      }
      animFrameRef.current = requestAnimationFrame(poll);
    };

    animFrameRef.current = requestAnimationFrame(poll);
    return () => {
      isMounted = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [compressorNode, propReductionDb]);

  const effectiveDb = compressorNode ? liveReduction : propReductionDb;
  // Reduction is typically <= 0 (e.g. -6 dB means 6 dB of attenuation)
  const attenuationAmount = Math.max(0, Math.min(maxReductionDb, Math.abs(effectiveDb)));
  const fraction = attenuationAmount / maxReductionDb; // 0.0 to 1.0

  // Meter color shifts from emerald (gentle 1-4dB) to amber (4-10dB) to rose (>10dB)
  const meterColor =
    attenuationAmount > 10
      ? '#f43f5e' /* Rose */
      : attenuationAmount > 4
        ? '#f59e0b' /* Amber */
        : '#10b981'; /* Emerald */

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 select-none"
      title={`Gain Reduction: -${attenuationAmount.toFixed(1)} dB`}
    >
      <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0 w-5 text-right">
        GR
      </span>

      {/* Meter Bar Container (Right-to-Left Attenuation Bar) */}
      <div
        className="relative flex-1 bg-slate-950 border border-slate-800 rounded overflow-hidden flex items-center justify-end"
        style={{ height }}
      >
        {/* Tick Mark Guides: 0, -3, -6, -12, -18, -24 */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-1 z-10 opacity-30">
          <div className="w-px h-full bg-slate-600" />
          <div className="w-px h-full bg-slate-600" />
          <div className="w-px h-full bg-slate-600" />
          <div className="w-px h-full bg-slate-600" />
          <div className="w-px h-full bg-slate-600" />
        </div>

        {/* Attenuation Fill Bar (shrinks inward from right to left) */}
        <div
          data-testid="gr-meter-fill"
          className="h-full transition-all duration-75 rounded-l"
          style={{
            width: `${Math.round(fraction * 100)}%`,
            backgroundColor: meterColor,
            boxShadow: fraction > 0.05 ? `0 0 6px ${meterColor}80` : 'none',
          }}
        />
      </div>

      {/* Numeric Readout */}
      <span className="text-[10px] font-mono tabular-nums text-slate-300 shrink-0 w-12 text-right">
        {attenuationAmount > 0.1 ? `-${attenuationAmount.toFixed(1)}` : '0.0'} dB
      </span>
    </div>
  );
};

