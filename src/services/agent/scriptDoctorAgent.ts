import {
  CroatianDialect,
  DubrovnikRegister,
  GeminiTextModelId,
  ScriptBlock,
  ScriptDoctorOption,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import { calculateBlockPacing } from '../../core/pacing/pacingCalculator';
import { transformToDubrovnikDialect } from '../../core/dubrovnik/dubrovnikPhonetics';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
} from './dubrovnikAgentInstructions';

export function buildFallbackDoctorOptions(
  block: ScriptBlock,
  speaker: Speaker | undefined,
  targetWpm: number,
  language: SupportedLanguage
): ScriptDoctorOption[] {
  const baseText = block.text.trim();
  const sentences = baseText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const tightenedText =
    sentences.length > 1
      ? sentences[0]
      : baseText.length > 65
        ? `${baseText.slice(0, 62).trim()}...`
        : baseText;

  const subtextText =
    language === 'hr'
      ? `[kratak uzdah] ${baseText}`
      : `[short sigh] ${baseText}`;

  const dramaticText =
    language === 'hr'
      ? `${sentences[0] ?? baseText} <break time="350ms"/> ${sentences.slice(1).join(' ') || 'Ali u to više nitko ne vjeruje.'}`
      : `${sentences[0] ?? baseText} <break time="350ms"/> ${sentences.slice(1).join(' ') || 'Though nobody believes that anymore.'}`;

  const rawCandidates = [
    {
      id: 'doc_tight',
      styleLabel: language === 'hr' ? 'Sažeti govorni ritam (Kraće)' : 'Tighter Spoken Cadence',
      text: tightenedText,
      directorNotes: language === 'hr' ? 'odlučno, brzo / brisk' : 'brisk, focused',
      rationale:
        language === 'hr'
          ? 'Uklanja suvišne klauzule radi prirodnijeg izgovora u jednom dahu.'
          : 'Trims literary clauses for punchier single-breath delivery.',
    },
    {
      id: 'doc_subtext',
      styleLabel:
        language === 'hr'
          ? 'Organska didaskalija i podtekst'
          : 'High Subtext & Breath Cue',
      text: subtextText,
      directorNotes:
        language === 'hr' ? 'šapatom, uz uzdah / whispered sigh' : 'whispered, weary',
      rationale:
        language === 'hr'
          ? 'Dodaje akustički udah prije replike za veću mikrofonsku intimnost.'
          : 'Injects an organic breath cue before the line for close-mic intimacy.',
    },
    {
      id: 'doc_dramatic',
      styleLabel:
        language === 'hr' ? 'Dramska cezura (SSML pauza)' : 'Dramatic Caesura (SSML Pause)',
      text: dramaticText.trim(),
      directorNotes: language === 'hr' ? 'ironično / sardonically' : 'sardonically',
      rationale:
        language === 'hr'
          ? 'Umeće preciznu cezuru od 350ms za naglašavanje poante.'
          : 'Inserts a 350ms theatrical beat before the closing clause.',
    },
  ];

  return rawCandidates.map((cand) => {
    const pacing = calculateBlockPacing(
      {
        text: cand.text,
        type: block.type,
        pauseAfterMs: block.pauseAfterMs,
      },
      speaker,
      targetWpm
    );
    return {
      ...cand,
      estimatedDurationSec: pacing.estimatedDurationSec,
      audioTokenEstimate: pacing.audioTokenEstimate,
    };
  });
}

/**
 * Step 4.3: Script Doctor & Vocal Cadence Polisher.
 * Rewrites a draft ScriptBlock into 3 spoken-cadence alternatives with duration & token telemetry.
 */
export async function doctorDialogueBlock(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  targetWpm?: number;
  language: SupportedLanguage;
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  fetchImpl?: typeof fetch;
  abortSignal?: AbortSignal;
}): Promise<ScriptDoctorOption[]> {
  const {
    block,
    speaker,
    targetWpm = 140,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    dialect,
    dubrovnikRegister,
    fetchImpl = fetch,
    abortSignal,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    const fallbacks = buildFallbackDoctorOptions(block, speaker, targetWpm, language);
    if (dialect === 'dubrovnik' && language === 'hr') {
      return fallbacks.map((opt) => ({
        ...opt,
        text: transformToDubrovnikDialect(opt.text, dubrovnikRegister),
        styleLabel: opt.styleLabel + ' (Dubrovački)',
      }));
    }
    return fallbacks;
  }

  const dubrovnikDialectPrompt =
    language === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  const prompt = [
    `You are an audio drama Script Doctor polishing a spoken line for ${
      speaker?.name ?? 'Speaker'
    } (${speaker?.personaPrompt ?? 'natural voice'}).`,
    `Original Line: "${block.text}"`,
    `Current Director Notes: "${block.directorNotes ?? ''}"`,
    `Language: ${language === 'hr' ? 'Croatian (hr)' : 'English (en)'}`,
    dubrovnikDialectPrompt,
    'Return ONLY a JSON object with property "options" containing 3 polished alternatives:',
    '{ "options": [ { "id": "doc_1", "styleLabel": "...", "text": "...", "directorNotes": "...", "rationale": "..." } ] }',
  ]
    .filter(Boolean)
    .join('\n');

  const endpoint = buildGeminiEndpoint(modelId, apiKey);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawJson !== 'string') {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
    }

    const parsed = JSON.parse(rawJson) as {
      options?: Array<{
        id?: string;
        styleLabel?: string;
        text?: string;
        directorNotes?: string;
        rationale?: string;
      }>;
    };

    if (!Array.isArray(parsed.options) || parsed.options.length === 0) {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
    }

    return parsed.options.slice(0, 3).map((opt, idx) => {
      const text = (opt.text || block.text).trim();
      const pacing = calculateBlockPacing(
        { text, type: block.type, pauseAfterMs: block.pauseAfterMs },
        speaker,
        targetWpm
      );
      return {
        id: opt.id || `doc_${idx + 1}`,
        styleLabel: opt.styleLabel || `Option ${idx + 1}`,
        text,
        directorNotes: opt.directorNotes || block.directorNotes || 'prirodno / natural',
        rationale: opt.rationale || '',
        estimatedDurationSec: pacing.estimatedDurationSec,
        audioTokenEstimate: pacing.audioTokenEstimate,
      };
    });
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
  }
}

