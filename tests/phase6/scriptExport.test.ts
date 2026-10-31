import { describe, expect, it } from 'vitest';
import {
  exportProjectJson,
  exportToFountain,
  exportToMarkdown,
  importProjectJson,
} from '../../src/services/scriptExportService';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 6 — Step 6.3: Fountain, Markdown & Project Archive Exporters', () => {
  it('exports valid Fountain screenplay syntax with title, character cues, and parentheticals', () => {
    const project = createSampleProject();
    const fountainText = exportToFountain(project);

    expect(fountainText).toContain(`Title: ${project.title}`);
    expect(fountainText).toContain('CAST & CHARACTERS:');

    // Speakers should appear in uppercase
    for (const spk of project.speakers) {
      expect(fountainText).toContain(spk.name.toUpperCase());
    }

    // Direction cues and dialogue text
    const sampleDialogue = project.blocks.find((b) => b.type === 'dialogue');
    if (sampleDialogue) {
      expect(fountainText).toContain(sampleDialogue.text);
    }
  });

  it('exports formatted Markdown production manuscript with stats and character table', () => {
    const project = createSampleProject();
    const mdText = exportToMarkdown(project);

    expect(mdText).toContain(`# ${project.title}`);
    expect(mdText).toContain('## Cast of Characters');
    expect(mdText).toContain('## Production Script');

    // Table header
    expect(mdText).toContain('| Character | Voice Profile | Gender / Age | Notes |');
    expect(mdText).toContain('| # | Timecode | Speaker / Cue | Direction | Dialogue / Text |');
  });

  it('performs lossless Project JSON (.storia.json) export and import round-trip', () => {
    const original = createSampleProject();
    const exportedJson = exportProjectJson(original);

    expect(exportedJson).toContain('"title"');
    expect(exportedJson).toContain('"speakers"');
    expect(exportedJson).toContain('"blocks"');

    const imported = importProjectJson(exportedJson);

    expect(imported.id).toBe(original.id);
    expect(imported.title).toBe(original.title);
    expect(imported.defaultLanguage).toBe(original.defaultLanguage);
    expect(imported.speakers.length).toBe(original.speakers.length);
    expect(imported.blocks.length).toBe(original.blocks.length);

    for (let i = 0; i < original.speakers.length; i++) {
      expect(imported.speakers[i].id).toBe(original.speakers[i].id);
      expect(imported.speakers[i].name).toBe(original.speakers[i].name);
    }

    for (let i = 0; i < original.blocks.length; i++) {
      expect(imported.blocks[i].id).toBe(original.blocks[i].id);
      expect(imported.blocks[i].text).toBe(original.blocks[i].text);
    }
  });

  it('throws descriptive error on invalid or corrupted project JSON input', () => {
    expect(() => importProjectJson('{ corrupted json')).toThrow('Invalid JSON syntax');
    expect(() => importProjectJson('{"title": "No ID"}')).toThrow('missing or invalid "id" field');
    expect(() => importProjectJson('{"id": "p1"}')).toThrow('missing or invalid "title" field');
  });
});

