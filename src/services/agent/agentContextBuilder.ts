import {
  AgentChatMessage,
  AIAgentMode,
  CoWriterAttachment,
  CroatianDialect,
  DubrovnikRegister,
  Project,
  ScriptBlock,
  ScriptTextSelection,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';

export type DetectedStoryTone =
  | 'comedy_satire'
  | 'scifi_tech'
  | 'podcast_talk'
  | 'coastal_mediterranean'
  | 'historical_period'
  | 'fantasy_myth'
  | 'intimate_drama'
  | 'thriller_mystery'
  | 'contemporary_drama';

export interface StudioContextSnapshot {
  episodeTitle: string;
  episodeDescription: string;
  episodeGenre: string;
  targetWpm: number;
  language: SupportedLanguage;
  dialect: CroatianDialect;
  dubrovnikRegister: DubrovnikRegister;
  detectedTone: DetectedStoryTone;
  speakers: Speaker[];
  allBlocks: ScriptBlock[];
  activeBlock?: ScriptBlock;
  activeBlockIndex: number;
  activeBlockSpeaker?: Speaker;
  selectedTextRange: ScriptTextSelection | null;
  /** Blocks strictly before the active block */
  beforeActiveBlocks: ScriptBlock[];
  /** Blocks up to and including the active block (ideal for continuing from selection) */
  precedingBlocks: ScriptBlock[];
  /** Blocks strictly after the active block */
  followingBlocks: ScriptBlock[];
  extractedThemes: string[];
  creativeDivergencePrompt: string;
  formattedContextSummary: string;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
  'what', 'when', 'where', 'which', 'who', 'will', 'would', 'could', 'should', 'into',
  'about', 'there', 'their', 'they', 'them', 'then', 'than', 'just', 'like', 'only',
  'some', 'more', 'very', 'here', 'over', 'after', 'before', 'between', 'through',
  'koji', 'koja', 'koje', 'nije', 'jesu', 'biti', 'samo', 'tako', 'kako', 'kada',
  'gdje', 'ovdje', 'tamo', 'nešto', 'ništa', 'nego', 'kroz', 'između', 'prije',
  'poslije', 'više', 'manje', 'svaki', 'svaka', 'svako', 'nego', 'iako', 'zato',
]);

export function detectStoryTone(textCorpus: string, dialect?: CroatianDialect): DetectedStoryTone {
  const lower = textCorpus.toLowerCase();

  if (
    /comedy|komedij|satir|humor|funny|smiješ|škerac|sitcom|parodij|ironi|witty|joke|šala/.test(
      lower
    )
  ) {
    return 'comedy_satire';
  }
  if (
    /podcast|interview|intervju|voditelj|host|debata|debate|panel|talk show|emisij|analiz/.test(
      lower
    )
  ) {
    return 'podcast_talk';
  }
  if (
    /sci-fi|scifi|svemir|space|orbital|cyber|ai\b|quantum|kvant|telemetr|fuzij|signal|station|postaj|dron|algorit/.test(
      lower
    )
  ) {
    return 'scifi_tech';
  }
  if (
    dialect === 'dubrovnik' ||
    /dubrovnik|ragus|stradun|lazaret|kupari|mlini|bura|jugo|more|morsk|obal|otok|jadrans|gospar|grad\b|porat/.test(
      lower
    )
  ) {
    return 'coastal_mediterranean';
  }
  if (
    /fantasy|fantazij|myth|mitolog|magic|magij|dragon|zmaj|legend|ancient|drevn|kraljevstv| prophecy/.test(
      lower
    )
  ) {
    return 'fantasy_myth';
  }
  if (
    /15\d\d|16\d\d|17\d\d|18\d\d|19[0-4]\d|republika|renesans|barok|povijes|historical|stoljeć|century|kralj|knež/.test(
      lower
    )
  ) {
    return 'historical_period';
  }
  if (
    /ljubav|love|romance|romans|brak|marriage|obitelj|family|prijatelj|friend|srce|heart|intimat|confess|oprost/.test(
      lower
    )
  ) {
    return 'intimate_drama';
  }
  if (
    /triler|thriller|mystery|misterij|detektiv|inspektor|murder|ubojstv|clue|trag|noir|istrag|conspirac|urot/.test(
      lower
    )
  ) {
    return 'thriller_mystery';
  }
  return 'contemporary_drama';
}

export function extractContextKeywords(textCorpus: string, maxKeywords = 8): string[] {
  const words = textCorpus
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));

  const counts = new Map<string, { original: string; count: number }>();
  for (const word of words) {
    const lower = word.toLowerCase();
    const existing = counts.get(lower);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(lower, { original: word, count: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxKeywords)
    .map((entry) => entry.original);
}

export function buildCreativeDivergencePrompt(options: {
  language: SupportedLanguage;
  tone: DetectedStoryTone;
  genre?: string;
}): string {
  const { language, tone, genre } = options;
  const isHr = language === 'hr';

  const toneDirective = (() => {
    switch (tone) {
      case 'comedy_satire':
        return isHr
          ? 'TON I ŽANR: Komedija / Satira. Koristi brz komični tajming, ironiju, neočekivane obrate, podtekst i živahnu međuigru likova.'
          : 'TONE & GENRE: Comedy / Satire. Prioritize sharp comic timing, dry wit, escalating absurdity, conversational interruptions, and character irony.';
      case 'podcast_talk':
        return isHr
          ? 'TON I ŽANR: Suvremeni Podcast / Analitički Razgovor. Prirodan studijski govor, spontane reakcije, konkretne analogije i intelektualna znatiželja.'
          : 'TONE & GENRE: Contemporary Podcast / Analytical Talk. Natural studio spontaneity, vivid analogies, sharp follow-up questions, and authentic host chemistry.';
      case 'scifi_tech':
        return isHr
          ? 'TON I ŽANR: Znanstvena fantastika / Tehnološki triler. Precizan tehnički vokabular, akustična prostornost, filozofska pitanja i osjetilni detalji.'
          : 'TONE & GENRE: Sci-Fi / High-Tech Drama. Ground dialogue in tactile technical realism, acoustic telemetry, philosophical stakes, and crisp pacing.';
      case 'coastal_mediterranean':
        return isHr
          ? 'TON I ŽANR: Mediteranska / Dubrovačka obalna drama. Osjetilni kontrast kamena, mora, vjetra i autentičnog lokalnog mentaliteta bez generičkih klišeja.'
          : 'TONE & GENRE: Mediterranean Coastal Drama. Sensory contrast of stone, sea currents, wind, and grounded local temperament.';
      case 'fantasy_myth':
        return isHr
          ? 'TON I ŽANR: Fantazija / Mitološka drama. Bogata zvučna tekstura, arhetipski motivi, poetičan ali govorno prirodan ritam.'
          : 'TONE & GENRE: Fantasy / Mythic Drama. Evocative acoustic worldbuilding, mythic resonance, and natural spoken rhythm.';
      case 'historical_period':
        return isHr
          ? 'TON I ŽANR: Povijesna drama. Vjerodostojni povijesni detalji, autentičan društveni registar i životni dijalozi.'
          : 'TONE & GENRE: Historical Period Drama. Period-accurate vocabulary, social subtext, and lived-in acoustic textures.';
      case 'intimate_drama':
        return isHr
          ? 'TON I ŽANR: Intimna psihološka / odnosna drama. Fokus na neizgovorenom podtekstu, mikro-pauzama, ranjivosti i autentičnim emocijama.'
          : 'TONE & GENRE: Intimate Character Drama. Focus on unspoken subtext, emotional honesty, breath pauses, and relational tension.';
      case 'thriller_mystery':
        return isHr
          ? 'TON I ŽANR: Napeti triler / Misterij. Gradi napetost kroz konkretne radnje, psihološko nadmudrivanje i specifične detalje iz konteksta.'
          : 'TONE & GENRE: Suspense Thriller / Mystery. Build tension through specific character stakes, psychological cat-and-mouse, and concrete context clues.';
      default:
        return isHr
          ? `TON I ŽANR: ${genre || 'Suvremena audio-drama'}. Prirodan govorni jezik, jasna motivacija likova i svježa dramaturgija.`
          : `TONE & GENRE: ${genre || 'Contemporary Audio Drama'}. Natural spoken cadence, distinct character voices, and fresh dramatic choices.`;
    }
  })();

  if (isHr) {
    return [
      toneDirective,
      'PRAVILA KREATIVNE RAZNOLIKOSTI (ANTI-KLIŠEJ):',
      '- NIKADA ne recikliraj generičke noir klišeje (poput "gusta magla na krovovima", "zaključaj oba zasuna", "pečat je još topao") osim ako to korisnik izričito ne traži.',
      '- Svaki lik mora govoriti svojim prepoznatljivim vokabularom, tempom i psihologijom iz opisa persone.',
      '- Nadoveži se IZRAVNO na odabrani blok, označeni tekst i dosadašnji tijek radnje.',
    ].join('\n');
  }

  return [
    toneDirective,
    'CREATIVE DIVERGENCE & ANTI-CLICHÉ RULES:',
    '- NEVER recycle generic noir filler clichés (such as "thick fog clung to the gas lamps", "lock both deadbolts", "the wax seal is still warm") unless explicitly requested.',
    '- Differentiate each speaker’s vocabulary, sentence length, and attitude based on their persona profile.',
    '- Anchor your writing directly in the currently selected block, highlighted text, and specific story context.',
  ].join('\n');
}

export function buildStudioContextSnapshot(options: {
  project: Project;
  selectedBlockId?: string | null;
  selectedTextRange?: ScriptTextSelection | null;
  directionHint?: string;
  attachments?: CoWriterAttachment[];
  maxWindowBlocks?: number;
}): StudioContextSnapshot {
  const {
    project,
    selectedBlockId,
    selectedTextRange = null,
    directionHint = '',
    attachments = [],
    maxWindowBlocks = 8,
  } = options;

  const allBlocks = project.blocks ?? [];
  const rawIdx = selectedBlockId
    ? allBlocks.findIndex((b) => b.id === selectedBlockId)
    : -1;
  const activeBlockIndex = rawIdx >= 0 ? rawIdx : Math.max(0, allBlocks.length - 1);
  const activeBlock = allBlocks[activeBlockIndex];
  const activeBlockSpeaker = project.speakers.find(
    (s) => s.id === activeBlock?.speakerId
  );

  const validTextSelection =
    selectedTextRange &&
    activeBlock &&
    selectedTextRange.blockId === activeBlock.id &&
    selectedTextRange.selectedText.trim().length > 0
      ? selectedTextRange
      : null;

  const beforeActiveBlocks = allBlocks.slice(
    Math.max(0, activeBlockIndex - maxWindowBlocks),
    activeBlockIndex
  );
  const precedingBlocks = allBlocks.slice(
    Math.max(0, activeBlockIndex - maxWindowBlocks + 1),
    activeBlockIndex + 1
  );
  const followingBlocks = allBlocks.slice(
    activeBlockIndex + 1,
    activeBlockIndex + 1 + Math.ceil(maxWindowBlocks / 2)
  );

  const episodeGenre = project.metadata?.genre?.trim() || 'Audio Drama / Podcast';
  const corpusParts = [
    project.title,
    project.description,
    episodeGenre,
    directionHint,
    ...precedingBlocks.map((b) => b.text),
    ...attachments.map((a) => `${a.name} ${(a.textContent ?? '').slice(0, 1500)}`),
  ];
  const fullCorpus = corpusParts.filter(Boolean).join(' ');

  const detectedTone = detectStoryTone(fullCorpus, project.dialect);
  const extractedThemes = extractContextKeywords(
    [
      directionHint,
      activeBlock?.text ?? '',
      project.title,
      project.description,
      ...precedingBlocks.slice(-4).map((b) => b.text),
    ].join(' ')
  );

  const creativeDivergencePrompt = buildCreativeDivergencePrompt({
    language: project.defaultLanguage,
    tone: detectedTone,
    genre: episodeGenre,
  });

  const formatBlockLine = (b: ScriptBlock, isCurrent = false) => {
    const spk =
      project.speakers.find((s) => s.id === b.speakerId)?.name ??
      b.type.toUpperCase();
    const notes = b.directorNotes ? ` (${b.directorNotes})` : '';
    const marker = isCurrent ? '>>> [SELECTED BLOCK] ' : '';
    return `${marker}#${b.order + 1} [${b.type}] ${spk}${notes}: "${b.text}"`;
  };

  const formattedContextSummary = [
    `EPISODE: "${project.title}" | Genre: ${episodeGenre} | Target WPM: ${project.metadata?.targetWpm ?? 140}`,
    project.description ? `SYNOPSIS: ${project.description}` : '',
    `CAST (${project.speakers.length}):`,
    ...project.speakers.map(
      (s) =>
        `- ${s.id} ("${s.name}", ${s.gender}, ${s.age}, Voice: ${s.voice.baseVoice}): ${s.personaPrompt} | Acting: ${s.actingNotes}`
    ),
    beforeActiveBlocks.length > 0
      ? `PRECEDING BLOCKS (Before Selection):\n${beforeActiveBlocks.map((b) => formatBlockLine(b, false)).join('\n')}`
      : '',
    activeBlock
      ? `CURRENTLY SELECTED BLOCK (#${activeBlock.order + 1} of ${allBlocks.length}):\n${formatBlockLine(activeBlock, true)}`
      : '',
    validTextSelection
      ? `HIGHLIGHTED TEXT SELECTION INSIDE BLOCK #${(activeBlock?.order ?? 0) + 1}: "${validTextSelection.selectedText}" (offsets ${validTextSelection.startOffset}..${validTextSelection.endOffset})`
      : '',
    followingBlocks.length > 0
      ? `FOLLOWING BLOCKS (After Selection):\n${followingBlocks.map((b) => formatBlockLine(b, false)).join('\n')}`
      : '',
    creativeDivergencePrompt,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    episodeTitle: project.title,
    episodeDescription: project.description,
    episodeGenre,
    targetWpm: project.metadata?.targetWpm ?? 140,
    language: project.defaultLanguage,
    dialect: project.dialect ?? 'standard',
    dubrovnikRegister: project.dubrovnikRegister ?? 'contemporary',
    detectedTone,
    speakers: project.speakers,
    allBlocks,
    activeBlock,
    activeBlockIndex,
    activeBlockSpeaker,
    selectedTextRange: validTextSelection,
    beforeActiveBlocks,
    precedingBlocks,
    followingBlocks,
    extractedThemes,
    creativeDivergencePrompt,
    formattedContextSummary,
  };
}

export function formatRecentChatHistoryForPrompt(
  chatHistory: AgentChatMessage[] | undefined,
  agentMode?: AIAgentMode,
  maxMessages = 8
): string {
  if (!chatHistory || chatHistory.length === 0) return '';
  const filtered = agentMode
    ? chatHistory.filter((m) => m.agentMode === agentMode)
    : chatHistory;
  const recent = (filtered.length > 0 ? filtered : chatHistory).slice(-maxMessages);
  if (recent.length === 0) return '';

  return (
    `RECENT CONVERSATION HISTORY:\n` +
    recent
      .map((m) => {
        const roleLabel = m.role === 'user' ? 'USER' : `ASSISTANT (${m.agentMode})`;
        const toolsSummary =
          m.toolActions && m.toolActions.length > 0
            ? ` [Tools Applied: ${m.toolActions.map((t) => t.summary).join('; ')}]`
            : '';
        return `${roleLabel}: ${m.content}${toolsSummary}`;
      })
      .join('\n')
  );
}
