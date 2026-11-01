import React, { useEffect, useRef } from 'react';
import { DattorroReverbEffectConfig } from '../../../types/storia';

export interface ReverbDecayCurveProps {
  config: DattorroReverbEffectConfig;
  heightPx?: number;
  className?: string;
}

/**
 * Real-time Canvas 2D Visualizer for Dattorro Plate Reverb.
 * Plots pre-delay silence interval, initial reflection density, and exponential T60 energy decay envelope.
 */
export const ReverbDecayCurve: React.FC<ReverbDecayCurveProps> = ({
  config,
  heightPx = 64,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const decay = config.decay ?? 2.8;
  const preDelayMs = config.preDelay ?? 20;
  const dampingHz = config.damping ?? 4500;
  const mix = config.mix ?? 0.4;
  const isEnabled = config.enabled ?? true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 320;
    const height = heightPx;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (-6dB, -18dB, -36dB, -60dB)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const dbSteps = [0.25, 0.5, 0.75];
    for (const step of dbSteps) {
      const y = step * (height - 14) + 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!isEnabled) {
      // Bypassed flat indicator
      ctx.strokeStyle = '#64748b';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height - 8);
      ctx.lineTo(width, height - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('BYPASSED (DIRECT AUDIO SYNC)', 10, height / 2 + 3);
      return;
    }

    // Pre-delay zone calculation (e.g. up to 15% max width)
    const maxViewTimeMs = Math.max(3000, decay * 1000 * 1.2);
    const preDelayPx = Math.min(width * 0.25, (preDelayMs / maxViewTimeMs) * width);

    // Draw pre-delay shading
    if (preDelayPx > 2) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
      ctx.fillRect(0, 4, preDelayPx, height - 8);

      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(preDelayPx, 4);
      ctx.lineTo(preDelayPx, height - 4);
      ctx.stroke();
    }

    // Decay Envelope Plot
    const curveStartX = preDelayPx;
    const availableWidth = width - curveStartX;

    // Gradient fill under decay curve
    const gradient = ctx.createLinearGradient(curveStartX, 0, width, height);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
    gradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

    ctx.beginPath();
    ctx.moveTo(curveStartX, height - 6);

    // Initial onset point
    const peakY = 8;
    ctx.lineTo(curveStartX, peakY);

    // Exponential decay: e^(-t / tau)
    // T60 = 6.91 * tau -> tau = decay / 6.91
    const tau = decay / 6.91;
    const steps = 60;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const t = frac * (decay * 1.2);
      const amp = Math.exp(-t / tau);
      const x = curveStartX + frac * availableWidth;
      const y = peakY + (1 - amp) * (height - peakY - 8);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height - 6);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Reverb curve stroke
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curveStartX, peakY);
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const t = frac * (decay * 1.2);
      const amp = Math.exp(-t / tau);
      const x = curveStartX + frac * availableWidth;
      const y = peakY + (1 - amp) * (height - peakY - 8);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Damping indicator / HF rolloff contour
    const dampFrac = Math.min(1.0, Math.max(0.1, dampingHz / 15000));
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(curveStartX, peakY);
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const t = frac * (decay * 1.2);
      const amp = Math.exp(-t / (tau * (0.3 + 0.7 * dampFrac)));
      const x = curveStartX + frac * availableWidth;
      const y = peakY + (1 - amp) * (height - peakY - 8);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Parameter overlay readouts
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px monospace';
    const text = `T60: ${decay.toFixed(1)}s | Pre: ${Math.round(preDelayMs)}ms | Damp: ${Math.round(dampingHz)}Hz | Mix: ${Math.round(mix * 100)}%`;
    ctx.fillText(text, Math.max(6, preDelayPx + 6), height - 8);
  }, [decay, preDelayMs, dampingHz, mix, isEnabled, heightPx]);

  return (
    <div className={`relative w-full rounded-md overflow-hidden border border-slate-800 ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${heightPx}px` }}
        className="block"
      />
    </div>
  );
};

