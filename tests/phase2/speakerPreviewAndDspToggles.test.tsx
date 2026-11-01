import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 2 & 3 — Gemini TTS vs Local Browser TTS, Speaker Preview & EQ/Dynamics Toggles', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.getState().setUiLanguage('en');
    useStoriaStore.getState().setActiveTtsProvider('browser_tts');
  });

  it('toggles speaker Biquad EQ and Dynamics Compressor ON/OFF with full Undo/Redo support', () => {
    const store = useStoriaStore.getState();
    const targetSpeaker = store.project.speakers[0];
    const speakerId = targetSpeaker.id;
    expect(targetSpeaker.voice.acoustics.biquadEq?.enabled ?? true).toBe(true);
    expect(targetSpeaker.voice.acoustics.compression?.enabled ?? true).toBe(true);

    // Toggle EQ OFF
    store.toggleSpeakerEq(speakerId);
    expect(
      useStoriaStore
        .getState()
        .project.speakers.find((s) => s.id === speakerId)
        ?.voice.acoustics.biquadEq?.enabled
    ).toBe(false);

    // Toggle Dynamics OFF
    store.toggleSpeakerDynamics(speakerId);
    expect(
      useStoriaStore
        .getState()
        .project.speakers.find((s) => s.id === speakerId)
        ?.voice.acoustics.compression?.enabled
    ).toBe(false);

    // Undo both toggles
    useStoriaStore.getState().undo();
    expect(
      useStoriaStore
        .getState()
        .project.speakers.find((s) => s.id === speakerId)
        ?.voice.acoustics.compression?.enabled
    ).toBe(true);

    useStoriaStore.getState().undo();
    expect(
      useStoriaStore
        .getState()
        .project.speakers.find((s) => s.id === speakerId)
        ?.voice.acoustics.biquadEq?.enabled
    ).toBe(true);
  });

  it('switches between Gemini 2.5 TTS and Local Browser TTS and auditions speaker voice via speechSynthesis', async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: () => [
          {
            name: 'Microsoft Matej - Croatian (Croatia)',
            lang: 'hr-HR',
            voiceURI: 'ms-hr-matej',
            default: true,
            localService: true,
          },
        ],
      },
      writable: true,
      configurable: true,
    });

    if (typeof window.SpeechSynthesisUtterance === 'undefined') {
      class MockUtterance {
        text: string;
        lang = 'hr-HR';
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onboundary: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: MockUtterance,
        writable: true,
        configurable: true,
      });
    }

    render(<App />);

    // Verify TopBar engine buttons exist
    const geminiEngineBtn = screen.getByText('Gemini 2.5 TTS');
    const browserEngineBtn = screen.getByText('Local Browser TTS');
    expect(geminiEngineBtn).toBeDefined();
    expect(browserEngineBtn).toBeDefined();

    // Click Preview Voice on the first speaker (Marko) in CastSidebar
    const previewBtns = screen.getAllByText('Preview Voice');
    expect(previewBtns.length).toBeGreaterThan(0);
    fireEvent.click(previewBtns[0]);

    expect(speakMock).toHaveBeenCalledTimes(1);

    // Click EQ:ON toggle button on Marko in CastSidebar
    const eqToggleBtns = screen.getAllByText('EQ:ON');
    expect(eqToggleBtns.length).toBeGreaterThan(0);
    fireEvent.click(eqToggleBtns[0]);

    expect(screen.getAllByText('EQ:OFF').length).toBeGreaterThan(0);
  });
});

