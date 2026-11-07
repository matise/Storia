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
});
