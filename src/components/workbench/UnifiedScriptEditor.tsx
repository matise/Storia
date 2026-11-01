import React from 'react';
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
      {/* 1. Playback / Audition Transport Mode: Clean in-place text surface (No title/notice clutter) */}
      {isTransportMode ? (
        <>
          {/* Accessible edit trigger for tests and keyboard navigation */}
          <button
            type="button"
            data-testid={`edit-mode-btn-${blockId}`}
            onClick={handleExitPlaybackToEdit}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          >
            {t('exitTransportToEdit')}
          </button>

          {/* Word Transport Surface: Exact font, line-height, padding, and zero-margin/padding word markings */}
          <div
            data-testid={`unified-editor-transport-${blockId}`}
            onDoubleClick={handleExitPlaybackToEdit}
            className="w-full rounded-lg bg-slate-950/70 border border-emerald-600/50 shadow-xs shadow-emerald-950/40 px-3 py-2 text-sm text-slate-100 leading-relaxed min-h-[58px] transition-colors select-none font-sans"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
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
                <React.Fragment key={wIdx}>
                  <span
                    data-testid={`word-token-${blockId}-${wIdx}`}
                    onClick={(e) => handleWordClick(token, e)}
                    onDoubleClick={(e) => handleWordDoubleClick(token, e)}
                    title={
                      timeTooltip
                        ? `${token.word} (${timeTooltip}) — Click to seek, double-click to edit`
                        : `${token.word} — Click to seek, double-click to edit`
                    }
                    className={`inline cursor-pointer p-0 m-0 transition-colors ${
                      isCurrent
                        ? 'text-emerald-300 font-semibold underline decoration-emerald-400 decoration-2 underline-offset-4 bg-emerald-500/20 rounded-xs'
                        : isPast
                          ? 'text-slate-100 font-normal hover:text-white'
                          : 'text-slate-400 font-normal hover:text-slate-200'
                    }`}
                  >
                    {token.word}
                  </span>
                  {wIdx < wordTokens.length - 1 ? ' ' : ''}
                </React.Fragment>
              );
            })}
          </div>
        </>
      ) : (
        /* 2. Idle / Edit Mode: High-Fidelity Textarea with Uniform Sizing */
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
          className="w-full rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-indigo-500/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed transition-colors font-sans"
        />
      )}
    </div>
  );
};
