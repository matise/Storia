import React from 'react';
import { Pencil } from 'lucide-react';
import {
  computeWordTimingTokens,
  getProgressForWord,
  WordTimingToken,
} from '../../core/pacing/wordTimingMapper';
import { useTranslation } from '../../i18n/useTranslation';

export interface UnifiedScriptEditorProps {
  blockId: string;
  text: string;
  placeholder?: string;
  isPlaying?: boolean;
  playheadProgress?: number; // 0.0 to 1.0
  activeWordIndex?: number; // override if supplied
  durationSec?: number;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  onAddNextBlock?: () => void;
  onSeekWord?: (progress: number) => void;
  onStopPlayback?: () => void;
}

export const UnifiedScriptEditor: React.FC<UnifiedScriptEditorProps> = ({
  blockId,
  text,
  placeholder = 'Enter spoken dialogue...',
  isPlaying = false,
  playheadProgress = 0,
  activeWordIndex: explicitWordIndex,
  durationSec = 0,
  disabled = false,
  onChangeText,
  onAddNextBlock,
  onSeekWord,
  onStopPlayback,
}) => {
  const { t } = useTranslation();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [forceEditMode, setForceEditMode] = React.useState(false);

  // When playback stops, reset forceEditMode
  React.useEffect(() => {
    if (!isPlaying) {
      setForceEditMode(false);
    }
  }, [isPlaying]);

  // Compute character-weighted word timing tokens for natural speech alignment
  const wordTokens: WordTimingToken[] = React.useMemo(() => {
    return computeWordTimingTokens(text);
  }, [text]);

  // Determine active word index
  const activeIndex = React.useMemo(() => {
    if (typeof explicitWordIndex === 'number' && explicitWordIndex >= 0) {
      return explicitWordIndex;
    }
    if (!isPlaying || wordTokens.length === 0) return -1;

    const prog = Math.max(0, Math.min(1.0, playheadProgress));
    for (let i = 0; i < wordTokens.length; i++) {
      if (prog >= wordTokens[i].startProgress && prog <= wordTokens[i].endProgress) {
        return i;
      }
    }
    if (prog < wordTokens[0].startProgress) return 0;
    return wordTokens.length - 1;
  }, [explicitWordIndex, isPlaying, playheadProgress, wordTokens]);

  const handleWordClick = (token: WordTimingToken, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetProgress = getProgressForWord(wordTokens, token.index);
    onSeekWord?.(targetProgress);
  };

  const handleWordDoubleClick = (_token: WordTimingToken, e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPlayback?.();
    setForceEditMode(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleExitPlaybackToEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPlayback?.();
    setForceEditMode(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const isTransportMode = isPlaying && !forceEditMode && wordTokens.length > 0;

  return (
    <div
      data-testid={`unified-editor-${blockId}`}
      className="relative w-full transition-all"
    >
      {/* 1. Playback / Audition Transport Mode: Read-Only Word Tokens with In-Place Highlight */}
      {isTransportMode ? (
        <div
          data-testid={`unified-editor-transport-${blockId}`}
          className="w-full rounded-lg bg-slate-950/95 border border-emerald-600/60 shadow-xs shadow-emerald-950/40 px-3 py-2 text-sm text-slate-100 leading-relaxed min-h-[58px] transition-colors flex flex-wrap items-baseline gap-x-1.5 gap-y-1 select-none"
        >
          {/* Subtle status & quick edit button in upper corner */}
          <div className="absolute top-1.5 right-2 flex items-center gap-1.5 z-10">
            <span className="text-[10px] font-mono text-emerald-400/90 hidden sm:inline-block pointer-events-none">
              {t('wordTransportPlayingNotice')}
            </span>
            <button
              type="button"
              data-testid={`edit-mode-btn-${blockId}`}
              onClick={handleExitPlaybackToEdit}
              title={t('exitTransportToEdit')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-750 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Pencil className="w-2.5 h-2.5 text-indigo-400" />
              <span>{t('exitTransportToEdit')}</span>
            </button>
          </div>

          {/* Word Token Elements */}
          {wordTokens.map((token, wIdx) => {
            const isCurrent = wIdx === activeIndex;
            const isPast = activeIndex >= 0 && wIdx < activeIndex;

            // Formatted word timestamp tooltip
            const wordSec = token.startProgress * durationSec;
            const wordMins = Math.floor(wordSec / 60);
            const wordRemSec = (wordSec % 60).toFixed(1);
            const timeTooltip =
              durationSec > 0
                ? `${String(wordMins).padStart(2, '0')}:${wordRemSec.padStart(4, '0')}`
                : undefined;

            return (
              <span
                key={wIdx}
                data-testid={`word-token-${blockId}-${wIdx}`}
                onClick={(e) => handleWordClick(token, e)}
                onDoubleClick={(e) => handleWordDoubleClick(token, e)}
                title={
                  timeTooltip
                    ? `${token.word} (${timeTooltip}) — Click to seek, double-click to edit`
                    : `${token.word} — Click to seek, double-click to edit`
                }
                className={`inline-block px-1 py-0.2 rounded transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-500/35 text-emerald-200 font-semibold ring-1 ring-emerald-400/60 shadow-xs shadow-emerald-900/50 scale-[1.03]'
                    : isPast
                      ? 'text-slate-200 font-medium hover:bg-slate-800/80 hover:text-white'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                {token.word}
              </span>
            );
          })}
        </div>
      ) : (
        /* 2. Idle / Edit Mode: High-Fidelity Textarea */
        <textarea
          ref={textareaRef}
          data-testid={`unified-editor-textarea-${blockId}`}
          rows={2}
          value={text}
          disabled={disabled}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onAddNextBlock?.();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-indigo-500/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed transition-colors"
        />
      )}
    </div>
  );
};
