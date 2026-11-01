import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('SpeakerConfigModal — Tab Navigation & Modular DSP Stack Debugging', () => {
  beforeEach(() => {
    act(() => {
      useStoriaStore.getState().resetToSampleProject();
      useStoriaStore.getState().setUiLanguage('en');
    });
  });

  it('opens SpeakerConfigModal on Voice tab by default and switches between tabs', () => {
    render(<App />);

    const store = useStoriaStore.getState();
    const speaker = store.project.speakers[0];

    // Open speaker modal
    act(() => {
      store.openSpeakerModal(speaker.id);
    });

    // Voice tab should be active by default
    expect(screen.getByTestId('speaker-voice-tab-content')).toBeDefined();

    // Switch to DSP tab
    const dspTabBtn = screen.getByTestId('speaker-tab-dsp');
    act(() => {
      fireEvent.click(dspTabBtn);
    });

    expect(screen.getByTestId('speaker-dsp-tab-content')).toBeDefined();
    expect(screen.getByTestId('speaker-effect-stack-editor')).toBeDefined();

    // Switch to Persona tab
    const personaTabBtn = screen.getByTestId('speaker-tab-persona');
    act(() => {
      fireEvent.click(personaTabBtn);
    });

    expect(screen.getByTestId('speaker-persona-tab-content')).toBeDefined();
  });

  it('opens directly on DSP tab when requested via openSpeakerModal(speakerId, "dsp")', () => {
    render(<App />);

    const store = useStoriaStore.getState();
    const speaker = store.project.speakers[0];

    // Open directly to DSP tab
    act(() => {
      store.openSpeakerModal(speaker.id, 'dsp');
    });

    expect(screen.getByTestId('speaker-dsp-tab-content')).toBeDefined();
    expect(screen.getByTestId('speaker-effect-stack-editor')).toBeDefined();
  });

  it('allows adding Dattorro Plate Reverb module to speaker effect stack and saves changes', () => {
    render(<App />);

    const store = useStoriaStore.getState();
    const speaker = store.project.speakers[0];

    act(() => {
      store.openSpeakerModal(speaker.id, 'dsp');
    });

    // Add Plate Reverb
    const addReverbBtn = screen.getByText('+ Plate Reverb');
    act(() => {
      fireEvent.click(addReverbBtn);
    });

    // Save changes
    const saveBtn = screen.getByTestId('save-speaker-btn');
    act(() => {
      fireEvent.click(saveBtn);
    });

    // Verify persisted speaker has effectStack containing dattorro_reverb
    const updatedSpeaker = useStoriaStore
      .getState()
      .project.speakers.find((s) => s.id === speaker.id);

    expect(updatedSpeaker?.voice.acoustics.effectStack).toBeDefined();
    expect(
      updatedSpeaker?.voice.acoustics.effectStack?.some(
        (m) => m.type === 'dattorro_reverb'
      )
    ).toBe(true);
  });
});
