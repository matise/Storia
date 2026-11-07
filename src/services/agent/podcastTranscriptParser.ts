import {
  CoWriterAttachment,
  CoWriterBeatCandidate,
  Speaker,
  SupportedLanguage,
} from '../../types/storia';

export interface ParsedPodcastTranscriptResult {
  title: string;
  format?: string;
  topic?: string;
  declaredSpeakers: string[];
  speakerMappingSummary: string[];
  directCandidate: CoWriterBeatCandidate;
  producedCandidate: CoWriterBeatCandidate;
}

/**
 * Extracts plain text (preserving paragraph breaks) from a .docx Word archive ArrayBuffer
 * by locating `word/document.xml` in the ZIP Central Directory and decompressing it.
 */
export async function extractTextFromDocxArrayBuffer(
  buffer: ArrayBuffer
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');

  // Scan backwards for End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  let docXmlBytes: Uint8Array | null = null;
  let compressionMethod = 0;

  if (eocdOffset >= 0) {
    const cdEntries = view.getUint16(eocdOffset + 10, true);
    let cdPos = view.getUint32(eocdOffset + 16, true);
    for (let e = 0; e < cdEntries && cdPos + 46 <= bytes.length; e++) {
      if (view.getUint32(cdPos, true) !== 0x02014b50) break;
      const method = view.getUint16(cdPos + 10, true);
      const compSize = view.getUint32(cdPos + 20, true);
      const nameLen = view.getUint16(cdPos + 28, true);
      const extraLen = view.getUint16(cdPos + 30, true);
      const commentLen = view.getUint16(cdPos + 32, true);
      const localHeaderOffset = view.getUint32(cdPos + 42, true);
      const fileName = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));

      if (fileName === 'word/document.xml') {
        const lNameLen = view.getUint16(localHeaderOffset + 26, true);
        const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
        docXmlBytes = bytes.subarray(dataStart, dataStart + compSize);
        compressionMethod = method;
        break;
      }
      cdPos += 46 + nameLen + extraLen + commentLen;
    }
  }

  if (!docXmlBytes) {
    return '';
  }

  let xmlText = '';
  if (compressionMethod === 0) {
    xmlText = decoder.decode(docXmlBytes);
  } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    void writer.write(new Uint8Array(docXmlBytes));
    void writer.close();
    const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
    xmlText = decoder.decode(decompressedBuffer);
  } else {
    return '';
  }

  return xmlText
    .replace(/<\/w:p>/gi, '\n\n')
    .replace(/<w:br[^>]*\/?>/gi, '\n')
    .replace(/<w:tab[^>]*\/?>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const METADATA_KEYS_SET = new Set([
  'format',
  'vrsta',
  'type',
  'sugovornici',
  'voditelji',
  'sudionici',
  'gosti',
  'govornici',
  'speakers',
  'hosts',
  'participants',
  'guests',
  'tema',
  'teme',
  'topic',
  'theme',
  'subject',
  'opis',
  'description',
  'sažetak',
  'summary',
  'naslov',
  'title',
  'epizoda',
  'episode',
  'datum',
  'date',
  'trajanje',
  'duration',
  'autor',
  'author',
  'izvor',
  'source',
  'napomena',
  'note',
  'notes',
]);

const NON_SPEAKER_TITLE_WORDS =
  /\b(analiza|dubinska|dio|poglavlje|segment|uvod|zaključak|sažetak|pregled|tema|format|transkript|part|chapter|section|intro|outro|summary|overview|analysis|deep dive|http|https|slika|tablica)\b/i;

const ROLE_SPEAKER_PATTERN =
  /^(?:voditelj(?:ica)?|host|co-?host|sugovornik|sugovornica|gost|gošća|guest|speaker|narator|pripovjedač|narrator|moderator|intervjuer|interviewee|osoba|glas|voice)(?:\s+\d+|\s+[A-ZČĆŽŠĐa-zčćžšđ0-9]+)?$/i;

function cleanMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,!?;:]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects and parses a structured podcast transcript document (such as Croatian
 * "Format: Transkript audio podcasta / Sugovornici: Voditelj 1 i Voditelj 2 / Tema: ... / [00:00:00] 1. dio: ...").
 */
export function parsePodcastTranscriptDocument(options: {
  text: string;
  speakers: Speaker[];
  language: SupportedLanguage;
  sourceFileName?: string;
  deepResearch?: boolean;
}): ParsedPodcastTranscriptResult | null {
  const { text, speakers, language, sourceFileName, deepResearch } = options;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return null;
  }

  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const sectionHeaderRegex =
    /^\s*(?:#{1,4}\s*)?(?:\*\*|__)?(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?)|(\d+\.\s*(?:dio|segment|poglavlje|part|chapter)\s*:\s*.+?))(?:\*\*|__)?\s*$/i;
  const horizontalRuleRegex = /^\s*[-_=─*]{3,}\s*$/;
  const keyValueRegex =
    /^\s*(?:[-*•]\s*)?(?:\*\*|__)?([^:*\n]{1,42}?)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*)$/;

  // Pass 1: Extract declared speakers from metadata and count potential speaker labels
  const declaredSpeakers: string[] = [];
  const labelCounts = new Map<string, number>();
  let hasPodcastMetadataMarker = false;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line || horizontalRuleRegex.test(line) || sectionHeaderRegex.test(line)) {
      continue;
    }
    const kvMatch = line.match(keyValueRegex);
    if (!kvMatch) continue;

    const rawKey = kvMatch[1].replace(/^#+\s*/, '').trim();
    const keyLower = rawKey.toLowerCase();
    const rawVal = kvMatch[2].replace(/(\*\*|__)\s*$/, '').trim();

    if (METADATA_KEYS_SET.has(keyLower)) {
      if (
        keyLower === 'format' ||
        keyLower === 'vrsta' ||
        keyLower === 'type'
      ) {
        if (/podcast|transkript|transcript|razgovor|intervju|audio/i.test(rawVal)) {
          hasPodcastMetadataMarker = true;
        }
      } else if (
        keyLower === 'sugovornici' ||
        keyLower === 'voditelji' ||
        keyLower === 'sudionici' ||
        keyLower === 'gosti' ||
        keyLower === 'govornici' ||
        keyLower === 'speakers' ||
        keyLower === 'hosts' ||
        keyLower === 'participants' ||
        keyLower === 'guests'
      ) {
        hasPodcastMetadataMarker = true;
        const parts = rawVal
          .split(/\s*(?:,|\bi\b|\band\b|&|\/|;|\+)\s*/i)
          .map((s) => cleanMarkdownInline(s))
          .filter((s) => s.length > 0 && s.length <= 35);
        for (const p of parts) {
          if (!declaredSpeakers.some((d) => d.toLowerCase() === p.toLowerCase())) {
            declaredSpeakers.push(p);
          }
        }
      }
      continue;
    }

    if (rawVal.length > 0) {
      labelCounts.set(rawKey, (labelCounts.get(rawKey) ?? 0) + 1);
    }
  }

  const projectSpeakerNamesLower = new Set(
    speakers.map((s) => s.name.toLowerCase().trim())
  );

  const isConfirmedSpeakerLabel = (label: string, seenBodyHeader: boolean): boolean => {
    const cleaned = label.replace(/^#+\s*/, '').trim();
    if (!cleaned || cleaned.length > 35) return false;
    const lower = cleaned.toLowerCase();
    if (METADATA_KEYS_SET.has(lower)) return false;

    if (declaredSpeakers.some((d) => d.toLowerCase() === lower)) {
      return true;
    }
    if (ROLE_SPEAKER_PATTERN.test(cleaned)) {
      return true;
    }
    if (projectSpeakerNamesLower.has(lower)) {
      return true;
    }
    if (NON_SPEAKER_TITLE_WORDS.test(cleaned)) {
      return false;
    }
    const words = cleaned.split(/\s+/);
    if (words.length > 3) return false;
    const count = labelCounts.get(cleaned) ?? 0;
    if (count >= 2) return true;
    if (seenBodyHeader && count >= 1 && /^[A-ZČĆŽŠĐ]/.test(cleaned)) {
      return true;
    }
    return false;
  };

  // Pass 2: Parse title, metadata, section headers, and dialogue turns
  const titleLines: string[] = [];
  let formatMeta = '';
  let topicMeta = '';
  let seenMetadataOrRuleOrSection = false;
  let activeMetaContinuation: 'topic' | 'title' | null = null;

  interface RawParsedItem {
    kind: 'section' | 'dialogue';
    timestamp?: string;
    speakerLabel?: string;
    text: string;
  }

  const items: RawParsedItem[] = [];
  let currentDialogue: RawParsedItem | null = null;

  const flushCurrentDialogue = () => {
    if (currentDialogue && currentDialogue.text.trim().length > 0) {
      currentDialogue.text = cleanMarkdownInline(currentDialogue.text);
      items.push(currentDialogue);
    }
    currentDialogue = null;
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      activeMetaContinuation = null;
      flushCurrentDialogue();
      continue;
    }

    if (horizontalRuleRegex.test(trimmed)) {
      seenMetadataOrRuleOrSection = true;
      activeMetaContinuation = null;
      flushCurrentDialogue();
      continue;
    }

    const secMatch = trimmed.match(sectionHeaderRegex);
    if (secMatch) {
      seenMetadataOrRuleOrSection = true;
      activeMetaContinuation = null;
      flushCurrentDialogue();
      const timestamp = secMatch[1]?.trim();
      const secTitle = cleanMarkdownInline(secMatch[2] || secMatch[3] || trimmed);
      items.push({
        kind: 'section',
        timestamp,
        text: secTitle,
      });
      continue;
    }

    const kvMatch = trimmed.match(keyValueRegex);
    if (kvMatch) {
      const rawKey = kvMatch[1].replace(/^#+\s*/, '').trim();
      const keyLower = rawKey.toLowerCase();
      const rawVal = kvMatch[2].replace(/(\*\*|__)\s*$/, '').trim();

      if (METADATA_KEYS_SET.has(keyLower)) {
        seenMetadataOrRuleOrSection = true;
        flushCurrentDialogue();

        if (keyLower === 'format' || keyLower === 'vrsta' || keyLower === 'type') {
          formatMeta = cleanMarkdownInline(rawVal);
          activeMetaContinuation = null;
        } else if (
          keyLower === 'tema' ||
          keyLower === 'teme' ||
          keyLower === 'topic' ||
          keyLower === 'theme' ||
          keyLower === 'subject' ||
          keyLower === 'opis' ||
          keyLower === 'description' ||
          keyLower === 'sažetak' ||
          keyLower === 'summary'
        ) {
          topicMeta = cleanMarkdownInline(rawVal);
          activeMetaContinuation = 'topic';
        } else if (
          keyLower === 'naslov' ||
          keyLower === 'title' ||
          keyLower === 'epizoda' ||
          keyLower === 'episode'
        ) {
          if (rawVal) {
            titleLines.length = 0;
            titleLines.push(cleanMarkdownInline(rawVal));
          }
          activeMetaContinuation = 'title';
        } else {
          activeMetaContinuation = null;
        }
        continue;
      }

      if (isConfirmedSpeakerLabel(rawKey, seenMetadataOrRuleOrSection)) {
        seenMetadataOrRuleOrSection = true;
        activeMetaContinuation = null;
        flushCurrentDialogue();
        currentDialogue = {
          kind: 'dialogue',
          speakerLabel: rawKey,
          text: rawVal,
        };
        continue;
      }
    }

    // Continuation of active dialogue turn
    if (currentDialogue) {
      currentDialogue.text += ` ${trimmed}`;
      continue;
    }

    // Continuation of multi-line Tema / Topic metadata
    if (activeMetaContinuation === 'topic') {
      topicMeta = cleanMarkdownInline(`${topicMeta} ${trimmed}`);
      continue;
    }

    // Leading document title lines (before metadata, rules, sections, or dialogue)
    if (!seenMetadataOrRuleOrSection && items.length === 0) {
      titleLines.push(cleanMarkdownInline(trimmed.replace(/^#+\s*/, '')));
    }
  }

  flushCurrentDialogue();

  const dialogueItems = items.filter((it) => it.kind === 'dialogue');
  if (
    dialogueItems.length < 2 &&
    !(dialogueItems.length === 1 && hasPodcastMetadataMarker)
  ) {
    return null;
  }

  // Build speaker mapping from transcript speaker labels -> project cast
  const dialogueSpeakers = speakers.filter(
    (s) => !/narrat|pripovjedač/i.test(s.name)
  );
  const castPool = dialogueSpeakers.length > 0 ? dialogueSpeakers : speakers;
  const narratorSpeaker =
    speakers.find((s) => /narrat|pripovjedač/i.test(s.name)) ??
    speakers[speakers.length - 1] ??
    speakers[0];

  const speakerLabelToCast = new Map<string, Speaker>();
  const speakerMappingSummary: string[] = [];
  let nextFallbackCastIdx = 0;

  // Collect all unique speaker labels in order of declaration + appearance
  const uniqueLabels: string[] = [...declaredSpeakers];
  for (const item of dialogueItems) {
    const lbl = item.speakerLabel!;
    if (!uniqueLabels.some((u) => u.toLowerCase() === lbl.toLowerCase())) {
      uniqueLabels.push(lbl);
    }
  }

  for (const label of uniqueLabels) {
    const lower = label.toLowerCase();
    // 1. Exact or partial name match in project.speakers
    let matched = speakers.find(
      (s) =>
        s.name.toLowerCase() === lower ||
        s.name.toLowerCase().includes(lower) ||
        lower.includes(s.name.toLowerCase())
    );

    // 2. Numbered host / speaker label (e.g. "Voditelj 1" -> castPool[0], "Voditelj 2" -> castPool[1])
    if (!matched && castPool.length > 0) {
      const numMatch = label.match(/(\d+)\s*$/);
      if (numMatch) {
        const oneBased = Math.max(1, parseInt(numMatch[1], 10));
        matched = castPool[(oneBased - 1) % castPool.length];
      }
    }

    // 3. Sequential fallback assignment
    if (!matched && castPool.length > 0) {
      matched = castPool[nextFallbackCastIdx % castPool.length];
      nextFallbackCastIdx++;
    }

    if (matched) {
      speakerLabelToCast.set(lower, matched);
      speakerMappingSummary.push(`${label} → ${matched.name}`);
    }
  }

  const resolveSpeakerId = (label?: string): string | undefined => {
    if (!label) return castPool[0]?.id;
    return speakerLabelToCast.get(label.toLowerCase())?.id ?? castPool[0]?.id;
  };

  // Construct direct blocks from parsed items
  const directBlocks: CoWriterBeatCandidate['blocks'] = [];
  for (const item of items) {
    if (item.kind === 'section') {
      directBlocks.push({
        type: 'narration',
        speakerId: narratorSpeaker?.id,
        text: item.text,
        directorNotes: item.timestamp
          ? `najava poglavlja [${item.timestamp}] / podcast chapter`
          : 'najava poglavlja / podcast chapter',
        pauseAfterMs: 550,
      });
    } else {
      directBlocks.push({
        type: 'dialogue',
        speakerId: resolveSpeakerId(item.speakerLabel),
        text: item.text,
        directorNotes: item.speakerLabel
          ? `${item.speakerLabel} — podcast razgovorno / conversational`
          : 'podcast razgovorno / conversational',
        pauseAfterMs: 400,
      });
    }
  }

  const extractedTitle =
    titleLines.join(' ').trim() ||
    (sourceFileName ? sourceFileName.replace(/\.[^.]+$/, '') : '') ||
    (language === 'hr' ? 'Transkript audio podcasta' : 'Audio Podcast Transcript');

  const rationaleParts: string[] = [];
  if (formatMeta) {
    rationaleParts.push(
      language === 'hr' ? `Format: ${formatMeta}.` : `Format: ${formatMeta}.`
    );
  } else {
    rationaleParts.push(
      language === 'hr'
        ? 'Izravno strukturirani transkript podcasta iz priloženog dokumenta.'
        : 'Directly structured podcast transcript extracted from the provided document.'
    );
  }
  if (topicMeta) {
    rationaleParts.push(
      language === 'hr' ? `Tema: ${topicMeta}` : `Topic: ${topicMeta}`
    );
  }

  const directCandidate: CoWriterBeatCandidate = {
    id: 'podcast_doc_direct',
    title: extractedTitle,
    rationale: rationaleParts.join(' '),
    blocks: directBlocks,
    deepResearchUsed: Boolean(deepResearch),
    analyzedFiles: sourceFileName ? [sourceFileName] : undefined,
    mode: 'podcast_episode',
    isParsedTranscript: true,
    parsedEpisodeTitle: extractedTitle,
    parsedEpisodeTopic: topicMeta || undefined,
    speakerMappingSummary,
  };

  // Build produced broadcast edition with intro/outro jingle SFX and section transition bumpers
  const producedBlocks: CoWriterBeatCandidate['blocks'] = [
    {
      type: 'sound_effect',
      text:
        language === 'hr'
          ? 'Prepoznatljivi intro podcast jingle s modernim elektroničkim sweep prijelazom.'
          : 'Upbeat modern podcast intro theme and broadcast sweep effect.',
      directorNotes: 'radio intro mastering',
      pauseAfterMs: 350,
    },
  ];

  let sectionCount = 0;
  for (const item of items) {
    if (item.kind === 'section') {
      if (sectionCount > 0) {
        producedBlocks.push({
          type: 'sound_effect',
          text:
            language === 'hr'
              ? 'Kratki glazbeni prijelazni bumper između poglavlja podcasta.'
              : 'Short musical transition bumper between podcast chapters.',
          directorNotes: 'transition sweep',
          pauseAfterMs: 300,
        });
      }
      sectionCount++;
      producedBlocks.push({
        type: 'narration',
        speakerId: narratorSpeaker?.id,
        text: item.text,
        directorNotes: item.timestamp
          ? `najava poglavlja [${item.timestamp}] / podcast chapter`
          : 'najava poglavlja / podcast chapter',
        pauseAfterMs: 550,
      });
    } else {
      producedBlocks.push({
        type: 'dialogue',
        speakerId: resolveSpeakerId(item.speakerLabel),
        text: item.text,
        directorNotes: item.speakerLabel
          ? `${item.speakerLabel} — podcast razgovorno / conversational`
          : 'podcast razgovorno / conversational',
        pauseAfterMs: 400,
      });
    }
  }

  producedBlocks.push({
    type: 'sound_effect',
    text:
      language === 'hr'
        ? 'Završna podcast glazbena tema (outro jingle) uz postepeni fade-out.'
        : 'Closing podcast outro theme music with smooth broadcast fade-out.',
    directorNotes: 'outro mastering',
    pauseAfterMs: 500,
  });

  const producedCandidate: CoWriterBeatCandidate = {
    id: 'podcast_doc_produced',
    title:
      language === 'hr'
        ? `${extractedTitle} (Produkcijska verzija s jinglovima)`
        : `${extractedTitle} (Produced Broadcast Edition)`,
    rationale:
      language === 'hr'
        ? `Cjeloviti transkript iz dokumenta obogaćen uvodnim i odjavnim podcast jinglovima te prijelazima između poglavlja.`
        : `Complete transcript from the document enriched with intro/outro podcast jingles and chapter transition bumpers.`,
    blocks: producedBlocks,
    deepResearchUsed: Boolean(deepResearch),
    analyzedFiles: sourceFileName ? [sourceFileName] : undefined,
    mode: 'podcast_episode',
    isParsedTranscript: true,
    parsedEpisodeTitle: extractedTitle,
    parsedEpisodeTopic: topicMeta || undefined,
    speakerMappingSummary,
  };

  return {
    title: extractedTitle,
    format: formatMeta || undefined,
    topic: topicMeta || undefined,
    declaredSpeakers,
    speakerMappingSummary,
    directCandidate,
    producedCandidate,
  };
}

export function extractPodcastTranscriptCandidatesFromInputs(options: {
  speakers: Speaker[];
  language: SupportedLanguage;
  directionHint?: string;
  attachments?: CoWriterAttachment[];
  deepResearch?: boolean;
}): CoWriterBeatCandidate[] {
  const { speakers, language, directionHint, attachments, deepResearch } = options;
  const candidates: CoWriterBeatCandidate[] = [];
  const allFileNames = attachments?.map((a) => a.name);

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.textContent && att.textContent.trim().length > 0) {
        const parsed = parsePodcastTranscriptDocument({
          text: att.textContent,
          speakers,
          language,
          sourceFileName: att.name,
          deepResearch,
        });
        if (parsed) {
          candidates.push(
            {
              ...parsed.directCandidate,
              analyzedFiles: allFileNames,
            },
            {
              ...parsed.producedCandidate,
              analyzedFiles: allFileNames,
            }
          );
        }
      }
    }
  }

  if (candidates.length === 0 && directionHint && directionHint.trim().length > 20) {
    const parsedFromHint = parsePodcastTranscriptDocument({
      text: directionHint,
      speakers,
      language,
      deepResearch,
    });
    if (parsedFromHint) {
      candidates.push(
        {
          ...parsedFromHint.directCandidate,
          analyzedFiles: allFileNames,
        },
        {
          ...parsedFromHint.producedCandidate,
          analyzedFiles: allFileNames,
        }
      );
    }
  }

  return candidates;
}

