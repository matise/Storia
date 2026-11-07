import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { AgentDock } from '../../src/components/layout/AgentDock';
import {
  generateNextSceneBeats,
  parsePodcastTranscriptDocument,
} from '../../src/services/geminiAgentService';
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
  }, 15000);

  it('parses structured podcast transcript documents (Format, Sugovornici, Tema, [00:00:00] sections, Voditelj 1/2) when Co-Writer is set to podcast_episode', async () => {
    const { project } = useStoriaStore.getState();

    const sampleTranscriptDoc = `
Dubinska analiza: Analogni presretač i arhitektura Mate
Foxa

Format: Transkript audio podcasta
Sugovornici: Voditelj 1 i Voditelj 2
Tema: Ekonomija protudronske obrane (C-UAS), rotacijski stabiliziran let pri visokim RPM-ovima i
mješovito analogno-digitalno vođenje
________________________________________________________

[00:00:00] 1. dio: Zamka eskalacije i ekonomija ratovanja dronovima
Voditelj 1: Znaš, kad inače razgovaramo o najnaprednijoj vojnoj tehnologiji, uvijek postoji to prešutno
očekivanje... pa, očekivanje *nečeg većeg*, zar ne?

Voditelj 2: Da. Više procesorske snage, veći podatkovni centri, brža digitalna superračunala. Nekako
smo prihvatili ideju da je stvarnost samo iznimno složen engine za renderiranje.

Voditelj 1: Upravo to. I ako želiš poraziti tehnološki naprednu prijetnju, jednostavno izgradiš veći, brži
digitalni mozak koji će je matematički nadmudriti.

Voditelj 2: Da, mislim, to je standardni obrazac eskalacije na koji se oslanjamo već desetljećima.
`.trim();

    const parsed = parsePodcastTranscriptDocument({
      text: sampleTranscriptDoc,
      speakers: project.speakers,
      language: 'hr',
      sourceFileName: 'mate_fox_podcast.txt',
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe(
      'Dubinska analiza: Analogni presretač i arhitektura Mate Foxa'
    );
    expect(parsed!.format).toBe('Transkript audio podcasta');
    expect(parsed!.topic).toBe(
      'Ekonomija protudronske obrane (C-UAS), rotacijski stabiliziran let pri visokim RPM-ovima i mješovito analogno-digitalno vođenje'
    );
    expect(parsed!.declaredSpeakers).toEqual(['Voditelj 1', 'Voditelj 2']);
    expect(parsed!.speakerMappingSummary).toHaveLength(2);

    const direct = parsed!.directCandidate;
    expect(direct.isParsedTranscript).toBe(true);
    expect(direct.blocks).toHaveLength(5); // 1 section header + 4 dialogue turns

    // Block 0: Section header [00:00:00] 1. dio: ...
    expect(direct.blocks[0].type).toBe('narration');
    expect(direct.blocks[0].text).toBe(
      '1. dio: Zamka eskalacije i ekonomija ratovanja dronovima'
    );
    expect(direct.blocks[0].directorNotes).toContain('00:00:00');

    // Blocks 1..4: Alternating Voditelj 1 (speakers[0]) and Voditelj 2 (speakers[1])
    expect(direct.blocks[1].type).toBe('dialogue');
    expect(direct.blocks[1].speakerId).toBe(project.speakers[0].id);
    expect(direct.blocks[1].text).toContain('očekivanje nečeg većeg, zar ne?');

    expect(direct.blocks[2].type).toBe('dialogue');
    expect(direct.blocks[2].speakerId).toBe(project.speakers[1].id);
    expect(direct.blocks[2].text).toContain('iznimno složen engine za renderiranje.');

    expect(direct.blocks[3].speakerId).toBe(project.speakers[0].id);
    expect(direct.blocks[4].speakerId).toBe(project.speakers[1].id);

    // Also test via generateNextSceneBeats in podcast_episode mode with attachment
    const candidates = await generateNextSceneBeats({
      precedingBlocks: project.blocks,
      speakers: project.speakers,
      language: 'hr',
      apiKey: null,
      mode: 'podcast_episode',
      attachments: [
        {
          id: 'att_podcast_1',
          name: 'mate_fox_podcast.txt',
          mimeType: 'text/plain',
          sizeBytes: sampleTranscriptDoc.length,
          textContent: sampleTranscriptDoc,
          isImage: false,
        },
      ],
    });

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0].title).toBe(
      'Dubinska analiza: Analogni presretač i arhitektura Mate Foxa'
    );
    expect(candidates[0].isParsedTranscript).toBe(true);
    expect(candidates[0].blocks).toHaveLength(5);
  });

  it('loads parsed podcast transcript as full episode from AgentDock UI', async () => {
    render(<AgentDock width={380} />);

    fireEvent.click(screen.getByTestId('tab-cowriter'));
    fireEvent.click(screen.getByTestId('cowriter-mode-podcast_episode'));

    const transcriptText = [
      'Dubinska analiza: Analogni presretač i arhitektura Mate Foxa',
      'Format: Transkript audio podcasta',
      'Sugovornici: Voditelj 1 i Voditelj 2',
      'Tema: Ekonomija protudronske obrane (C-UAS)',
      '---',
      '[00:00:00] 1. dio: Zamka eskalacije',
      'Voditelj 1: Prva replika prvog voditelja o tehnologiji.',
      'Voditelj 2: Druga replika drugog voditelja o arhitekturi.',
    ].join('\n');

    const dropzone = screen.getByTestId('cowriter-dropzone');
    const mockFile = new File([transcriptText], 'podcast_transkript.txt', {
      type: 'text/plain',
    });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] },
    });

    await waitFor(() => {
      expect(screen.getByText('podcast_transkript.txt')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('generate-beats-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('cowriter-transcript-badge-0')).toBeDefined();
    });

    expect(screen.getByTestId('cowriter-speaker-mapping-0')).toBeDefined();

    const loadFullEpisodeBtn = screen.getByTestId('load-podcast-episode-btn-0');
    fireEvent.click(loadFullEpisodeBtn);

    const updatedProject = useStoriaStore.getState().project;
    expect(updatedProject.title).toBe(
      'Dubinska analiza: Analogni presretač i arhitektura Mate Foxa'
    );
    expect(updatedProject.description).toBe(
      'Ekonomija protudronske obrane (C-UAS)'
    );
    expect(updatedProject.blocks).toHaveLength(3);
    expect(updatedProject.blocks[0].type).toBe('narration');
    expect(updatedProject.blocks[1].text).toBe(
      'Prva replika prvog voditelja o tehnologiji.'
    );
    expect(updatedProject.blocks[2].text).toBe(
      'Druga replika drugog voditelja o arhitekturi.'
    );
  });
});
