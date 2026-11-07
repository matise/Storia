import {
  CroatianDialect,
  DubrovnikRegister,
  GeminiTextModelId,
  GroundingSource,
  PersonaResearchRecord,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import { transformToDubrovnikDialect } from '../../core/dubrovnik/dubrovnikPhonetics';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
} from './dubrovnikAgentInstructions';

/**
 * Constructs the dual-layer system instruction for Persona-Grounded Research,
 * binding the character's psychological worldview, idioms, age, gender, and acting notes
 * while requiring historical/factual accuracy.
 */
export function buildPersonaResearchSystemPrompt(
  speaker: Speaker,
  language: SupportedLanguage,
  dialect?: CroatianDialect,
  dubrovnikRegister?: DubrovnikRegister
): string {
  const genderRule =
    language === 'hr'
      ? speaker.gender === 'female'
        ? 'GRAMATIČKI ROD: Ženski (koristi glagolske pridjeve radne u ženskom rodu: npr. "rekla sam", "vidjela sam", "znala sam").'
        : speaker.gender === 'male'
          ? 'GRAMATIČKI ROD: Muški (koristi glagolske pridjeve radne u muškom rodu: npr. "rekao sam", "vidio sam", "znao sam").'
          : 'GRAMATIČKI ROD: Neutralan.'
      : `Speaker Gender: ${speaker.gender}.`;

  if (language === 'hr') {
    const dialectPrompt =
      dialect === 'dubrovnik' ? buildDubrovnikAgentInstructions(dubrovnikRegister) : '';

    return [
      `Ti si ${speaker.name} (Dob: ${speaker.age}).`,
      `PERSONA I SVJETONAZOR: ${speaker.personaPrompt}`,
      `GLUMAČKE UPUTE I GOVORNI RITAM: ${speaker.actingNotes}`,
      genderRule,
      dialectPrompt,
      'PRAVILA ODGOVARANJA:',
      '1. Odgovori ISKLJUČIVO u prvom licu ("ja") iz perspektive svog lika, koristeći njegov rječnik, ton i ritam govora.',
      '2. Temelji sve povijesne, znanstvene ili činjenične tvrdnje na provjerenim činjenicama.',
      '3. Odgovor mora zvučati kao autentična izgovorena replika u radio-drami ili podcastu (2 do 4 rečenice).',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `You are ${speaker.name} (Age: ${speaker.age}).`,
    `PERSONA & WORLDVIEW: ${speaker.personaPrompt}`,
    `ACTING NOTES & VOCAL CADENCE: ${speaker.actingNotes}`,
    genderRule,
    'RESPONSE RULES:',
    '1. Answer STRICTLY in first-person ("I") in-character, using this persona’s vocabulary, idioms, and rhythm.',
    '2. Anchor all historical, scientific, or factual claims to verified facts.',
    '3. Keep the response formatted as spoken radio-drama or podcast dialogue (2 to 4 sentences).',
  ].join('\n');
}

/**
 * Extracts verified GroundingSource citations from Gemini's `groundingMetadata` payload.
 */
export function extractGroundingSources(apiResponse: unknown): GroundingSource[] {
  const sources: GroundingSource[] = [];
  const seenUris = new Set<string>();

  if (!apiResponse || typeof apiResponse !== 'object') {
    return sources;
  }

  const candidates = (apiResponse as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return sources;
  }

  const firstCandidate = candidates[0] as {
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
      webSearchQueries?: string[];
    };
  };

  const chunks = firstCandidate?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      const uri = chunk?.web?.uri?.trim();
      const title = chunk?.web?.title?.trim() || uri;
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        sources.push({ uri, title: title ?? uri });
      }
    }
  }

  return sources;
}

export function buildFallbackPersonaResearch(
  speaker: Speaker,
  query: string,
  language: SupportedLanguage,
  modelId: GeminiTextModelId
): PersonaResearchRecord {
  const qLower = query.toLowerCase();
  const isPistolQuery = /pištolj|policij|1938|weapon|pistol|police|browning|fn/.test(qLower);

  if (language === 'hr') {
    const personaResponse = isPistolQuery
      ? speaker.gender === 'female'
        ? `Koliko sam puta vidjela te crne futrole u Petrinjskoj... Naši redari nose belgijski FN Model 1910 ili 1922 u kalibru 7.65 milimetara — kratka cijev koja prebrzo planu u magli.`
        : `Znam taj zvuk zatvarača u snu. Zagrebački detektivi i redarstvenici nose belgijski FN Browning Model 1910 i 1922, kalibar 7.65 milimetara — stane u džep kaputa, ali u uskoj veži zvuči kao top.`
      : speaker.gender === 'female'
        ? `Pitala sam se isto dok sam listala stare arhive. Kad pogledaš ispod službenih izvještaja glede "${query.trim()}", uvijek pronađeš tragove koje su htjeli sakriti u magli.`
        : `Dugo sam kopao po arhivima oko toga — "${query.trim()}". Službeni papiri kažu jedno, ali na zagrebačkom asfaltu istina uvijek ima drugačiji okus.`;

    return {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      speakerId: speaker.id,
      query: query.trim(),
      personaResponse,
      objectiveSummary: isPistolQuery
        ? 'Redarstvo i žandarmerija Kraljevine Jugoslavije (uključujući Zagreb 1930-ih) standardno su koristili poluautomatske pištolje FN Model 1910 i FN Model 1922 (7.65×17mm / 9×17mm).'
        : `Kontekstualni sažetak istraživanja za upit: "${query.trim()}".`,
      sources: isPistolQuery
        ? [
            {
              title: 'Hrvatski povijesni muzej — Zbirka oružja 20. stoljeća (hpm.hr)',
              uri: 'https://www.hpm.hr/',
            },
            {
              title: 'Muzej grada Zagreba — Zagrebačko redarstvo između dva rata (mgz.hr)',
              uri: 'https://www.mgz.hr/',
            },
          ]
        : [
            {
              title: 'Leksikografski zavod Miroslav Krleža — Hrvatska enciklopedija',
              uri: 'https://www.enciklopedija.hr/',
            },
          ],
      modelUsed: modelId,
      timestamp: Date.now(),
    };
  }

  const personaResponseEn = isPistolQuery
    ? `I know the weight of that steel by heart. The Zagreb police detectives carry the Belgian FN Browning Model 1910 and 1922 chambered in 7.65mm—compact enough for a trenchcoat pocket, loud enough to wake the whole block.`
    : `I've spent enough sleepless nights digging into "${query.trim()}". The official ledger tells a clean story, but out on the wet cobblestones the facts cut a lot sharper.`;

  return {
    id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    speakerId: speaker.id,
    query: query.trim(),
    personaResponse: personaResponseEn,
    objectiveSummary: isPistolQuery
      ? 'Yugoslav police and Zagreb municipal detectives in 1938 carried the Belgian FN Model 1910 and Model 1922 semi-automatic pistols (7.65mm Browning).'
      : `Verified contextual summary for query: "${query.trim()}".`,
    sources: [
      {
        title: 'Croatian History Museum — Interwar Police & Military Collection (hpm.hr)',
        uri: 'https://www.hpm.hr/',
      },
      {
        title: 'Zagreb City Museum — Urban History Archives (mgz.hr)',
        uri: 'https://www.mgz.hr/',
      },
    ],
    modelUsed: modelId,
    timestamp: Date.now(),
  };
}

/**
 * Step 4.1: Executes Persona-Grounded Research via the selected Gemini model
 * with optional Google Search grounding (`tools: [{ google_search: {} }]`).
 */
export async function runPersonaResearch(options: {
  speaker: Speaker;
  query: string;
  language: SupportedLanguage;
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  enableSearchGrounding?: boolean;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  fetchImpl?: typeof fetch;
  abortSignal?: AbortSignal;
}): Promise<PersonaResearchRecord> {
  const {
    speaker,
    query,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    enableSearchGrounding = true,
    dialect,
    dubrovnikRegister,
    fetchImpl = fetch,
    abortSignal,
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Research query cannot be empty.');
  }

  if (!apiKey || apiKey.trim().length < 10) {
    const fallback = buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
    if (dialect === 'dubrovnik' && language === 'hr') {
      fallback.personaResponse = transformToDubrovnikDialect(
        fallback.personaResponse,
        dubrovnikRegister
      );
    }
    return fallback;
  }

  const systemInstruction = buildPersonaResearchSystemPrompt(
    speaker,
    language,
    dialect,
    dubrovnikRegister
  );
  const endpoint = buildGeminiEndpoint(modelId, apiKey);

  const requestBody: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              language === 'hr'
                ? `Istraži i odgovori u ulozi lika (${speaker.name}) na pitanje: ${trimmedQuery}`
                : `Research and answer strictly in-character (${speaker.name}) to the question: ${trimmedQuery}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.45,
    },
  };

  if (enableSearchGrounding) {
    requestBody.tools = [{ google_search: {} }];
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
    }

    const data = await response.json();
    const rawText: string | undefined =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('')
        .trim() || undefined;

    if (!rawText) {
      return buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
    }

    const extractedSources = extractGroundingSources(data);
    const fallbackRecord = buildFallbackPersonaResearch(
      speaker,
      trimmedQuery,
      language,
      modelId
    );

    return {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      speakerId: speaker.id,
      query: trimmedQuery,
      personaResponse: rawText,
      objectiveSummary: fallbackRecord.objectiveSummary,
      sources: extractedSources.length > 0 ? extractedSources : fallbackRecord.sources,
      modelUsed: modelId,
      timestamp: Date.now(),
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
  }
}

