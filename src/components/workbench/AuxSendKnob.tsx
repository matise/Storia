import React from 'react';

export interface AuxSendKnobProps {
  valueDb: number; // e.g. 0 (-Infinity or <= -48 is treated as -inf / off)
  onChange: (valueDb: number) => void;
  busName?: string;
  minDb?: number; // default -48
  maxDb?: number; // default +10
  size?: number; // diameter in pixels (default 26)
  label?: string;
  tooltip?: string;
  testId?: string;
  disabled?: boolean;
}

/**
 * Professional Studio Rotary Aux Send Knob with emerald green SVG arc indicator.
 * Routes audio signal from the script block / channel into the modular Aux DSP processing stack.
 *
 * Supports:
 * - Dragging up/right to increase, down/left to decrease.
 * - Double click to reset to 0.0 dB (unity send).
 * - Range: -inf (muted, <= minDb) to +10 dB.
 */
export const AuxSendKnob: React.FC<AuxSendKnobProps> = ({
  valueDb,
  onChange,
  busName = 'Main FX',
  minDb = -48,
  maxDb = 10,
  size = 26,
  label = 'Aux',
  tooltip,
  testId = 'aux-send-knob',
  disabled = false,
}) => {
  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startValRef = React.useRef(0);

  // Normalize value to a 0.0 - 1.0 fraction
  const isMuted = !Number.isFinite(valueDb) || valueDb <= minDb;
  const currentDbClamped = isMuted ? minDb : Math.min(maxDb, Math.max(minDb, valueDb));
  const fraction = isMuted ? 0 : (currentDbClamped - minDb) / (maxDb - minDb);

  // Knob angles: from -135deg (min) to +135deg (max), total 270deg rotation
  const minAngle = -135;
  const maxAngle = 135;
  const currentAngle = minAngle + fraction * (maxAngle - minAngle);

  // 0dB reference angle
  const zeroFraction = (0 - minDb) / (maxDb - minDb);
  const zeroAngle = minAngle + zeroFraction * (maxAngle - minAngle);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = isMuted ? minDb : currentDbClamped;

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore in test
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    e.stopPropagation();
    const deltaY = startYRef.current - e.clientY; // drag up = positive
    const sensitivity = 0.35; // dB per pixel
    const nextVal = startValRef.current + deltaY * sensitivity;

    if (nextVal <= minDb) {
      onChange(-Infinity);
    } else {
      const rounded = Math.round(Math.min(maxDb, nextVal) * 10) / 10;
      onChange(rounded);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      isDraggingRef.current = false;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    // Reset to 0.0 dB unity send on double-click
    onChange(0);
  };

  const formattedDisplay = isMuted
    ? '-∞'
    : valueDb > 0
      ? `+${valueDb.toFixed(1)}`
      : `${valueDb.toFixed(1)}`;

  // SVG dimensions
  const center = size / 2;
  const radius = size / 2 - 3;
  const strokeWidth = 2.2;

  // Polar to cartesian for SVG arc
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const bgArc = describeArc(center, center, radius, minAngle, maxAngle);
  const activeArc =
    currentAngle > minAngle ? describeArc(center, center, radius, minAngle, currentAngle) : '';

  // Pointer indicator tip
  const indicatorPos = polarToCartesian(center, center, radius - 1, currentAngle);

  return (
    <div
      data-testid={testId}
      title={
        tooltip ??
        `${label} (${busName}): ${formattedDisplay} dB (Drag to adjust, dbl-click to reset)`
      }
      className={`inline-flex flex-col items-center select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-ns-resize'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="overflow-visible">
          {/* Background track */}
          <path
            d={bgArc}
            fill="none"
            stroke="#13231e"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Unity 0dB tick mark */}
          {(() => {
            const tick = polarToCartesian(center, center, radius + 2, zeroAngle);
            return (
              <circle
                cx={tick.x}
                cy={tick.y}
                r={1}
                fill="#34d399"
                opacity={0.7}
              />
            );
          })()}

          {/* Active filled arc in Emerald */}
          {activeArc && (
            <path
              d={activeArc}
              fill="none"
              stroke={
                valueDb > 0
                  ? '#34d399' /* Light emerald for boost */
                  : '#10b981' /* Vivid emerald for standard send */
              }
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}

          {/* Inner knob cap */}
          <circle
            cx={center}
            cy={center}
            r={radius - 2.2}
            fill="#062117"
            stroke="#065f46"
            strokeWidth={0.8}
          />

          {/* Rotary pointer needle */}
          <line
            x1={center}
            y1={center}
            x2={indicatorPos.x}
            y2={indicatorPos.y}
            stroke="#6ee7b7"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-[9px] font-mono font-medium text-emerald-400 tabular-nums leading-none">
          {formattedDisplay}
        </span>
        <span className="text-[8px] font-mono text-emerald-600 leading-none">dB</span>
      </div>
    </div>
  );
};

