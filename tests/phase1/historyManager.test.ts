import { describe, expect, it } from 'vitest';
import { HistoryManager } from '../../src/core/history/Command';
import {
  AddBlockCommand,
  AddOrRemoveSpeakerCommand,
  DeleteBlockCommand,
  ProjectStateAccessor,
  ReorderBlocksCommand,
  UpdateBlockCommand,
  UpdateSpeakerCommand,
} from '../../src/core/history/commands/scriptCommands';
import { createNoirSampleProject } from '../../src/i18n/sampleProject';
import { Project, ScriptBlock } from '../../src/types/storia';

function createMemoryAccessor(initial?: Project): {
  accessor: ProjectStateAccessor;
  getState: () => Project;
} {
  let state: Project = initial ?? createNoirSampleProject();
  return {
    accessor: {
      getProject: () => state,
      setProject: (next: Project) => {
        state = next;
      },
    },
    getState: () => state,
  };
}

describe('Phase 1 — Command Pattern & HistoryManager (Undo / Redo)', () => {
  it('executes, undoes, and redoes AddBlockCommand, UpdateBlockCommand, ReorderBlocksCommand, and DeleteBlockCommand', () => {
    const { accessor, getState } = createMemoryAccessor();
    const history = new HistoryManager(100);
    const initialCount = getState().blocks.length;

    const newBlock: ScriptBlock = {
      id: 'blk_test_new',
      type: 'dialogue',
      speakerId: 'spk_marko',
      text: 'Nova replika u magli.',
      directorNotes: 'tiho',
      pauseAfterMs: 300,
      ttsStatus: 'unrendered',
      order: initialCount,
    };

    // 1. AddBlockCommand
    history.executeCommand(new AddBlockCommand(accessor, newBlock, 1));
    expect(getState().blocks.length).toBe(initialCount + 1);
    expect(getState().blocks[1].id).toBe('blk_test_new');

    // 2. UpdateBlockCommand (also marks 'ok' block as 'stale')
    expect(getState().blocks[0].ttsStatus).toBe('ok');
    history.executeCommand(
      new UpdateBlockCommand(accessor, 'blk_1', {
        text: 'Izmijenjeni tekst prve replike.',
      })
    );
    expect(getState().blocks[0].text).toBe('Izmijenjeni tekst prve replike.');
    expect(getState().blocks[0].ttsStatus).toBe('stale');

    // 3. ReorderBlocksCommand
    const firstIdBeforeReorder = getState().blocks[0].id;
    const secondIdBeforeReorder = getState().blocks[1].id;
    history.executeCommand(new ReorderBlocksCommand(accessor, 0, 1));
    expect(getState().blocks[0].id).toBe(secondIdBeforeReorder);
    expect(getState().blocks[1].id).toBe(firstIdBeforeReorder);

    // 4. DeleteBlockCommand
    history.executeCommand(new DeleteBlockCommand(accessor, 'blk_test_new'));
    expect(getState().blocks.find((b) => b.id === 'blk_test_new')).toBeUndefined();

    // Undo all 4 steps in reverse order
    history.undo(); // Undo Delete
    expect(getState().blocks.find((b) => b.id === 'blk_test_new')).toBeDefined();

    history.undo(); // Undo Reorder
    expect(getState().blocks[0].id).toBe('blk_1');
    expect(getState().blocks[1].id).toBe('blk_test_new');

    history.undo(); // Undo UpdateBlock
    expect(getState().blocks[0].ttsStatus).toBe('ok');
    expect(getState().blocks[0].text).toContain('Ugasi svjetlo');

    history.undo(); // Undo AddBlock
    expect(getState().blocks.length).toBe(initialCount);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Redo all 4 steps
    history.redo();
    history.redo();
    history.redo();
    history.redo();
    expect(getState().blocks.find((b) => b.id === 'blk_test_new')).toBeUndefined();
    expect(getState().blocks[0].text).toBe('Izmijenjeni tekst prve replike.');
  });

  it('caps undoStack at maxDepth (100) and clears redoStack on new mutation', () => {
    const { accessor, getState } = createMemoryAccessor();
    const history = new HistoryManager(100);

    for (let i = 1; i <= 120; i++) {
      history.executeCommand(
        new UpdateBlockCommand(accessor, 'blk_1', {
          text: `Edit iteration #${i}`,
        })
      );
    }

    expect(history.getUndoCount()).toBe(100);
    expect(getState().blocks[0].text).toBe('Edit iteration #120');

    // Undo 2 times -> redoCount becomes 2
    history.undo();
    history.undo();
    expect(history.getRedoCount()).toBe(2);
    expect(getState().blocks[0].text).toBe('Edit iteration #118');

    // Execute a new command -> redoStack must be cleared immediately
    history.executeCommand(
      new UpdateBlockCommand(accessor, 'blk_1', {
        text: 'Branched timeline edit',
      })
    );
    expect(history.getRedoCount()).toBe(0);
    expect(history.canRedo()).toBe(false);
  });

  it('executes and undoes UpdateSpeakerCommand and AddOrRemoveSpeakerCommand', () => {
    const { accessor, getState } = createMemoryAccessor();
    const history = new HistoryManager(100);

    const marko = getState().speakers.find((s) => s.id === 'spk_marko')!;
    const updatedMarko = {
      ...marko,
      name: 'Inspektor Marko Kovač',
      voice: {
        ...marko.voice,
        speakingRate: 1.25,
      },
    };

    history.executeCommand(new UpdateSpeakerCommand(accessor, updatedMarko));
    expect(getState().speakers.find((s) => s.id === 'spk_marko')?.name).toBe(
      'Inspektor Marko Kovač'
    );
    // Changing voice parameters marks Marko's rendered blocks as 'stale'
    expect(getState().blocks[0].ttsStatus).toBe('stale');

    history.undo();
    expect(getState().speakers.find((s) => s.id === 'spk_marko')?.name).toBe('Marko');
    expect(getState().blocks[0].ttsStatus).toBe('ok');

    // Add speaker
    const extraSpeaker = {
      ...marko,
      id: 'spk_extra',
      name: 'Radio Operator',
    };
    history.executeCommand(new AddOrRemoveSpeakerCommand(accessor, 'add', extraSpeaker));
    expect(getState().speakers.some((s) => s.id === 'spk_extra')).toBe(true);

    history.undo();
    expect(getState().speakers.some((s) => s.id === 'spk_extra')).toBe(false);
  });
});

