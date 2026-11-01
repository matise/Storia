import { describe, expect, it } from 'vitest';
import {
  buildAcousticDirective,
  buildSsmlPayload,
  extractDirectorNotes,
} from '../../src/services/geminiTtsService';
import {
  localizeDirectorCueForLanguage,
  normalizeCroatianUnicode,
  prepareTextForTts,
  restoreCroatianDiacritics,
} from '../../src/core/tts/croatianTextNormalizer';
import { createNoirSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 2 — Invisible Acoustic Directives, Didaskalije Parser & SSML Builder', () => {
  const project = createNoirSampleProject();
  const marko = project.speakers.find((s) => s.id === 'spk_marko')!;
  const ana = project.speakers.find((s) => s.id === 'spk_ana')!;

  it('extracts both block-level directorNotes and inline bracketed [...] cues without duplicates', () => {
    const cues = extractDirectorNotes({
      directorNotes: 'šapatom / whispered',
      text: '[kratak uzdah / short sigh] Ugasi svjetlo. [šapatom / whispered] Netko nas gleda.',
    });

    expect(cues).toEqual(['šapatom / whispered', 'kratak uzdah / short sigh']);
  });

  it('builds system acousticDirective including Croatian/English language, persona, acting notes, and multi-speaker handoff context', () => {
    const block1 = project.blocks[0];
    const block2 = project.blocks[1];

    const directiveHr = buildAcousticDirective({
      block: block2,
      speaker: ana,
      language: 'hr',
      precedingBlocks: [block1],
      allSpeakers: project.speakers,
    });

    expect(directiveHr).toContain('Language: Croatian (hr-HR).');
    expect(directiveHr).toContain('Character: Ana, Age: 28, Gender: female.');
    expect(directiveHr).toContain(ana.personaPrompt);
    expect(directiveHr).toContain(ana.actingNotes);
    expect(directiveHr).toContain('Immediate direction: [nervozno / anxious].');
    expect(directiveHr).toContain('Conversational handoff context');
    expect(directiveHr).toContain('Marko: "Ugasi svjetlo.');
  });

  it('builds valid SSML with <prosody>, start/end <mark>, word-level <mark name="blk_{id}_w_{idx}"/>, and <break>', () => {
    const block = project.blocks[0]; // Marko, pauseAfterMs: 450
    const ssml = buildSsmlPayload(block, marko);

    expect(ssml.startsWith('<speak>')).toBe(true);
    expect(ssml.endsWith('</speak>')).toBe(true);
    expect(ssml).toContain('<prosody rate="0.95" pitch="-2st">');
    expect(ssml).toContain('(šapatom / whispered)');
    expect(ssml).toContain(`<mark name="start_${block.id}"/>`);
    expect(ssml).toContain(`<mark name="blk_${block.id}_w_0"/>Ugasi`);
    expect(ssml).toContain(`<mark name="blk_${block.id}_w_1"/>svjetlo.`);
    expect(ssml).toContain(`<mark name="end_${block.id}"/>`);
    expect(ssml).toContain('<break time="450ms"/>');
  });

  it('normalizes Croatian Unicode combining marks, restores missing diacritics (č, ć, ž, š, đ), and expands Croatian TTS abbreviations', () => {
    // 1. Decomposed combining marks -> NFC precomposed Croatian characters
    const decomposed = 'c\u030C c\u0301 z\u030C s\u030C d\u0335';
    expect(normalizeCroatianUnicode(decomposed)).toBe('č ć ž š đ');

    // 2. Restore missing Croatian diacritics from ASCII input
    const asciiTyped =
      'Sto gledas? Covjek u nocnom tramvaju kaze da je kisa sve gusca izmedu kuca.';
    const restored = restoreCroatianDiacritics(asciiTyped);
    expect(restored).toBe(
      'Što gledaš? Čovjek u noćnom tramvaju kaže da je kiša sve gušća između kuća.'
    );

    // 3. Prepare text for TTS (expands Dr. -> doktor, npr. -> na primjer)
    const prepared = prepareTextForTts(
      'Dr. Klara i g. Kovac istrazuju sto se dogodilo, npr. u Knezevu dvoru.',
      'hr'
    );
    expect(prepared).toContain('doktor Klara');
    expect(prepared).toContain('Kovač');
    expect(prepared).toContain('što');
    expect(prepared).toContain('na primjer');
    expect(prepared).toContain('Kneževu');

    // 4. Localize bilingual director cue for Croatian TTS
    expect(localizeDirectorCueForLanguage('šapatom / whispered', 'hr')).toBe('šapatom');
    expect(localizeDirectorCueForLanguage('šapatom / whispered', 'en')).toBe('whispered');
  });
});

