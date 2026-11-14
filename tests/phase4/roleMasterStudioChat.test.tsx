import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentDock } from '../../src/components/layout/AgentDock';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import {
  buildStudioContextSnapshot,
  detectStoryTone,
  doctorDialogueBlock,
  generateNextSceneBeats,
  runRoleMasterChatTurn,
} from '../../src/services/geminiAgentService';

describe('Role-Master Studio Chat, Selection Awareness & Creative Divergence', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
  });

  it('anchors StudioContextSnapshot around mid-script selectedBlockId and tracks highlighted text spans', () => {
    const state = useStoriaStore.getState();
    const blocks = state.project.blocks;
    expect(blocks.length).toBeGreaterThanOrEqual(3);

    const midBlock = blocks[1];
    state.selectBlock(midBlock.id);
    state.setSelectedTextRange({
      blockId: midBlock.id,
      startOffset: 0,
      endOffset: 14,
      selectedText: midBlock.text.slice(0, 14),
    });

    const updatedState = useStoriaStore.getState();
    const snapshot = buildStudioContextSnapshot({
      project: updatedState.project,
      selectedBlockId: updatedState.selectedBlockId,
      selectedTextRange: updatedState.selectedTextRange,
    });

    expect(snapshot.activeBlock?.id).toBe(midBlock.id);
    expect(snapshot.activeBlockIndex).toBe(1);
    expect(snapshot.beforeActiveBlocks.map((b) => b.id)).toEqual([blocks[0].id]);
    expect(snapshot.followingBlocks.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.selectedTextRange?.selectedText).toBe(midBlock.text.slice(0, 14));
  });

  it('generates context-relevant, non-repetitive scene beats for non-noir tones and splices sub-selection polish in Script Doctor', async () => {
    const state = useStoriaStore.getState();
    state.updateProjectProperties({
      title: 'Komedija u Redakciji',
      description: 'Satirična komedija o pokvarenom aparatu za kavu u radijskom studiju',
      genre: 'Comedy / Satire',
    });

    const project = useStoriaStore.getState().project;
    expect(detectStoryTone(`${project.title} ${project.description} ${project.metadata?.genre}`)).toBe(
      'comedy_satire'
    );

    const beats = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      selectedBlockId: project.blocks[1]?.id,
      episodeTitle: project.title,
      episodeDescription: project.description,
      episodeGenre: project.metadata?.genre,
      directionHint: 'aparat za espresso počinje emitirati vremensku prognozu',
      apiKey: null,
    });

    expect(beats).toHaveLength(3);
    const titles = new Set(beats.map((b) => b.title));
    expect(titles.size).toBe(3);
    expect(JSON.stringify(beats).toLowerCase()).toContain('espresso');

    // Test sub-selection polish in Script Doctor
    const targetBlock = project.blocks[1];
    const highlightedWord = targetBlock.text.split(' ').slice(0, 2).join(' ');
    const restOfLine = targetBlock.text.slice(highlightedWord.length);

    const doctorOpts = await doctorDialogueBlock({
      block: targetBlock,
      speaker: project.speakers[0],
      targetWpm: 140,
      language: 'hr',
      selectedText: highlightedWord,
      apiKey: null,
    });

    expect(doctorOpts).toHaveLength(3);
    expect(doctorOpts[0].text).toContain(restOfLine.trim());
  });

  it('executes conversational tool commands across Role-Master tabs and supports inline Undo', async () => {
    const store = useStoriaStore.getState();
    const secondBlock = store.project.blocks[1];
    const targetPhrase = secondBlock.text.split('.')[0];

    store.selectBlock(secondBlock.id);
    store.setSelectedTextRange({
      blockId: secondBlock.id,
      startOffset: 0,
      endOffset: targetPhrase.length,
      selectedText: targetPhrase,
    });

    render(<AgentDock />);

    // Verify Live Context & Selection Bar displays active block and highlighted span
    expect(screen.getByTestId('agent-dock-selection-bar')).toBeTruthy();
    expect(screen.getByTestId('agent-dock-selected-text-pill').textContent).toContain(
      targetPhrase
    );

    // 1. Switch to Dialogue Doctor tab and ask in natural chat to replace the highlighted selection
    fireEvent.click(screen.getByTestId('tab-dialogue-doctor'));
    const chatInput = screen.getByTestId('role-master-chat-input');
    const sendBtn = screen.getByTestId('role-master-chat-send-btn');

    fireEvent.change(chatInput, {
      target: { value: 'change this to "Ostavi lampu upaljenu"' },
    });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByTestId('chat-tool-badge-replace_selected_text')).toBeTruthy();
    });

    const updatedBlockAfterReplace = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === secondBlock.id);
    expect(updatedBlockAfterReplace?.text).toContain('Ostavi lampu upaljenu');

    // Test inline Undo button on the chat tool badge
    fireEvent.click(screen.getByTestId('chat-undo-tool-btn'));
    const restoredBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === secondBlock.id);
    expect(restoredBlock?.text).toBe(secondBlock.text);

    // 2. Ask Co-Writer Role-Master chat to split the active block into a two-speaker dialogue exchange
    fireEvent.click(screen.getByTestId('tab-cowriter'));
    const initialBlockCount = useStoriaStore.getState().project.blocks.length;

    fireEvent.change(screen.getByTestId('role-master-chat-input'), {
      target: { value: 'Podijeli ovaj blok u dijalog' },
    });
    fireEvent.click(screen.getByTestId('role-master-chat-send-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('chat-tool-badge-split_block')).toBeTruthy();
    });

    expect(useStoriaStore.getState().project.blocks.length).toBe(initialBlockCount + 1);

    // 3. Programmatically verify Persona Master voice tuning tool action
    const personaTurn = await runRoleMasterChatTurn({
      userMessage: 'Make voice slower and deeper',
      role: 'persona_research',
      project: useStoriaStore.getState().project,
      selectedBlockId: secondBlock.id,
      apiKey: null,
    });
    expect(personaTurn.toolActions).toHaveLength(1);
    expect(personaTurn.toolActions[0].tool).toBe('update_speaker');
  });
});
