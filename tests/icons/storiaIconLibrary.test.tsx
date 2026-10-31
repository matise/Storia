import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  StoriaIcons,
  StoriaAppBrandIcon,
  StorybookIcon,
  AudioDramaWaveIcon,
  SpeakerPersonaIcon,
  MagicTtsSparkleIcon,
  SoundEffectFoleyIcon,
  MasterBroadcastDiskIcon,
  ScriptDoctorQuillIcon,
  BilingualGlobeBookIcon,
  STORIA_PALETTE,
} from '../../src/components/icons';

describe('Storia Custom SVG Icon Library', () => {
  it('exports all 9 unified icon components in the registry', () => {
    expect(StoriaIcons.Brand).toBe(StoriaAppBrandIcon);
    expect(StoriaIcons.Storybook).toBe(StorybookIcon);
    expect(StoriaIcons.AudioWave).toBe(AudioDramaWaveIcon);
    expect(StoriaIcons.Persona).toBe(SpeakerPersonaIcon);
    expect(StoriaIcons.MagicTts).toBe(MagicTtsSparkleIcon);
    expect(StoriaIcons.FoleySfx).toBe(SoundEffectFoleyIcon);
    expect(StoriaIcons.MasterExport).toBe(MasterBroadcastDiskIcon);
    expect(StoriaIcons.ScriptDoctor).toBe(ScriptDoctorQuillIcon);
    expect(StoriaIcons.Bilingual).toBe(BilingualGlobeBookIcon);
  });

  it('renders StoriaAppBrandIcon in both vibrant color and monochrome variants', () => {
    const { container: colorContainer } = render(
      <StoriaAppBrandIcon size={48} data-testid="storia-color-brand" />
    );
    const colorSvg = colorContainer.querySelector('svg');
    expect(colorSvg).toBeDefined();
    expect(colorSvg?.getAttribute('width')).toBe('48');
    expect(colorSvg?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(colorContainer.innerHTML).toContain(STORIA_PALETTE.saffron);

    const { container: monoContainer } = render(
      <StoriaAppBrandIcon size={32} variant="mono" className="text-white" />
    );
    const monoSvg = monoContainer.querySelector('svg');
    expect(monoSvg).toBeDefined();
    expect(monoSvg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('renders all domain-specific icons with customizable sizing', () => {
    const icons = [
      StorybookIcon,
      AudioDramaWaveIcon,
      SpeakerPersonaIcon,
      MagicTtsSparkleIcon,
      SoundEffectFoleyIcon,
      MasterBroadcastDiskIcon,
      ScriptDoctorQuillIcon,
      BilingualGlobeBookIcon,
    ];

    for (const Icon of icons) {
      const { container } = render(<Icon size={28} className="custom-icon-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('width')).toBe('28');
      expect(svg?.getAttribute('height')).toBe('28');
      expect(svg?.getAttribute('class')).toContain('custom-icon-class');
    }
  });
});

