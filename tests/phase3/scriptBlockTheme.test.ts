import { describe, expect, it } from 'vitest';
import {
  computePerceivedLuminance,
  generateBlockThemeStyle,
  parseColorToRgb,
} from '../../src/core/theme/scriptBlockTheme';

describe('Script Block Adaptive Theme & Color Blending Engine', () => {
  it('parses hex colors into accurate 8-bit RGB components', () => {
    expect(parseColorToRgb('#f97316')).toEqual({ r: 249, g: 115, b: 22 });
    expect(parseColorToRgb('#10b981')).toEqual({ r: 16, g: 185, b: 129 });
    expect(parseColorToRgb('#818cf8')).toEqual({ r: 129, g: 140, b: 248 });
    expect(parseColorToRgb('#f59e0b')).toEqual({ r: 245, g: 158, b: 11 });

    // 3-digit shorthand
    expect(parseColorToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });

    // Fallback for invalid hex
    expect(parseColorToRgb('invalid')).toEqual({ r: 99, g: 102, b: 241 });
  });

  it('computes ITU-R BT.601 perceived luminance accurately', () => {
    const blackLuma = computePerceivedLuminance(0, 0, 0);
    expect(blackLuma).toBe(0);

    const whiteLuma = computePerceivedLuminance(255, 255, 255);
    expect(whiteLuma).toBe(1);

    // Green contributes most to perceived brightness under BT.601 (0.587)
    const pureGreen = computePerceivedLuminance(0, 255, 0);
    const pureBlue = computePerceivedLuminance(0, 0, 255);
    expect(pureGreen).toBeGreaterThan(pureBlue);
  });

  it('generates specular sheen over darkened accent gradient with left track border', () => {
    const maraOrange = '#f97316';
    const style = generateBlockThemeStyle(maraOrange, false, false);

    expect(style.borderLeftColor).toBe(maraOrange);
    expect(style.background).toContain('linear-gradient(180deg');
    expect(style.background).toContain('linear-gradient(115deg');
    expect(style.background).toContain('rgba(249, 115, 22');
    expect(style.borderTopColor).toContain('rgba(249, 115, 22');
  });

  it('applies glowing emerald state when block is actively playing', () => {
    const foxyEmerald = '#10b981';
    const style = generateBlockThemeStyle(foxyEmerald, false, true);

    expect(style.borderLeftColor).toBe(foxyEmerald);
    expect(style.borderTopColor).toContain('rgba(16, 185, 129');
    expect(style.boxShadow).toContain('rgba(16, 185, 129');
  });

  it('illuminates speaker accent border and glow when block is selected', () => {
    const enaIndigo = '#818cf8';
    const style = generateBlockThemeStyle(enaIndigo, true, false);

    expect(style.borderLeftColor).toBe(enaIndigo);
    expect(style.borderTopColor).toContain('rgba(129, 140, 248');
    expect(style.boxShadow).toContain('rgba(129, 140, 248');
  });
});
