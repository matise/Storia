import {
  AgentChatMessage,
  CoWriterAttachment,
  CoWriterBeatCandidate,
  CoWriterWorkflowMode,
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
import { extractPodcastTranscriptCandidatesFromInputs } from './podcastTranscriptParser';
import {
  buildCreativeDivergencePrompt,
  detectStoryTone,
  extractContextKeywords,
  formatRecentChatHistoryForPrompt,
} from './agentContextBuilder';

export interface CoWriterContextOptions {
  precedingBlocks?: ScriptBlock[];
  followingBlocks?: ScriptBlock[];
  selectedBlockId?: string | null;
  selectedText?: string;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeGenre?: string;
}

export function buildFallbackSceneBeats(
  speakers: Speaker[],
  language: SupportedLanguage,
  directionHint?: string,
  attachments?: CoWriterAttachment[],
  deepResearch?: boolean,
  mode: CoWriterWorkflowMode = 'scene_beats',
  contextOptions?: CoWriterContextOptions
): CoWriterBeatCandidate[] {
  if (mode === 'podcast_episode') {
    const parsedTranscriptCandidates = extractPodcastTranscriptCandidatesFromInputs({
      speakers,
      language,
      directionHint,
      attachments,
      deepResearch,
    });
    if (parsedTranscriptCandidates.length > 0) {
      return parsedTranscriptCandidates;
    }
  }

  const s1 = speakers[0]?.id ?? 'spk_marko';
  const s2 = speakers[1]?.id ?? speakers[0]?.id ?? 'spk_ana';
  const s1Name = speakers[0]?.name ?? 'Speaker 1';
  const s2Name = speakers[1]?.name ?? speakers[0]?.name ?? 'Speaker 2';
  const narrator =
    speakers.find((s) => s.name.toLowerCase().includes('narrat'))?.id ?? s1;
  const hintClean = directionHint?.trim() ?? '';
  const hintNote = hintClean ? ` (${hintClean})` : '';

  const hasFiles = Boolean(attachments && attachments.length > 0);
  const firstFile = hasFiles ? attachments![0] : undefined;

  const preceding = contextOptions?.precedingBlocks ?? [];
  const selectedBlock = contextOptions?.selectedBlockId
    ? preceding.find((b) => b.id === contextOptions.selectedBlockId) ??
      preceding[preceding.length - 1]
    : preceding[preceding.length - 1];
  const selectedSnippet =
    contextOptions?.selectedText?.trim() ||
    selectedBlock?.text?.trim() ||
    '';

  const toneCorpus = [
    hintClean,
    contextOptions?.episodeTitle ?? '',
    contextOptions?.episodeDescription ?? '',
    contextOptions?.episodeGenre ?? '',
    selectedSnippet,
    ...preceding.slice(-3).map((b) => b.text),
  ].join(' ');
  const detectedTone = detectStoryTone(toneCorpus);
  const keywords = extractContextKeywords(toneCorpus, 4);
  const focusKeyword =
    hintClean ||
    (contextOptions?.selectedText?.trim() ? `"${contextOptions.selectedText.trim()}"` : '') ||
    keywords[0] ||
    '';

  // When a specific directionHint, highlighted text, or non-noir genre (comedy, sci-fi, coastal, intimate) is active
  // in scene_beats mode without attachments, synthesize context-driven beats tailored to the actual scene!
  if (
    mode === 'scene_beats' &&
    !hasFiles &&
    (Boolean(hintClean) ||
      Boolean(contextOptions?.selectedText?.trim()) ||
      detectedTone === 'comedy_satire' ||
      detectedTone === 'scifi_tech' ||
      detectedTone === 'intimate_drama' ||
      detectedTone === 'coastal_mediterranean')
  ) {
    const topicPhrase =
      hintClean ||
      (contextOptions?.selectedText?.trim()
        ? contextOptions.selectedText.trim()
        : selectedSnippet.slice(0, 65) || contextOptions?.episodeTitle || 'ovaj trenutak');

    if (language === 'hr') {
      const contextualBeatsHr: CoWriterBeatCandidate[] = [
        {
          id: 'beat_1',
          title: `1. Karakterna suigra i podtekst${hintNote}`,
          rationale: `Izravno se nadovezuje na odabrani kontekst (${topicPhrase.slice(0, 50)}) kroz karakternu napetost između ${s1Name} i ${s2Name}.`,
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: hintClean
                ? `Čekaj malo — ako gledamo "${hintClean}", onda sve što smo maloprije rekli dobiva sasvim drugi smisao.`
                : `Misliš li stvarno to što si upravo izgovorio: "${topicPhrase.slice(0, 55)}"?`,
              directorNotes:
                detectedTone === 'comedy_satire'
                  ? 'ironično, brz komični tajming'
                  : 'izravno, s nevjericom / probing',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text:
                detectedTone === 'comedy_satire'
                  ? `Naravno da mislim! Samo što ti uvijek tražiš dramski zaplet tamo gdje je običan nesporazum.`
                  : `Znam kako zvuči, ali više ne možemo ignorirati činjenice koje su pred nama.`,
              directorNotes:
                detectedTone === 'comedy_satire'
                  ? 'duhovito, kroz smijeh / wry chuckle'
                  : 'staloženo, iskreno / grounded',
              pauseAfterMs: 450,
            },
          ],
        },
        {
          id: 'beat_2',
          title: deepResearch
            ? `2. Dubinska sinteza i pomak u prostoru${hintNote}`
            : `2. Zvučna dinamika i promjena ritma${hintNote}`,
          rationale:
            'Mijenja akustičnu perspektivu scene kombiniranjem konkretnog zvučnog detalja i pripovjednog prijelaza.',
          blocks: [
            {
              type: 'sound_effect',
              text:
                detectedTone === 'scifi_tech'
                  ? 'Tiho pulsiranje telemetrijske konzole i kratki digitalni signal potvrde.'
                  : detectedTone === 'coastal_mediterranean'
                    ? 'Šum valova uz kameni mul i udar bure u drvene škure.'
                    : 'Naglo pomicanje stolice i tihi žamor prostora u pozadini.',
              directorNotes: 'prostorni fokus / spatial detail',
              pauseAfterMs: 350,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: `U tom trenutku fokus razgovora prebacio se na ${focusKeyword || 'ključnu odluku koja ih je čekala'}.`,
              directorNotes: 'prirodan pripovjedački ritam',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: `Idemo odmah provjeriti ${hintClean || 'taj trag'} prije nego što izgubimo korak.`,
              directorNotes: 'odlučno, u pokretu',
              pauseAfterMs: 450,
            },
          ],
        },
        {
          id: 'beat_3',
          title: `3. Neočekivani obrat i ironični odmak${hintNote}`,
          rationale:
            'Razbija predvidljivi obrazac scene uvođenjem nove perspektive i duhovite kontre.',
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: `Najbolji dio cijele priče oko "${topicPhrase.slice(0, 48)}" je to što smo rješenje imali pred nosom od prve minute.`,
              directorNotes: 'suho, ironično / dry wit',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: `Reci to naglas još jednom i preuzimaš cijelu odgovornost za idući korak.`,
              directorNotes: 'britko, s osmijehom / sharp',
              pauseAfterMs: 450,
            },
          ],
        },
      ];

      return contextualBeatsHr.map((b) => ({
        ...b,
        deepResearchUsed: Boolean(deepResearch),
        analyzedFiles: attachments?.map((a) => a.name),
        mode,
      }));
    } else {
      const contextualBeatsEn: CoWriterBeatCandidate[] = [
        {
          id: 'beat_1',
          title: `1. Character Subtext & Friction${hintNote}`,
          rationale: `Directly builds upon the active context (${topicPhrase.slice(0, 50)}) through sharp interplay between ${s1Name} and ${s2Name}.`,
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: hintClean
                ? `Wait a second—if we factor in "${hintClean}", everything we just assumed flips upside down.`
                : `Hold on. Did you actually mean what you just said about "${topicPhrase.slice(0, 55)}"?`,
              directorNotes:
                detectedTone === 'comedy_satire'
                  ? 'deadpan, quick comic timing'
                  : 'probing, direct',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text:
                detectedTone === 'comedy_satire'
                  ? `Of course I meant it! You are the only person who turns a simple Tuesday into a grand conspiracy.`
                  : `Every word of it. We cannot keep tiptoeing around what is right in front of us.`,
              directorNotes:
                detectedTone === 'comedy_satire'
                  ? 'wry, amused'
                  : 'grounded, unflinching',
              pauseAfterMs: 450,
            },
          ],
        },
        {
          id: 'beat_2',
          title: deepResearch
            ? `2. Analytical Synthesis & Acoustic Shift${hintNote}`
            : `2. Kinetic Action & Soundstage Pivot${hintNote}`,
          rationale:
            'Shifts the acoustic environment and narrative momentum with tactile sound design.',
          blocks: [
            {
              type: 'sound_effect',
              text:
                detectedTone === 'scifi_tech'
                  ? 'Low harmonic hum of the telemetry array locking onto a new frequency.'
                  : detectedTone === 'coastal_mediterranean'
                    ? 'Crisp sea breeze and waves lapping against the stone pier.'
                    : 'Chair scraping back sharply and quick footsteps across the room.',
              directorNotes: 'focused stereo field',
              pauseAfterMs: 350,
            },
            {
              type: 'narration',
              speakerId: narrator,
              text: `The focus of the room shifted immediately toward ${focusKeyword || 'the decision waiting ahead of them'}.`,
              directorNotes: 'clear narrative pacing',
              pauseAfterMs: 500,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: `Let's test "${hintClean || 'that theory'}" right now while we still have the advantage.`,
              directorNotes: 'energized, moving',
              pauseAfterMs: 450,
            },
          ],
        },
        {
          id: 'beat_3',
          title: `3. Unexpected Twist & Ironic Pivot${hintNote}`,
          rationale:
            'Subverts the expected trajectory with character wit and a fresh angle.',
          blocks: [
            {
              type: 'dialogue',
              speakerId: s1,
              text: `The funniest part about "${topicPhrase.slice(0, 48)}" is that the answer was sitting in plain sight the whole time.`,
              directorNotes: 'sardonically, dry wit',
              pauseAfterMs: 400,
            },
            {
              type: 'dialogue',
              speakerId: s2,
              text: `Say that one more time and you are leading the next briefing yourself.`,
              directorNotes: 'dryly, crisp',
              pauseAfterMs: 450,
            },
          ],
        },
      ];

      return contextualBeatsEn.map((b) => ({
        ...b,
        deepResearchUsed: Boolean(deepResearch),
        analyzedFiles: attachments?.map((a) => a.name),
        mode,
      }));
    }
  }

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
  followingBlocks?: ScriptBlock[];
  selectedBlockId?: string | null;
  selectedText?: string;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeGenre?: string;
  chatHistory?: AgentChatMessage[];
  speakers: Speaker[];
  language: SupportedLanguage;
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  directionHint?: string;
  attachments?: CoWriterAttachment[];
  deepResearch?: boolean;
  mode?: CoWriterWorkflowMode;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  fetchImpl?: typeof fetch;
  abortSignal?: AbortSignal;
}): Promise<CoWriterBeatCandidate[]> {
  const {
    precedingBlocks,
    followingBlocks = [],
    selectedBlockId,
    selectedText,
    episodeTitle,
    episodeDescription,
    episodeGenre,
    chatHistory,
    speakers,
    language,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    directionHint,
    attachments,
    deepResearch = false,
    mode = 'scene_beats',
    dialect,
    dubrovnikRegister,
    fetchImpl = fetch,
    abortSignal,
  } = options;

  // Anchor preceding and following blocks around selectedBlockId if present
  const selectedIdx = selectedBlockId
    ? precedingBlocks.findIndex((b) => b.id === selectedBlockId)
    : -1;
  const anchoredPreceding =
    selectedIdx >= 0 ? precedingBlocks.slice(0, selectedIdx + 1) : precedingBlocks;
  const anchoredFollowing =
    followingBlocks.length > 0
      ? followingBlocks
      : selectedIdx >= 0 && selectedIdx + 1 < precedingBlocks.length
        ? precedingBlocks.slice(selectedIdx + 1, selectedIdx + 5)
        : [];

  const contextOptions: CoWriterContextOptions = {
    precedingBlocks: anchoredPreceding,
    followingBlocks: anchoredFollowing,
    selectedBlockId,
    selectedText,
    episodeTitle,
    episodeDescription,
    episodeGenre,
  };

  if (!apiKey || apiKey.trim().length < 10) {
    const fallbacks = buildFallbackSceneBeats(
      speakers,
      language,
      directionHint,
      attachments,
      deepResearch,
      mode,
      contextOptions
    );
    if (dialect === 'dubrovnik' && language === 'hr') {
      return fallbacks.map((beat) => ({
        ...beat,
        title: transformToDubrovnikDialect(beat.title, dubrovnikRegister),
        blocks: beat.blocks.map((blk) => ({
          ...blk,
          text: transformToDubrovnikDialect(blk.text, dubrovnikRegister),
        })),
      }));
    }
    return fallbacks;
  }

  const contextLines = anchoredPreceding
    .slice(-8)
    .map((b, idx, arr) => {
      const spk = speakers.find((s) => s.id === b.speakerId)?.name ?? b.type.toUpperCase();
      const isSelected =
        (selectedBlockId && b.id === selectedBlockId) ||
        (!selectedBlockId && idx === arr.length - 1);
      const marker = isSelected ? '>>> [ACTIVE SELECTION] ' : '';
      return `${marker}[${b.type}] ${spk}: ${b.text}`;
    })
    .join('\n');

  const followingLines =
    anchoredFollowing.length > 0
      ? anchoredFollowing
          .slice(0, 4)
          .map((b) => {
            const spk =
              speakers.find((s) => s.id === b.speakerId)?.name ?? b.type.toUpperCase();
            return `[${b.type}] ${spk}: ${b.text}`;
          })
          .join('\n')
      : '';

  const speakerList = speakers
    .map(
      (s) =>
        `${s.id}: ${s.name} (Gender: ${s.gender}, Age: ${s.age}, Persona: ${s.personaPrompt}, Acting: ${s.actingNotes})`
    )
    .join('\n');

  const parsedPodcastCandidates =
    mode === 'podcast_episode'
      ? extractPodcastTranscriptCandidatesFromInputs({
          speakers,
          language,
          directionHint,
          attachments,
          deepResearch,
        })
      : [];

  const attachmentDescriptions =
    attachments && attachments.length > 0
      ? `ATTACHED FILES (${attachments.length}):\n` +
        attachments
          .map(
            (a) =>
              `- ${a.name} (${a.mimeType}, ${a.sizeBytes} bytes)${
                a.textContent ? `:\n"""${a.textContent.slice(0, 4000)}..."""` : ''
              }`
          )
          .join('\n')
      : '';

  const deepResearchInstructions = deepResearch
    ? 'DEEP RESEARCH MODE IS ACTIVE: Conduct thorough analytical research (using Google Search grounding if relevant) and deep multimodal document/visual examination. Extract hidden dramatic clues, subtext, period-accurate details, and geopolitical context.'
    : '';

  const dubrovnikDialectInstructions =
    language === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';

  const detectedTone = detectStoryTone(
    [
      episodeTitle ?? '',
      episodeDescription ?? '',
      episodeGenre ?? '',
      directionHint ?? '',
      selectedText ?? '',
      contextLines,
    ].join(' '),
    dialect
  );
  const creativeDivergenceRules = buildCreativeDivergencePrompt({
    language,
    tone: detectedTone,
    genre: episodeGenre,
  });
  const recentChatPrompt = formatRecentChatHistoryForPrompt(chatHistory, 'cowriter', 6);

  let modeRolePrompt = [
    `You are an elite audio drama Co-Writer and Narrative Showrunner generating 3 creatively distinct candidate narrative continuation beats in ${
      language === 'hr' ? 'Croatian (hr)' : 'English (en)'
    }.`,
    `Ensure the 3 candidate beats explore genuinely DIFFERENT creative directions anchored at the active selection:`,
    `- Beat 1 (Character Subtext & Relational Friction): Deepen psychological subtext, unspoken motives, or conversational intimacy/conflict.`,
    `- Beat 2 (Kinetic Action & Acoustic Staging): Advance the physical action and sensory environment using evocative sound design/foley and dynamic pacing.`,
    `- Beat 3 (Unexpected Twist, Irony, or Genre Pivot): Surprise the listener with a sharp revelation, dry humor/irony, or structural turn suited to the episode's genre.`,
  ].join('\n');

  let modeStructureInstruction =
    'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array of 3 beat objects. Do not wrap in markdown or backticks.\n{ "beats": [ { "id": "beat_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 450 } ] } ] }';

  if (mode === 'complete_story') {
    modeRolePrompt = `You are a master storyteller and audio dramatist generating a comprehensive, long complete audio drama story in ${
      language === 'hr' ? 'Croatian (hr)' : 'English (en)'
    }. Craft each candidate draft with a distinct creative interpretation, authentic character voices, and vivid acoustic worldbuilding tailored to the episode's genre and premise.`;
    modeStructureInstruction =
      'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array containing 2 or 3 complete story candidate drafts. Each candidate draft MUST be an extensive, fully realized episodic narrative containing 8 to 14 script blocks covering opening atmospheric narration, sound effects/foley, escalating dialogue, climax, and resolution.\n{ "beats": [ { "id": "story_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 450 } ] } ] }';
  } else if (mode === 'podcast_episode') {
    modeRolePrompt = `You are an expert podcast producer and scriptwriter creating a complete audio podcast episode script in ${
      language === 'hr' ? 'Croatian (hr)' : 'English (en)'
    }.`;
    modeStructureInstruction =
      'CRITICAL INSTRUCTION: Return ONLY a valid JSON object with a "beats" array containing 2 or 3 complete podcast episode candidate drafts.\n' +
      'IMPORTANT PODCAST TRANSCRIPT RULE: If any attached document, text, or image is already formatted like a podcast transcript (e.g., having header fields like "Format: Transkript audio podcasta", "Sugovornici: Voditelj 1 i Voditelj 2", "Tema: ...", timestamped section headers like "[00:00:00] 1. dio: ...", and speaker lines like "Voditelj 1: ...", "Voditelj 2: ..."), you MUST extract and use the ACTUAL podcast title, topic (Tema), section headings (as "narration" blocks), and exact speaker dialogue turns from the provided document/image! Map "Voditelj 1" / "Host 1" to the first available dialogue speakerId and "Voditelj 2" / "Host 2" to the second available dialogue speakerId.\n' +
      'Otherwise, if the attached document is general prose/notes, each candidate episode MUST be a full conversational podcast script containing 8 to 12 blocks covering: intro theme/jingle sound effect, host greeting & topic hook, co-host/guest conversational banter, deep-dive topic discussion analyzing the evidence/files, musical transition sound effect, key takeaway summary, and outro sign-off.\n' +
      '{ "beats": [ { "id": "podcast_1", "title": "...", "rationale": "...", "blocks": [ { "type": "dialogue" | "narration" | "sound_effect", "speakerId": "...", "text": "...", "directorNotes": "...", "pauseAfterMs": 400 } ] } ] }';
  }

  const episodeHeader =
    episodeTitle || episodeGenre || episodeDescription
      ? `Episode Context: "${episodeTitle ?? 'Untitled'}" | Genre: ${episodeGenre ?? 'Audio Drama'}${
          episodeDescription ? `\nSynopsis: ${episodeDescription}` : ''
        }`
      : '';

  const promptText = [
    modeRolePrompt,
    episodeHeader,
    `Available Speakers:\n${speakerList}`,
    `Recent Script Context (Anchored at Selection):\n${contextLines}`,
    selectedText?.trim()
      ? `Highlighted Text Selection in Active Block: "${selectedText.trim()}"`
      : '',
    followingLines
      ? `Upcoming Blocks After Selection (bridge smoothly toward these if continuing mid-script):\n${followingLines}`
      : '',
    directionHint ? `Director Hint / Topic Prompt: ${directionHint}` : '',
    recentChatPrompt,
    creativeDivergenceRules,
    attachmentDescriptions,
    deepResearchInstructions,
    dubrovnikDialectInstructions,
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
          text: `[ATTACHED DOCUMENT: ${att.name}]\n${att.textContent.slice(0, 60000)}\n[END ATTACHED DOCUMENT: ${att.name}]`,
        });
      }
    }
  }

  const endpoint = buildGeminiEndpoint(modelId, apiKey);

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
      signal: abortSignal,
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      return buildFallbackSceneBeats(
        speakers,
        language,
        directionHint,
        attachments,
        deepResearch,
        mode,
        contextOptions
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== 'string') {
      return buildFallbackSceneBeats(
        speakers,
        language,
        directionHint,
        attachments,
        deepResearch,
        mode,
        contextOptions
      );
    }

    const rawJson = stripMarkdownJsonFence(rawText);
    const parsed = JSON.parse(rawJson) as { beats?: unknown[] };
    if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
      return buildFallbackSceneBeats(
        speakers,
        language,
        directionHint,
        attachments,
        deepResearch,
        mode,
        contextOptions
      );
    }

    const validSpeakerIds = new Set(speakers.map((s) => s.id));
    const defaultSpeakerId = speakers[0]?.id;
    const dialogueSpeakers = speakers.filter(
      (s) => !/narrat|pripovjedač/i.test(s.name)
    );
    const castPool = dialogueSpeakers.length > 0 ? dialogueSpeakers : speakers;

    const resolveHydratedSpeakerId = (rawSpeakerId?: string): string | undefined => {
      if (!rawSpeakerId) return defaultSpeakerId;
      if (validSpeakerIds.has(rawSpeakerId)) return rawSpeakerId;
      const lower = rawSpeakerId.toLowerCase().trim();
      const byName = speakers.find(
        (s) =>
          s.name.toLowerCase() === lower ||
          s.name.toLowerCase().includes(lower) ||
          lower.includes(s.name.toLowerCase())
      );
      if (byName) return byName.id;
      const numMatch = rawSpeakerId.match(/(\d+)\s*$/);
      if (numMatch && castPool.length > 0) {
        const oneBased = Math.max(1, parseInt(numMatch[1], 10));
        return castPool[(oneBased - 1) % castPool.length].id;
      }
      return defaultSpeakerId;
    };

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
              .filter(
                (blk) => blk && typeof blk.text === 'string' && blk.text.trim().length > 0
              )
              .map((blk) => {
                const bType =
                  blk.type === 'narration' ||
                  blk.type === 'sound_effect' ||
                  blk.type === 'direction'
                    ? blk.type
                    : 'dialogue';
                const spkId =
                  bType === 'dialogue' || bType === 'narration'
                    ? resolveHydratedSpeakerId(blk.speakerId)
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

    if (parsedPodcastCandidates.length > 0) {
      return [parsedPodcastCandidates[0], ...hydratedBeats.slice(0, 2)];
    }

    return hydratedBeats;
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return buildFallbackSceneBeats(
      speakers,
      language,
      directionHint,
      attachments,
      deepResearch,
      mode,
      contextOptions
    );
  }
}

