import {
  AgentToolAction,
  BlockType,
  CoWriterBeatBlockDraft,
  CroatianDialect,
  DubrovnikRegister,
  normalizeGeminiVoiceName,
  ScriptBlock,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import { StoriaStoreState } from '../../store/storeTypes';

/**
 * Resolves a speaker reference (id, exact name, partial name, or 1-based index like "Speaker 1" / "Voditelj 2")
 * to an existing Speaker in the project.
 */
export function resolveSpeakerFromReference(
  speakers: Speaker[],
  ref?: string | null,
  fallbackSpeakerId?: string
): Speaker | undefined {
  if (speakers.length === 0) return undefined;
  if (!ref || !ref.trim()) {
    return speakers.find((s) => s.id === fallbackSpeakerId) ?? speakers[0];
  }
  const trimmed = ref.trim();
  const byId = speakers.find((s) => s.id === trimmed);
  if (byId) return byId;

  const lower = trimmed.toLowerCase();
  const byExactName = speakers.find((s) => s.name.toLowerCase() === lower);
  if (byExactName) return byExactName;

  const byPartialName = speakers.find(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      lower.includes(s.name.toLowerCase())
  );
  if (byPartialName) return byPartialName;

  const numMatch = trimmed.match(/(\d+)\s*$/);
  if (numMatch) {
    const oneBased = Math.max(1, parseInt(numMatch[1], 10));
    return speakers[(oneBased - 1) % speakers.length];
  }

  return speakers.find((s) => s.id === fallbackSpeakerId) ?? speakers[0];
}

/**
 * Resolves a target block from an explicit blockId, 1-based blockOrder, or the store's currently selected block.
 */
export function resolveTargetBlock(
  blocks: ScriptBlock[],
  selectedBlockId: string | null,
  explicitBlockId?: string,
  blockOrderOneBased?: number
): ScriptBlock | undefined {
  if (blocks.length === 0) return undefined;
  if (explicitBlockId) {
    const byId = blocks.find((b) => b.id === explicitBlockId);
    if (byId) return byId;
  }
  if (
    typeof blockOrderOneBased === 'number' &&
    blockOrderOneBased >= 1 &&
    blockOrderOneBased <= blocks.length
  ) {
    return blocks[blockOrderOneBased - 1];
  }
  if (selectedBlockId) {
    const bySelected = blocks.find((b) => b.id === selectedBlockId);
    if (bySelected) return bySelected;
  }
  return blocks[0];
}

/**
 * Executes a list of AgentToolAction objects against the Storia store (backed by Undo/Redo HistoryManager).
 * Returns the updated list of actions with `applied: true` and resolved target IDs.
 */
export function executeStudioToolActions(
  getStore: () => StoriaStoreState,
  actions: AgentToolAction[]
): AgentToolAction[] {
  const executed: AgentToolAction[] = [];

  for (const action of actions) {
    const state = getStore();
    const { project, selectedBlockId, selectedTextRange } = state;
    const payload = action.payload ?? {};

    try {
      switch (action.tool) {
        case 'update_block': {
          const target = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.blockId as string | undefined),
            typeof payload.blockNumber === 'number'
              ? payload.blockNumber
              : undefined
          );
          if (!target) break;

          const patch: Partial<ScriptBlock> = {};
          if (typeof payload.text === 'string' && payload.text.trim().length > 0) {
            patch.text = payload.text.trim();
          }
          if (typeof payload.directorNotes === 'string') {
            patch.directorNotes = payload.directorNotes.trim();
          }
          if (
            payload.type === 'dialogue' ||
            payload.type === 'narration' ||
            payload.type === 'sound_effect' ||
            payload.type === 'direction'
          ) {
            patch.type = payload.type;
          }
          if (typeof payload.speakerId === 'string' || typeof payload.speakerName === 'string') {
            const spk = resolveSpeakerFromReference(
              project.speakers,
              (payload.speakerId as string) || (payload.speakerName as string),
              target.speakerId
            );
            if (spk) {
              patch.speakerId = spk.id;
            }
          }
          if (typeof payload.pauseAfterMs === 'number') {
            patch.pauseAfterMs = Math.max(50, Math.min(5000, payload.pauseAfterMs));
          }

          state.updateBlock(target.id, patch);
          executed.push({
            ...action,
            targetBlockId: target.id,
            applied: true,
          });
          break;
        }

        case 'replace_selected_text': {
          const target = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.blockId as string | undefined)
          );
          if (!target) break;

          const replacementText = String(payload.replacementText ?? payload.text ?? '').trim();
          if (!replacementText) break;

          const originalText = target.text;
          let nextText = originalText;

          const activeSelection =
            selectedTextRange && selectedTextRange.blockId === target.id
              ? selectedTextRange
              : null;

          const targetSubstring =
            (typeof payload.selectedText === 'string' && payload.selectedText) ||
            activeSelection?.selectedText ||
            '';

          if (
            activeSelection &&
            activeSelection.startOffset >= 0 &&
            activeSelection.endOffset <= originalText.length &&
            activeSelection.endOffset > activeSelection.startOffset
          ) {
            nextText =
              originalText.slice(0, activeSelection.startOffset) +
              replacementText +
              originalText.slice(activeSelection.endOffset);
          } else if (targetSubstring && originalText.includes(targetSubstring)) {
            nextText = originalText.replace(targetSubstring, replacementText);
          } else {
            nextText = replacementText;
          }

          const patch: Partial<ScriptBlock> = { text: nextText };
          if (typeof payload.directorNotes === 'string' && payload.directorNotes.trim()) {
            patch.directorNotes = payload.directorNotes.trim();
          }

          state.updateBlock(target.id, patch);
          state.setSelectedTextRange(null);

          executed.push({
            ...action,
            targetBlockId: target.id,
            applied: true,
          });
          break;
        }

        case 'insert_blocks': {
          const rawBlocks = Array.isArray(payload.blocks) ? payload.blocks : [];
          if (rawBlocks.length === 0) break;

          const position = payload.position === 'before' ? 'before' : 'after';
          const anchorBlock = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.afterBlockId as string | undefined),
            typeof payload.blockNumber === 'number'
              ? payload.blockNumber
              : undefined
          );

          const drafts: CoWriterBeatBlockDraft[] = rawBlocks
            .filter((b) => b && typeof (b as { text?: unknown }).text === 'string')
            .map((b) => {
              const item = b as Record<string, unknown>;
              const rawType = String(item.type || 'dialogue');
              const bType: BlockType =
                rawType === 'narration' ||
                rawType === 'sound_effect' ||
                rawType === 'direction'
                  ? rawType
                  : 'dialogue';
              const spk =
                bType === 'dialogue' || bType === 'narration'
                  ? resolveSpeakerFromReference(
                      project.speakers,
                      String(item.speakerId || item.speakerName || ''),
                      anchorBlock?.speakerId ?? project.speakers[0]?.id
                    )
                  : undefined;

              return {
                type: bType,
                speakerId: spk?.id,
                text: String(item.text).trim(),
                directorNotes:
                  typeof item.directorNotes === 'string'
                    ? item.directorNotes.trim()
                    : 'prirodno / natural',
                pauseAfterMs: Number(item.pauseAfterMs) || 450,
              };
            });

          if (drafts.length === 0) break;

          if (position === 'before' && anchorBlock) {
            const anchorIdx = project.blocks.findIndex((b) => b.id === anchorBlock.id);
            if (anchorIdx === 0) {
              // Insert after block 0, then move block 0 below the newly inserted blocks
              const insertedIds = state.insertSceneBeatBlocks(drafts, anchorBlock.id);
              for (let i = 0; i < insertedIds.length; i++) {
                getStore().moveBlockRelative(anchorBlock.id, 'down');
              }
            } else {
              const prevBlock = project.blocks[anchorIdx - 1];
              state.insertSceneBeatBlocks(drafts, prevBlock?.id);
            }
          } else {
            state.insertSceneBeatBlocks(drafts, anchorBlock?.id);
          }

          executed.push({
            ...action,
            targetBlockId: anchorBlock?.id,
            applied: true,
          });
          break;
        }

        case 'split_block': {
          const target = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.blockId as string | undefined)
          );
          if (!target) break;

          const rawParts = Array.isArray(payload.blocks) ? payload.blocks : [];
          if (rawParts.length < 2) break;

          const normalizedParts = rawParts
            .filter((p) => p && typeof (p as { text?: unknown }).text === 'string')
            .map((p, idx) => {
              const item = p as Record<string, unknown>;
              const rawType = String(item.type || target.type || 'dialogue');
              const bType: BlockType =
                rawType === 'narration' ||
                rawType === 'sound_effect' ||
                rawType === 'direction'
                  ? rawType
                  : 'dialogue';
              const fallbackSpk =
                project.speakers[idx % project.speakers.length]?.id ?? target.speakerId;
              const spk =
                bType === 'dialogue' || bType === 'narration'
                  ? resolveSpeakerFromReference(
                      project.speakers,
                      String(item.speakerId || item.speakerName || ''),
                      fallbackSpk
                    )
                  : undefined;

              return {
                type: bType,
                speakerId: spk?.id,
                text: String(item.text).trim(),
                directorNotes:
                  typeof item.directorNotes === 'string'
                    ? item.directorNotes.trim()
                    : target.directorNotes || 'prirodno / natural',
                pauseAfterMs: Number(item.pauseAfterMs) || 400,
              };
            });

          if (normalizedParts.length < 2) break;

          const first = normalizedParts[0];
          state.updateBlock(target.id, {
            type: first.type,
            speakerId: first.speakerId,
            text: first.text,
            directorNotes: first.directorNotes,
            pauseAfterMs: first.pauseAfterMs,
          });

          state.insertSceneBeatBlocks(normalizedParts.slice(1), target.id);
          executed.push({
            ...action,
            targetBlockId: target.id,
            applied: true,
          });
          break;
        }

        case 'delete_block': {
          const target = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.blockId as string | undefined),
            typeof payload.blockNumber === 'number'
              ? payload.blockNumber
              : undefined
          );
          if (!target || project.blocks.length <= 1) break;
          state.deleteBlock(target.id);
          executed.push({
            ...action,
            targetBlockId: target.id,
            applied: true,
          });
          break;
        }

        case 'move_block': {
          const target = resolveTargetBlock(
            project.blocks,
            selectedBlockId,
            action.targetBlockId || (payload.blockId as string | undefined),
            typeof payload.blockNumber === 'number'
              ? payload.blockNumber
              : undefined
          );
          if (!target) break;
          const direction = payload.direction === 'up' ? 'up' : 'down';
          state.moveBlockRelative(target.id, direction);
          executed.push({
            ...action,
            targetBlockId: target.id,
            applied: true,
          });
          break;
        }

        case 'batch_update_blocks': {
          const updates = Array.isArray(payload.updates) ? payload.updates : [];
          for (const rawUpd of updates) {
            const u = rawUpd as Record<string, unknown>;
            const blk = resolveTargetBlock(
              getStore().project.blocks,
              selectedBlockId,
              typeof u.blockId === 'string' ? u.blockId : undefined,
              typeof u.blockNumber === 'number' ? u.blockNumber : undefined
            );
            if (blk) {
              const patch: Partial<ScriptBlock> = {};
              if (typeof u.text === 'string' && u.text.trim()) {
                patch.text = u.text.trim();
              }
              if (typeof u.directorNotes === 'string') {
                patch.directorNotes = u.directorNotes.trim();
              }
              getStore().updateBlock(blk.id, patch);
            }
          }
          executed.push({
            ...action,
            applied: true,
          });
          break;
        }

        case 'update_speaker': {
          const spk = resolveSpeakerFromReference(
            project.speakers,
            action.targetSpeakerId ||
              (payload.speakerId as string | undefined) ||
              (payload.speakerName as string | undefined),
            project.blocks.find((b) => b.id === selectedBlockId)?.speakerId
          );
          if (!spk) break;

          const nextSpeaker: Speaker = JSON.parse(JSON.stringify(spk)) as Speaker;
          if (typeof payload.name === 'string' && payload.name.trim()) {
            nextSpeaker.name = payload.name.trim();
          }
          if (typeof payload.personaPrompt === 'string' && payload.personaPrompt.trim()) {
            nextSpeaker.personaPrompt = payload.personaPrompt.trim();
          }
          if (typeof payload.actingNotes === 'string' && payload.actingNotes.trim()) {
            nextSpeaker.actingNotes = payload.actingNotes.trim();
          }
          if (typeof payload.stylePrompt === 'string' && payload.stylePrompt.trim()) {
            nextSpeaker.voice.stylePrompt = payload.stylePrompt.trim();
          }
          if (typeof payload.baseVoice === 'string' && payload.baseVoice.trim()) {
            nextSpeaker.voice.baseVoice = normalizeGeminiVoiceName(
              payload.baseVoice,
              nextSpeaker.gender
            );
          }
          if (typeof payload.speakingRate === 'number') {
            nextSpeaker.voice.speakingRate = Math.max(
              0.5,
              Math.min(2.0, payload.speakingRate)
            );
          }
          if (typeof payload.pitchAdjustment === 'number') {
            nextSpeaker.voice.pitchAdjustment = Math.max(
              -10,
              Math.min(10, Math.round(payload.pitchAdjustment))
            );
          }
          if (typeof payload.lowShelfGainDb === 'number' && nextSpeaker.voice.acoustics.biquadEq) {
            nextSpeaker.voice.acoustics.biquadEq.lowShelfGainDb = payload.lowShelfGainDb;
          }
          if (typeof payload.midPeakGainDb === 'number' && nextSpeaker.voice.acoustics.biquadEq) {
            nextSpeaker.voice.acoustics.biquadEq.midPeakGainDb = payload.midPeakGainDb;
          }
          if (typeof payload.highShelfGainDb === 'number' && nextSpeaker.voice.acoustics.biquadEq) {
            nextSpeaker.voice.acoustics.biquadEq.highShelfGainDb = payload.highShelfGainDb;
          }

          state.updateSpeaker(nextSpeaker);
          executed.push({
            ...action,
            targetSpeakerId: nextSpeaker.id,
            applied: true,
          });
          break;
        }

        case 'update_episode_metadata': {
          state.updateProjectProperties({
            title: typeof payload.title === 'string' ? payload.title : undefined,
            description:
              typeof payload.description === 'string' ? payload.description : undefined,
            genre: typeof payload.genre === 'string' ? payload.genre : undefined,
            targetWpm:
              typeof payload.targetWpm === 'number' ? payload.targetWpm : undefined,
            defaultLanguage:
              payload.defaultLanguage === 'hr' || payload.defaultLanguage === 'en'
                ? (payload.defaultLanguage as SupportedLanguage)
                : undefined,
            dialect:
              payload.dialect === 'dubrovnik' || payload.dialect === 'standard'
                ? (payload.dialect as CroatianDialect)
                : undefined,
            dubrovnikRegister:
              payload.dubrovnikRegister === 'classical' ||
              payload.dubrovnikRegister === 'traditional' ||
              payload.dubrovnikRegister === 'contemporary'
                ? (payload.dubrovnikRegister as DubrovnikRegister)
                : undefined,
          });
          executed.push({
            ...action,
            applied: true,
          });
          break;
        }
      }
    } catch (err) {
      console.warn(`Tool action ${action.tool} failed:`, err);
      executed.push({ ...action, applied: false });
    }
  }

  return executed;
}
