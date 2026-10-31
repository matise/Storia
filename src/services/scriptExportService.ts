import { Project } from '../types/storia';
import { formatDurationReadout } from '../core/pacing/pacingCalculator';

/**
 * Exports the project script into industry standard Fountain screenplay syntax (.fountain).
 * Specs:
 * - Title page metadata: Title, Author, Draft Date, Genre, Notes.
 * - Scene Headings / Directions: Centered or capitalized.
 * - Character Cues: Uppercase speaker name.
 * - Parentheticals: (director notes).
 * - Dialogue: Indented / standard block.
 * - Sound Effects: Explicit SFX transition / action cues.
 */
export function exportToFountain(project: Project): string {
  const lines: string[] = [];

  // Title Page
  lines.push(`Title: ${project.title}`);
  if (project.metadata?.author) {
    lines.push(`Author: ${project.metadata.author}`);
  }
  lines.push(`Draft date: ${new Date(project.updatedAt || Date.now()).toLocaleDateString()}`);
  if (project.metadata?.genre) {
    lines.push(`Genre: ${project.metadata.genre}`);
  }
  lines.push(`Notes: Exported from Storia Studio (Default Language: ${project.defaultLanguage.toUpperCase()})`);
  lines.push('');
  lines.push('===');
  lines.push('');

  // Cast list as initial action note
  if (project.speakers.length > 0) {
    lines.push('CAST & CHARACTERS:');
    for (const spk of project.speakers) {
      lines.push(`- ${spk.name} (${spk.gender}, ${spk.age}): ${spk.actingNotes || spk.personaPrompt}`);
    }
    lines.push('');
    lines.push('===');
    lines.push('');
  }

  const speakerMap = new Map<string, string>();
  for (const s of project.speakers) {
    speakerMap.set(s.id, s.name);
  }

  // Script blocks
  for (let i = 0; i < project.blocks.length; i++) {
    const block = project.blocks[i];

    if (block.type === 'direction') {
      lines.push(`> ${block.text} <`);
      lines.push('');
      continue;
    }

    if (block.type === 'sound_effect') {
      const preset = block.sfxCategory ? `[${block.sfxCategory}]` : '';
      lines.push(`.SFX: ${block.text || 'Sound cue'} ${preset}`);
      lines.push('');
      continue;
    }

    // Dialogue & Narration
    const speakerName = (block.speakerId ? speakerMap.get(block.speakerId) : undefined) ||
      (block.type === 'narration' ? 'NARRATOR' : 'VOICE');

    lines.push(speakerName.toUpperCase());

    if (block.directorNotes && block.directorNotes.trim()) {
      const cleanedCue = block.directorNotes.replace(/^\[|\]$/g, '').trim();
      lines.push(`(${cleanedCue})`);
    }

    lines.push(block.text || '...');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exports the project script as formatted Markdown (.md) manuscript
 * including summary statistics, cast table, duration, tokens, and timestamped lines.
 */
export function exportToMarkdown(project: Project): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${project.title}`);
  if (project.description) {
    lines.push(`> *${project.description}*`);
    lines.push('');
  }

  lines.push(`- **Author:** ${project.metadata?.author || 'Storia Studio'}`);
  lines.push(`- **Genre:** ${project.metadata?.genre || 'Audio Drama'}`);
  lines.push(`- **Language:** ${project.defaultLanguage.toUpperCase()}`);
  lines.push(`- **Target Pacing:** ${project.metadata?.targetWpm || 140} WPM`);
  lines.push(`- **Broadcast Mastering:** ${project.audioConfig.sampleRate} Hz, ${project.audioConfig.bitDepth}-bit, Target ${project.audioConfig.targetLufs} LUFS`);
  lines.push('');

  // Cast Table
  lines.push('## Cast of Characters');
  lines.push('');
  lines.push('| Character | Voice Profile | Gender / Age | Notes |');
  lines.push('|---|---|---|---|');
  for (const spk of project.speakers) {
    lines.push(`| **${spk.name}** | ${spk.voice.baseVoice} | ${spk.gender}, ${spk.age} | ${spk.actingNotes || spk.personaPrompt} |`);
  }
  lines.push('');

  // Script Table / Breakdown
  lines.push('## Production Script');
  lines.push('');
  lines.push('| # | Timecode | Speaker / Cue | Direction | Dialogue / Text |');
  lines.push('|---|---|---|---|---|');

  const speakerMap = new Map<string, string>();
  for (const s of project.speakers) {
    speakerMap.set(s.id, s.name);
  }

  for (let i = 0; i < project.blocks.length; i++) {
    const b = project.blocks[i];
    const timecode = `[${formatDurationReadout(b.startTimeSec ?? 0, true)}]`;
    const speaker = b.speakerId ? (speakerMap.get(b.speakerId) || 'Unknown') : b.type.toUpperCase();
    const cue = b.directorNotes ? `*${b.directorNotes}*` : '-';
    const text = b.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

    lines.push(`| ${i + 1} | \`${timecode}\` | **${speaker}** | ${cue} | ${text} |`);
  }
  lines.push('');

  // Research Notebook Appendix (if present)
  if (project.researchNotebook && project.researchNotebook.length > 0) {
    lines.push('## Persona Research Notebook');
    lines.push('');
    for (const record of project.researchNotebook) {
      const spk = speakerMap.get(record.speakerId) || 'Character';
      lines.push(`### Query: "${record.query}" (POV: ${spk})`);
      lines.push(`> ${record.personaResponse}`);
      lines.push('');
      if (record.sources && record.sources.length > 0) {
        lines.push('**Verified Sources:**');
        for (const src of record.sources) {
          lines.push(`- [${src.title}](${src.uri})`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Losslessly serializes a Project into a JSON bundle string (.storia.json),
 * stripping heavy memory Float32Array peak buffers so it is lean, portable, and git-friendly.
 */
export function exportProjectJson(project: Project): string {
  const cleanProject: Project = {
    ...project,
    blocks: project.blocks.map(({ waveformPeaks: _wp, ...rest }) => rest),
  };
  return JSON.stringify(cleanProject, null, 2);
}

/**
 * Validates and parses a raw JSON string into a verified Storia Project instance.
 */
export function importProjectJson(jsonStr: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Invalid JSON syntax in project bundle: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid project bundle: root element must be a valid JSON object.');
  }

  const p = parsed as Partial<Project>;
  if (!p.id || typeof p.id !== 'string') {
    throw new Error('Invalid project bundle: missing or invalid "id" field.');
  }
  if (!p.title || typeof p.title !== 'string') {
    throw new Error('Invalid project bundle: missing or invalid "title" field.');
  }
  if (!Array.isArray(p.speakers)) {
    throw new Error('Invalid project bundle: "speakers" must be an array.');
  }
  if (!Array.isArray(p.blocks)) {
    throw new Error('Invalid project bundle: "blocks" must be an array.');
  }

  // Ensure default structures are populated
  const validatedProject: Project = {
    id: p.id,
    title: p.title,
    description: p.description || '',
    defaultLanguage: p.defaultLanguage === 'en' ? 'en' : 'hr',
    speakers: p.speakers,
    blocks: p.blocks.map((b, idx) => ({
      ...b,
      order: b.order !== undefined ? b.order : idx,
      ttsStatus: b.ttsStatus || 'unrendered',
    })),
    researchNotebook: Array.isArray(p.researchNotebook) ? p.researchNotebook : [],
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    metadata: {
      author: p.metadata?.author || 'Storia Studio',
      genre: p.metadata?.genre || 'Audio Drama',
      targetWpm: p.metadata?.targetWpm || 140,
    },
    audioConfig: {
      sampleRate: p.audioConfig?.sampleRate === 44100 ? 44100 : 48000,
      bitDepth: p.audioConfig?.bitDepth === 16 ? 16 : p.audioConfig?.bitDepth === 32 ? 32 : 24,
      dither: p.audioConfig?.dither === 'none' ? 'none' : 'tpdf',
      targetLufs: typeof p.audioConfig?.targetLufs === 'number' ? p.audioConfig.targetLufs : -16.0,
      truePeakLimitDb: typeof p.audioConfig?.truePeakLimitDb === 'number' ? p.audioConfig.truePeakLimitDb : -1.0,
    },
    aiSettings: {
      apiKey: p.aiSettings?.apiKey,
      textModel: p.aiSettings?.textModel || 'gemini-2.5-flash',
      ttsModel: p.aiSettings?.ttsModel || 'gemini-2.5-flash-preview-tts',
      ttsProvider: p.aiSettings?.ttsProvider || 'gemini_tts',
      enableSearchGrounding: Boolean(p.aiSettings?.enableSearchGrounding),
      temperature: typeof p.aiSettings?.temperature === 'number' ? p.aiSettings.temperature : 0.7,
      audioOutputFormat: p.aiSettings?.audioOutputFormat || 'pcm_48khz',
    },
  };

  return validatedProject;
}

/**
 * Triggers a native browser file download for a Blob or string content.
 */
export function triggerBrowserFileDownload(
  content: Blob | string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  if (typeof window === 'undefined') return;

  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

