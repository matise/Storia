import { describe, it, expect, vi } from 'vitest';
import {
  buildPersonaResearchSystemPrompt,
  extractGroundingSources,
  runPersonaResearch,
} from '../../src/services/geminiAgentService';
import { createNoirSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 4.1: Persona-Grounded Research & Citation Extractor', () => {
  it('constructs dual-layer system instructions for Marko (HR) and Ana (EN) with gender agreement rules', () => {
    const speakers = createNoirSampleProject().speakers;
    const marko = speakers.find((s) => s.id === 'spk_marko')!;
    const ana = speakers.find((s) => s.id === 'spk_ana')!;

    const markoHrPrompt = buildPersonaResearchSystemPrompt(marko, 'hr');
    expect(markoHrPrompt).toContain('Marko');
    expect(markoHrPrompt).toContain(marko.personaPrompt);
    expect(markoHrPrompt).toContain('GRAMATIČKI ROD: Muški');
    expect(markoHrPrompt).toContain('"rekao sam"');

    const anaHrPrompt = buildPersonaResearchSystemPrompt(ana, 'hr');
    expect(anaHrPrompt).toContain('GRAMATIČKI ROD: Ženski');
    expect(anaHrPrompt).toContain('"rekla sam"');

    const anaEnPrompt = buildPersonaResearchSystemPrompt(ana, 'en');
    expect(anaEnPrompt).toContain('You are Ana');
    expect(anaEnPrompt).toContain('Answer STRICTLY in first-person ("I")');
  });

  it('extracts unique GroundingSource[] citations from Gemini groundingMetadata and handles missing metadata gracefully', () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'U Zagrebu smo nosili FN Browning Model 1922.' }],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: 'https://www.hpm.hr/zbirka-oruzja',
                  title: 'Hrvatski povijesni muzej',
                },
              },
              {
                web: {
                  uri: 'https://www.mgz.hr/arhiv',
                  title: 'Muzej grada Zagreba',
                },
              },
              // Duplicate URI should be deduplicated
              {
                web: {
                  uri: 'https://www.hpm.hr/zbirka-oruzja',
                  title: 'Duplicate HPM',
                },
              },
            ],
          },
        },
      ],
    };

    const sources = extractGroundingSources(mockGeminiResponse);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({
      uri: 'https://www.hpm.hr/zbirka-oruzja',
      title: 'Hrvatski povijesni muzej',
    });
    expect(sources[1]).toEqual({
      uri: 'https://www.mgz.hr/arhiv',
      title: 'Muzej grada Zagreba',
    });

    expect(extractGroundingSources({})).toEqual([]);
    expect(extractGroundingSources(null)).toEqual([]);
  });

  it('dispatches runPersonaResearch to the selected Gemini model endpoint with Google Search grounding tool', async () => {
    const marko = createNoirSampleProject().speakers.find((s) => s.id === 'spk_marko')!;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Nosio sam belgijski FN Model 1922 ispod balonera svake noći.',
                },
              ],
            },
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://www.hpm.hr/',
                    title: 'Hrvatski povijesni muzej',
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    const record = await runPersonaResearch({
      speaker: marko,
      query: 'Kakve je pištolje koristila zagrebačka policija 1938. godine?',
      language: 'hr',
      apiKey: 'AIzaSyTestKey1234567890',
      modelId: 'gemini-3.1-pro-preview',
      enableSearchGrounding: true,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('models/gemini-3.1-pro-preview:generateContent');
    const body = JSON.parse(calledInit.body);
    expect(body.tools).toEqual([{ google_search: {} }]);

    expect(record.personaResponse).toContain('FN Model 1922');
    expect(record.modelUsed).toBe('gemini-3.1-pro-preview');
    expect(record.sources[0].uri).toBe('https://www.hpm.hr/');
  });
});

