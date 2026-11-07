import { describe, expect, it } from 'vitest';
import { GEMINI_BASE_VOICES } from '../../src/types/storia';

describe('Gemini Base Voices Catalog Verification', () => {
  const ALLOWED_GEMINI_VOICES = [
    'achernar',
    'achird',
    'algenib',
    'algieba',
    'alnilam',
    'aoede',
    'autonoe',
    'callirrhoe',
    'charon',
    'despina',
    'enceladus',
    'erinome',
    'fenrir',
    'gacrux',
    'iapetus',
    'kore',
    'laomedeia',
    'leda',
    'orus',
    'puck',
    'pulcherrima',
    'rasalgethi',
    'sadachbia',
    'sadaltager',
    'schedar',
    'sulafat',
    'umbriel',
    'vindemiatrix',
    'zephyr',
    'zubenelgenubi',
  ];

  it('contains exactly the 30 allowed Gemini API voice names', () => {
    expect(GEMINI_BASE_VOICES.length).toBe(30);

    // Verify all allowed voices exist in GEMINI_BASE_VOICES
    for (const allowed of ALLOWED_GEMINI_VOICES) {
      const found = GEMINI_BASE_VOICES.some(
        (v) => v.toLowerCase() === allowed.toLowerCase()
      );
      expect(found, `Voice "${allowed}" should be in GEMINI_BASE_VOICES`).toBe(true);
    }
  });

  it('does not contain unsupported voice names like Orpheus or Helios', () => {
    expect(
      GEMINI_BASE_VOICES.some((v) => v.toLowerCase() === 'orpheus')
    ).toBe(false);
    expect(
      GEMINI_BASE_VOICES.some((v) => v.toLowerCase() === 'helios')
    ).toBe(false);
  });
});

