import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpeakerConfigModal } from '../../src/components/modals/SpeakerConfigModal';
import { ProjectPropertiesModal } from '../../src/components/modals/ProjectPropertiesModal';
import { ScriptWorkbench } from '../../src/components/layout/ScriptWorkbench';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import {
  GEMINI_BASE_VOICES,
  GEMINI_VOICE_CATALOG,
  normalizeGeminiVoiceName,
} from '../../src/types/storia';
import { hydrateProjectTimeline } from '../../src/store/projectPersistence';

describe('Gemini AI Speaker & Voice DSP Architect + AI Episode Architect', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
  });

  it('includes all 30 official Gemini 2.5 TTS voices and normalizes unsupported Orpheus/Helios names', () => {
    expect(GEMINI_VOICE_CATALOG.length).toBe(30);
    expect(GEMINI_BASE_VOICES.length).toBe(30);
    expect(GEMINI_BASE_VOICES).toContain('Orus');
    expect(GEMINI_BASE_VOICES).toContain('Sadaltager');
    expect(GEMINI_BASE_VOICES).not.toContain('Orpheus');
    expect(GEMINI_BASE_VOICES).not.toContain('Helios');

    expect(normalizeGeminiVoiceName('Orpheus', 'male')).toBe('Orus');
    expect(normalizeGeminiVoiceName('orpheus', 'male')).toBe('Orus');
    expect(normalizeGeminiVoiceName('Helios', 'male')).toBe('Sadaltager');
    expect(normalizeGeminiVoiceName('zephyr', 'female')).toBe('Zephyr');

    // Verify hydrateProjectTimeline migrates legacy Orpheus speakers
    const sample = useStoriaStore.getState().project;
    const legacyProject = {
      ...sample,
      speakers: sample.speakers.map((s, idx) =>
        idx === 0 ? { ...s, voice: { ...s.voice, baseVoice: 'Orpheus' } } : s
      ),
    };
    const hydrated = hydrateProjectTimeline(legacyProject);
    expect(hydrated.speakers[0].voice.baseVoice).toBe('Orus');
  });

  it('designs a speaker voice, persona, and modular DSP stack (Stone Vault Reverb & Radio Filter) in SpeakerConfigModal', async () => {
    const store = useStoriaStore.getState();
    const targetSpeaker = store.project.speakers[0];
    store.openSpeakerModal(targetSpeaker.id, 'dsp');

    render(<SpeakerConfigModal />);

    expect(screen.getByTestId('ai-speaker-architect-panel')).toBeTruthy();

    // Trigger Stone Vault Reverb preset
    fireEvent.click(screen.getByTestId('ai-preset-vault-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-speaker-rationale-banner')).toBeTruthy();
    });

    // Save speaker changes and verify store state has Dattorro Reverb in effectStack and valid Gemini voice
    fireEvent.click(screen.getByTestId('save-speaker-btn'));

    const updatedSpeaker = useStoriaStore
      .getState()
      .project.speakers.find((s) => s.id === targetSpeaker.id);
    expect(updatedSpeaker).toBeDefined();
    expect(GEMINI_BASE_VOICES).toContain(updatedSpeaker?.voice.baseVoice);
    expect(updatedSpeaker?.voice.baseVoice).not.toBe('Orpheus');
    const effectTypes = (updatedSpeaker?.voice.acoustics.effectStack ?? []).map(
      (m) => m.type
    );
    expect(effectTypes).toContain('biquad_eq');
    expect(effectTypes).toContain('dynamics_compressor');
    expect(effectTypes).toContain('dattorro_reverb');
  });

  it('creates a full AI Episode (custom Cast + opening Scene) and fills episode properties in ProjectPropertiesModal', async () => {
    const store = useStoriaStore.getState();
    const initialCount = store.projects.length;
    store.setEpisodePropertiesModalOpen(true);

    render(<ProjectPropertiesModal />);

    expect(screen.getByTestId('ai-episode-architect-panel')).toBeTruthy();

    const promptInput = screen.getByTestId('ai-episode-prompt-input');
    fireEvent.change(promptInput, {
      target: {
        value: 'Analitički podcast o protudronskoj obrani i analognoj arhitekturi',
      },
    });

    fireEvent.click(screen.getByTestId('ai-create-full-episode-btn'));

    await waitFor(() => {
      expect(useStoriaStore.getState().projects.length).toBe(initialCount + 1);
    });

    const newActiveProject = useStoriaStore.getState().project;
    expect(newActiveProject.title).toContain('Analitički podcast');
    expect(newActiveProject.speakers.length).toBeGreaterThanOrEqual(2);
    expect(newActiveProject.blocks.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('ai-episode-rationale-banner')).toBeTruthy();

    // Test AI Fill Active Properties on the current episode
    fireEvent.change(promptInput, {
      target: {
        value: 'Sci-Fi signal anomaly on Palagruža station',
      },
    });
    fireEvent.click(screen.getByTestId('ai-fill-episode-props-btn'));

    await waitFor(() => {
      expect(useStoriaStore.getState().project.title).toContain(
        'Sci-Fi signal anomaly'
      );
    });
  });

  it('renders Episode Properties Strip and Master Waveform Timeline Deck as high-contrast framed studio groups', () => {
    render(<ScriptWorkbench />);

    const episodeStrip = screen.getByTestId('workbench-episode-properties-strip');
    const waveformDeck = screen.getByTestId('episode-waveform-transport-deck');
    const blocksContainer = screen.getByTestId('script-blocks-scroll-container');

    expect(episodeStrip.className).toContain('rounded-xl');
    expect(episodeStrip.className).toContain('border-indigo-500/45');
    expect(waveformDeck.className).toContain('rounded-xl');
    expect(waveformDeck.className).toContain('border-cyan-500/45');
    expect(blocksContainer.className).toContain('border-t');
  });

  it('supports attaching documents/scripts to AI Episode Architect and creates an episode from empty library', async () => {
    useStoriaStore.getState().clearEntireLibrary();
    expect(useStoriaStore.getState().projects.length).toBe(0);

    useStoriaStore.getState().setEpisodePropertiesModalOpen(true);
    render(<ProjectPropertiesModal />);

    // AI Episode Architect panel should be active and interactive even when projects is empty
    const architectPanel = screen.getByTestId('ai-episode-architect-panel');
    expect(architectPanel).toBeDefined();

    const attachBtn = screen.getByTestId('ai-attach-files-btn');
    expect(attachBtn).toBeDefined();

    // Attach a mock document file
    const file = new File(['[SCENE START]\nCOMMANDER: Signal detected.\n[SCENE END]'], 'deep_space_pitch.txt', {
      type: 'text/plain',
    });
    const fileInput = screen.getByTestId('ai-architect-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('deep_space_pitch.txt')).toBeDefined();
    });

    // Create AI episode from the attached document
    fireEvent.click(screen.getByTestId('ai-create-full-episode-btn'));

    await waitFor(() => {
      expect(useStoriaStore.getState().projects.length).toBe(1);
    });

    const createdProject = useStoriaStore.getState().project;
    expect(createdProject.speakers.length).toBeGreaterThanOrEqual(2);
    expect(createdProject.blocks.length).toBeGreaterThanOrEqual(4);
  });

  it('extracts cast from character bible document, stages cards with archetypes & EQ, and allows creating episode or importing cast', async () => {
    const store = useStoriaStore.getState();
    store.resetToSampleProject();
    const initialEpisodeCount = store.projects.length;
    const initialSpeakerCount = store.project.speakers.length;
    store.setEpisodePropertiesModalOpen(true);

    render(<ProjectPropertiesModal />);

    // Attach mock character bible for Ena, Mare, and Foxy
    const docContent = `
      RAZRADA LIKOVA:
      Matija "Mate Fox" (Foxy): DJ m@tise, Lazareti organizator, 43 godine. Vulpes (Lisica). Promukao noćni glas.
      Ena: Kupari, 25 godina. Bijela čaplja (White Heron), inženjerka sustava, matematička geometrija 14:19. Kristalan analitički glas.
      Mare: Mlini, 26 godina. Crni blavor / morska murina, 135 BPM, flegmatični oklop, duboki ženski alt.
    `;
    const docFile = new File([docContent], 'Razrada Likova_ Ena, Mare i Foxy.docx', {
      type: 'text/plain',
    });

    const fileInput = screen.getByTestId('ai-architect-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [docFile] } });

    await waitFor(() => {
      expect(screen.getByText('Razrada Likova_ Ena, Mare i Foxy.docx')).toBeDefined();
    });

    // Click "Extract Cast from Doc" button
    const extractBtn = screen.getByTestId('ai-extract-cast-btn');
    expect(extractBtn).toBeDefined();
    fireEvent.click(extractBtn);

    // Staged characters panel should appear with 3 character cards
    await waitFor(() => {
      expect(screen.getByTestId('staged-characters-panel')).toBeDefined();
    });

    // Verify extracted characters
    expect(screen.getByText('Matija "Mate Fox" (Foxy)')).toBeDefined();
    expect(screen.getByText('Ena')).toBeDefined();
    expect(screen.getByText('Mare')).toBeDefined();

    // Check archetype badges
    expect(screen.getByText(/Vulpes/)).toBeDefined();
    expect(screen.getByText(/White Heron/)).toBeDefined();
    expect(screen.getByText(/Sea Moray/)).toBeDefined();

    // Check audition button click does not throw
    const auditionBtns = screen.getAllByTestId(/staged-char-audition-btn-/);
    expect(auditionBtns.length).toBe(3);
    fireEvent.click(auditionBtns[0]);

    // Check voice dropdown change
    const voiceSelects = screen.getAllByTestId(/staged-char-voice-select-/);
    fireEvent.change(voiceSelects[0], { target: { value: 'Fenrir' } });
    expect((voiceSelects[0] as HTMLSelectElement).value).toBe('Fenrir');

    // Test Action 1: Import Cast to Active Episode
    const importBtn = screen.getByTestId('import-cast-to-active-btn');
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByTestId('staged-cast-notice-banner')).toBeDefined();
      expect(useStoriaStore.getState().project.speakers.length).toBe(initialSpeakerCount + 3);
    });

    // Test Action 2: Create Episode with Selected Cast
    const createWithCastBtn = screen.getByTestId('create-episode-with-cast-btn');
    fireEvent.click(createWithCastBtn);

    await waitFor(() => {
      expect(useStoriaStore.getState().projects.length).toBe(initialEpisodeCount + 1);
    });

    const newEpisode = useStoriaStore.getState().project;
    expect(newEpisode.speakers.length).toBe(3);
    expect(newEpisode.speakers.some((s) => s.name.includes('Foxy'))).toBe(true);
    expect(newEpisode.speakers.some((s) => s.name.includes('Ena'))).toBe(true);
    expect(newEpisode.speakers.some((s) => s.name.includes('Mare'))).toBe(true);
  });
});
