/**
 * Normalizes hex or rgb string into 8-bit RGB components.
 */
export function parseColorToRgb(colorStr: string): { r: number; g: number; b: number } {
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    }
  }
  return { r: 99, g: 102, b: 241 }; // Default indigo-500
}

/**
 * Computes perceived luminance Y according to ITU-R BT.601 standard:
 * Y = 0.299*R + 0.587*G + 0.114*B (normalized 0.0 to 1.0)
 */
export function computePerceivedLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface BlockThemeStyle {
  background: string;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  boxShadow: string;
}

/**
 * Generates an adaptive, dark-studio CSS background and border styling for a ScriptBlock.
 * Features:
 * - Grayscale-normalized bright top specular sheen layered over a darkened accent hue.
 * - Directional subtle gradient (115deg) bleeding the accent color softly from the speaker indicator edge.
 * - Crisp left-accent track identifier border matching DAW studio workflows.
 * - Reactive state highlights for selection and active playhead audition.
 */
export function generateBlockThemeStyle(
  accentHex: string,
  isSelected: boolean,
  isPlaying: boolean,
  isHovered = false
): BlockThemeStyle {
  const { r, g, b } = parseColorToRgb(accentHex);
  const luma = computePerceivedLuminance(r, g, b);

  // Grayscale-normalized bright factor:
  // Balances high-luminance colors (like amber/yellow) and deep colors (like indigo/violet)
  // so that neither washes out nor becomes invisible in dark mode.
  const lumaNorm = Math.max(0.65, Math.min(1.35, 0.75 + (1 - luma) * 0.4));

  // Darkened accent base opacities
  const boost = isPlaying ? 0.06 : isSelected ? 0.04 : isHovered ? 0.02 : 0;
  const opacityStart = (0.13 + boost) * lumaNorm;
  const opacityMid = (0.045 + boost * 0.5) * lumaNorm;

  // Specular top luminance sheen (grayscale normalized bright)
  const topSheenAlpha = Number((0.025 * lumaNorm).toFixed(3));
  const topSheen = `linear-gradient(180deg, rgba(255, 255, 255, ${topSheenAlpha}) 0%, rgba(255, 255, 255, 0) 50%)`;

  // Subtle directional accent wash (from speaker dot left-to-right)
  const accentGradient = `linear-gradient(115deg, rgba(${r}, ${g}, ${b}, ${opacityStart.toFixed(3)}) 0%, rgba(${r}, ${g}, ${b}, ${opacityMid.toFixed(3)}) 38%, rgba(11, 16, 29, 0.94) 100%)`;

  const background = `${topSheen}, ${accentGradient}`;

  // Left accent line: always prominently displays the speaker/sfx color
  const borderLeftColor = accentHex;

  // Rest of border:
  let borderColor: string;
  let boxShadow: string;

  if (isPlaying) {
    borderColor = 'rgba(16, 185, 129, 0.75)'; // Emerald-500 playhead highlight
    boxShadow = `0 0 10px rgba(16, 185, 129, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06)`;
  } else if (isSelected) {
    borderColor = `rgba(${r}, ${g}, ${b}, 0.65)`;
    boxShadow = `0 0 10px rgba(${r}, ${g}, ${b}, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)`;
  } else if (isHovered) {
    borderColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
    boxShadow = `0 0 6px rgba(${r}, ${g}, ${b}, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.03)`;
  } else {
    borderColor = `rgba(${r}, ${g}, ${b}, 0.20)`;
    boxShadow = `inset 0 1px 0 rgba(255, 255, 255, 0.03)`;
  }

  return {
    background,
    borderTopColor: borderColor,
    borderRightColor: borderColor,
    borderBottomColor: borderColor,
    borderLeftColor,
    boxShadow,
  };
}
