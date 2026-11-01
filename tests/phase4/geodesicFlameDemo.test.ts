import { describe, expect, it, beforeEach } from 'vitest';
import { createGeodesicFlameProject, createInitialProjectLibrary } from '../../src/i18n/sampleProject';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { buildPersonaResearchSystemPrompt } from '../../src/services/geminiAgentService';

describe('The Triad of the Geodesic Flame Demo Project (Dubrovnik Vernacular Cast)', () => {
  beforeEach(() => {
    localStorage.clear();
    useStoriaStore.getState().resetToSampleProject();
  });

  it('creates the authentic Geodesic Flame project with Croatian language and Dubrovnik dialect', () => {
    const project = createGeodesicFlameProject();

    expect(project.id).toBe('proj_geodesic_flame_demo');
    expect(project.title).toContain('Trijada Geodetskog Plamena');
    expect(project.title).toContain('The Triad of the Geodesic Flame');
    expect(project.defaultLanguage).toBe('hr');
    expect(project.dialect).toBe('dubrovnik');
    expect(project.dubrovnikRegister).toBe('contemporary');
    expect(project.metadata?.author).toContain('Mate Fox Banchilo');
    expect(project.metadata?.targetWpm).toBe(135);
  });

  it('configures the three cast members (eNa, Mara, Foxy) with Croatian personas, acting notes, and acoustics', () => {
    const project = createGeodesicFlameProject();
    expect(project.speakers).toHaveLength(3);

    const [ena, mara, foxy] = project.speakers;

    // 1. eNa (Emothelia)
    expect(ena.id).toBe('spk_ena');
    expect(ena.name).toContain('eNa');
    expect(ena.age).toBe('25');
    expect(ena.gender).toBe('female');
    expect(ena.personaPrompt).toContain('Emothelia');
    expect(ena.personaPrompt).toContain('Čarobnica Rezonancije');
    expect(ena.personaPrompt).toContain('dubrovačkim govorom');
    expect(ena.personaPrompt).toContain('Iscijeli frekvenciju');
    expect(ena.actingNotes).toContain('kristalnom jasnoćom');
    expect(ena.voice.baseVoice).toBe('Aoede');
    expect(ena.voice.acoustics.biquadEq?.enabled).toBe(true);

    // 2. Mara (Maravexia)
    expect(mara.id).toBe('spk_mara');
    expect(mara.name).toContain('Mara');
    expect(mara.age).toBe('25');
    expect(mara.gender).toBe('female');
    expect(mara.personaPrompt).toContain('Maravexia');
    expect(mara.personaPrompt.toLowerCase()).toContain('čuvarica feniksa');
    expect(mara.personaPrompt).toContain('dubrovačkim govorom');
    expect(mara.personaPrompt).toContain('Zapali iskru');
    expect(mara.actingNotes).toContain('Vatreno');
    expect(mara.voice.baseVoice).toBe('Zephyr');
    expect(mara.voice.acoustics.biquadEq?.enabled).toBe(true);

    // 3. Foxy (Mate Fox Banchilo)
    expect(foxy.id).toBe('spk_foxy');
    expect(foxy.name).toContain('Foxy');
    expect(foxy.age).toBe('43');
    expect(foxy.gender).toBe('male');
    expect(foxy.personaPrompt).toContain('Mate Fox Banchilo');
    expect(foxy.personaPrompt).toContain('Meštar Mnogostrukosti');
    expect(foxy.personaPrompt).toContain('Keplerov kut');
    expect(foxy.personaPrompt).toContain('Lazareta');
    expect(foxy.personaPrompt).toContain('Slušaj omjer');
    expect(foxy.actingNotes).toContain('autoritativan bariton');
    expect(foxy.voice.baseVoice).toBe('Fenrir');
    expect(foxy.voice.acoustics.biquadEq?.enabled).toBe(true);
  });

  it('contains dramatized script blocks from Act I & II featuring authentic Dubrovnik dialogue and SFX', () => {
    const project = createGeodesicFlameProject();
    expect(project.blocks.length).toBeGreaterThanOrEqual(9);

    // Block 1: Sea waves and synthetic grid hum
    const sfx1 = project.blocks[0];
    expect(sfx1.type).toBe('sound_effect');
    expect(sfx1.text).toContain('Lazareta');

    // Mara's dialogue
    const maraBlock = project.blocks[1];
    expect(maraBlock.speakerId).toBe('spk_mara');
    expect(maraBlock.text).toContain('gosparu Fox');
    expect(maraBlock.directorNotes).toContain('fiercely');

    // Foxy's response (Block 3)
    const foxyBlock1 = project.blocks[2];
    expect(foxyBlock1.speakerId).toBe('spk_foxy');
    expect(foxyBlock1.text).toContain('pristavljat teću');
    expect(foxyBlock1.text).toContain('zagorjet');

    // eNa's arrival dialogue (Block 4)
    const enaBlock = project.blocks[3];
    expect(enaBlock.speakerId).toBe('spk_ena');
    expect(enaBlock.text).toContain('Muči, Mare');
    expect(enaBlock.text).toContain('volte Lazareta');
    expect(enaBlock.text).toContain('čeljad');
    expect(enaBlock.directorNotes).toContain('kristalnog zvona');

    // Foxy's dialogue (Block 5)
    const foxyBlock2 = project.blocks[4];
    expect(foxyBlock2.speakerId).toBe('spk_foxy');
    expect(foxyBlock2.text).toContain('Keplerovom omjeru');
    expect(foxyBlock2.directorNotes).toContain('biquaternionskom emiteru');

    // Sub-bass transient sfx (Block 7)
    const sfx2 = project.blocks[6];
    expect(sfx2.type).toBe('sound_effect');
    expect(sfx2.text).toContain('zvučnog mehanizma');

    // Total duration is calculated by pacing calculator
    expect(project.blocks.every((b) => (b.estimatedDurationSec ?? 0) > 0)).toBe(true);
  });

  it('loads seamlessly into the global store via loadGeodesicFlameDemo and episode switcher', () => {
    const store = useStoriaStore.getState();

    // Trigger one-click demo load
    store.loadGeodesicFlameDemo();

    const activeProject = useStoriaStore.getState().project;
    expect(activeProject.id).toBe('proj_geodesic_flame_demo');
    expect(activeProject.title).toContain('Trijada Geodetskog Plamena');
    expect(activeProject.speakers.map((s) => s.id)).toEqual(['spk_ena', 'spk_mara', 'spk_foxy']);

    // Check research notebook entry
    expect(activeProject.researchNotebook).toBeDefined();
    expect(activeProject.researchNotebook?.[0]?.query).toContain('Keplerov kut');

    // Check Gemini Agent Prompt Generation with Foxy's Dubrovnik persona
    const foxySpeaker = activeProject.speakers.find((s) => s.id === 'spk_foxy')!;
    const foxyPrompt = buildPersonaResearchSystemPrompt(
      foxySpeaker,
      activeProject.defaultLanguage,
      activeProject.dialect,
      activeProject.dubrovnikRegister
    );

    expect(foxyPrompt).toContain('Mate Fox Banchilo');
    expect(foxyPrompt).toContain('DUBROVAČKI GOVOR');
    expect(foxyPrompt).toContain('Keplerov kut');
  });

  it('is included in the initial project library for episode switching', () => {
    const library = createInitialProjectLibrary();
    const demoInLib = library.find((p) => p.id === 'proj_geodesic_flame_demo');

    expect(demoInLib).toBeDefined();
    expect(demoInLib?.title).toContain('Trijada Geodetskog Plamena');
  });
});
