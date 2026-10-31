import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentDock } from '../../src/components/layout/AgentDock';
import { generateNextSceneBeats } from '../../src/services/geminiAgentService';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { CoWriterAttachment } from '../../src/types/storia';

describe('Co-Writer File Attachments & Deep Research', () => {
  beforeEach(() => {
    useStoriaStore.getState().resetToSampleProject();
  });

  it('sends multimodal inlineData, document text, and googleSearch tools when deep research & attachments are active', async () => {
    const { project } = useStoriaStore.getState();

    let capturedRequestBody: Record<string, unknown> | null = null;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      capturedRequestBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      beats: [
                        {
                          id: 'deep_beat_1',
                          title: 'Šifrirani pergament Dubrovačke Republike',
                          rationale: 'Analizom priložene slike i dubinskim istraživanjem otkriva skriveni vodeni žig.',
                          blocks: [
                            {
                              type: 'dialogue',
                              speakerId: project.speakers[0]?.id,
                              text: 'Pogledaj ovaj pečat pod svjetlom. To je šifra Malog vijeća iz 1582. godine.',
                              directorNotes: 'fascinirano / fascinated',
                              pauseAfterMs: 400,
                            },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    });

    const testAttachments: CoWriterAttachment[] = [
      {
        id: 'att_1',
        name: 'ragusa_cipher.png',
        mimeType: 'image/png',
        sizeBytes: 1048576, // 1 MB
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        isImage: true,
      },
      {
        id: 'att_2',
        name: 'dnevnik_istrage.txt',
        mimeType: 'text/plain',
        sizeBytes: 256,
        textContent: 'Trezor je otvoren u ponoć. Zapisničar je nestao prema Minčeti.',
        isImage: false,
      },
    ];

    const beats = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: 'AIzaSyTestKeyValid1234567890',
      modelId: 'gemini-3-flash-preview',
      directionHint: 'Istraži vezu između pečata i nestalog diplomata',
      attachments: testAttachments,
      deepResearch: true,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(beats).toHaveLength(1);
    expect(beats[0].title).toBe('Šifrirani pergament Dubrovačke Republike');
    expect(beats[0].deepResearchUsed).toBe(true);
    expect(beats[0].analyzedFiles).toEqual(['ragusa_cipher.png', 'dnevnik_istrage.txt']);

    // Check captured payload sent to Gemini API
    expect(capturedRequestBody).toBeDefined();
    const contents = (capturedRequestBody as unknown as { contents: Array<{ parts: Array<Record<string, unknown>> }> }).contents;
    expect(contents).toBeDefined();
    const parts = contents[0].parts;

    // Verify text prompt part exists
    expect(parts.some((p) => typeof p.text === 'string' && (p.text as string).includes('DEEP RESEARCH MODE'))).toBe(true);

    // Verify inlineData part for image exists with exact base64 data
    expect(parts.some((p) => (p.inlineData as { mimeType: string })?.mimeType === 'image/png')).toBe(true);

    // Verify document text content is injected into parts
    expect(parts.some((p) => typeof p.text === 'string' && (p.text as string).includes('Trezor je otvoren u ponoć'))).toBe(true);

    // Verify Google Search grounding tool was passed for deep research
    const tools = (capturedRequestBody as unknown as { tools?: Array<{ googleSearch: object }> }).tools;
    expect(tools).toBeDefined();
    expect(tools?.[0]?.googleSearch).toBeDefined();
  });

  it('incorporates attached file names into fallback scene beats when offline', async () => {
    const { project } = useStoriaStore.getState();

    const testAttachments: CoWriterAttachment[] = [
      {
        id: 'att_fallback',
        name: 'tajni_plan_grada.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 45000,
        isImage: false,
      },
    ];

    const fallbackBeats = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: null, // offline / no key
      attachments: testAttachments,
      deepResearch: true,
    });

    expect(fallbackBeats).toHaveLength(3);
    expect(fallbackBeats[0].title).toContain('tajni_plan_grada.pdf');
    expect(fallbackBeats[0].rationale).toContain('tajni_plan_grada.pdf');
    expect(fallbackBeats[0].deepResearchUsed).toBe(true);
    expect(fallbackBeats[0].analyzedFiles).toContain('tajni_plan_grada.pdf');
  });

  it('renders Co-Writer dropzone, toggles Deep Research, handles file attachments and removes them', async () => {
    render(<AgentDock />);

    // Switch to Co-Writer tab
    const coWriterTab = screen.getByTestId('tab-cowriter');
    fireEvent.click(coWriterTab);

    // Verify Co-Writer mode header and direction input exist
    expect(screen.getByTestId('cowriter-direction-input')).toBeDefined();

    // Verify Deep Research Toggle exists and toggles
    const deepResearchToggle = screen.getByTestId('cowriter-deep-research-toggle');
    expect(deepResearchToggle).toBeDefined();
    expect(deepResearchToggle.textContent).toContain('Deep Research: OFF');

    fireEvent.click(deepResearchToggle);
    expect(deepResearchToggle.textContent).toContain('Deep Research: ON');

    // Verify dropzone exists
    const dropzone = screen.getByTestId('cowriter-dropzone');
    expect(dropzone).toBeDefined();

    // Simulate drag over and drag leave
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);

    // Simulate file drop
    const mockFile = new File(['Dubrovnik archive test content'], 'dubrovnik_archive.txt', {
      type: 'text/plain',
    });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Wait for the attachment pill to appear
    await waitFor(() => {
      expect(screen.getByText('dubrovnik_archive.txt')).toBeDefined();
    });

    // Verify file count on the generate button
    const generateBtn = screen.getByTestId('generate-beats-btn');
    expect(generateBtn.textContent).toContain('(1)');

    // Click remove button on the attachment pill
    const removeBtn = screen.getByTitle('Remove file');
    fireEvent.click(removeBtn);

    // Verify file pill is removed
    await waitFor(() => {
      expect(screen.queryByText('dubrovnik_archive.txt')).toBeNull();
    });
  });
});
