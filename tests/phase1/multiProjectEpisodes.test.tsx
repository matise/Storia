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
    expect(switcher.value).toBe(useStoriaStore.getState().projects[0].id);

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

  it('supports episode searching, checkbox selection, and selective episode export in the upgraded modal', () => {
    useStoriaStore.getState().resetToSampleProject();
    render(<App />);

    // Open modal
    const openModalBtn = screen.getByTestId('open-episode-properties-btn');
    fireEvent.click(openModalBtn);

    // Verify search input filters episodes
    const searchInput = screen.getByTestId('library-search-input') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Palagruža' } });

    expect(screen.getByTestId('episode-library-card-proj_palagruza_ep2')).toBeDefined();
    expect(screen.queryByTestId('episode-library-card-proj_dubrovnik_ep3')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByTestId('episode-library-card-proj_dubrovnik_ep3')).toBeDefined();

    // Checkbox selection: select episode 1 and episode 2
    const checkEp1 = screen.getByTestId('episode-select-checkbox-proj_magla_zagreb_ep1');
    fireEvent.click(checkEp1);

    // Export Selected button should appear with count (1)
    const exportSelectedBtn = screen.getByTestId('library-toolbar-export-selected-btn');
    expect(exportSelectedBtn).toBeDefined();
    expect(exportSelectedBtn.textContent).toContain('1');

    // Select second episode
    const checkEp2 = screen.getByTestId('episode-select-checkbox-proj_palagruza_ep2');
    fireEvent.click(checkEp2);
    expect(exportSelectedBtn.textContent).toContain('2');
  });

  it('completely clears the library, displays empty-state modal and studio hero, and restores or creates new episode', () => {
    useStoriaStore.getState().resetToSampleProject();
    render(<App />);

    // 1. Open Episode Properties Modal and trigger Clear Entire Library
    const openModalBtn = screen.getByTestId('open-episode-properties-btn');
    fireEvent.click(openModalBtn);

    const clearEntireBtn = screen.getByTestId('library-toolbar-clear-entire-btn');
    fireEvent.click(clearEntireBtn);

    // Confirmation banner should appear
    const confirmClearBtn = screen.getByTestId('confirm-clear-entire-library-btn');
    expect(confirmClearBtn).toBeDefined();
    fireEvent.click(confirmClearBtn);

    // Verify library is completely empty
    expect(useStoriaStore.getState().projects.length).toBe(0);

    // Verify modal empty card and disabled properties notice
    expect(screen.getByTestId('library-empty-state-card')).toBeDefined();
    expect(screen.getByTestId('no-active-episode-notice')).toBeDefined();

    // 2. Close modal via close button -> App should render studio-empty-library-hero
    const closeBtn = screen.getByTestId('close-episode-properties-btn');
    fireEvent.click(closeBtn);
    expect(screen.getByTestId('studio-empty-library-hero')).toBeDefined();

    // 3. Click "Create Episode" button in empty studio hero
    const heroCreateBtn = screen.getByTestId('hero-create-episode-btn');
    fireEvent.click(heroCreateBtn);

    // Now library has 1 project, studio is unlocked
    expect(useStoriaStore.getState().projects.length).toBe(1);
    expect(screen.queryByTestId('studio-empty-library-hero')).toBeNull();

    // 4. Open modal, clear library again, close modal and test Restore Samples button in hero
    const openModalAgainBtn = screen.getByTestId('open-episode-properties-btn');
    fireEvent.click(openModalAgainBtn);
    fireEvent.click(screen.getByTestId('library-toolbar-clear-entire-btn'));
    fireEvent.click(screen.getByTestId('confirm-clear-entire-library-btn'));
    expect(useStoriaStore.getState().projects.length).toBe(0);

    fireEvent.click(screen.getByTestId('close-episode-properties-btn'));
    const heroRestoreBtn = screen.getByTestId('hero-restore-samples-btn');
    fireEvent.click(heroRestoreBtn);

    // Samples restored
    expect(useStoriaStore.getState().projects.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByTestId('studio-empty-library-hero')).toBeNull();
  });
});
