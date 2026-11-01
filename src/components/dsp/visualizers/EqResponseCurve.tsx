import React from 'react';

export interface EqResponseCurveProps {
  lowShelfFreqHz?: number;
  lowShelfGainDb?: number;
  midPeakFreqHz?: number;
  midPeakGainDb?: number;
  midPeakQ?: number;
  highShelfFreqHz?: number;
  highShelfGainDb?: number;
  height?: number; // default: 72px
  maxDb?: number; // default: 12 dB (+/- 12dB range)
  testId?: string;
  enabled?: boolean;
}

/**
 * Calculates theoretical biquad filter magnitude response in dB at a given frequency f (Hz).
 */
function evaluateBiquadGainDb(
  f: number,
  lowFreq: number,
  lowGain: number,
  midFreq: number,
  midGain: number,
  midQ: number,
  highFreq: number,
  highGain: number
): number {
  let totalDb = 0;

  // 1. Low Shelf approximation: 2nd-order shelf response
  if (Math.abs(lowGain) > 0.05) {
    const ratio = f / Math.max(20, lowFreq);
    // Smooth transition around cutoff: 1 / (1 + ratio^2)
    const factor = 1 / (1 + Math.pow(ratio, 2));
    totalDb += lowGain * factor;
  }

  // 2. Mid Peak approximation: bell curve parameterized by center freq and Q
  if (Math.abs(midGain) > 0.05) {
    const qClamped = Math.max(0.1, midQ);
    const logRatio = Math.log2(f / Math.max(40, midFreq));
    const bandwidth = 1 / qClamped;
    const bell = Math.exp(-Math.pow(logRatio / bandwidth, 2) * 1.386);
    totalDb += midGain * bell;
  }

  // 3. High Shelf approximation: 2nd-order shelf response
  if (Math.abs(highGain) > 0.05) {
    const ratio = f / Math.max(100, highFreq);
    // Smooth high shelf transition: ratio^2 / (1 + ratio^2)
    const factor = Math.pow(ratio, 2) / (1 + Math.pow(ratio, 2));
    totalDb += highGain * factor;
  }

  return totalDb;
}

/**
 * High-precision 2D Canvas frequency response plot (20Hz - 20kHz).
 * Displays composite parametric EQ transfer curves with grid lines and filter center markers.
 */
export const EqResponseCurve: React.FC<EqResponseCurveProps> = ({
  lowShelfFreqHz = 120,
  lowShelfGainDb = 0,
  midPeakFreqHz = 2500,
  midPeakGainDb = 0,
  midPeakQ = 1.0,
  highShelfFreqHz = 8000,
  highShelfGainDb = 0,
  height = 72,
  maxDb = 12,
  testId = 'eq-response-curve',
  enabled = true,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent.toLowerCase().includes('jsdom')
    ) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 280;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    const freqToX = (f: number) => {
      const logF = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
      return ((logF - logMin) / logRange) * width;
    };

    const gainToY = (gDb: number) => {
      const midY = height / 2;
      const clampedGain = Math.max(-maxDb, Math.min(maxDb, gDb));
      return midY - (clampedGain / maxDb) * (height / 2 - 4);
    };

    // 1. Grid lines (Frequencies: 100Hz, 1kHz, 10kHz)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    for (const gf of gridFreqs) {
      const gx = freqToX(gf);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }

    // 2. Center 0dB line & +/-6dB guidelines
    const zeroY = gainToY(0);
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, gainToY(6));
    ctx.lineTo(width, gainToY(6));
    ctx.moveTo(0, gainToY(-6));
    ctx.lineTo(width, gainToY(-6));
    ctx.stroke();

    // 3. Compute response curve points
    const points: { x: number; y: number }[] = [];
    const stepCount = Math.max(64, Math.round(width / 3));

    for (let i = 0; i <= stepCount; i++) {
      const t = i / stepCount;
      const f = Math.pow(10, logMin + t * logRange);
      const db = enabled
        ? evaluateBiquadGainDb(
            f,
            lowShelfFreqHz,
            lowShelfGainDb,
            midPeakFreqHz,
            midPeakGainDb,
            midPeakQ,
            highShelfFreqHz,
            highShelfGainDb
          )
        : 0.0;
      points.push({ x: t * width, y: gainToY(db) });
    }

    // 4. Fill gradient area below the curve
    if (points.length > 0 && enabled) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(99, 102, 241, 0.25)'); // Indigo
      grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.08)');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, zeroY);
      for (const pt of points) {
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.lineTo(points[points.length - 1].x, zeroY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 5. Draw the curve outline
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = enabled ? '#818cf8' : '#64748b';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 6. Draw center frequency dot markers
    if (enabled) {
      const drawMarker = (freq: number, gain: number, color: string) => {
        const mx = freqToX(freq);
        const my = gainToY(gain);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      if (Math.abs(lowShelfGainDb) > 0.05) {
        drawMarker(lowShelfFreqHz, lowShelfGainDb, '#6366f1');
      }
      if (Math.abs(midPeakGainDb) > 0.05) {
        drawMarker(midPeakFreqHz, midPeakGainDb, '#a855f7');
      }
      if (Math.abs(highShelfGainDb) > 0.05) {
        drawMarker(highShelfFreqHz, highShelfGainDb, '#06b6d4');
      }
    }

    ctx.restore();
  }, [
    lowShelfFreqHz,
    lowShelfGainDb,
    midPeakFreqHz,
    midPeakGainDb,
    midPeakQ,
    highShelfFreqHz,
    highShelfGainDb,
    height,
    maxDb,
    enabled,
  ]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div
      data-testid={testId}
      className="relative rounded bg-slate-950 border border-slate-800/90 overflow-hidden select-none"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="block"
      />
      {/* Frequency axis labels */}
      <div className="absolute bottom-0.5 inset-x-2 flex justify-between pointer-events-none text-[8px] font-mono text-slate-500">
        <span>20Hz</span>
        <span>100Hz</span>
        <span>1kHz</span>
        <span>10kHz</span>
        <span>20kHz</span>
      </div>
    </div>
  );
};

