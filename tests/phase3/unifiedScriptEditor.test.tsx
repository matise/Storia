import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  computeWordTimingTokens,
  getProgressForWord,
  getWordIndexAtProgress,
} from '../../src/core/pacing/wordTimingMapper';
import { UnifiedScriptEditor } from '../../src/components/workbench/UnifiedScriptEditor';

describe('Word Timing Mapper Engine', () => {
  const sampleDubrovnikLine =
    'U gluho doba, valovi tuku o mulo od Lazareta u staron Portu.';

  it('computes character-weighted timing intervals and punctuation pauses', () => {
    const tokens = computeWordTimingTokens(sampleDubrovnikLine);

    expect(tokens.length).toBeGreaterThan(5);
    // First token starts at 0.0
    expect(tokens[0].startProgress).toBe(0);
    expect(tokens[0].word).toBe('U');

    // Last token ends at 1.0
    const last = tokens[tokens.length - 1];
    expect(last.endProgress).toBe(1.0);
    expect(last.word).toBe('Portu.');

    // Monotonic progression
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].startProgress).toBeGreaterThanOrEqual(tokens[i - 1].startProgress);
      expect(tokens[i].endProgress).toBeGreaterThan(tokens[i].startProgress);
    }
  });

  it('finds active word index for given playback progress', () => {
    const tokens = computeWordTimingTokens(sampleDubrovnikLine);

    expect(getWordIndexAtProgress(tokens, 0.0)).toBe(0);
    expect(getWordIndexAtProgress(tokens, 1.0)).toBe(tokens.length - 1);

    const midIdx = getWordIndexAtProgress(tokens, 0.5);
    expect(midIdx).toBeGreaterThan(0);
    expect(midIdx).toBeLessThan(tokens.length - 1);
  });

  it('maps clicked word index to target audio seek progress', () => {
    const tokens = computeWordTimingTokens(sampleDubrovnikLine);

    const progFirst = getProgressForWord(tokens, 0);
    expect(progFirst).toBe(0);

    const progThird = getProgressForWord(tokens, 2);
    expect(progThird).toBeGreaterThan(0);
    expect(progThird).toBeLessThan(1);
  });
});

describe('UnifiedScriptEditor Component', () => {
  const defaultText =
    'U gluho doba, valovi tuku o mulo od Lazareta u staron Portu.';

  it('renders standard multi-line textarea in idle edit mode', () => {
    const handleChangeText = vi.fn();
    const handleAddBlock = vi.fn();

    render(
      <UnifiedScriptEditor
        blockId="blk_edit_1"
        text={defaultText}
        isPlaying={false}
        onChangeText={handleChangeText}
        onAddNextBlock={handleAddBlock}
      />
    );

    // Textarea is present
    const textarea = screen.getByTestId('unified-editor-textarea-blk_edit_1') as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.value).toBe(defaultText);

    // Typing triggers onChange
    fireEvent.change(textarea, { target: { value: 'Novi tekst' } });
    expect(handleChangeText).toHaveBeenCalledWith('Novi tekst');

    // Ctrl+Enter triggers onAddNextBlock
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(handleAddBlock).toHaveBeenCalledTimes(1);

    // Word transport tokens are NOT active while editing
    expect(screen.queryByTestId('unified-editor-transport-blk_edit_1')).toBeNull();
  });

  it('switches to locked word-transport mode during playback and highlights active word', () => {
    const handleSeekWord = vi.fn();

    render(
      <UnifiedScriptEditor
        blockId="blk_play_1"
        text={defaultText}
        isPlaying={true}
        playheadProgress={0.45}
        durationSec={15.0}
        onChangeText={vi.fn()}
        onSeekWord={handleSeekWord}
      />
    );

    // Raw textarea is hidden during playback
    expect(screen.queryByTestId('unified-editor-textarea-blk_play_1')).toBeNull();

    // Transport container is visible
    const transport = screen.getByTestId('unified-editor-transport-blk_play_1');
    expect(transport).toBeDefined();

    // Word tokens are rendered
    const word0 = screen.getByTestId('word-token-blk_play_1-0');
    expect(word0.textContent).toContain('U');

    // Clicking a word triggers onSeekWord with fractional progress
    fireEvent.click(word0);
    expect(handleSeekWord).toHaveBeenCalledTimes(1);
    expect(handleSeekWord).toHaveBeenCalledWith(0);
  });

  it('unlocks text editing when double-clicking a word or clicking the edit button', () => {
    const handleStop = vi.fn();

    render(
      <UnifiedScriptEditor
        blockId="blk_unlock_1"
        text={defaultText}
        isPlaying={true}
        playheadProgress={0.2}
        onChangeText={vi.fn()}
        onStopPlayback={handleStop}
      />
    );

    // Initially in transport mode
    expect(screen.getByTestId('unified-editor-transport-blk_unlock_1')).toBeDefined();

    // Clicking edit button exits playback and returns to textarea
    const editBtn = screen.getByTestId('edit-mode-btn-blk_unlock_1');
    fireEvent.click(editBtn);

    expect(handleStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('unified-editor-textarea-blk_unlock_1')).toBeDefined();
  });

  it('unlocks text editing when double-clicking anywhere on the transport container', () => {
    const handleStop = vi.fn();

    render(
      <UnifiedScriptEditor
        blockId="blk_unlock_2"
        text={defaultText}
        isPlaying={true}
        playheadProgress={0.4}
        onChangeText={vi.fn()}
        onStopPlayback={handleStop}
      />
    );

    const transportContainer = screen.getByTestId('unified-editor-transport-blk_unlock_2');
    fireEvent.doubleClick(transportContainer);

    expect(handleStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('unified-editor-textarea-blk_unlock_2')).toBeDefined();
  });
});
