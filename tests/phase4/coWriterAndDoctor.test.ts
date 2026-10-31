import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  doctorDialogueBlock,
  generateNextSceneBeats,
} from '../../src/services/geminiAgentService';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 4.2 & 4.3: Co-Writer Structured Scene Generator & Script Doctor', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
  });

  it('parses structured JSON scene beats from Gemini and falls back gracefully on malformed payloads', async () => {
    const { project } = useStoriaStore.getState();

    const mockFetchValid = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    beats: [
                      {
                        id: 'custom_beat_1',
                        title: 'Tajni znak s prozora',
                        rationale: 'Povezuje Markovu sumnju s Aninom reakcijom.',
                        blocks: [
                          {
                            type: 'dialogue',
                            speakerId: 'spk_marko',
                            text: 'Pogledaj gore — netko je dvaput upalio šibicu.',
                            directorNotes: 'tiho / quietly',
                            pauseAfterMs: 400,
                          },
                          {
                            type: 'dialogue',
                            speakerId: 'spk_ana',
                            text: 'To je naš vezist. Moramo odmah dolje.',
                            directorNotes: 'hitno / urgently',
                            pauseAfterMs: 500,
                          },
                        ],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const beats = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: 'AIzaSyTestKey1234567890',
      modelId: 'gemini-3-flash-preview',
      fetchImpl: mockFetchValid as unknown as typeof fetch,
    });

    expect(beats).toHaveLength(1);
    expect(beats[0].title).toBe('Tajni znak s prozora');
    expect(beats[0].blocks).toHaveLength(2);
    expect(beats[0].blocks[0].speakerId).toBe('spk_marko');

    // Malformed payload fallback test
    const mockFetchMalformed = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{not_valid_json' }] } }],
      }),
    });

    const fallbackBeats = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: 'AIzaSyTestKey1234567890',
      fetchImpl: mockFetchMalformed as unknown as typeof fetch,
    });
    expect(fallbackBeats).toHaveLength(3);
    expect(fallbackBeats[0].blocks.length).toBeGreaterThan(0);
  });

  it('inserts Co-Writer scene beats and applies Script Doctor polish with full Undo/Redo support', async () => {
    const initialCount = useStoriaStore.getState().project.blocks.length;

    const beats = await generateNextSceneBeats({
      precedingBlocks: useStoriaStore.getState().project.blocks,
      speakers: useStoriaStore.getState().project.speakers,
      language: 'hr',
    });

    // Insert Beat #1 into script
    const insertedIds = useStoriaStore
      .getState()
      .insertSceneBeatBlocks(beats[0].blocks);
    expect(insertedIds.length).toBe(beats[0].blocks.length);
    expect(useStoriaStore.getState().project.blocks.length).toBe(
      initialCount + beats[0].blocks.length
    );

    // Undo each inserted block
    for (let i = 0; i < insertedIds.length; i++) {
      useStoriaStore.getState().undo();
    }
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialCount);

    // Redo one block
    useStoriaStore.getState().redo();
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialCount + 1);

    // Test Script Doctor polish + Undo/Redo
    const firstBlock = useStoriaStore.getState().project.blocks[0];
    const originalText = firstBlock.text;
    const speaker = useStoriaStore
      .getState()
      .project.speakers.find((s) => s.id === firstBlock.speakerId);

    const doctorOpts = await doctorDialogueBlock({
      block: firstBlock,
      speaker,
      language: 'hr',
    });
    expect(doctorOpts).toHaveLength(3);
    expect(doctorOpts[0].estimatedDurationSec).toBeGreaterThan(0);

    // Apply Option #2 (High Subtext)
    useStoriaStore.getState().updateBlock(firstBlock.id, {
      text: doctorOpts[1].text,
      directorNotes: doctorOpts[1].directorNotes,
    });
    expect(useStoriaStore.getState().project.blocks[0].text).toBe(doctorOpts[1].text);

    // Undo polish
    useStoriaStore.getState().undo();
    expect(useStoriaStore.getState().project.blocks[0].text).toBe(originalText);
  });
});

