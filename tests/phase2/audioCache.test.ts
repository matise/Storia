import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllAudioCache,
  computeBlockCacheKey,
  evaluateBlockCacheStatus,
} from '../../src/core/storage/audioCache';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 2 — Content-Addressed IndexedDB Audio Cache & Store Invalidation', () => {
  beforeEach(async () => {
    await clearAllAudioCache();
    useStoriaStore.getState().resetToSampleProject();
  });

  it('produces identical SHA-256 cache keys for identical inputs and invalidates on text, directorNotes, or voice mutation', async () => {
    const project = useStoriaStore.getState().project;
    const block = project.blocks[0];
    const marko = project.speakers.find((s) => s.id === block.speakerId)!;

    const key1 = await computeBlockCacheKey(block, marko, 'hr');
    const key2 = await computeBlockCacheKey({ ...block }, { ...marko }, 'hr');
    expect(key1).toBe(key2);

    // Mutate dialogue text -> cache key must change
    const keyTextChanged = await computeBlockCacheKey(
      { ...block, text: 'Izmijenjena replika.' },
      marko,
      'hr'
    );
    expect(keyTextChanged).not.toBe(key1);

    // Mutate directorNotes -> cache key must change
    const keyNotesChanged = await computeBlockCacheKey(
      { ...block, directorNotes: 'glasno / loudly' },
      marko,
      'hr'
    );
    expect(keyNotesChanged).not.toBe(key1);

    // Mutate speaker speakingRate -> cache key must change
    const keyVoiceChanged = await computeBlockCacheKey(
      block,
      {
        ...marko,
        voice: { ...marko.voice, speakingRate: 1.35 },
      },
      'hr'
    );
    expect(keyVoiceChanged).not.toBe(key1);
  });

  it('renders a block to cache, marks it stale on edit, and restores [TTS: OK] on Undo without re-synthesizing', async () => {
    const store = useStoriaStore.getState();

    // Synthesize Block #1 (blk_1)
    await store.synthesizeBlock('blk_1');

    const renderedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === 'blk_1')!;
    expect(renderedBlock.ttsStatus).toBe('ok');
    expect(renderedBlock.waveformPeaks).toBeDefined();
    expect(renderedBlock.waveformPeaks!.length).toBeGreaterThan(0);
    expect(renderedBlock.cacheKey).toBeDefined();

    // Verify evaluateBlockCacheStatus reports 'ok'
    const marko = useStoriaStore
      .getState()
      .project.speakers.find((s) => s.id === renderedBlock.speakerId);
    const checkOk = await evaluateBlockCacheStatus(renderedBlock, marko, 'hr');
    expect(checkOk.status).toBe('ok');
    expect(checkOk.cachedEntry).not.toBeNull();

    // Edit text of blk_1 -> status must immediately transition to 'stale'
    useStoriaStore.getState().updateBlock('blk_1', {
      text: 'Ugasi svjetlo odmah! Netko stoji na prozoru.',
    });

    const editedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === 'blk_1')!;
    expect(editedBlock.ttsStatus).toBe('stale');

    // Undo the text edit -> status must revert to 'ok' matching the cached entry
    useStoriaStore.getState().undo();
    await useStoriaStore.getState().syncCacheStatuses();

    const revertedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === 'blk_1')!;
    expect(revertedBlock.ttsStatus).toBe('ok');
    expect(revertedBlock.waveformPeaks).toBeDefined();
  });
});

