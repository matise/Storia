import {
  AppSettings,
  Project,
  createDefaultMainAuxBus,
  normalizeGeminiVoiceName,
} from '../types/storia';
import {
  createInitialProjectLibrary,
  createSampleProject,
} from '../i18n/sampleProject';
import { recalculateProjectTimeline } from '../core/pacing/pacingCalculator';

export const PROJECT_STORAGE_KEY = 'storia_active_project_v1';
export const PROJECTS_LIBRARY_STORAGE_KEY = 'storia_projects_library_v1';
export const SETTINGS_STORAGE_KEY = 'storia_app_settings_v1';

export function hydrateProjectTimeline(parsed: Project): Project {
  const sanitizedSpeakers = Array.isArray(parsed.speakers)
    ? parsed.speakers.map((s) => ({
        ...s,
        voice: {
          ...s.voice,
          baseVoice: normalizeGeminiVoiceName(s.voice?.baseVoice, s.gender),
        },
      }))
    : [];

  const { blocks } = recalculateProjectTimeline(
    parsed.blocks,
    sanitizedSpeakers,
    parsed.metadata?.targetWpm ?? 140
  );
  const auxBusses =
    parsed.auxBusses && parsed.auxBusses.length > 0
      ? parsed.auxBusses
      : [createDefaultMainAuxBus()];
  return { ...parsed, speakers: sanitizedSpeakers, blocks, auxBusses };
}

export function loadInitialProjectsLibrary(): Project[] {
  try {
    const rawLib = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    if (rawLib) {
      const parsedList = JSON.parse(rawLib) as Project[];
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        return parsedList
          .filter((p) => p && p.id && Array.isArray(p.blocks) && Array.isArray(p.speakers))
          .map(hydrateProjectTimeline);
      }
    }
  } catch {
    // Fallback to initial library
  }
  return createInitialProjectLibrary();
}

export function createEmptyPlaceholderProject(): Project {
  return {
    id: 'empty_library_placeholder',
    title: 'No Episode Loaded',
    description: '',
    defaultLanguage: 'hr',
    dialect: 'standard',
    dubrovnikRegister: 'contemporary',
    speakers: [],
    blocks: [],
    researchNotebook: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      author: '',
      genre: '',
      targetWpm: 140,
    },
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16,
      truePeakLimitDb: -1,
    },
    aiSettings: {
      textModel: 'gemini-2.5-flash',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      ttsProvider: 'gemini_tts',
      temperature: 0.7,
      audioOutputFormat: 'pcm_48khz',
    },
    auxBusses: [createDefaultMainAuxBus()],
  };
}

export function loadInitialProject(library: Project[]): Project {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Project;
      if (parsed && parsed.id && Array.isArray(parsed.blocks) && Array.isArray(parsed.speakers)) {
        return hydrateProjectTimeline(parsed);
      }
    }
  } catch {
    // Fallback to first project in library
  }
  return library[0] ?? createEmptyPlaceholderProject();
}

export function loadInitialSettings(defaultProjectId: string): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      if (parsed && (parsed.uiLanguage === 'en' || parsed.uiLanguage === 'hr')) {
        return parsed;
      }
    }
  } catch {
    // Fallback to default settings
  }
  return {
    uiLanguage: 'en',
    theme: 'dark',
    activeProjectId: defaultProjectId,
    audioBufferSize: 128,
  };
}

export function stripPeaksForStorage(project: Project): Project {
  return {
    ...project,
    blocks: project.blocks.map(({ waveformPeaks: _wp, ...rest }) => rest),
  };
}

export function persistProject(project: Project, library?: Project[]): Project[] {
  const nextLib = library
    ? library.some((p) => p.id === project.id)
      ? library.map((p) => (p.id === project.id ? project : p))
      : [project, ...library]
    : undefined;

  try {
    localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify(stripPeaksForStorage(project))
    );
    if (nextLib) {
      localStorage.setItem(
        PROJECTS_LIBRARY_STORAGE_KEY,
        JSON.stringify(nextLib.map(stripPeaksForStorage))
      );
    }
  } catch {
    // Ignore storage quota errors in restricted test environments
  }

  return nextLib ?? [project];
}

export function persistSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

