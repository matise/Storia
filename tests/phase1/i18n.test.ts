import { describe, expect, it } from 'vitest';
import { DICTIONARY } from '../../src/i18n/dictionary';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 1 — Bilingual Dictionary & Store Persistence', () => {
  it('maintains 100% key parity and non-empty strings between English (en) and Croatian (hr)', () => {
    const enKeys = Object.keys(DICTIONARY.en).sort();
    const hrKeys = Object.keys(DICTIONARY.hr).sort();

    expect(enKeys).toEqual(hrKeys);

    for (const key of enKeys) {
      const k = key as keyof typeof DICTIONARY.en;
      expect(typeof DICTIONARY.en[k]).toBe('string');
      expect(DICTIONARY.en[k].trim().length).toBeGreaterThan(0);
      expect(typeof DICTIONARY.hr[k]).toBe('string');
      expect(DICTIONARY.hr[k].trim().length).toBeGreaterThan(0);
    }
  });

  it('switches UI language and performs undoable block mutations through useStoriaStore', () => {
    const store = useStoriaStore.getState();
    store.resetToSampleProject();

    expect(useStoriaStore.getState().appSettings.uiLanguage).toBe('en');
    store.setUiLanguage('hr');
    expect(useStoriaStore.getState().appSettings.uiLanguage).toBe('hr');

    const initialLen = useStoriaStore.getState().project.blocks.length;
    const newId = useStoriaStore.getState().addBlock('dialogue', undefined, {
      text: 'Testna replika u trgovini stanja.',
    });

    expect(useStoriaStore.getState().project.blocks.length).toBe(initialLen + 1);
    expect(useStoriaStore.getState().selectedBlockId).toBe(newId);
    expect(useStoriaStore.getState().undoCount).toBe(1);

    useStoriaStore.getState().undo();
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialLen);
    expect(useStoriaStore.getState().redoCount).toBe(1);

    useStoriaStore.getState().redo();
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialLen + 1);
  });
});

