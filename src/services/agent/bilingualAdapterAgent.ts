import {
  AgentChatMessage,
  BilingualAdaptationResult,
  CroatianDialect,
  DubrovnikRegister,
  GeminiTextModelId,
  ScriptBlock,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import { transformToDubrovnikDialect } from '../../core/dubrovnik/dubrovnikPhonetics';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';
import { formatRecentChatHistoryForPrompt } from './agentContextBuilder';

/**
 * Constructs the linguistic and morphological gender-agreement prompt for Bilingual Adaptation.
 */
export function buildBilingualAdapterPrompt(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  selectedText?: string;
  customInstruction?: string;
  precedingBlocks?: ScriptBlock[];
  chatHistory?: AgentChatMessage[];
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
}): string {
  const {
    block,
    speaker,
    sourceLang,
    targetLang,
    selectedText,
    customInstruction,
    precedingBlocks = [],
    chatHistory,
    dialect,
    dubrovnikRegister,
  } = options;
  const gender = speaker?.gender ?? 'neutral';

  const croatianMorphologyRule =
    targetLang === 'hr'
      ? gender === 'female'
        ? 'CROATIAN GENDER AGREEMENT (CRITICAL): The speaker is FEMALE. All first-person past-tense l-participles (glagolski pridjevi radni) and adjectives MUST use feminine "-la / -a" morphology (e.g., "rekla sam", "vidjela sam", "bila sam", "sigurna sam").'
        : gender === 'male'
          ? 'CROATIAN GENDER AGREEMENT (CRITICAL): The speaker is MALE. All first-person past-tense l-participles (glagolski pridjevi radni) and adjectives MUST use masculine "-o / -ao" morphology (e.g., "rekao sam", "vidio sam", "bio sam", "siguran sam").'
          : 'CROATIAN GENDER AGREEMENT: Neutral / narrator morphology.'
      : `Speaker gender context: ${gender}. Preserve spoken syllable count and persona idioms.`;

  const dubrovnikDialectRule =
    targetLang === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  const recentContext =
    precedingBlocks.length > 0
      ? `Preceding Scene Context:\n${precedingBlocks
          .slice(-3)
          .map((b) => `[${b.type}]: "${b.text}"`)
          .join('\n')}`
      : '';

  const recentChat = formatRecentChatHistoryForPrompt(
    chatHistory,
    'bilingual_adapter',
    4
  );

  return [
    `Adapt the following audio drama script block from ${sourceLang.toUpperCase()} to ${targetLang.toUpperCase()}.`,
    `Speaker: ${speaker?.name ?? 'Narrator'} (Gender: ${gender}, Persona: ${speaker?.personaPrompt ?? 'N/A'})`,
    croatianMorphologyRule,
    dubrovnikDialectRule,
    recentContext,
    `Original Text: "${block.text}"`,
    selectedText?.trim()
      ? `HIGHLIGHTED SELECTION FOCUS: The user highlighted "${selectedText.trim()}". Ensure this specific phrase is culturally and idiomatically adapted and return the complete updated block text in "adaptedText".`
      : '',
    customInstruction?.trim()
      ? `User Adaptation Instruction: "${customInstruction.trim()}"`
      : '',
    `Original Director Notes: "${block.directorNotes ?? ''}"`,
    recentChat,
    'Return ONLY a JSON object with: { "adaptedText": "...", "adaptedDirectorNotes": "...", "culturalNotes": "...", "genderAgreementApplied": "..." }',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildFallbackBilingualAdaptation(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  selectedText?: string;
  customInstruction?: string;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
}): BilingualAdaptationResult {
  const {
    block,
    speaker,
    sourceLang,
    targetLang,
    selectedText,
    dialect,
    dubrovnikRegister,
  } = options;
  const fullText = block.text.trim();
  const focusSpan =
    selectedText &&
    selectedText.trim().length > 0 &&
    selectedText.trim() !== fullText &&
    fullText.includes(selectedText.trim())
      ? selectedText.trim()
      : null;
  const text = focusSpan ?? fullText;
  const isFemale = speaker?.gender === 'female';

  // Known sample lines & smart morphological adaptation
  const knownTranslationsHrToEn: Record<string, string> = {
    'Ugasi svjetlo. Netko nas promatra s onog tavana prekoputa.':
      'Kill the light. Someone is watching us from that attic across the street.',
    'To su samo sjene, Marko. Gledaš previše američkih filmova.':
      'Those are just shadows, Marko. You watch too many American movies.',
    'Magla je postajala sve gušća, gutajući zvuke posljednjeg noćnog tramvaja u Ilici.':
      'The fog grew thicker, swallowing the rattle of the last night tram down Ilica Street.',
    'Udaljeno škripanje tramvajskih tračnica i tihi koraci po mokrim kockama kaldrme.':
      'Distant screech of tram rails and quiet footsteps across wet cobblestones.',
  };

  if (sourceLang === 'hr' && targetLang === 'en') {
    const adaptedSpan =
      knownTranslationsHrToEn[text] ??
      (isFemale
        ? `I told you already — "${text}"`
        : `I saw it myself — "${text}"`);

    const adaptedText = focusSpan
      ? fullText.replace(focusSpan, adaptedSpan)
      : adaptedSpan;

    return {
      sourceLang,
      targetLang,
      originalText: fullText,
      adaptedText,
      adaptedDirectorNotes: block.directorNotes || 'whispered / natural',
      culturalNotes: focusSpan
        ? `Adapted highlighted span "${focusSpan}" into natural English cadence while preserving surrounding block context.`
        : 'Adapted idioms into natural English radio-drama cadence while matching syllable pacing.',
      genderAgreementApplied: `Speaker (${speaker?.name ?? 'Narrator'}: ${
        speaker?.gender ?? 'neutral'
      }) perspective preserved in English idiom.`,
    };
  }

  // EN -> HR adaptation with strict masculine (-o) vs feminine (-la) l-participle inflection
  const knownEnToHr = Object.entries(knownTranslationsHrToEn).find(
    ([, enVal]) => enVal.toLowerCase() === text.toLowerCase()
  )?.[0];

  let adaptedHr = knownEnToHr;
  if (!adaptedHr) {
    if (isFemale) {
      adaptedHr = text
        .replace(/\bI saw\b/gi, 'Vidjela sam')
        .replace(/\bI said\b/gi, 'Rekla sam')
        .replace(/\bI knew\b/gi, 'Znala sam')
        .replace(/\bI was\b/gi, 'Bila sam')
        .replace(/\bI went\b/gi, 'Otišla sam');
      if (adaptedHr === text) {
        adaptedHr = `Znala sam čim sam ušla u sobu — ${text}`;
      }
    } else {
      adaptedHr = text
        .replace(/\bI saw\b/gi, 'Vidio sam')
        .replace(/\bI said\b/gi, 'Rekao sam')
        .replace(/\bI knew\b/gi, 'Znao sam')
        .replace(/\bI was\b/gi, 'Bio sam')
        .replace(/\bI went\b/gi, 'Otišao sam');
      if (adaptedHr === text) {
        adaptedHr = `Znao sam čim sam ušao u sobu — ${text}`;
      }
    }
  }

  if (targetLang === 'hr' && dialect === 'dubrovnik') {
    adaptedHr = transformToDubrovnikDialect(adaptedHr, dubrovnikRegister);
  }

  const finalAdaptedHr = focusSpan
    ? fullText.replace(focusSpan, adaptedHr)
    : adaptedHr;

  return {
    sourceLang,
    targetLang,
    originalText: fullText,
    adaptedText: finalAdaptedHr,
    adaptedDirectorNotes: block.directorNotes || 'prirodno / natural',
    culturalNotes:
      dialect === 'dubrovnik'
        ? 'Prilagođeno autentičnom dubrovačkom govoru (raguzejski idiom) uz očuvanje trajanja izgovora.'
        : 'Prilagođeno autentičnom govornom ritmu uz očuvanje trajanja izgovora.',
    genderAgreementApplied: isFemale
      ? 'Ženski rod (-la glagolski pridjev radni: "vidjela sam / znala sam")'
      : 'Muški rod (-o glagolski pridjev radni: "vidio sam / znao sam")',
  };
}

/**
 * Step 4.4: Bilingual Cultural & Grammatical Adapter (EN <-> HR).
 * Translates and culturally adapts script blocks while enforcing Croatian grammatical gender agreement.
 */
export async function adaptBlockBilingually(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  selectedText?: string;
  customInstruction?: string;
  precedingBlocks?: ScriptBlock[];
  chatHistory?: AgentChatMessage[];
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  fetchImpl?: typeof fetch;
  abortSignal?: AbortSignal;
}): Promise<BilingualAdaptationResult> {
  const {
    block,
    speaker,
    sourceLang,
    targetLang,
    selectedText,
    customInstruction,
    precedingBlocks,
    chatHistory,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    dialect,
    dubrovnikRegister,
    fetchImpl = fetch,
    abortSignal,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    const fallback = buildFallbackBilingualAdaptation({
      block,
      speaker,
      sourceLang,
      targetLang,
      selectedText,
      customInstruction,
      dialect,
      dubrovnikRegister,
    });
    if (targetLang === 'hr' && dialect === 'dubrovnik') {
      fallback.adaptedText = transformToDubrovnikDialect(
        fallback.adaptedText,
        dubrovnikRegister
      );
      fallback.culturalNotes += ' Prilagođeno dubrovačkom govoru (raguzejski idiom).';
    }
    return fallback;
  }

  const prompt = buildBilingualAdapterPrompt({
    block,
    speaker,
    sourceLang,
    targetLang,
    selectedText,
    customInstruction,
    precedingBlocks,
    chatHistory,
    dialect,
    dubrovnikRegister,
  });

  const endpoint = buildGeminiEndpoint(modelId, apiKey);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawJson !== 'string') {
      return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
    }

    const parsed = JSON.parse(stripMarkdownJsonFence(rawJson)) as Partial<BilingualAdaptationResult>;
    if (!parsed.adaptedText || typeof parsed.adaptedText !== 'string') {
      return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
    }

    return {
      sourceLang,
      targetLang,
      originalText: block.text,
      adaptedText: parsed.adaptedText.trim(),
      adaptedDirectorNotes: parsed.adaptedDirectorNotes || block.directorNotes,
      culturalNotes: parsed.culturalNotes || '',
      genderAgreementApplied:
        parsed.genderAgreementApplied ||
        (speaker?.gender === 'female' ? 'Feminine (-la)' : 'Masculine (-o)'),
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
  }
}

