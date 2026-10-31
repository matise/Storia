import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Multi-Project (Episode) Studio Library & Episode Properties UI', () => {
  beforeEach(() => {
    localStorage.clear();
    useStoriaStore.getState().resetToSampleProject();
  });

  it('preloads 3 sample episodes (HR & EN) in the studio library', () => {
    const state = useStoriaStore.getState();
    expect(state.projects.length).toBeGreaterThanOrEqual(3);

    const ep1 = state.projects.find((p) => p.id === 'proj_magla_zagreb_ep1');
    const ep2 = state.projects.find((p) => p.id === 'proj_palagruza_ep2');
    const ep3 = state.projects.find((p) => p.id === 'proj_dubrovnik_ep3');

    expect(ep1).toBeDefined();
    expect(ep1?.defaultLanguage).toBe('hr');
    expect(ep1?.metadata?.genre).toContain('Noir');

    expect(ep2).toBeDefined();
    expect(ep2?.defaultLanguage).toBe('en');
    expect(ep2?.title).toContain('Signals from Palagruža');

    expect(ep3).toBeDefined();
    expect(ep3?.defaultLanguage).toBe('hr');
    expect(ep3?.title).toContain('Noćni arhiv Republike');
  });

  it('switches between episodes and loads episode-specific speakers, blocks, and language', () => {
    useStoriaStore.getState().switchProject('proj_palagruza_ep2');

    const switched = useStoriaStore.getState().project;
    expect(switched.id).toBe('proj_palagruza_ep2');
    expect(switched.defaultLanguage).toBe('en');
    expect(switched.speakers.some((s) => s.name === 'Elena')).toBe(true);
    expect(switched.blocks.length).toBeGreaterThanOrEqual(4);
  });

  it('updates episode properties (title, language, genre, author, targetWpm, audioConfig) and syncs with library', () => {
    const initialDuration = useStoriaStore.getState().project.blocks[1].estimatedDurationSec;

    useStoriaStore.getState().updateProjectProperties({
      title: 'Ep 1: Magla nad Gornjim gradom (Director Cut)',
      description: 'Proširena verzija prve epizode.',
      defaultLanguage: 'en',
      genre: 'Cyber-Noir Thriller',
      author: 'M. Kovač',
      targetWpm: 200,
      sampleRate: 44100,
      bitDepth: 16,
      targetLufs: -14,
    });

    const updated = useStoriaStore.getState().project;
    expect(updated.title).toBe('Ep 1: Magla nad Gornjim gradom (Director Cut)');
    expect(updated.description).toBe('Proširena verzija prve epizode.');
    expect(updated.defaultLanguage).toBe('en');
    expect(updated.metadata?.genre).toBe('Cyber-Noir Thriller');
    expect(updated.metadata?.author).toBe('M. Kovač');
    expect(updated.metadata?.targetWpm).toBe(200);
    expect(updated.audioConfig.sampleRate).toBe(44100);
    expect(updated.audioConfig.bitDepth).toBe(16);
    expect(updated.audioConfig.targetLufs).toBe(-14);

    // Higher WPM should reduce estimated duration for dialogue blocks
    expect(updated.blocks[1].estimatedDurationSec).not.toBe(initialDuration);

    // Synced inside projects array
    const syncedInLibrary = useStoriaStore
      .getState()
      .projects.find((p) => p.id === updated.id);
    expect(syncedInLibrary?.title).toBe('Ep 1: Magla nad Gornjim gradom (Director Cut)');
    expect(syncedInLibrary?.defaultLanguage).toBe('en');
  });

  it('creates, duplicates, and deletes episodes in the studio library', () => {
    const initialCount = useStoriaStore.getState().projects.length;

    const newEp = useStoriaStore.getState().createProject({
      title: 'Ep 4: Testna Epizoda',
      defaultLanguage: 'hr',
      genre: 'Sci-Fi',
    });

    expect(useStoriaStore.getState().projects.length).toBe(initialCount + 1);
    expect(useStoriaStore.getState().project.id).toBe(newEp.id);
    expect(useStoriaStore.getState().project.title).toBe('Ep 4: Testna Epizoda');

    const duplicated = useStoriaStore.getState().duplicateProject(newEp.id);
    expect(useStoriaStore.getState().projects.length).toBe(initialCount + 2);
    expect(duplicated.title).toContain('(Kopija)');

    useStoriaStore.getState().deleteProject(duplicated.id);
    expect(useStoriaStore.getState().projects.length).toBe(initialCount + 1);
  });

  it('renders TopBar episode switcher, inline workbench episode properties strip, and Episode Properties Modal', () => {
    render(<App />);

    // 1. Switch episode via TopBar dropdown
    const switcher = screen.getByTestId('episode-switcher-select') as HTMLSelectElement;
    expect(switcher.value).toBe('proj_magla_zagreb_ep1');

    fireEvent.change(switcher, { target: { value: 'proj_palagruza_ep2' } });
    expect(useStoriaStore.getState().project.id).toBe('proj_palagruza_ep2');

    // 2. Verify inline workbench properties strip shows Episode 2 properties and updates on change
    const inlineTitleInput = screen.getByTestId(
      'workbench-episode-title-input'
    ) as HTMLInputElement;
    expect(inlineTitleInput.value).toContain('Signals from Palagruža');

    fireEvent.change(inlineTitleInput, {
      target: { value: 'Ep 2: Signals from Vis' },
    });
    expect(useStoriaStore.getState().project.title).toBe('Ep 2: Signals from Vis');

    const inlineLangSelect = screen.getByTestId(
      'workbench-episode-lang-select'
    ) as HTMLSelectElement;
    expect(inlineLangSelect.value).toBe('en');
    fireEvent.change(inlineLangSelect, { target: { value: 'hr' } });
    expect(useStoriaStore.getState().project.defaultLanguage).toBe('hr');

    // 3. Open Episode Properties Modal from TopBar button
    const openModalBtn = screen.getByTestId('open-episode-properties-btn');
    fireEvent.click(openModalBtn);

    const modalTitleInput = screen.getByTestId(
      'modal-episode-title-input'
    ) as HTMLInputElement;
    expect(modalTitleInput.value).toBe('Ep 2: Signals from Vis');

    fireEvent.change(modalTitleInput, {
      target: { value: 'Ep 2: Signals from Lastovo' },
    });
    expect(useStoriaStore.getState().project.title).toBe('Ep 2: Signals from Lastovo');
  });
});
