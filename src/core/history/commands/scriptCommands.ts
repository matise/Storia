import { Command } from '../Command';
import { Project, ScriptBlock, Speaker } from '../../../types/storia';
import { recalculateProjectTimeline } from '../../pacing/pacingCalculator';

export type ProjectStateAccessor = {
  getProject: () => Project;
  setProject: (project: Project) => void;
};

function cloneBlock(block: ScriptBlock): ScriptBlock {
  return {
    ...block,
    timepoints: block.timepoints ? block.timepoints.map((tp) => ({ ...tp })) : undefined,
  };
}

function cloneSpeaker(speaker: Speaker): Speaker {
  return JSON.parse(JSON.stringify(speaker)) as Speaker;
}

function applyBlocksToProject(project: Project, nextRawBlocks: ScriptBlock[]): Project {
  const targetWpm = project.metadata?.targetWpm ?? 140;
  const { blocks } = recalculateProjectTimeline(nextRawBlocks, project.speakers, targetWpm);
  return {
    ...project,
    blocks,
    updatedAt: Date.now(),
  };
}

/**
 * 1. AddBlockCommand — Inserts a new ScriptBlock at the specified index (or end of script).
 */
export class AddBlockCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private block: ScriptBlock;
  private insertIndex?: number;
  private previousBlocksSnapshot: ScriptBlock[] = [];

  constructor(accessor: ProjectStateAccessor, block: ScriptBlock, insertIndex?: number) {
    this.id = `cmd_add_blk_${block.id}_${Date.now()}`;
    this.description = `Add ${block.type} block`;
    this.accessor = accessor;
    this.block = cloneBlock(block);
    this.insertIndex = insertIndex;
  }

  execute(): void {
    const project = this.accessor.getProject();
    this.previousBlocksSnapshot = project.blocks.map(cloneBlock);

    const nextBlocks = project.blocks.map(cloneBlock);
    const idx =
      this.insertIndex !== undefined
        ? Math.max(0, Math.min(nextBlocks.length, this.insertIndex))
        : nextBlocks.length;
    nextBlocks.splice(idx, 0, cloneBlock(this.block));

    this.accessor.setProject(applyBlocksToProject(project, nextBlocks));
  }

  undo(): void {
    const project = this.accessor.getProject();
    this.accessor.setProject(
      applyBlocksToProject(project, this.previousBlocksSnapshot.map(cloneBlock))
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'AddBlockCommand',
      id: this.id,
      description: this.description,
      blockId: this.block.id,
      insertIndex: this.insertIndex,
    };
  }
}

/**
 * 2. UpdateBlockCommand — Modifies properties of an existing ScriptBlock and flags TTS as stale if content changed.
 */
export class UpdateBlockCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private blockId: string;
  private patch: Partial<ScriptBlock>;
  private previousBlockSnapshot: ScriptBlock | null = null;

  constructor(accessor: ProjectStateAccessor, blockId: string, patch: Partial<ScriptBlock>) {
    this.id = `cmd_upd_blk_${blockId}_${Date.now()}`;
    this.description = `Update block ${blockId}`;
    this.accessor = accessor;
    this.blockId = blockId;
    this.patch = { ...patch };
  }

  execute(): void {
    const project = this.accessor.getProject();
    const target = project.blocks.find((b) => b.id === this.blockId);
    if (!target) return;

    if (!this.previousBlockSnapshot) {
      this.previousBlockSnapshot = cloneBlock(target);
    }

    const affectsAudio =
      (this.patch.text !== undefined && this.patch.text !== target.text) ||
      (this.patch.directorNotes !== undefined &&
        this.patch.directorNotes !== target.directorNotes) ||
      (this.patch.speakerId !== undefined && this.patch.speakerId !== target.speakerId) ||
      (this.patch.pauseAfterMs !== undefined && this.patch.pauseAfterMs !== target.pauseAfterMs);

    const nextBlocks = project.blocks.map((b) => {
      if (b.id !== this.blockId) return cloneBlock(b);
      const nextStatus =
        this.patch.ttsStatus !== undefined
          ? this.patch.ttsStatus
          : affectsAudio && b.ttsStatus === 'ok'
            ? 'stale'
            : b.ttsStatus;
      return {
        ...cloneBlock(b),
        ...this.patch,
        ttsStatus: nextStatus,
      };
    });

    this.accessor.setProject(applyBlocksToProject(project, nextBlocks));
  }

  undo(): void {
    if (!this.previousBlockSnapshot) return;
    const project = this.accessor.getProject();
    const restored = cloneBlock(this.previousBlockSnapshot);
    const nextBlocks = project.blocks.map((b) =>
      b.id === this.blockId ? restored : cloneBlock(b)
    );
    this.accessor.setProject(applyBlocksToProject(project, nextBlocks));
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'UpdateBlockCommand',
      id: this.id,
      description: this.description,
      blockId: this.blockId,
      patch: this.patch,
    };
  }
}

/**
 * 3. DeleteBlockCommand — Deletes a ScriptBlock and restores it to its exact index on undo.
 */
export class DeleteBlockCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private blockId: string;
  private previousBlocksSnapshot: ScriptBlock[] = [];

  constructor(accessor: ProjectStateAccessor, blockId: string) {
    this.id = `cmd_del_blk_${blockId}_${Date.now()}`;
    this.description = `Delete block ${blockId}`;
    this.accessor = accessor;
    this.blockId = blockId;
  }

  execute(): void {
    const project = this.accessor.getProject();
    this.previousBlocksSnapshot = project.blocks.map(cloneBlock);
    const nextBlocks = project.blocks.filter((b) => b.id !== this.blockId).map(cloneBlock);
    this.accessor.setProject(applyBlocksToProject(project, nextBlocks));
  }

  undo(): void {
    const project = this.accessor.getProject();
    this.accessor.setProject(
      applyBlocksToProject(project, this.previousBlocksSnapshot.map(cloneBlock))
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'DeleteBlockCommand',
      id: this.id,
      description: this.description,
      blockId: this.blockId,
    };
  }
}

/**
 * 4. ReorderBlocksCommand — Moves a block from fromIndex to toIndex and recalculates timeline bounds.
 */
export class ReorderBlocksCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private fromIndex: number;
  private toIndex: number;
  private previousBlocksSnapshot: ScriptBlock[] = [];

  constructor(accessor: ProjectStateAccessor, fromIndex: number, toIndex: number) {
    this.id = `cmd_reorder_${fromIndex}_${toIndex}_${Date.now()}`;
    this.description = `Reorder block ${fromIndex + 1} to ${toIndex + 1}`;
    this.accessor = accessor;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  execute(): void {
    const project = this.accessor.getProject();
    if (
      this.fromIndex < 0 ||
      this.fromIndex >= project.blocks.length ||
      this.toIndex < 0 ||
      this.toIndex >= project.blocks.length ||
      this.fromIndex === this.toIndex
    ) {
      return;
    }

    this.previousBlocksSnapshot = project.blocks.map(cloneBlock);
    const nextBlocks = project.blocks.map(cloneBlock);
    const [moved] = nextBlocks.splice(this.fromIndex, 1);
    nextBlocks.splice(this.toIndex, 0, moved);

    this.accessor.setProject(applyBlocksToProject(project, nextBlocks));
  }

  undo(): void {
    if (this.previousBlocksSnapshot.length === 0) return;
    const project = this.accessor.getProject();
    this.accessor.setProject(
      applyBlocksToProject(project, this.previousBlocksSnapshot.map(cloneBlock))
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'ReorderBlocksCommand',
      id: this.id,
      description: this.description,
      fromIndex: this.fromIndex,
      toIndex: this.toIndex,
    };
  }
}

/**
 * 5. UpdateSpeakerCommand — Updates a Speaker (including GeminiVoiceConfig and Biquad EQ acoustics)
 * and recalculates timeline durations if speakingRate changed.
 */
export class UpdateSpeakerCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private updatedSpeaker: Speaker;
  private previousSpeakerSnapshot: Speaker | null = null;
  private previousBlocksSnapshot: ScriptBlock[] = [];

  constructor(accessor: ProjectStateAccessor, updatedSpeaker: Speaker) {
    this.id = `cmd_upd_spk_${updatedSpeaker.id}_${Date.now()}`;
    this.description = `Update speaker ${updatedSpeaker.name}`;
    this.accessor = accessor;
    this.updatedSpeaker = cloneSpeaker(updatedSpeaker);
  }

  execute(): void {
    const project = this.accessor.getProject();
    const existing = project.speakers.find((s) => s.id === this.updatedSpeaker.id);
    if (!existing) return;

    if (!this.previousSpeakerSnapshot) {
      this.previousSpeakerSnapshot = cloneSpeaker(existing);
      this.previousBlocksSnapshot = project.blocks.map(cloneBlock);
    }

    const voiceChanged =
      existing.voice.baseVoice !== this.updatedSpeaker.voice.baseVoice ||
      existing.voice.stylePrompt !== this.updatedSpeaker.voice.stylePrompt ||
      existing.voice.speakingRate !== this.updatedSpeaker.voice.speakingRate ||
      existing.voice.pitchAdjustment !== this.updatedSpeaker.voice.pitchAdjustment;

    const nextSpeakers = project.speakers.map((s) =>
      s.id === this.updatedSpeaker.id ? cloneSpeaker(this.updatedSpeaker) : cloneSpeaker(s)
    );

    const nextRawBlocks = project.blocks.map((b) => {
      if (voiceChanged && b.speakerId === this.updatedSpeaker.id && b.ttsStatus === 'ok') {
        return { ...cloneBlock(b), ttsStatus: 'stale' as const };
      }
      return cloneBlock(b);
    });

    const targetWpm = project.metadata?.targetWpm ?? 140;
    const { blocks } = recalculateProjectTimeline(nextRawBlocks, nextSpeakers, targetWpm);

    this.accessor.setProject({
      ...project,
      speakers: nextSpeakers,
      blocks,
      updatedAt: Date.now(),
    });
  }

  undo(): void {
    if (!this.previousSpeakerSnapshot) return;
    const project = this.accessor.getProject();
    const restoredSpeaker = cloneSpeaker(this.previousSpeakerSnapshot);
    const nextSpeakers = project.speakers.map((s) =>
      s.id === restoredSpeaker.id ? restoredSpeaker : cloneSpeaker(s)
    );

    const targetWpm = project.metadata?.targetWpm ?? 140;
    const { blocks } = recalculateProjectTimeline(
      this.previousBlocksSnapshot.map(cloneBlock),
      nextSpeakers,
      targetWpm
    );

    this.accessor.setProject({
      ...project,
      speakers: nextSpeakers,
      blocks,
      updatedAt: Date.now(),
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'UpdateSpeakerCommand',
      id: this.id,
      description: this.description,
      speakerId: this.updatedSpeaker.id,
    };
  }
}

/**
 * 6. AddOrRemoveSpeakerCommand — Adds or removes a Speaker from the project cast.
 */
export class AddOrRemoveSpeakerCommand implements Command {
  id: string;
  description: string;
  private accessor: ProjectStateAccessor;
  private mode: 'add' | 'remove';
  private speaker: Speaker;
  private previousSpeakersSnapshot: Speaker[] = [];
  private previousBlocksSnapshot: ScriptBlock[] = [];

  constructor(accessor: ProjectStateAccessor, mode: 'add' | 'remove', speaker: Speaker) {
    this.id = `cmd_${mode}_spk_${speaker.id}_${Date.now()}`;
    this.description = `${mode === 'add' ? 'Add' : 'Remove'} speaker ${speaker.name}`;
    this.accessor = accessor;
    this.mode = mode;
    this.speaker = cloneSpeaker(speaker);
  }

  execute(): void {
    const project = this.accessor.getProject();
    this.previousSpeakersSnapshot = project.speakers.map(cloneSpeaker);
    this.previousBlocksSnapshot = project.blocks.map(cloneBlock);

    let nextSpeakers: Speaker[];
    let nextRawBlocks = project.blocks.map(cloneBlock);

    if (this.mode === 'add') {
      nextSpeakers = [...project.speakers.map(cloneSpeaker), cloneSpeaker(this.speaker)];
    } else {
      nextSpeakers = project.speakers
        .filter((s) => s.id !== this.speaker.id)
        .map(cloneSpeaker);
      const fallbackId = nextSpeakers[0]?.id;
      nextRawBlocks = nextRawBlocks.map((b) =>
        b.speakerId === this.speaker.id ? { ...b, speakerId: fallbackId } : b
      );
    }

    const targetWpm = project.metadata?.targetWpm ?? 140;
    const { blocks } = recalculateProjectTimeline(nextRawBlocks, nextSpeakers, targetWpm);

    this.accessor.setProject({
      ...project,
      speakers: nextSpeakers,
      blocks,
      updatedAt: Date.now(),
    });
  }

  undo(): void {
    const project = this.accessor.getProject();
    const nextSpeakers = this.previousSpeakersSnapshot.map(cloneSpeaker);
    const targetWpm = project.metadata?.targetWpm ?? 140;
    const { blocks } = recalculateProjectTimeline(
      this.previousBlocksSnapshot.map(cloneBlock),
      nextSpeakers,
      targetWpm
    );

    this.accessor.setProject({
      ...project,
      speakers: nextSpeakers,
      blocks,
      updatedAt: Date.now(),
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'AddOrRemoveSpeakerCommand',
      id: this.id,
      description: this.description,
      mode: this.mode,
      speakerId: this.speaker.id,
    };
  }
}

