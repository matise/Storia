import {
  AgentChatMessage,
  AgentToolAction,
  AgentToolType,
  AIAgentMode,
  BlockType,
  CoWriterAttachment,
  CroatianDialect,
  DubrovnikRegister,
  GeminiTextModelId,
  Project,
  ScriptBlock,
  ScriptTextSelection,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';
import { transformToDubrovnikDialect } from '../../core/dubrovnik/dubrovnikPhonetics';
import {
  buildDubrovnikAgentInstructions,
  buildGeminiEndpoint,
  stripMarkdownJsonFence,
} from './dubrovnikAgentInstructions';
import {
  buildStudioContextSnapshot,
  formatRecentChatHistoryForPrompt,
  StudioContextSnapshot,
} from './agentContextBuilder';
import { resolveSpeakerFromReference } from './agentToolExecutor';

export interface RoleMasterChatResponse {
  reply: string;
  role: AIAgentMode;
  toolActions: AgentToolAction[];
  suggestedFollowUps: string[];
}

export interface RoleMasterChatOptions {
  userMessage: string;
  role: AIAgentMode;
  project?: Project;
  blocks?: ScriptBlock[];
  speakers?: Speaker[];
  selectedBlockId?: string | null;
  selectedTextRange?: ScriptTextSelection | null;
  activeSpeakerId?: string | null;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeGenre?: string;
  language?: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  chatHistory?: AgentChatMessage[];
  attachments?: CoWriterAttachment[];
  apiKey?: string | null;
  modelId?: GeminiTextModelId;
  fetchImpl?: typeof fetch;
  abortSignal?: AbortSignal;
}

function toSnapshotProject(options: RoleMasterChatOptions): Project {
  if (options.project) {
    return options.project;
  }
  const now = Date.now();
  return {
    id: 'proj_chat_snapshot',
    title: options.episodeTitle ?? 'Untitled Episode',
    description: options.episodeDescription ?? '',
    defaultLanguage: options.language ?? 'hr',
    dialect: options.dialect ?? 'standard',
    dubrovnikRegister: options.dubrovnikRegister ?? 'contemporary',
    speakers: options.speakers ?? [],
    blocks: options.blocks ?? [],
    audioConfig: {
      sampleRate: 48000,
      bitDepth: 24,
      dither: 'tpdf',
      targetLufs: -16,
      truePeakLimitDb: -1.0,
    },
    aiSettings: {
      ttsProvider: 'gemini_tts',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      textModel: options.modelId ?? 'gemini-3-flash-preview',
      enableSearchGrounding: false,
      temperature: 0.7,
      audioOutputFormat: 'pcm_24khz',
    },
    metadata: {
      genre: options.episodeGenre ?? 'Audio Drama / Podcast',
      author: 'Storia Studio',
      targetWpm: 140,
    },
    chatHistory: options.chatHistory ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function getRoleMasterIdentityPrompt(
  role: AIAgentMode,
  language: SupportedLanguage
): string {
  const isHr = language === 'hr';
  switch (role) {
    case 'persona_research':
      return isHr
        ? 'Ti si Majstor Istraživanja Likova i Povijesnog Konteksta (Persona & World Researcher). Poznaješ psihologiju svakog govornika, podtekst scene, povijesne/tehničke činjenice i vokalne osobine. Odgovaraš prirodno kao vrhunski dramaturški savjetnik u studiju i po potrebi izravno ažuriraš profil govornika ili blokove scenarija pomoću alata.'
        : 'You are the Master Persona & World Researcher. You specialize in character psychology, subtext, historical/technical authenticity, and vocal profile tuning. You converse naturally as a studio dramaturg and can directly update speaker profiles or script blocks using studio tools.';
    case 'cowriter':
      return isHr
        ? 'Ti si Glavni Ko-Scenarist i Arhitekt Scena (Master Co-Writer). Vodiš strukturu priče, gradiš obrate, dijaloge, naraciju i zvučne efekte svjestan trenutnog bloka i označenog teksta. Odgovaraš prirodno u razgovoru i po želji korisnika izravno umećeš, dijeliš, mijenjaš ili premještaš blokove pomoću alata.'
        : 'You are the Master Co-Writer & Narrative Architect. You craft story beats, dialogue exchanges, narration, and sound effects anchored around the user’s active block and highlighted selection. You converse naturally and directly insert, split, edit, or reorder script blocks using studio tools.';
    case 'dialogue_doctor':
      return isHr
        ? 'Ti si Majstor Dijaloškog Doktora i Vokalne Režije (Master Dialogue Doctor). Specijaliziran si za govorni ritam, kadencu, skraćivanje rečenica, glumačke upute (directorNotes) i poliranje označenog teksta ili cijelog bloka. Odgovaraš prirodno i izravno primjenjuješ izmjene na označeni tekst ili blok pomoću alata.'
        : 'You are the Master Dialogue Doctor & Vocal Director. You specialize in spoken cadence, subtext, breath pacing, directorNotes, and surgical polishing of highlighted text spans or full blocks. You converse naturally and directly apply edits using studio tools.';
    case 'bilingual_adapter':
      return isHr
        ? 'Ti si Majstor Dvojezične i Dijalektalne Adaptacije (Master Bilingual & Dialect Adapter). Specijaliziran si za hrvatsko-englesku dramsku adaptaciju, morfološko slaganje roda (-o / -la) i autentični dubrovački govor (raguzejski idiom). Odgovaraš prirodno i izravno prevodiš ili prilagođavaš označeni tekst ili blok pomoću alata.'
        : 'You are the Master Bilingual & Dialect Adapter. You specialize in EN <-> HR dramatic adaptation, Croatian grammatical gender agreement (-o vs. -la participles), and authentic Dubrovnik dialect (Ragusan idiom). You converse naturally and directly adapt highlighted spans or full blocks using studio tools.';
  }
}

export function buildRoleMasterSystemPrompt(options: {
  role: AIAgentMode;
  snapshot: StudioContextSnapshot;
  language: SupportedLanguage;
  dialect?: CroatianDialect;
  dubrovnikRegister?: DubrovnikRegister;
  chatHistory?: AgentChatMessage[];
}): string {
  const {
    role,
    snapshot,
    language,
    dialect = 'standard',
    dubrovnikRegister = 'contemporary',
    chatHistory,
  } = options;

  const identity = getRoleMasterIdentityPrompt(role, language);
  const dubrovnikRules =
    language === 'hr' && dialect === 'dubrovnik'
      ? buildDubrovnikAgentInstructions(dubrovnikRegister)
      : '';
  const recentHistory = formatRecentChatHistoryForPrompt(chatHistory, role, 8);
  const selectedSpan = snapshot.selectedTextRange?.selectedText?.trim() || '';

  return [
    identity,
    `Respond in ${language === 'hr' ? 'Croatian (Hrvatski)' : 'English'} unless the user asks for another language.`,
    snapshot.formattedContextSummary,
    selectedSpan
      ? `ACTIVE HIGHLIGHTED TEXT SELECTION inside block "${snapshot.activeBlock?.id}": "${selectedSpan}" (offsets ${snapshot.selectedTextRange?.startOffset}..${snapshot.selectedTextRange?.endOffset}). When the user says "this", "the selection", or "these words", operate specifically on this highlighted span!`
      : '',
    dubrovnikRules,
    recentHistory,
    `AVAILABLE STUDIO TOOLS (include in "toolActions" array ONLY when the user asks to change, edit, rewrite, shorten, translate, split, insert, move, delete, or update something):`,
    `- "replace_selected_text": { "id": "act_1", "tool": "replace_selected_text", "targetBlockId": "...", "summary": "Replaced selected span", "payload": { "selectedText": "...", "replacementText": "...", "directorNotes": "optional" } }`,
    `- "update_block": { "id": "act_1", "tool": "update_block", "targetBlockId": "...", "summary": "Updated block", "payload": { "text": "optional new text", "directorNotes": "optional new cue", "speakerId": "optional speaker id or name", "type": "dialogue|narration|sound_effect" } }`,
    `- "insert_blocks": { "id": "act_1", "tool": "insert_blocks", "targetBlockId": "...", "summary": "Inserted N block(s)", "payload": { "position": "after"|"before", "blocks": [{ "type": "dialogue|narration|sound_effect", "speakerName": "Speaker Name", "text": "...", "directorNotes": "..." }] } }`,
    `- "split_block": { "id": "act_1", "tool": "split_block", "targetBlockId": "...", "summary": "Split block into dialogue turns", "payload": { "blocks": [{ "type": "dialogue", "speakerName": "Speaker Name", "text": "...", "directorNotes": "..." }, ...] } }`,
    `- "delete_block": { "id": "act_1", "tool": "delete_block", "targetBlockId": "...", "summary": "Deleted block", "payload": {} }`,
    `- "move_block": { "id": "act_1", "tool": "move_block", "targetBlockId": "...", "summary": "Moved block", "payload": { "direction": "up"|"down" } }`,
    `- "update_speaker": { "id": "act_1", "tool": "update_speaker", "targetSpeakerId": "...", "summary": "Updated speaker profile", "payload": { "speakerName": "...", "personaPrompt": "optional", "actingNotes": "optional", "stylePrompt": "optional", "speakingRate": 1.0, "pitchAdjustment": 0 } }`,
    `- "update_episode_metadata": { "id": "act_1", "tool": "update_episode_metadata", "summary": "Updated episode metadata", "payload": { "title": "optional", "description": "optional", "genre": "optional" } }`,
    `Return ONLY valid JSON with this structure:`,
    `{`,
    `  "reply": "Conversational, helpful studio response explaining your insight or what you just changed.",`,
    `  "toolActions": [ ... ],`,
    `  "suggestedFollowUps": ["Short follow-up chip 1", "Short follow-up chip 2"]`,
    `}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function tightenSpokenText(text: string, isHr: boolean): string {
  const cleaned = text
    .replace(/\b(dakle|ovaj|zapravo|u suštini|jednostavno rečeno)\b\s*,?/gi, '')
    .replace(/\b(basically|actually|to be honest|in order to|as a matter of fact)\b\s*,?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleaned !== text && cleaned.length >= 8) {
    return cleaned;
  }

  const clauses = text
    .split(/(?<=[.!?—,;])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length > 1) {
    return clauses.slice(0, Math.max(1, clauses.length - 1)).join(' ');
  }

  const words = text.split(/\s+/);
  if (words.length > 7) {
    const trimmed = words
      .slice(0, Math.ceil(words.length * 0.72))
      .join(' ')
      .replace(/[,;:-]+$/, '');
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  return isHr
    ? `${text.replace(/[.!?]+$/, '')} — odmah.`
    : `${text.replace(/[.!?]+$/, '')}—now.`;
}

function adaptTextLocally(
  text: string,
  speaker: Speaker | undefined,
  dialect?: CroatianDialect,
  dubrovnikRegister?: DubrovnikRegister,
  forceTargetLang?: SupportedLanguage
): string {
  const isFemale = speaker?.gender === 'female';
  const looksCroatian = /\b(sam|nije|što|kako|ovdje|samo|već|nego|ali|noć|grad)\b/i.test(text);
  const targetLang: SupportedLanguage =
    forceTargetLang ?? (looksCroatian ? 'en' : 'hr');

  if (targetLang === 'en') {
    if (text.includes('Ugasi svjetlo')) {
      return 'Kill the light. Someone is watching us from that attic across the street.';
    }
    return isFemale
      ? `I knew it the moment we stepped inside — ${text}`
      : `I saw it with my own eyes — ${text}`;
  }

  let hrText = isFemale
    ? text
        .replace(/\bI saw\b/gi, 'Vidjela sam')
        .replace(/\bI knew\b/gi, 'Znala sam')
        .replace(/\bI said\b/gi, 'Rekla sam')
        .replace(/\bI was\b/gi, 'Bila sam')
    : text
        .replace(/\bI saw\b/gi, 'Vidio sam')
        .replace(/\bI knew\b/gi, 'Znao sam')
        .replace(/\bI said\b/gi, 'Rekao sam')
        .replace(/\bI was\b/gi, 'Bio sam');

  if (hrText === text && !looksCroatian) {
    hrText = isFemale
      ? `Znala sam čim sam čula taj ton — ${text}`
      : `Znao sam čim sam čuo taj ton — ${text}`;
  }

  if (dialect === 'dubrovnik') {
    hrText = transformToDubrovnikDialect(hrText, dubrovnikRegister);
  }
  return hrText;
}

function makeToolAction(
  tool: AgentToolType,
  summary: string,
  payload: Record<string, unknown>,
  targetBlockId?: string,
  targetSpeakerId?: string
): AgentToolAction {
  return {
    id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tool,
    summary,
    targetBlockId,
    targetSpeakerId,
    payload,
  };
}

/**
 * Local Role-Master intent & tool engine for immediate offline/fallback studio chat execution.
 */
export function buildLocalRoleMasterChatTurn(
  options: RoleMasterChatOptions
): RoleMasterChatResponse {
  const snapshotProject = toSnapshotProject(options);
  const {
    userMessage,
    role,
    selectedBlockId,
    selectedTextRange,
    activeSpeakerId,
    attachments,
  } = options;

  const language = options.language ?? snapshotProject.defaultLanguage ?? 'hr';
  const dialect = options.dialect ?? snapshotProject.dialect ?? 'standard';
  const dubrovnikRegister =
    options.dubrovnikRegister ?? snapshotProject.dubrovnikRegister ?? 'contemporary';

  const isHr = language === 'hr';
  const isDubrovnik = isHr && dialect === 'dubrovnik';

  const snapshot = buildStudioContextSnapshot({
    project: snapshotProject,
    selectedBlockId,
    selectedTextRange,
    attachments,
  });

  const blocks = snapshot.allBlocks;
  const speakers = snapshot.speakers;
  const activeBlock = snapshot.activeBlock ?? blocks[blocks.length - 1] ?? null;
  const activeSpeaker =
    (activeSpeakerId ? speakers.find((s) => s.id === activeSpeakerId) : undefined) ??
    snapshot.activeBlockSpeaker ??
    speakers[0];
  const secondarySpeaker =
    speakers.find((s) => s.id !== activeSpeaker?.id) ?? activeSpeaker;

  const trimmedMsg = userMessage.trim();
  const lower = trimmedMsg.toLowerCase();
  const selectedTextCandidate = snapshot.selectedTextRange?.selectedText?.trim() ?? '';
  const hasSelection = Boolean(
    activeBlock &&
      selectedTextCandidate.length > 0 &&
      activeBlock.text.includes(selectedTextCandidate)
  );
  const selectedSpan = hasSelection ? selectedTextCandidate : '';

  // 1. Explicit replacement: "change this to X", "replace with X", "promijeni ovo u X", "zamijeni s X"
  const explicitReplaceMatch =
    trimmedMsg.match(
      /(?:change\s+(?:this|selection|it|text)\s+to|replace\s+(?:this|selection|it)?\s*with|rewrite\s+as|promijeni\s+(?:ovo|tekst|označeno)?\s*u|zamijeni\s+(?:ovo|tekst)?\s*(?:sa?|u))\s+["“']?(.+?)["”']?$/i
    ) || trimmedMsg.match(/^["“'](.+)["”']$/);

  if (explicitReplaceMatch && activeBlock) {
    const newText = explicitReplaceMatch[1].trim();
    if (hasSelection) {
      return {
        role,
        reply: isHr
          ? `Zamijenio sam označeni dio teksta ("${selectedSpan}") u bloku #${snapshot.activeBlockIndex + 1} novom formulacijom: "${newText}".`
          : `Replaced the highlighted span ("${selectedSpan}") in block #${snapshot.activeBlockIndex + 1} with "${newText}".`,
        toolActions: [
          makeToolAction(
            'replace_selected_text',
            isHr
              ? `Zamijenjen označeni tekst u bloku #${snapshot.activeBlockIndex + 1}`
              : `Replaced selected text in block #${snapshot.activeBlockIndex + 1}`,
            {
              selectedText: selectedSpan,
              replacementText: newText,
            },
            activeBlock.id
          ),
        ],
        suggestedFollowUps: isHr
          ? ['Dodaj glumačku uputu šapatom', 'Skrati cijeli blok', 'Podijeli u dijalog']
          : ['Add whispered delivery cue', 'Tighten full block', 'Split into dialogue'],
      };
    }

    return {
      role,
      reply: isHr
        ? `Ažurirao sam tekst aktivnog bloka #${snapshot.activeBlockIndex + 1} prema tvojoj uputi.`
        : `Updated the text of active block #${snapshot.activeBlockIndex + 1} as requested.`,
      toolActions: [
        makeToolAction(
          'update_block',
          isHr
            ? `Ažuriran tekst bloka #${snapshot.activeBlockIndex + 1}`
            : `Updated block #${snapshot.activeBlockIndex + 1} text`,
          { text: newText },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Dodaj zvučni efekt prije ovoga', 'Prilagodi dubrovačkom govoru']
        : ['Add sound effect before this', 'Polish vocal delivery notes'],
    };
  }

  // 2. Delivery / Emotion / Director Notes cue ("whisper", "šapat", "sarcastic", "ironično", "urgent", "hitno")
  if (
    activeBlock &&
    /\b(whisper|whispered|šapat|šapćući|tiše|polušapat|sarcastic|ironic|ironično|cinično|urgent|hitno|napeto|angry|ljutito|excited|uzbuđeno|calm|smireno|delivery|uput|ton)\b/i.test(
      lower
    ) &&
    !/\b(add|insert|dodaj|umetni)\s+(?:sfx|sound|zvuk)\b/i.test(lower)
  ) {
    let cue = isHr ? 'intenzivno, blizu mikrofona' : 'intense, close-mic';
    if (/whisper|šapat|tiše|polušapat/i.test(lower)) {
      cue = isHr ? 'šapatom, sasvim blizu mikrofona' : 'hushed whisper, ultra-close mic';
    } else if (/sarcastic|ironic|ironično|cinično/i.test(lower)) {
      cue = isHr ? 'suha ironija, s kratkom stankom' : 'dry, razor-sharp irony with a beat pause';
    } else if (/urgent|hitno|napeto/i.test(lower)) {
      cue = isHr ? 'hitno, ubrzan dah' : 'urgent, breathless cadence';
    } else if (/angry|ljutito/i.test(lower)) {
      cue = isHr ? 'suzdržani bijes, oštri suglasnici' : 'controlled anger, clipped consonants';
    } else if (/calm|smireno/i.test(lower)) {
      cue = isHr ? 'smireno i odmjereno' : 'calm, measured authority';
    }

    return {
      role,
      reply: isHr
        ? `Postavio sam glumačku uputu (directorNotes) za blok #${snapshot.activeBlockIndex + 1} na "${cue}" kako bi vokalna sinteza uhvatila točnu emociju.`
        : `Updated the director notes on block #${snapshot.activeBlockIndex + 1} to "${cue}" for expressive vocal synthesis.`,
      toolActions: [
        makeToolAction(
          'update_block',
          isHr
            ? `Glumačka uputa postavljena na "${cue}"`
            : `Director notes set to "${cue}"`,
          { directorNotes: cue },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Skrati rečenicu za brži ritam', 'Podijeli u dvije replike']
        : ['Tighten sentence cadence', 'Split into two dialogue turns'],
    };
  }

  // 3. Shorten / Tighten / Polish ("shorten", "tighten", "punchier", "skrati", "ispoliraj", "sažmi")
  if (
    activeBlock &&
    /\b(shorten|tighten|punchier|concise|skrati|sažmi|ispoliraj|polish|prirodnije|natural|rewrite|preformuliraj)\b/i.test(
      lower
    )
  ) {
    const targetText = hasSelection ? selectedSpan : activeBlock.text;
    let tightened = tightenSpokenText(targetText, isHr);
    if (isDubrovnik) {
      tightened = transformToDubrovnikDialect(tightened, dubrovnikRegister);
    }

    if (hasSelection) {
      return {
        role,
        reply: isHr
          ? `Sažeo sam i ispolirao označeni izraz ("${selectedSpan}" → "${tightened}") za prirodniji govorni dah.`
          : `Tightened and polished the highlighted selection ("${selectedSpan}" → "${tightened}") for punchier spoken cadence.`,
        toolActions: [
          makeToolAction(
            'replace_selected_text',
            isHr
              ? `Ispoliran označeni dio u bloku #${snapshot.activeBlockIndex + 1}`
              : `Polished selected span in block #${snapshot.activeBlockIndex + 1}`,
            {
              selectedText: selectedSpan,
              replacementText: tightened,
            },
            activeBlock.id
          ),
        ],
        suggestedFollowUps: isHr
          ? ['Dodaj glumačku uputu šapatom', 'Prevedi ovaj blok']
          : ['Add whispered delivery cue', 'Adapt block bilingually'],
      };
    }

    return {
      role,
      reply: isHr
        ? `Skratio sam i ritmički izoštrio blok #${snapshot.activeBlockIndex + 1} ("${tightened}") kako bi zvučao prirodnije pred mikrofonom.`
        : `Tightened block #${snapshot.activeBlockIndex + 1} ("${tightened}") for cleaner broadcast pacing.`,
      toolActions: [
        makeToolAction(
          'update_block',
          isHr
            ? `Skraćen i ispoliran blok #${snapshot.activeBlockIndex + 1}`
            : `Tightened and polished block #${snapshot.activeBlockIndex + 1}`,
          {
            text: tightened,
            directorNotes:
              activeBlock.directorNotes || (isHr ? 'prirodno, sažeto' : 'natural, punchy'),
          },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Podijeli ovaj blok u dijalog', 'Dodaj zvučni efekt nakon ovoga']
        : ['Split this block into dialogue', 'Add sound effect after this'],
    };
  }

  // 4. Split block into multi-speaker dialogue ("split", "podijeli", "razbij", "turn into dialogue")
  if (
    activeBlock &&
    /\b(split|divide|podijeli|razbij|razdvoji|pretvori u dijalog)\b/i.test(lower)
  ) {
    const sentences = activeBlock.text
      .split(/(?<=[.!?—])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const firstHalf =
      sentences.length >= 2
        ? sentences.slice(0, Math.ceil(sentences.length / 2)).join(' ')
        : activeBlock.text;
    const secondHalf =
      sentences.length >= 2
        ? sentences.slice(Math.ceil(sentences.length / 2)).join(' ')
        : isHr
          ? `Čekaj malo — želiš reći da je to cijelo vrijeme bilo pred nama?`
          : `Wait a second—are you saying that was right in front of us the whole time?`;

    return {
      role,
      reply: isHr
        ? `Podijelio sam blok #${snapshot.activeBlockIndex + 1} u dinamičnu dijalošku izmjenu između govornika ${activeSpeaker?.name ?? 'Govornik 1'} i ${secondarySpeaker?.name ?? 'Govornik 2'}.`
        : `Split block #${snapshot.activeBlockIndex + 1} into a two-turn exchange between ${activeSpeaker?.name ?? 'Speaker 1'} and ${secondarySpeaker?.name ?? 'Speaker 2'}.`,
      toolActions: [
        makeToolAction(
          'split_block',
          isHr
            ? `Podijeljen blok #${snapshot.activeBlockIndex + 1} na 2 dijaloške replike`
            : `Split block #${snapshot.activeBlockIndex + 1} into 2 dialogue turns`,
          {
            blocks: [
              {
                type: 'dialogue',
                speakerId: activeSpeaker?.id,
                speakerName: activeSpeaker?.name,
                text: firstHalf,
                directorNotes:
                  activeBlock.directorNotes || (isHr ? 'fokusirano' : 'focused'),
              },
              {
                type: 'dialogue',
                speakerId: secondarySpeaker?.id,
                speakerName: secondarySpeaker?.name,
                text: secondHalf,
                directorNotes: isHr ? 'brzi odgovor, iznenađeno' : 'quick reply, surprised',
              },
            ],
          },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Dodaj zvučni efekt između njih', 'Ispoliraj drugu repliku']
        : ['Add sound effect before this', 'Polish the reply line'],
    };
  }

  // 5. Insert Sound Effect / Narration / Dialogue ("add sfx", "add sound", "dodaj zvuk", "insert", "umetni")
  if (
    /\b(add|insert|dodaj|umetni|ubaci|create|napravi)\b/i.test(lower) &&
    /\b(sfx|sound|zvuk|kiš|rain|vjetar|wind|bura|door|vrat|footstep|korac|music|glazb|šum|static|narration|naracij|dialogue|dijalog|replika|line|beat|scen)\b/i.test(
      lower
    )
  ) {
    const position: 'before' | 'after' = /\b(before|prije|ispred)\b/i.test(lower)
      ? 'before'
      : 'after';

    const wantsSfx =
      /\b(sfx|sound|zvuk|kiš|rain|vjetar|wind|bura|door|vrat|footstep|korac|šum|static)\b/i.test(
        lower
      );
    const wantsNarration = /\b(narration|naracij|opis)\b/i.test(lower);

    const newBlockType: BlockType = wantsSfx
      ? 'sound_effect'
      : wantsNarration
        ? 'narration'
        : 'dialogue';

    let newText = '';

    if (newBlockType === 'sound_effect') {
      if (/rain|kiš/i.test(lower)) {
        newText = isHr
          ? 'Pljusak kiše po prozorskom staklu i tihi odjek ulice'
          : 'Rain pattering against the windowpane and distant street resonance';
      } else if (/wind|vjetar|bura/i.test(lower)) {
        newText = isDubrovnik
          ? 'Reful bure niz kamene mire i škripanje drvenih persijana'
          : isHr
            ? 'Snažan udar vjetra kroz prolaz i treperenje stakla'
            : 'Sharp gust of wind whistling through the corridor';
      } else if (/door|vrat/i.test(lower)) {
        newText = isHr
          ? 'Škripanje teških drvenih vrata i metalni klik brave'
          : 'Heavy wooden door creaking open followed by a latch click';
      } else if (/footstep|korac/i.test(lower)) {
        newText = isHr
          ? 'Ubrzani koraci po kamenim pločama koji se naglo zaustavljaju'
          : 'Hurried footsteps across stone tiles coming to an abrupt halt';
      } else {
        newText = isHr
          ? `Atmosferski zvučni prijelaz u prostoru (${snapshot.extractedThemes[0] ?? 'studio'})`
          : `Atmospheric acoustic transition (${snapshot.extractedThemes[0] ?? 'studio'})`;
      }
    } else if (newBlockType === 'narration') {
      newText = isDubrovnik
        ? `Tišina se spustila nad Gradom, a svaka riječ izgovorena u komori dobila je novu težinu.`
        : isHr
          ? `U prostoru je nastala kratka stanka dok se fokus prebacio na idući trag.`
          : `A brief silence settled over the room as attention shifted to the next detail.`;
    } else {
      newText = isDubrovnik
        ? `Čekaj malo, čuješ li ovo? Netko je već prolazio ovuda prije nas.`
        : isHr
          ? `Pogledaj ovo izbliza — ovaj detalj mijenja sve što smo dosad pretpostavili.`
          : `Look closely at this—that single detail changes everything we assumed.`;
    }

    return {
      role,
      reply: isHr
        ? `Umetnuo sam novi blok (${newBlockType === 'sound_effect' ? 'zvučni efekt' : newBlockType === 'narration' ? 'naraciju' : 'dijalog'}) ${position === 'before' ? 'ispred' : 'nakon'} bloka #${snapshot.activeBlockIndex + 1}.`
        : `Inserted a new ${newBlockType.replace('_', ' ')} block ${position} block #${snapshot.activeBlockIndex + 1}.`,
      toolActions: [
        makeToolAction(
          'insert_blocks',
          isHr
            ? `Umetnut blok (${newBlockType}) ${position === 'before' ? 'prije' : 'nakon'} aktivnog bloka`
            : `Inserted ${newBlockType} block ${position} active block`,
          {
            position,
            blocks: [
              {
                type: newBlockType,
                speakerId: newBlockType === 'dialogue' ? activeSpeaker?.id : undefined,
                speakerName:
                  newBlockType === 'dialogue' ? activeSpeaker?.name : undefined,
                text: newText,
                directorNotes:
                  newBlockType === 'dialogue'
                    ? isHr
                      ? 'prirodno, sa zanimanjem'
                      : 'natural, engaged'
                    : undefined,
              },
            ],
          },
          activeBlock?.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Dodaj još jednu repliku odgovora', 'Promijeni ton u šapat']
        : ['Add a follow-up reply line', 'Make delivery whispered'],
    };
  }

  // 6. Translate / Bilingual or Dialect Adaptation ("translate", "prevedi", "adapt", "prilagodi", "dubrovnik")
  if (
    activeBlock &&
    /\b(translate|prevedi|adapt|prilagodi|dubrovnik|dubrovačk|raguz|english|englesk|croatian|hrvatsk)\b/i.test(
      lower
    )
  ) {
    const wantsDubrovnik = /dubrovnik|dubrovačk|raguz/i.test(lower);
    const wantsEn = /english|englesk|\bto en\b|\bu en\b/i.test(lower);
    const wantsHr =
      /croatian|hrvatsk|\bto hr\b|\bu hr\b|dubrovnik|dubrovačk/i.test(lower);
    const targetLang: SupportedLanguage | undefined = wantsEn
      ? 'en'
      : wantsHr
        ? 'hr'
        : undefined;

    const sourceSpan = hasSelection ? selectedSpan : activeBlock.text;
    const adapted = adaptTextLocally(
      sourceSpan,
      activeSpeaker,
      wantsDubrovnik ? 'dubrovnik' : dialect,
      dubrovnikRegister,
      targetLang
    );

    if (hasSelection) {
      return {
        role,
        reply: isHr
          ? `Prilagodio sam označeni izraz ("${selectedSpan}" → "${adapted}") uz poštivanje roda govornika (${activeSpeaker?.name ?? 'Pripovjedač'}).`
          : `Adapted the highlighted selection ("${selectedSpan}" → "${adapted}") with speaker gender agreement (${activeSpeaker?.name ?? 'Narrator'}).`,
        toolActions: [
          makeToolAction(
            'replace_selected_text',
            isHr
              ? `Jezično prilagođen označeni tekst u bloku #${snapshot.activeBlockIndex + 1}`
              : `Adapted selected text in block #${snapshot.activeBlockIndex + 1}`,
            {
              selectedText: selectedSpan,
              replacementText: adapted,
            },
            activeBlock.id
          ),
        ],
        suggestedFollowUps: isHr
          ? ['Prilagodi cijeli blok', 'Ispoliraj ritam rečenice']
          : ['Adapt entire block', 'Tighten spoken cadence'],
      };
    }

    return {
      role,
      reply: isHr
        ? `Prilagodio sam blok #${snapshot.activeBlockIndex + 1}: "${adapted}".`
        : `Adapted block #${snapshot.activeBlockIndex + 1}: "${adapted}".`,
      toolActions: [
        makeToolAction(
          'update_block',
          isHr
            ? `Jezično prilagođen blok #${snapshot.activeBlockIndex + 1}`
            : `Bilingually adapted block #${snapshot.activeBlockIndex + 1}`,
          { text: adapted },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Skrati izraz za brži izgovor', 'Dodaj glumačku uputu']
        : ['Tighten phrasing for pacing', 'Add director delivery cue'],
    };
  }

  // 7. Switch speaker on active block ("switch speaker to X", "assign to X", "promijeni govornika u X", "neka govori X")
  const speakerSwitchMatch = trimmedMsg.match(
    /(?:switch\s+speaker\s+to|assign\s+to|change\s+speaker\s+to|promijeni\s+govornika\s+u|neka\s+govori|stavi\s+govornika)\s+(.+)$/i
  );
  if (speakerSwitchMatch && activeBlock) {
    const refName = speakerSwitchMatch[1].replace(/[.!?]+$/, '').trim();
    const matchedSpeaker = resolveSpeakerFromReference(speakers, refName, activeBlock.speakerId);
    if (matchedSpeaker) {
      return {
        role,
        reply: isHr
          ? `Prebacio sam govornika bloka #${snapshot.activeBlockIndex + 1} na **${matchedSpeaker.name}**.`
          : `Switched the speaker of block #${snapshot.activeBlockIndex + 1} to **${matchedSpeaker.name}**.`,
        toolActions: [
          makeToolAction(
            'update_block',
            isHr
              ? `Govornik promijenjen u ${matchedSpeaker.name}`
              : `Speaker changed to ${matchedSpeaker.name}`,
            {
              speakerId: matchedSpeaker.id,
              type: 'dialogue',
            },
            activeBlock.id
          ),
        ],
        suggestedFollowUps: isHr
          ? ['Prilagodi tekst glasu ovog lika', 'Dodaj glumačku uputu']
          : ['Tailor line to this character’s voice', 'Add acting delivery cue'],
      };
    }
  }

  // 8. Delete or Move block ("delete this block", "obriši ovaj blok", "move up", "pomakni gore/dolje")
  if (
    activeBlock &&
    /\b(delete|remove|obriši|ukloni)\s+(?:this\s+)?(?:block|blok|repliku)\b/i.test(lower)
  ) {
    return {
      role,
      reply: isHr
        ? `Obrisao sam blok #${snapshot.activeBlockIndex + 1} iz scenarija. Možeš poništiti radnju jednim klikom na Undo.`
        : `Removed block #${snapshot.activeBlockIndex + 1} from the script. You can undo this action anytime.`,
      toolActions: [
        makeToolAction(
          'delete_block',
          isHr
            ? `Obrisan blok #${snapshot.activeBlockIndex + 1}`
            : `Deleted block #${snapshot.activeBlockIndex + 1}`,
          {},
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Umetni novu repliku', 'Nastavi scenu']
        : ['Insert a new dialogue line', 'Continue scene'],
    };
  }

  if (
    activeBlock &&
    /\b(move|pomakni|premjesti)\b.*\b(up|down|gore|dolje|niže|više)\b/i.test(lower)
  ) {
    const dir: 'up' | 'down' = /\b(up|gore|više)\b/i.test(lower) ? 'up' : 'down';
    return {
      role,
      reply: isHr
        ? `Pomaknuo sam blok #${snapshot.activeBlockIndex + 1} ${dir === 'up' ? 'gore' : 'dolje'} u redoslijedu.`
        : `Moved block #${snapshot.activeBlockIndex + 1} ${dir} in the script timeline.`,
      toolActions: [
        makeToolAction(
          'move_block',
          isHr
            ? `Pomaknut blok #${snapshot.activeBlockIndex + 1} ${dir === 'up' ? 'gore' : 'dolje'}`
            : `Moved block #${snapshot.activeBlockIndex + 1} ${dir}`,
          { direction: dir },
          activeBlock.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Ispoliraj ovaj blok', 'Dodaj zvučni efekt prije']
        : ['Polish this block', 'Add sound effect before'],
    };
  }

  // 9. Speaker Voice / Persona tuning ("make voice faster/slower/deeper", "update persona", "promijeni glas")
  if (
    activeSpeaker &&
    /\b(voice|glas|speaking rate|tempo|faster|brže|slower|sporije|deeper|dublje|pitch|persona|karakter)\b/i.test(
      lower
    )
  ) {
    const currentRate = activeSpeaker.voice.speakingRate ?? 1.0;
    const currentPitch = activeSpeaker.voice.pitchAdjustment ?? 0;
    const newRate = /\b(faster|brže)\b/i.test(lower)
      ? Math.min(1.25, Number((currentRate + 0.08).toFixed(2)))
      : /\b(slower|sporije)\b/i.test(lower)
        ? Math.max(0.82, Number((currentRate - 0.08).toFixed(2)))
        : currentRate;
    const newPitch = /\b(deeper|dublje|lower|niže)\b/i.test(lower)
      ? Math.max(-4, currentPitch - 1)
      : /\b(higher|više|brighter|svjetlije)\b/i.test(lower)
        ? Math.min(4, currentPitch + 1)
        : currentPitch;

    return {
      role,
      reply: isHr
        ? `Ažurirao sam vokalni i karakterni profil za **${activeSpeaker.name}** (tempo: ${newRate}x, visina: ${newPitch >= 0 ? `+${newPitch}` : newPitch} st).`
        : `Updated the vocal and persona profile for **${activeSpeaker.name}** (rate: ${newRate}x, pitch: ${newPitch >= 0 ? `+${newPitch}` : newPitch} st).`,
      toolActions: [
        makeToolAction(
          'update_speaker',
          isHr
            ? `Ažuriran profil govornika ${activeSpeaker.name}`
            : `Updated speaker profile for ${activeSpeaker.name}`,
          {
            speakerName: activeSpeaker.name,
            speakingRate: newRate,
            pitchAdjustment: newPitch,
            actingNotes: `${activeSpeaker.actingNotes ? `${activeSpeaker.actingNotes} • ` : ''}${trimmedMsg}`,
          },
          undefined,
          activeSpeaker.id
        ),
      ],
      suggestedFollowUps: isHr
        ? ['Dodaj repliku u glasu ovog lika', 'Ispoliraj trenutni blok']
        : ['Add a dialogue line in character', 'Polish current block'],
    };
  }

  // 10. Conversational Role-Master Guidance (when asking a question or brainstorming without an explicit edit command)
  const blockContextLabel = activeBlock
    ? `#${snapshot.activeBlockIndex + 1} (${activeSpeaker?.name ?? 'Narrator'}: "${
        selectedSpan || activeBlock.text.slice(0, 65)
      }")`
    : isHr
      ? 'trenutnu scenu'
      : 'the current scene';

  switch (role) {
    case 'persona_research':
      return {
        role,
        reply: isHr
          ? `Kao voditelj istraživanja likova za **${activeSpeaker?.name ?? 'ovaj ansambl'}**, gledajući ${blockContextLabel}: ovdje je ključno naglasiti kontrast između onoga što lik izgovara i onoga što prešućuje (${snapshot.detectedTone} ton). Reci mi npr. *"učini glas malo sporijim i dubljim"* ili *"dodaj repliku u glasu ovog lika"* i odmah ću primijeniti izmjenu.`
          : `Looking at ${blockContextLabel} through **${activeSpeaker?.name ?? 'the character'}'s** psychology (${snapshot.detectedTone} tone): the strongest subtext lies in what they withhold between clauses. Tell me *"make voice slower and deeper"* or *"change this to..."* and I will apply it directly.`,
        toolActions: [],
        suggestedFollowUps: isHr
          ? [
              'Učini glas malo sporijim i dubljim',
              'Dodaj repliku u glasu ovog lika',
              'Promijeni glumačku uputu u šapat',
            ]
          : [
              'Make voice slower and deeper',
              'Add a dialogue line in character',
              'Set delivery cue to whispered',
            ],
      };

    case 'cowriter':
      return {
        role,
        reply: isHr
          ? `Pratim kontekst oko bloka ${blockContextLabel} (žanr/ton: ${snapshot.detectedTone}). Možemo razviti scenu u tri smjera: eskalirati sukob između likova ${activeSpeaker?.name ?? 'A'} i ${secondarySpeaker?.name ?? 'B'}, uvesti zvučni prekid u prostoru ili podijeliti ovaj blok u brzi dijalog. Napiši što želiš promijeniti ili dodati!`
          : `Anchored at ${blockContextLabel} (${snapshot.detectedTone} tone), we can escalate the exchange between ${activeSpeaker?.name ?? 'Speaker A'} and ${secondarySpeaker?.name ?? 'Speaker B'}, introduce an acoustic interruption, or split this block into rapid banter. Just tell me what to change or insert!`,
        toolActions: [],
        suggestedFollowUps: isHr
          ? [
              'Podijeli ovaj blok u dijalog',
              'Dodaj zvučni efekt prije ovog bloka',
              'Dodaj novu repliku nakon ovoga',
            ]
          : [
              'Split this block into dialogue',
              'Add sound effect before this block',
              'Add a new dialogue line after this',
            ],
      };

    case 'bilingual_adapter':
      return {
        role,
        reply: isHr
          ? `Analiziram ${blockContextLabel} (${activeSpeaker?.name ?? 'Pripovjedač'}, rod: ${activeSpeaker?.gender ?? 'neutral'}). Mogu odmah prevesti ili prilagoditi ${hasSelection ? `označeni izraz ("${selectedSpan}")` : 'cijeli blok'} na engleski, standardni hrvatski ili autentični dubrovački govor uz točno slaganje glagolskog pridjeva radnog.`
          : `Analyzing ${blockContextLabel} (${activeSpeaker?.name ?? 'Narrator'}, gender: ${activeSpeaker?.gender ?? 'neutral'}). I can directly adapt ${hasSelection ? `your highlighted selection ("${selectedSpan}")` : 'the full block'} into English, Croatian (-o/-la gender agreement), or authentic Dubrovnik dialect.`,
        toolActions: [],
        suggestedFollowUps: isHr
          ? [
              'Prilagodi dubrovačkom govoru',
              'Prevedi na engleski',
              'Skrati i prilagodi hrvatskom ritmu',
            ]
          : [
              'Translate to Croatian with gender agreement',
              'Adapt into Dubrovnik dialect',
              'Translate to English',
            ],
      };

    case 'dialogue_doctor':
    default:
      return {
        role,
        reply: isHr
          ? `Analizirao sam govorni ritam za ${blockContextLabel}. ${hasSelection ? `Označeni dio ("${selectedSpan}") možemo odmah sažeti ili preoblikovati bez diranja ostatka rečenice.` : 'Rečenicu možemo skratiti za prirodniji dah, podijeliti u dvije replike ili joj dodati preciznu vokalnu uputu.'}`
          : `Analyzed the spoken cadence of ${blockContextLabel}. ${hasSelection ? `We can surgically rewrite or tighten your highlighted span ("${selectedSpan}") in place.` : 'We can tighten the phrasing for breath pacing, split it into two turns, or update the vocal delivery notes.'}`,
        toolActions: [],
        suggestedFollowUps: isHr
          ? [
              'Skrati i ispoliraj za prirodniji govor',
              'Promijeni ton u šapat',
              'Podijeli ovaj blok u dijalog',
            ]
          : [
              'Shorten and tighten spoken rhythm',
              'Make delivery whispered',
              'Split this block into dialogue',
            ],
      };
  }
}

/**
 * Executes a conversational Role-Master Studio Chat turn with full context & tool capabilities.
 */
export async function runRoleMasterChatTurn(
  options: RoleMasterChatOptions
): Promise<RoleMasterChatResponse> {
  const snapshotProject = toSnapshotProject(options);
  const {
    userMessage,
    role,
    selectedBlockId,
    selectedTextRange,
    chatHistory,
    attachments,
    apiKey,
    modelId = 'gemini-3-flash-preview',
    fetchImpl = fetch,
    abortSignal,
  } = options;

  const language = options.language ?? snapshotProject.defaultLanguage ?? 'hr';
  const dialect = options.dialect ?? snapshotProject.dialect ?? 'standard';
  const dubrovnikRegister =
    options.dubrovnikRegister ?? snapshotProject.dubrovnikRegister ?? 'contemporary';

  const fallback = buildLocalRoleMasterChatTurn(options);

  if (!apiKey || apiKey.trim().length < 10) {
    return fallback;
  }

  const snapshot = buildStudioContextSnapshot({
    project: snapshotProject,
    selectedBlockId,
    selectedTextRange,
    attachments,
  });

  const systemPrompt = buildRoleMasterSystemPrompt({
    role,
    snapshot,
    language,
    dialect,
    dubrovnikRegister,
    chatHistory,
  });

  const endpoint = buildGeminiEndpoint(modelId, apiKey);

  const userParts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [{ text: `User Studio Request: ${userMessage.trim()}` }];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.dataUrl && att.dataUrl.startsWith('data:')) {
        const commaIdx = att.dataUrl.indexOf(',');
        const base64Data = att.dataUrl.slice(commaIdx + 1);
        userParts.push({
          inlineData: {
            mimeType: att.mimeType || (att.isImage ? 'image/png' : 'application/pdf'),
            data: base64Data,
          },
        });
      } else if (att.textContent) {
        userParts.push({
          text: `[ATTACHED CONTEXT FILE: ${att.name}]\n${att.textContent.slice(0, 30000)}\n[END FILE]`,
        });
      }
    }
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: userParts,
          },
        ],
        generationConfig: {
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawJson !== 'string') {
      return fallback;
    }

    const parsed = JSON.parse(stripMarkdownJsonFence(rawJson)) as {
      reply?: string;
      toolActions?: unknown[];
      suggestedFollowUps?: unknown[];
    };
    if (!parsed.reply || typeof parsed.reply !== 'string') {
      return fallback;
    }

    const validToolActions = Array.isArray(parsed.toolActions)
      ? parsed.toolActions
          .filter(
            (a): a is Record<string, unknown> =>
              Boolean(
                a &&
                  typeof a === 'object' &&
                  ((a as Record<string, unknown>).tool ||
                    (a as Record<string, unknown>).type)
              )
          )
          .map((raw, idx): AgentToolAction => {
            const toolName = String(raw.tool ?? raw.type) as AgentToolType;
            const payload =
              raw.payload && typeof raw.payload === 'object'
                ? (raw.payload as Record<string, unknown>)
                : { ...raw };
            return {
              id: String(raw.id || `tool_${Date.now()}_${idx}`),
              tool: toolName,
              summary: String(raw.summary || `Executed ${toolName}`),
              targetBlockId:
                typeof raw.targetBlockId === 'string'
                  ? raw.targetBlockId
                  : typeof raw.blockId === 'string'
                    ? raw.blockId
                    : undefined,
              targetSpeakerId:
                typeof raw.targetSpeakerId === 'string'
                  ? raw.targetSpeakerId
                  : typeof raw.speakerId === 'string'
                    ? raw.speakerId
                    : undefined,
              payload,
            };
          })
      : [];

    return {
      role,
      reply: parsed.reply.trim(),
      toolActions: validToolActions,
      suggestedFollowUps:
        Array.isArray(parsed.suggestedFollowUps) && parsed.suggestedFollowUps.length > 0
          ? parsed.suggestedFollowUps.slice(0, 4).map(String)
          : fallback.suggestedFollowUps,
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      throw err;
    }
    return fallback;
  }
}
