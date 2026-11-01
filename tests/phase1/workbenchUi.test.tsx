import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 1 — Studio Workbench 3-Pane UI Integration', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.getState().setUiLanguage('en');
  });

  it('renders the 3-pane studio workbench, toggles EN/HR localization, and supports undo/redo from TopBar', () => {
    render(<App />);

    // Verify default sample episode and speakers are rendered
    expect(screen.getByText(/Trijada Geodetskog Plamena/i)).toBeDefined();
    expect(screen.getByText('CAST & SPEAKERS')).toBeDefined();
    expect(screen.getByText('AI AGENT & RESEARCH DOCK')).toBeDefined();

    // Toggle language from EN -> HR
    const langBtn = screen.getByTitle('Switch English / Croatian (EN/HR)');
    fireEvent.click(langBtn);

    expect(screen.getByText('ULOGE I GOVORNICI')).toBeDefined();
    expect(screen.getByText('AI AGENT I ISTRAŽIVANJE')).toBeDefined();

    // Add a new dialogue line via UI button
    const initialBlockCount = useStoriaStore.getState().project.blocks.length;
    const addDialogueBtn = screen.getByText('+ Dijalog');
    fireEvent.click(addDialogueBtn);

    expect(useStoriaStore.getState().project.blocks.length).toBe(initialBlockCount + 1);

    // Click Undo in TopBar
    const undoBtn = screen.getByTitle('Poništi (Ctrl+Z)');
    fireEvent.click(undoBtn);
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialBlockCount);

    // Click Redo in TopBar
    const redoBtn = screen.getByTitle('Ponovi (Ctrl+Y)');
    fireEvent.click(redoBtn);
    expect(useStoriaStore.getState().project.blocks.length).toBe(initialBlockCount + 1);
  });
});
