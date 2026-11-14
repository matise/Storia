import {
  AgentChatMessage,
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
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';
import { formatRecentChatHistoryForPrompt } from './agentContextBuilder';

export function buildFallbackDoctorOptions(
  block: ScriptBlock,
  speaker: Speaker | undefined,
  targetWpm: number,
  language: SupportedLanguage,
  options?: {
    selectedText?: string;
    customInstruction?: string;
  }
): ScriptDoctorOption[] {
  const baseText = block.text.trim();
  const sel = options?.selectedText?.trim();
  const customHint = options?.customInstruction?.trim();

  if (sel && baseText.includes(sel)) {
    const selWords = sel.split(/\s+/).filter(Boolean);
    const tighterSpan =
      selWords.length > 3
        ? selWords.slice(0, Math.ceil(selWords.length * 0.65)).join(' ')
        : sel;
    const tightFull = baseText.replace(sel, tighterSpan);
    const subtextFull = baseText.replace(
      sel,
      language === 'hr' ? `[tiho] ${sel}` : `[softly] ${sel}`
    );
    const pauseFull = baseText.replace(
      sel,
      `${sel} <break time="300ms"/>`
    );

    const spanCandidates = [
      {
        id: 'doc_tight',
        styleLabel:
          language === 'hr'
            ? `Fokus na odabir: Sažeti izričaj${customHint ? ` (${customHint})` : ''}`
            : `Selection Focus: Tighter Phrasing${customHint ? ` (${customHint})` : ''}`,
        text: tightFull,
        directorNotes: customHint || (language === 'hr' ? 'odlučno, fokusirano' : 'brisk, focused'),
        rationale:
          language === 'hr'
            ? `Sažima označeni dio ("${sel.slice(0, 35)}") uz očuvanje ostatka replike.`
            : `Tightens the highlighted selection ("${sel.slice(0, 35)}") while preserving the surrounding line.`,
      },
      {
        id: 'doc_subtext',
        styleLabel:
          language === 'hr'
            ? 'Fokus na odabir: Naglašeni podtekst'
            : 'Selection Focus: Subtext & Intimacy',
        text: subtextFull,
        directorNotes: language === 'hr' ? 'polušapat, blizu mikrofona' : 'close-mic subtext',
        rationale:
          language === 'hr'
            ? `Dodaje suptilnu glumačku modulaciju na označenu frazu.`
            : `Adds an intimate vocal cue directly onto the selected phrase.`,
      },
      {
        id: 'doc_dramatic',
        styleLabel:
          language === 'hr'
            ? 'Fokus na odabir: Cezura nakon fraze'
            : 'Selection Focus: Dramatic Beat Pause',
        text: pauseFull,
        directorNotes: language === 'hr' ? 's pauzom za naglasak' : 'measured beat',
        rationale:
          language === 'hr'
            ? `Umeće SSML pauzu od 300ms odmah nakon označenog teksta.`
            : `Inserts a 300ms SSML beat immediately after the highlighted phrase.`,
      },
    ];

    return spanCandidates.map((cand) => {
      const pacing = calculateBlockPacing(
        { text: cand.text, type: block.type, pauseAfterMs: block.pauseAfterMs },
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
      styleLabel:
        language === 'hr'
          ? `Sažeti govorni ritam (Kraće)${customHint ? ` — ${customHint}` : ''}`
          : `Tighter Spoken Cadence${customHint ? ` — ${customHint}` : ''}`,
      text: tightenedText,
      directorNotes: customHint || (language === 'hr' ? 'odlučno, brzo / brisk' : 'brisk, focused'),
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
 * Rewrites a draft ScriptBlock (or highlighted text span) into 3 spoken-cadence alternatives with duration & token telemetry.
 */
export async function doctorDialogueBlock(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  targetWpm?: number;
  language: SupportedLanguage;
  selectedText?: string;
  customInstruction?: string;
  precedingBlocks?: ScriptBlock[];
  followingBlocks?: ScriptBlock[];
  episodeGenre?: string;
  chatHistory?: AgentChatMessage[];
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
    selectedText,
    customInstruction,
    precedingBlocks = [],
    followingBlocks = [],
    episodeGenre,
    chatHistory,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    dialect,
    dubrovnikRegister,
    fetchImpl = fetch,
    abortSignal,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    const fallbacks = buildFallbackDoctorOptions(block, speaker, targetWpm, language, {
      selectedText,
      customInstruction,
    });
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

  const surroundingContext = [
    precedingBlocks.length > 0
      ? `Preceding Lines:\n${precedingBlocks.slice(-3).map((b) => `[${b.type}]: "${b.text}"`).join('\n')}`
      : '',
    followingBlocks.length > 0
      ? `Following Lines:\n${followingBlocks.slice(0, 2).map((b) => `[${b.type}]: "${b.text}"`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const recentChat = formatRecentChatHistoryForPrompt(
    chatHistory,
    'dialogue_doctor',
    4
  );

  const prompt = [
    `You are a master audio drama Script Doctor and Vocal Cadence Surgeon polishing a spoken line for ${
      speaker?.name ?? 'Speaker'
    } (Persona: ${speaker?.personaPrompt ?? 'natural voice'}, Acting: ${speaker?.actingNotes ?? 'studio delivery'}).`,
    episodeGenre ? `Episode Genre / Tone: ${episodeGenre}` : '',
    surroundingContext,
    `Target Line to Polish: "${block.text}"`,
    selectedText?.trim()
      ? `CRITICAL SELECTION FOCUS: The user specifically highlighted "${selectedText.trim()}" inside this line. Focus your rewrite on improving or transforming that highlighted span while returning the complete updated block text in "text".`
      : '',
    customInstruction?.trim()
      ? `User Direction / Rewrite Request: "${customInstruction.trim()}"`
      : '',
    `Current Director Notes: "${block.directorNotes ?? ''}"`,
    `Language: ${language === 'hr' ? 'Croatian (hr)' : 'English (en)'}`,
    recentChat,
    dubrovnikDialectPrompt,
    'Return ONLY a JSON object with property "options" containing 3 distinct, natural spoken-cadence alternatives (1: Tighter/Punchier, 2: Subtext & Breath/Intimacy, 3: Dramatic Pacing/Twist):',
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
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language, {
        selectedText,
        customInstruction,
      });
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawJson !== 'string') {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language, {
        selectedText,
        customInstruction,
      });
    }

    const parsed = JSON.parse(stripMarkdownJsonFence(rawJson)) as {
      options?: Array<{
        id?: string;
        styleLabel?: string;
        text?: string;
        directorNotes?: string;
        rationale?: string;
      }>;
    };

    if (!Array.isArray(parsed.options) || parsed.options.length === 0) {
      return buildFallbackDoctorOptions(block, speaker, targetWpm, language, {
        selectedText,
        customInstruction,
      });
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
    return buildFallbackDoctorOptions(block, speaker, targetWpm, language, {
      selectedText,
      customInstruction,
    });
  }
}

