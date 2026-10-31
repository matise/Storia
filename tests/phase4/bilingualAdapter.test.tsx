import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  adaptBlockBilingually,
  buildBilingualAdapterPrompt,
} from '../../src/services/geminiAgentService';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { AgentDock } from '../../src/components/layout/AgentDock';

describe('Phase 4.4 & 4.5: Bilingual Cultural Adapter & AgentDock Gemini Model Picker', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
  });

  it('enforces Croatian masculine (-o) vs feminine (-la) l-participle morphological gender agreement', async () => {
    const { project } = useStoriaStore.getState();
    const marko = project.speakers.find((s) => s.id === 'spk_marko')!;
    const ana = project.speakers.find((s) => s.id === 'spk_ana')!;

    const testEnglishBlock = {
      ...project.blocks[0],
      text: 'I saw the shadow in the courtyard and I knew the truth.',
    };

    const markoPrompt = buildBilingualAdapterPrompt({
      block: testEnglishBlock,
      speaker: marko,
      sourceLang: 'en',
      targetLang: 'hr',
    });
    expect(markoPrompt).toContain('The speaker is MALE');
    expect(markoPrompt).toContain('"-o / -ao"');

    const anaPrompt = buildBilingualAdapterPrompt({
      block: testEnglishBlock,
      speaker: ana,
      sourceLang: 'en',
      targetLang: 'hr',
    });
    expect(anaPrompt).toContain('The speaker is FEMALE');
    expect(anaPrompt).toContain('"-la / -a"');

    // Verify offline adaptation inflection for Marko vs Ana
    const markoAdaptation = await adaptBlockBilingually({
      block: testEnglishBlock,
      speaker: marko,
      sourceLang: 'en',
      targetLang: 'hr',
    });
    expect(markoAdaptation.adaptedText).toContain('Vidio sam');
    expect(markoAdaptation.adaptedText).toContain('Znao sam');

    const anaAdaptation = await adaptBlockBilingually({
      block: testEnglishBlock,
      speaker: ana,
      sourceLang: 'en',
      targetLang: 'hr',
    });
    expect(anaAdaptation.adaptedText).toContain('Vidjela sam');
    expect(anaAdaptation.adaptedText).toContain('Znala sam');
  });

  it('switches Gemini models via the AgentDock model picker and executes all 4 AI Agent modes', async () => {
    render(<AgentDock />);

    // 1. Test Gemini Model Picker in AgentDock header
    const modelPicker = screen.getByTestId(
      'agent-dock-model-picker'
    ) as HTMLSelectElement;
    expect(modelPicker.value).toBe('gemini-3-flash-preview');

    fireEvent.change(modelPicker, { target: { value: 'gemini-3.1-pro-preview' } });
    expect(useStoriaStore.getState().project.aiSettings.textModel).toBe(
      'gemini-3.1-pro-preview'
    );

    // 2. Test Tab 1: Persona Research + Insert as Dialogue Line
    const runResearchBtn = screen.getByTestId('run-persona-research-btn');
    fireEvent.click(runResearchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('persona-research-response-text')).toBeTruthy();
    });

    const initialBlocksCount = useStoriaStore.getState().project.blocks.length;
    fireEvent.click(screen.getByTestId('insert-research-dialogue-btn'));
    expect(useStoriaStore.getState().project.blocks.length).toBe(
      initialBlocksCount + 1
    );

    // 3. Test Tab 2: Co-Writer
    fireEvent.click(screen.getByTestId('tab-cowriter'));
    fireEvent.click(screen.getByTestId('generate-beats-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('cowriter-beat-card-0')).toBeTruthy();
    });

    // 4. Test Tab 3: Script Doctor
    fireEvent.click(screen.getByTestId('tab-dialogue-doctor'));
    fireEvent.click(screen.getByTestId('run-doctor-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('doctor-option-card-0')).toBeTruthy();
    });

    // 5. Test Tab 4: Bilingual Adapter
    fireEvent.click(screen.getByTestId('tab-bilingual-adapter'));
    fireEvent.click(screen.getByTestId('run-adapter-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('adapter-result-card')).toBeTruthy();
    });
  });
});

