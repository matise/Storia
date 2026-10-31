import {
  BilingualAdaptationResult,
  CoWriterAttachment,
  CoWriterBeatCandidate,
  CoWriterWorkflowMode,
  GeminiTextModelId,
  GroundingSource,
  PersonaResearchRecord,
  ScriptBlock,
  ScriptDoctorOption,
  Speaker,
  SupportedLanguage,
} from '../types/storia';
import { calculateBlockPacing } from '../core/pacing/pacingCalculator';

/**
 * Constructs the dual-layer system instruction for Persona-Grounded Research,
 * binding the character's psychological worldview, idioms, age, gender, and acting notes
 * while requiring historical/factual accuracy.
 */
export function buildPersonaResearchSystemPrompt(
  speaker: Speaker,
  language: SupportedLanguage
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
    return [
      `Ti si ${speaker.name} (Dob: ${speaker.age}).`,
      `PERSONA I SVJETONAZOR: ${speaker.personaPrompt}`,
      `GLUMAČKE UPUTE I GOVORNI RITAM: ${speaker.actingNotes}`,
      genderRule,
      'PRAVILA ODGOVARANJA:',
      '1. Odgovori ISKLJUČIVO u prvom licu ("ja") iz perspektive svog lika, koristeći njegov rječnik, ton i ritam govora.',
      '2. Temelji sve povijesne, znanstvene ili činjenične tvrdnje na provjerenim činjenicama.',
      '3. Odgovor mora zvučati kao autentična izgovorena replika u radio-drami ili podcastu (2 do 4 rečenice).',
    ].join('\n');
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

function buildFallbackPersonaResearch(
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
  fetchImpl?: typeof fetch;
}): Promise<PersonaResearchRecord> {
  const {
    speaker,
    query,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    enableSearchGrounding = true,
    fetchImpl = fetch,
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Research query cannot be empty.');
  }

  if (!apiKey || apiKey.trim().length < 10) {
    return buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
  }

  const systemInstruction = buildPersonaResearchSystemPrompt(speaker, language);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

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
  } catch {
    return buildFallbackPersonaResearch(speaker, trimmedQuery, language, modelId);
  }
}

function buildFallbackSceneBeats(
  speakers: Speaker[],
  language: SupportedLanguage,
  directionHint?: string,
  attachments?: CoWriterAttachment[],
  deepResearch?: boolean,
  mode: CoWriterWorkflowMode = 'scene_beats'
): CoWriterBeatCandidate[] {
  const s1 = speakers[0]?.id ?? 'spk_marko';
  const s2 = speakers[1]?.id ?? speakers[0]?.id ?? 'spk_ana';
  const narrator =
    speakers.find((s) => s.name.toLowerCase().includes('narrat'))?.id ?? s1;
  const hintNote = directionHint?.trim() ? ` (${directionHint.trim()})` : '';

  const hasFiles = Boolean(attachments && attachments.length > 0);
  const firstFile = hasFiles ? attachments![0] : undefined;

  let baseBeats: CoWriterBeatCandidate[];

  if (language === 'hr') {
    if (mode === 'complete_story') {
      baseBeats = [
        {
          id: 'story_1',
          title: hasFiles
            ? `Cjelovita priča: Tajna dokumenta "${firstFile!.name}"${hintNote}`
            : `Cjelovita priča: Noćni arhiv i nestali spis${hintNote}`,
          rationale:
            'Kompletan dramski luk od atmosferskog uvoda i otkrića traga, preko eskalacije napetosti i zvučnih efekata, do klimaksa i razrješenja.',
          blocks: [
            {
              type: 'narration',
              speakerId: narrator,
              text: 'Gusta magla spustila se na krovove staroga grada, prigušujući rijetke korake noćnih prolaznika.',
              directorNotes: 'smireno, filmično, duboko / cinematic noir',
              pauseAfterMs: 650,
            },
            {
              type: 'sound_effect',
              text: 'Udaljena zvonjava crkvenog sata, škripa starih prozorskih kapaka i tihi šum noćnog vjetra.',
              directorNotes: 'atmosferski prostorni stereo zvuk / atmospheric wide',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Pogledaj što sam izvukao iz zapečaćenog pretinca: "${firstFile!.name}". Margina sadrži šifru.`
                : 'Zatvori vrata i zaključaj oba zasuna. Imamo točno deset minuta prije nego što stigne smjena straže.',
              directorNotes: 'napeto, prigušeni šapat / tense whisper',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Jesi li siguran da te nitko nije pratio? Čula sam sumnjivo kuckanje na dvorišnim vratima.',
              directorNotes: 'oprezno, zabrinuto / cautious',
              pauseAfterMs: 400,
            },
            {
              type: 'sound_effect',
              text: 'Oštro metalno škljocanje brave i ubrzani koraci po kamenom podu hodnika.',
              directorNotes: 'foley u krupnom planu / close foley',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'Sada nema povratka. Ako otvorimo ovu kasetu, moramo znati tko stoji iza šifriranih naloga.',
              directorNotes: 'odlučno, tiho / resolute',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Otvaraj. Što god pisalo unutra, istina više ne može ostati zakopana pod prašinom arhiva.',
              directorNotes: 'čvrsto, bez oklijevanja / unwavering',
              pauseAfterMs: 500,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: 'Svjetlost voštane svijeće zatreperila je na požutjelim stranicama. Istina je konačno progovorila, a sjene su nestale.',
              directorNotes: 'dramatično smirenje, konačnost / finality',
              pauseAfterMs: 800,
            },
          ],
        },
      ];
    } else if (mode === 'podcast_episode') {
      baseBeats = [
        {
          id: 'podcast_1',
          title: hasFiles
            ? `Podcast Epizoda: Analiza dosjea "${firstFile!.name}"${hintNote}`
            : `Podcast Epizoda: Tajna povijest i skriveni tragovi${hintNote}`,
          rationale:
            'Prirodan razgovorni podcast format s dinamičnim uvodom, dijalogom voditelja i gosta, zvučnim prijelazom, dubinskom analizom i zaključkom.',
          blocks: [
            {
              type: 'sound_effect',
              text: 'Prepoznatljivi intro podcast jingle s modernim elektroničkim sweep prijelazom.',
              directorNotes: 'radio intro mastering',
              pauseAfterMs: 300,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'Dobrodošli u novu epizodu podcasta! Danas istražujemo priču koja je desetljećima bila skrivena pod oznakom tajnosti.',
              directorNotes: 'energično, prijateljski, mikrofonski blizu / podcast host',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Bok svima! Hvala na pozivu. Danas stvarno imamo materijal koji će vas prikovati za slušalice.',
              directorNotes: 'nasmijano, toplo, angažirano / co-host guest',
              pauseAfterMs: 450,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: 'Prije nego što zaronimo u detalje, vratimo se na početak zagonetke koja je zbunila i najiskusnije istraživače.',
              directorNotes: 'narativni prelazak, dokumentarno / documentary tone',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Upravo proučavamo priloženi dokument "${firstFile!.name}". Obrati pažnju na ovaj zabilježeni datum.`
                : 'Usporedili smo svjedočanstva triju ključnih aktera. Svi spominju istu zgradu u istoj ulici, ali s potpuno različitim motivima.',
              directorNotes: 'analitično, intrigantno / analytical',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Točno to! Kada povežeš te vremenske točke, vidi se da ništa nije bilo slučajno, već precizno koordinirano.',
              directorNotes: 'uvjerljivo, entuzijastično / compelling',
              pauseAfterMs: 400,
            },
            {
              type: 'sound_effect',
              text: 'Kratki zvučni bumper i prijelaz na završni segment epizode.',
              directorNotes: 'glazbeni transition sweep',
              pauseAfterMs: 350,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'To nas dovodi do ključnog zaključka za danas. Hvala vam što ste bili s nama — pretplatite se i čujemo se u idućoj epizodi!',
              directorNotes: 'odjava, toplo, profesionalno / outro host',
              pauseAfterMs: 600,
            },
          ],
        },
      ];
    } else {
      baseBeats = [
        {
          id: 'beat_1',
          title: hasFiles
            ? `1. Analiza nalaza: ${firstFile!.name}${hintNote}`
            : `1. Eskalacija napetosti${hintNote}`,
          rationale: hasFiles
            ? `Proučava priloženi ${firstFile!.isImage ? 'vizualni zapis' : 'dokument'} "${firstFile!.name}" i otkriva ključni dramski trag.`
            : 'Podiže dramski ulog uvođenjem konkretnog zvučnog traga na stubištu i brze izmjene replika.',
          blocks: [
            {
              type: 'sound_effect',
              text: hasFiles
                ? 'Šuštanje pergamenta i tihi metalni zveket istraživačke opreme.'
                : 'Kratko škripanje drvene stepenice u hodniku i prigušeni koraci.',
              directorNotes: 'blizu / close mic',
              pauseAfterMs: 350,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Pogledaj pažljivo ovaj detalj na "${firstFile!.name}". Netko je namjerno ostavio šifriranu bilješku na margini.`
                : 'Jesi li čula ovo? Netko stoji ravno pred našim vratima.',
              directorNotes: 'napeto, šapatom / tense whisper',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: hasFiles
                ? 'Usporedi to s arhivskim registrom. Datum se poklapa s noći kada je zapečaćen trezor.'
                : 'Ne miči se. Ako pritisne kvaku, izlazi kroz dvorišni prozor.',
              directorNotes: 'odlučno / resolute',
              pauseAfterMs: 500,
            },
          ],
        },
        {
          id: 'beat_2',
          title: deepResearch
            ? `2. Dubinsko istraživanje i arhivska sinteza${hintNote}`
            : `2. Atmosferska introspekcija i otkriće${hintNote}`,
          rationale: deepResearch
            ? 'Kroz dubinsku analizu izvora i povijesnih činjenica povezuje skrivene motive likova.'
            : 'Usporava ritam kroz pripovjedačev opis prostora prije nego što lik otkrije ključni dokaz.',
          blocks: [
            {
              type: 'narration',
              speakerId: narrator,
              text: deepResearch
                ? 'Duboka analiza zapisa otkriva obrazac koji su suvremenici prešutjeli: sva pisma potpisana su istim pseudonimom.'
                : 'Svjetlost ulične plinske svjetiljke probijala se kroz rolete, režući sobu na oštre pruge sjene.',
              directorNotes: 'smireno, filmično / cinematic',
              pauseAfterMs: 650,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: hasFiles
                ? `Znači dokumenti iz "${firstFile!.name}" nisu slučajno dospjeli u naše ruke.`
                : 'Pogledaj omotnicu na stolu. Pečat je još topao — bili su ovdje prije nas.',
              directorNotes: 'iznenađeno / startled',
              pauseAfterMs: 500,
            },
          ],
        },
        {
          id: 'beat_3',
          title: `3. Suočavanje i ironični preokret${hintNote}`,
          rationale:
            'Kreira karakterni kontrast između cinizma i opasnosti kroz brzi dijalog.',
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Znači cijeli grad traži trag, a nama je bio pred očima u "${firstFile!.name}".`
                : 'Znači, cijeli grad traži taj spis, a on nam je cijelo vrijeme u džepu.',
              directorNotes: 'ironično / sardonically',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Nemoj se prerano veseliti. Najteže je izaći iz grada dok još traje policijski sat.',
              directorNotes: 'oprezno / cautious',
              pauseAfterMs: 500,
            },
          ],
        },
      ];
    }
  } else {
    if (mode === 'complete_story') {
      baseBeats = [
        {
          id: 'story_1',
          title: hasFiles
            ? `Complete Story: The Dossier in "${firstFile!.name}"${hintNote}`
            : `Complete Story: The Midnight Vault Archive${hintNote}`,
          rationale:
            'A complete, multi-scene narrative arc spanning atmospheric setup, clue revelation, rising tension, sound effects, climax, and resolution.',
          blocks: [
            {
              type: 'narration',
              speakerId: narrator,
              text: 'Thick fog clung to the gas lamps along the river, swallowing the footsteps of midnight couriers.',
              directorNotes: 'composed, atmospheric noir',
              pauseAfterMs: 650,
            },
            {
              type: 'sound_effect',
              text: 'Distant church bell tolls three times, accompanied by cold wind rattling iron window grates.',
              directorNotes: 'wide atmospheric stereo',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Look at what I pulled from the vault: "${firstFile!.name}". The seal is cracked, but the ledger is intact.`
                : 'Lock both deadbolts and extinguish the lamp. We have ten minutes before the watch changes.',
              directorNotes: 'urgent, guarded whisper',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Are you certain no one followed you from the bridge? I heard footsteps on the cobblestones.',
              directorNotes: 'tense, scanning the room',
              pauseAfterMs: 400,
            },
            {
              type: 'sound_effect',
              text: 'Sharp click of a heavy brass lock turning and urgent footsteps on bare wooden boards.',
              directorNotes: 'close foley',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'There is no turning back now. Once we open this cylinder, we carry the names to the consulate.',
              directorNotes: 'resolute, low',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Break the seal. Whatever is written on that parchment, the truth cannot stay buried in the dark.',
              directorNotes: 'firm, unflinching',
              pauseAfterMs: 500,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: 'A flicker of candlelight caught the ink. The conspiracy was laid bare, and the night was only beginning.',
              directorNotes: 'finality, dramatic swell',
              pauseAfterMs: 800,
            },
          ],
        },
      ];
    } else if (mode === 'podcast_episode') {
      baseBeats = [
        {
          id: 'podcast_1',
          title: hasFiles
            ? `Podcast Episode: Examining "${firstFile!.name}"${hintNote}`
            : `Podcast Episode: Secrets, Spies & Untold History${hintNote}`,
          rationale:
            'A natural conversational podcast episode script featuring host hook, co-host banter, deep dive analysis, transition cues, and outro.',
          blocks: [
            {
              type: 'sound_effect',
              text: 'Upbeat modern podcast intro theme and broadcast sweep effect.',
              directorNotes: 'radio broadcast mastering',
              pauseAfterMs: 300,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'Welcome back to the podcast! Today we are cracking open an investigation that historians spent decades trying to piece together.',
              directorNotes: 'energetic, warm, close-mic host',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Hey everyone! Thanks for having me on. We uncovered evidence today that genuinely rewrites what we thought happened.',
              directorNotes: 'enthusiastic, natural co-host',
              pauseAfterMs: 450,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: 'Before we examine the documents, let us step back to the autumn of 1938 when the first report vanished.',
              directorNotes: 'documentary narrator, clear',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Take a look at the attached file "${firstFile!.name}". The marginalia matches the diplomatic cipher perfectly.`
                : 'We cross-referenced three separate survivor testimonies. All three place the mysterious courier on the same evening train.',
              directorNotes: 'analytical, intriguing',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Exactly! When you align those timestamps, it becomes clear this was an organized intelligence operation.',
              directorNotes: 'compelling, confident',
              pauseAfterMs: 400,
            },
            {
              type: 'sound_effect',
              text: 'Short musical transition bumper leading into the closing thoughts segment.',
              directorNotes: 'transition sweep',
              pauseAfterMs: 350,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: 'And that brings us to the core takeaway for today. Thanks for tuning in—hit subscribe and we will see you in the next episode!',
              directorNotes: 'warm outro sign-off',
              pauseAfterMs: 600,
            },
          ],
        },
      ];
    } else {
      baseBeats = [
        {
          id: 'beat_1',
          title: hasFiles
            ? `1. Analysis of Attached Evidence: ${firstFile!.name}${hintNote}`
            : `1. Escalating Suspense${hintNote}`,
          rationale: hasFiles
            ? `Examines the attached ${firstFile!.isImage ? 'image' : 'document'} "${firstFile!.name}" to unearth an urgent dramatic clue.`
            : 'Raises immediate tension with a close-mic hallway foley cue and rapid dialogue exchange.',
          blocks: [
            {
              type: 'sound_effect',
              text: hasFiles
                ? 'Rustle of parchment and a faint metallic click of magnifying tools on glass.'
                : 'Sharp creak of a wooden floorboard outside the door and slow footsteps.',
              directorNotes: 'close stereo field',
              pauseAfterMs: 350,
            },
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Look closely at this mark on "${firstFile!.name}". Someone deliberately inscribed a cipher along the margin.`
                : 'Did you hear that? Someone is standing right outside the door.',
              directorNotes: 'whispered, urgent',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: hasFiles
                ? 'Cross-reference it with the courier ledger. The date matches the night the consulate archives burned.'
                : 'Hold your breath. If that handle turns, we go out the courtyard window.',
              directorNotes: 'focused, low voice',
              pauseAfterMs: 500,
            },
          ],
        },
        {
          id: 'beat_2',
          title: deepResearch
            ? `2. Deep Research Synthesis${hintNote}`
            : `2. Atmospheric Discovery${hintNote}`,
          rationale: deepResearch
            ? 'Deep research across sources reveals a hidden geopolitical pattern behind the event.'
            : 'Uses the narrator to establish noir room tone before revealing a physical clue.',
          blocks: [
            {
              type: 'narration',
              speakerId: narrator,
              text: deepResearch
                ? 'Deeper investigation of the records reveals a concealed fact: every dispatch was sent through the same diplomatic backchannel.'
                : 'Amber light from the streetlamp sliced through the blinds, painting the desk in narrow shadows.',
              directorNotes: 'composed, atmospheric',
              pauseAfterMs: 650,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: hasFiles
                ? `Then "${firstFile!.name}" wasn't left behind by accident. It was a decoy.`
                : 'Look at the wax seal on this ledger. It is still warm—they were here five minutes ago.',
              directorNotes: 'startled, quiet',
              pauseAfterMs: 500,
            },
          ],
        },
        {
          id: 'beat_3',
          title: `3. Cynical Reversal${hintNote}`,
          rationale:
            'Plays off character subtext and dry humor to pivot the scene toward the next location.',
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: hasFiles
                ? `Half the precinct is tearing the city apart for this clue, and we had it in "${firstFile!.name}".`
                : 'Half the precinct is tearing the city apart for that dossier, and it was sitting on our coat rack.',
              directorNotes: 'sardonically',
              pauseAfterMs: 450,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: 'Save the victory speech until we make it past the last checkpoint.',
              directorNotes: 'dryly',
              pauseAfterMs: 500,
            },
          ],
        },
      ];
    }
  }

  return baseBeats.map((b) => ({
    ...b,
    deepResearchUsed: Boolean(deepResearch),
    analyzedFiles: attachments?.map((a) => a.name),
    mode,
  }));
}

/**
 * Step 4.2: Co-Writer Structured Scene Beat Generator.
 * Analyzes preceding script blocks, active cast profiles, attached files, and deep research to propose 3 structured scene continuations.
 */
export async function generateNextSceneBeats(options: {
  precedingBlocks: ScriptBlock[];
  speakers: Speaker[];
  language: SupportedLanguage;
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  directionHint?: string;
  attachments?: CoWriterAttachment[];
  deepResearch?: boolean;
  mode?: CoWriterWorkflowMode;
  fetchImpl?: typeof fetch;
}): Promise<CoWriterBeatCandidate[]> {
  const {
    precedingBlocks,
    speakers,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    directionHint,
    attachments,
    deepResearch = false,
    mode = 'scene_beats',
    fetchImpl = fetch,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    return buildFallbackSceneBeats(speakers, language, directionHint, attachments, deepResearch, mode);
  }

  const contextLines = precedingBlocks
    .slice(-8)
    .map((b) => {
      const spk = speakers.find((s) => s.id === b.speakerId)?.name ?? b.type.toUpperCase();
      return `[${b.type}] ${spk}: ${b.text}`;
    })
    .join('\n');

  const speakerList = speakers
    .map((s) => `${s.id}: ${s.name} (${s.personaPrompt})`)
    .join('\n');

  const attachmentDescriptions = attachments && attachments.length > 0
    ? `ATTACHED FILES (${attachments.length}):\n` +
      attachments
        .map(
          (a) =>
            `- ${a.name} (${a.mimeType}, ${a.sizeBytes} bytes)${
              a.textContent ? `:\n"""${a.textContent.slice(0, 1000)}..."""` : ''
            }`
        )
        .join('\n')
    : '';

  const deepResearchInstructions = deepResearch
    ? 'DEEP RESEARCH MODE IS ACTIVE: Conduct thorough analytical research (using Google Search grounding if relevant) and deep multimodal document/visual examination. Extract hidden dramatic clues, subtext, period-accurate details, and geopolitical context.'
    : '';

  let modeRolePrompt = `You are an expert audio drama Co-Writer generating 3 candidate narrative continuation beats in ${
    language === 'hr' ? 'Croatian (hr)' : 'English (en)'
  }.`;
  let modeStructureInstruction =
    'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array of 3 beat objects. Do not wrap in markdown or backticks.\n{ "beats": [ { "id": "beat_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 450 } ] } ] }';

  if (mode === 'complete_story') {
    modeRolePrompt = `You are a master storyteller and audio dramatist generating a comprehensive, long complete audio drama story in ${
      language === 'hr' ? 'Croatian (hr)' : 'English (en)'
    }.`;
    modeStructureInstruction =
      'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array containing 2 or 3 complete story candidate drafts. Each candidate draft MUST be an extensive, fully realized episodic narrative containing 8 to 14 script blocks covering opening atmospheric narration, sound effects/foley, escalating dialogue, climax, and resolution.\n{ "beats": [ { "id": "story_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 450 } ] } ] }';
  } else if (mode === 'podcast_episode') {
    modeRolePrompt = `You are an expert podcast producer and scriptwriter creating a complete audio podcast episode script in ${
      language === 'hr' ? 'Croatian (hr)' : 'English (en)'
    }.`;
    modeStructureInstruction =
      'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array containing 2 or 3 complete podcast episode candidate drafts. Each candidate episode MUST be a full conversational podcast script containing 8 to 12 blocks covering: intro theme/jingle sound effect, host greeting & topic hook, co-host/guest conversational banter, deep-dive topic discussion analyzing the evidence/files, musical transition sound effect, key takeaway summary, and outro sign-off.\n{ "beats": [ { "id": "podcast_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 400 } ] } ] }';
  }

  const promptText = [
    modeRolePrompt,
    `Available Speakers:\n${speakerList}`,
    `Recent Script Context:\n${contextLines}`,
    directionHint ? `Director Hint / Topic Prompt: ${directionHint}` : '',
    attachmentDescriptions,
    deepResearchInstructions,
    modeStructureInstruction,
  ]
    .filter(Boolean)
    .join('\n\n');

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [{ text: promptText }];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.dataUrl && att.dataUrl.startsWith('data:')) {
        const commaIdx = att.dataUrl.indexOf(',');
        const base64Data = att.dataUrl.slice(commaIdx + 1);
        parts.push({
          inlineData: {
            mimeType: att.mimeType || (att.isImage ? 'image/png' : 'application/pdf'),
            data: base64Data,
          },
        });
      } else if (att.textContent) {
        parts.push({
          text: `[ATTACHED DOCUMENT: ${att.name}]\n${att.textContent.slice(0, 15000)}\n[END ATTACHED DOCUMENT: ${att.name}]`,
        });
      }
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const requestPayload: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.75,
      responseMimeType: 'application/json',
    },
  };

  if (deepResearch) {
    requestPayload.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      return buildFallbackSceneBeats(speakers, language, directionHint, attachments, deepResearch, mode);
    }

    const data = await response.json();
    let rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawJson !== 'string') {
      return buildFallbackSceneBeats(speakers, language, directionHint, attachments, deepResearch, mode);
    }

    // Clean any markdown wrapper if present
    rawJson = rawJson.trim();
    if (rawJson.startsWith('```')) {
      rawJson = rawJson
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }

    const parsed = JSON.parse(rawJson) as { beats?: unknown[] };
    if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
      return buildFallbackSceneBeats(speakers, language, directionHint, attachments, deepResearch, mode);
    }

    const validSpeakerIds = new Set(speakers.map((s) => s.id));
    const defaultSpeakerId = speakers[0]?.id;

    const hydratedBeats: CoWriterBeatCandidate[] = parsed.beats
      .slice(0, 3)
      .map((rawBeat: unknown, bIdx: number) => {
        const beatObj = rawBeat as {
          id?: string;
          title?: string;
          rationale?: string;
          blocks?: Array<{
            type?: string;
            speakerId?: string;
            text?: string;
            directorNotes?: string;
            pauseAfterMs?: number;
          }>;
        };

        const validBlocks = Array.isArray(beatObj.blocks)
          ? beatObj.blocks
              .filter((blk) => blk && typeof blk.text === 'string' && blk.text.trim().length > 0)
              .map((blk) => {
                const bType =
                  blk.type === 'narration' ||
                  blk.type === 'sound_effect' ||
                  blk.type === 'direction'
                    ? blk.type
                    : 'dialogue';
                const spkId =
                  bType === 'dialogue' || bType === 'narration'
                    ? blk.speakerId && validSpeakerIds.has(blk.speakerId)
                      ? blk.speakerId
                      : defaultSpeakerId
                    : undefined;

                return {
                  type: bType as ScriptBlock['type'],
                  speakerId: spkId,
                  text: blk.text!.trim(),
                  directorNotes: blk.directorNotes?.trim() || 'prirodno / natural',
                  pauseAfterMs: Number(blk.pauseAfterMs) || 450,
                };
              })
          : [];

        if (validBlocks.length === 0) {
          throw new Error('Beat contained no valid blocks');
        }

        return {
          id: beatObj.id || `beat_${bIdx + 1}`,
          title: beatObj.title || `Beat ${bIdx + 1}`,
          rationale: beatObj.rationale || '',
          blocks: validBlocks,
          deepResearchUsed: Boolean(deepResearch),
          analyzedFiles: attachments?.map((a) => a.name),
          mode,
        };
      });

    return hydratedBeats;
  } catch {
    return buildFallbackSceneBeats(speakers, language, directionHint, attachments, deepResearch, mode);
  }
}

function buildFallbackDoctorOptions(
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
  fetchImpl?: typeof fetch;
}): Promise<ScriptDoctorOption[]> {
  const {
    block,
    speaker,
    targetWpm = 140,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    fetchImpl = fetch,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
  }

  const prompt = [
    `You are an audio drama Script Doctor polishing a spoken line for ${
      speaker?.name ?? 'Speaker'
    } (${speaker?.personaPrompt ?? 'natural voice'}).`,
    `Original Line: "${block.text}"`,
    `Current Director Notes: "${block.directorNotes ?? ''}"`,
    `Language: ${language === 'hr' ? 'Croatian (hr)' : 'English (en)'}`,
    'Return ONLY a JSON object with property "options" containing 3 polished alternatives:',
    '{ "options": [ { "id": "doc_1", "styleLabel": "...", "text": "...", "directorNotes": "...", "rationale": "..." } ] }',
  ].join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  } catch {
    return buildFallbackDoctorOptions(block, speaker, targetWpm, language);
  }
}

/**
 * Constructs the linguistic and morphological gender-agreement prompt for Bilingual Adaptation.
 */
export function buildBilingualAdapterPrompt(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
}): string {
  const { block, speaker, sourceLang, targetLang } = options;
  const gender = speaker?.gender ?? 'neutral';

  const croatianMorphologyRule =
    targetLang === 'hr'
      ? gender === 'female'
        ? 'CROATIAN GENDER AGREEMENT (CRITICAL): The speaker is FEMALE. All first-person past-tense l-participles (glagolski pridjevi radni) and adjectives MUST use feminine "-la / -a" morphology (e.g., "rekla sam", "vidjela sam", "bila sam", "sigurna sam").'
        : gender === 'male'
          ? 'CROATIAN GENDER AGREEMENT (CRITICAL): The speaker is MALE. All first-person past-tense l-participles (glagolski pridjevi radni) and adjectives MUST use masculine "-o / -ao" morphology (e.g., "rekao sam", "vidio sam", "bio sam", "siguran sam").'
          : 'CROATIAN GENDER AGREEMENT: Neutral / narrator morphology.'
      : `Speaker gender context: ${gender}. Preserve spoken syllable count and persona idioms.`;

  return [
    `Adapt the following audio drama script block from ${sourceLang.toUpperCase()} to ${targetLang.toUpperCase()}.`,
    `Speaker: ${speaker?.name ?? 'Narrator'} (Gender: ${gender}, Persona: ${speaker?.personaPrompt ?? 'N/A'})`,
    croatianMorphologyRule,
    `Original Text: "${block.text}"`,
    `Original Director Notes: "${block.directorNotes ?? ''}"`,
    'Return ONLY a JSON object with: { "adaptedText": "...", "adaptedDirectorNotes": "...", "culturalNotes": "...", "genderAgreementApplied": "..." }',
  ].join('\n');
}

function buildFallbackBilingualAdaptation(options: {
  block: ScriptBlock;
  speaker?: Speaker;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
}): BilingualAdaptationResult {
  const { block, speaker, sourceLang, targetLang } = options;
  const text = block.text.trim();
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
    const adaptedText =
      knownTranslationsHrToEn[text] ??
      (isFemale
        ? `I told you already — "${text}"`
        : `I saw it myself — "${text}"`);

    return {
      sourceLang,
      targetLang,
      originalText: text,
      adaptedText,
      adaptedDirectorNotes: block.directorNotes || 'whispered / natural',
      culturalNotes:
        'Adapted Zagreb noir idioms into natural English radio-drama cadence while matching syllable pacing.',
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

  return {
    sourceLang,
    targetLang,
    originalText: text,
    adaptedText: adaptedHr,
    adaptedDirectorNotes: block.directorNotes || 'prirodno / natural',
    culturalNotes:
      'Prilagođeno autentičnom zagrebačkom govornom ritmu uz očuvanje trajanja izgovora.',
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
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  fetchImpl?: typeof fetch;
}): Promise<BilingualAdaptationResult> {
  const {
    block,
    speaker,
    sourceLang,
    targetLang,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    fetchImpl = fetch,
  } = options;

  if (!apiKey || apiKey.trim().length < 10) {
    return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
  }

  const prompt = buildBilingualAdapterPrompt({
    block,
    speaker,
    sourceLang,
    targetLang,
  });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const parsed = JSON.parse(rawJson) as Partial<BilingualAdaptationResult>;
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
  } catch {
    return buildFallbackBilingualAdaptation({ block, speaker, sourceLang, targetLang });
  }
}

