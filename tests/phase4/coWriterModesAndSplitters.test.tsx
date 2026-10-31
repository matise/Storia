import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../src/App';
import { AgentDock } from '../../src/components/layout/AgentDock';
import { generateNextSceneBeats } from '../../src/services/geminiAgentService';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Co-Writer Mode Selection (Scene, Complete Story, Podcast) & Scalable Panel Splitters', () => {
  beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1440;
    useStoriaStore.getState().resetToSampleProject();
  });

  it('renders Co-Writer mode selector and switches between Scene (3 Beats), Complete Story, and Podcast modes', async () => {
    render(<AgentDock width={380} />);

    // Switch to Co-Writer tab
    const cowriterTab = screen.getByRole('button', { name: /co-writer/i });
    fireEvent.click(cowriterTab);

    // Verify mode selector buttons exist
    const sceneBtn = screen.getByTestId('cowriter-mode-scene_beats');
    const storyBtn = screen.getByTestId('cowriter-mode-complete_story');
    const podcastBtn = screen.getByTestId('cowriter-mode-podcast_episode');

    expect(sceneBtn).toBeTruthy();
    expect(storyBtn).toBeTruthy();
    expect(podcastBtn).toBeTruthy();

    // Default mode is scene_beats
    expect(sceneBtn.className).toContain('bg-indigo-600');

    // Switch to Complete Story mode
    fireEvent.click(storyBtn);
    expect(storyBtn.className).toContain('bg-indigo-600');
    expect(screen.getByTestId('generate-beats-btn').textContent).toMatch(/complete story/i);

    // Switch to Podcast mode
    fireEvent.click(podcastBtn);
    expect(podcastBtn.className).toContain('bg-indigo-600');
    expect(screen.getByTestId('generate-beats-btn').textContent).toMatch(/podcast/i);
  });

  it('generateNextSceneBeats generates a full multi-block arc in complete_story mode', async () => {
    const { project } = useStoriaStore.getState();

    const candidates = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: null, // Test rich offline fallback
      mode: 'complete_story',
    });

    expect(candidates.length).toBeGreaterThan(0);
    const story = candidates[0];
    expect(story.mode).toBe('complete_story');
    expect(story.title).toMatch(/cjelovita priča/i);
    // Story contains rich sequence of blocks: narration, sound effect, dialogues, climax, resolution
    expect(story.blocks.length).toBeGreaterThanOrEqual(8);

    const hasNarration = story.blocks.some((b) => b.type === 'narration');
    const hasSfx = story.blocks.some((b) => b.type === 'sound_effect');
    const hasDialogue = story.blocks.some((b) => b.type === 'dialogue');

    expect(hasNarration).toBe(true);
    expect(hasSfx).toBe(true);
    expect(hasDialogue).toBe(true);
  });

  it('generateNextSceneBeats generates a full podcast script in podcast_episode mode', async () => {
    const { project } = useStoriaStore.getState();

    const candidates = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'en',
      apiKey: null,
      mode: 'podcast_episode',
    });

    expect(candidates.length).toBeGreaterThan(0);
    const podcast = candidates[0];
    expect(podcast.mode).toBe('podcast_episode');
    expect(podcast.title).toMatch(/podcast/i);
    // Podcast contains intro cue, host greeting, guest banter, transition, outro
    expect(podcast.blocks.length).toBeGreaterThanOrEqual(8);

    const hasIntroSfx = podcast.blocks.some(
      (b) => b.type === 'sound_effect' && b.text.toLowerCase().includes('intro')
    );
    expect(hasIntroSfx).toBe(true);
  });

  it('sends mode-specific instructions to Gemini API when complete_story is selected', async () => {
    const { project } = useStoriaStore.getState();
    let capturedBody: Record<string, unknown> | null = null;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
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
                          id: 'story_gemini_1',
                          title: 'The Dubrovnik Conspiracy',
                          rationale: 'Complete story arc.',
                          blocks: [
                            {
                              type: 'narration',
                              text: 'The evening bells echoed across Stradun.',
                              pauseAfterMs: 500,
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

    const candidates = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'en',
      apiKey: 'test-valid-api-key-123456',
      mode: 'complete_story',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(candidates[0].title).toBe('The Dubrovnik Conspiracy');
    const parsedBody = capturedBody as unknown as { contents?: Array<{ parts?: Array<{ text?: string }> }> } | null;
    const promptSent = parsedBody?.contents?.[0]?.parts?.[0]?.text ?? '';
    expect(promptSent).toContain('long complete audio drama story');
  });

  it('renders left and right panel splitters and resizes panels within min/max bounds', () => {
    const { container } = render(<App />);

    const leftSplitter = screen.getByTestId('left-panel-splitter');
    const rightSplitter = screen.getByTestId('right-panel-splitter');

    expect(leftSplitter).toBeTruthy();
    expect(rightSplitter).toBeTruthy();

    // Verify initial default width on left sidebar
    const castAside = container.querySelector('aside.border-r') as HTMLElement;
    expect(castAside.style.width).toBe('280px');

    // Drag left splitter to the right by +60px
    fireEvent.mouseDown(leftSplitter, { clientX: 280 });
    fireEvent.mouseMove(window, { clientX: 340 });
    fireEvent.mouseUp(window);

    expect(castAside.style.width).toBe('340px');
    expect(localStorage.getItem('storia_layout_left_width')).toBe('340');

    // Drag left splitter too far to the left (e.g. -200px) - must clamp at MIN_LEFT_WIDTH (220px)
    fireEvent.mouseDown(leftSplitter, { clientX: 340 });
    fireEvent.mouseMove(window, { clientX: 100 });
    fireEvent.mouseUp(window);

    expect(castAside.style.width).toBe('220px');
    expect(localStorage.getItem('storia_layout_left_width')).toBe('220');

    // Verify right sidebar sizing & clamping
    const agentAside = container.querySelector('aside.border-l') as HTMLElement;
    expect(agentAside.style.width).toBe('360px');

    // Drag right splitter to make it smaller than MIN_RIGHT_WIDTH (280px) -> clamps at 280px
    fireEvent.mouseDown(rightSplitter, { clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 1200 }); // Moving right shrinks right panel
    fireEvent.mouseUp(window);

    expect(agentAside.style.width).toBe('280px');
    expect(localStorage.getItem('storia_layout_right_width')).toBe('280');
  });
});
