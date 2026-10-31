import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  classifySfxPrompt,
  synthesizeSfxAudio,
} from '../../src/services/sfxGeneratorService';
import { encodePcm16ToWavBytes } from '../../src/services/geminiTtsService';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptWorkbench } from '../../src/components/layout/ScriptWorkbench';

describe('Hybrid SFX Generation Engine (Procedural Physical-Modeling + AI Compiler + File Import)', () => {
  beforeEach(async () => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.getState().setActiveTtsProvider('browser_tts');
    await useStoriaStore.getState().purgeAudioCache();
  });

  it('classifies bilingual Croatian and English SFX descriptions into multi-layer physical-modeling recipes', () => {
    const croatianTramRecipe = classifySfxPrompt(
      'Udaljeno škripanje tramvajskih tračnica i tihi koraci po mokrim kockama kaldrme.',
      'ambient stereo field',
      'auto'
    );

    const layerTypes = croatianTramRecipe.layers.map((l) => l.type);
    expect(layerTypes).toContain('tram_rail');
    expect(layerTypes).toContain('footsteps');
    expect(layerTypes).toContain('weather_rain');
    expect(croatianTramRecipe.reverbMix).toBeGreaterThanOrEqual(0.5);
    expect(croatianTramRecipe.distanceLowpassHz).toBeLessThanOrEqual(3500);

    const englishStormRecipe = classifySfxPrompt(
      'Heavy rain on a window with distant thunder and howling wind',
      'stormy night',
      'auto',
      4.5
    );
    const stormLayers = englishStormRecipe.layers.map((l) => l.type);
    expect(stormLayers).toContain('weather_rain');
    expect(stormLayers).toContain('thunder');
    expect(stormLayers).toContain('wind_storm');
    expect(englishStormRecipe.durationSec).toBe(4.5);
  });

  it('synthesizes a sound_effect block into a 24kHz 16-bit WAV Blob and SoA Float32Array waveform peaks', async () => {
    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;
    expect(sfxBlock).toBeDefined();

    // Direct service synthesis check
    const directResult = await synthesizeSfxAudio({
      block: sfxBlock,
      language: 'hr',
      useAiCompiler: false,
    });
    expect(directResult.audioBlob.size).toBeGreaterThan(44);
    expect(directResult.durationSec).toBeGreaterThan(1.5);
    expect(directResult.waveformPeaks.minPeaks).toBeInstanceOf(Float32Array);
    expect(directResult.waveformPeaks.maxPeaks).toBeInstanceOf(Float32Array);
    expect(directResult.waveformPeaks.rmsLevels).toBeInstanceOf(Float32Array);

    // Store synthesis check
    await useStoriaStore.getState().synthesizeBlock(sfxBlock.id);
    const updatedBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === sfxBlock.id)!;

    expect(updatedBlock.ttsStatus).toBe('ok');
    expect(updatedBlock.generatedAudioUrl).toBeDefined();
    expect(updatedBlock.waveformPeaks).toBeDefined();
    expect(updatedBlock.waveformPeaks!.minPeaks.length).toBeGreaterThan(20);
  });

  it('imports a custom WAV audio file onto a sound_effect block and extracts its waveform peaks', async () => {
    const sfxBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.type === 'sound_effect')!;

    // Build a synthetic 0.5-second 24kHz 440Hz sine WAV file
    const sampleRate = 24000;
    const pcm16 = new Int16Array(sampleRate / 2);
    for (let i = 0; i < pcm16.length; i++) {
      pcm16[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 20000);
    }
    const wavBytes = encodePcm16ToWavBytes(
      new Uint8Array(pcm16.buffer),
      sampleRate,
      1
    );
    const customWavFile = new File([wavBytes], 'custom_thunder_foley.wav', {
      type: 'audio/wav',
    });

    await useStoriaStore.getState().importSfxAudioFile(sfxBlock.id, customWavFile);

    const updated = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === sfxBlock.id)!;

    expect(updated.ttsStatus).toBe('ok');
    expect(updated.sfxCategory).toBe('custom_upload');
    expect(updated.customAudioFileName).toBe('custom_thunder_foley.wav');
    expect(updated.sfxDurationSec).toBeCloseTo(0.5, 1);
    expect(updated.estimatedDurationSec).toBeCloseTo(0.5, 1);
    expect(updated.waveformPeaks).toBeDefined();
    expect(updated.waveformPeaks!.maxPeaks.length).toBeGreaterThan(0);
  });

  it('renders SFX Studio controls in ScriptBlockCard and updates preset & duration', async () => {
    const sfxBlock = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.type === 'sound_effect')!;

    render(<ScriptWorkbench />);

    const presetSelect = screen.getByTestId(
      `sfx-category-select-${sfxBlock.id}`
    ) as HTMLSelectElement;
    const durationInput = screen.getByTestId(
      `sfx-duration-input-${sfxBlock.id}`
    ) as HTMLInputElement;
    const importBtn = screen.getByTestId(`sfx-import-btn-${sfxBlock.id}`);
    const generateBtn = screen.getByTestId(`generate-block-btn-${sfxBlock.id}`);

    expect(presetSelect).toBeTruthy();
    expect(durationInput).toBeTruthy();
    expect(importBtn).toBeTruthy();
    expect(generateBtn).toBeTruthy();

    // Change preset to 'thunder' and duration to 5.0s
    fireEvent.change(presetSelect, { target: { value: 'thunder' } });
    fireEvent.change(durationInput, { target: { value: '5' } });

    const modified = useStoriaStore
      .getState()
      .project.blocks.find((b) => b.id === sfxBlock.id)!;
    expect(modified.sfxCategory).toBe('thunder');
    expect(modified.sfxDurationSec).toBe(5);

    // Click generate SFX button
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const rendered = useStoriaStore
        .getState()
        .project.blocks.find((b) => b.id === sfxBlock.id)!;
      expect(rendered.ttsStatus).toBe('ok');
      expect(rendered.waveformPeaks).toBeDefined();
    });
  });
});
