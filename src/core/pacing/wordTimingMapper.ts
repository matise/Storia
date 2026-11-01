import { stripNonSpokenTokens } from './pacingCalculator';

export interface WordTimingToken {
  word: string;
  cleanWord: string;
  index: number;
  startProgress: number;
  endProgress: number;
  midProgress: number;
}

/**
 * Computes phonetic character-weighted timing intervals for each spoken word in a script block.
 * Punctuation (commas, periods, question marks) adds natural conversational weight so that
 * the estimated karaoke highlight and click-to-seek positions align naturally with speech pacing.
 */
export function computeWordTimingTokens(rawText: string): WordTimingToken[] {
  const cleaned = stripNonSpokenTokens(rawText);
  if (!cleaned) return [];

  const rawWords = cleaned.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  // 1. Calculate weights per word based on character length + punctuation pause weight
  const weights: number[] = [];
  let totalWeight = 0;

  for (const w of rawWords) {
    const letters = w.replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ]/g, '');
    let wWeight = Math.max(1, letters.length);

    // Conversational punctuation pause weights
    if (/[.!?;:]$/.test(w)) {
      wWeight += 3.2; // Clause / sentence boundary pause
    } else if (/[,—–-]/.test(w)) {
      wWeight += 1.8; // Minor comma / dash breathing pause
    }

    weights.push(wWeight);
    totalWeight += wWeight;
  }

  // 2. Compute normalized startProgress / endProgress intervals
  const tokens: WordTimingToken[] = [];
  let accumulated = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const wWeight = weights[i];
    const startProgress = accumulated / totalWeight;
    const endProgress = (accumulated + wWeight) / totalWeight;
    const midProgress = (startProgress + endProgress) / 2;

    tokens.push({
      word,
      cleanWord: word.replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ]/g, ''),
      index: i,
      startProgress: Number(startProgress.toFixed(4)),
      endProgress: Number(endProgress.toFixed(4)),
      midProgress: Number(midProgress.toFixed(4)),
    });

    accumulated += wWeight;
  }

  return tokens;
}

/**
 * Finds the active word token index corresponding to a playback progress fraction (0.0 to 1.0).
 */
export function getWordIndexAtProgress(
  tokens: WordTimingToken[],
  progress: number
): number {
  if (!tokens || tokens.length === 0) return -1;
  const clamped = Math.max(0, Math.min(1.0, progress));

  // Binary or linear scan
  for (let i = 0; i < tokens.length; i++) {
    if (clamped >= tokens[i].startProgress && clamped <= tokens[i].endProgress) {
      return i;
    }
  }

  if (clamped < tokens[0].startProgress) return 0;
  return tokens.length - 1;
}

/**
 * Gets the normalized audio seek progress (0.0 to 1.0) when clicking a word index.
 */
export function getProgressForWord(
  tokens: WordTimingToken[],
  wordIndex: number
): number {
  if (!tokens || tokens.length === 0) return 0;
  const safeIdx = Math.max(0, Math.min(tokens.length - 1, wordIndex));
  return tokens[safeIdx].startProgress;
}

