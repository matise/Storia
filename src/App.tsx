import React from 'react';
import { TopBar } from './components/layout/TopBar';
import { CastSidebar } from './components/layout/CastSidebar';
import { ScriptWorkbench } from './components/layout/ScriptWorkbench';
import { AgentDock } from './components/layout/AgentDock';
import { SpeakerConfigModal } from './components/modals/SpeakerConfigModal';
import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { ProjectPropertiesModal } from './components/modals/ProjectPropertiesModal';
import { ExportMasterModal } from './components/modals/ExportMasterModal';
import { AuxBusRackModal } from './components/modals/AuxBusRackModal';
import { FolderKanban, FolderPlus, Plus, RotateCcw } from 'lucide-react';
import { useStoriaStore } from './store/useStoriaStore';
import { useTranslation } from './i18n/useTranslation';

const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 500;
const DEFAULT_LEFT_WIDTH = 280;

const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 650;
const DEFAULT_RIGHT_WIDTH = 360;

const MIN_CENTER_WORKBENCH_WIDTH = 360;

export const App: React.FC = () => {
  const { t } = useTranslation();
  const undo = useStoriaStore((s) => s.undo);
  const redo = useStoriaStore((s) => s.redo);
  const selectedBlockId = useStoriaStore((s) => s.selectedBlockId);
  const assignSpeakerByHotkey = useStoriaStore((s) => s.assignSpeakerByHotkey);
  const moveBlockRelative = useStoriaStore((s) => s.moveBlockRelative);
  const syncCacheStatuses = useStoriaStore((s) => s.syncCacheStatuses);
  const projects = useStoriaStore((s) => s.projects);
  const isEpisodePropertiesModalOpen = useStoriaStore((s) => s.isEpisodePropertiesModalOpen);
  const setEpisodePropertiesModalOpen = useStoriaStore((s) => s.setEpisodePropertiesModalOpen);
  const createProject = useStoriaStore((s) => s.createProject);
  const resetToSampleProject = useStoriaStore((s) => s.resetToSampleProject);

  // Scalable Panels Width State with LocalStorage Persistence
  const [leftWidth, setLeftWidth] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem('storia_layout_left_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= MIN_LEFT_WIDTH && val <= MAX_LEFT_WIDTH) return val;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LEFT_WIDTH;
  });

  const [rightWidth, setRightWidth] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem('storia_layout_right_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= MIN_RIGHT_WIDTH && val <= MAX_RIGHT_WIDTH) return val;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RIGHT_WIDTH;
  });

  const [isDraggingLeft, setIsDraggingLeft] = React.useState(false);
  const [isDraggingRight, setIsDraggingRight] = React.useState(false);

  const leftWidthRef = React.useRef(leftWidth);
  const rightWidthRef = React.useRef(rightWidth);
  leftWidthRef.current = leftWidth;
  rightWidthRef.current = rightWidth;

  const handleLeftPointerDown = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    if ('setPointerCapture' in target && 'pointerId' in e) {
      try {
        target.setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {
        // ignore
      }
    }
    setIsDraggingLeft(true);
    const startX = typeof e.clientX === 'number' && !isNaN(e.clientX) ? e.clientX : 0;
    const startWidth = leftWidthRef.current;

    const onMove = (ev: MouseEvent | PointerEvent) => {
      const clientX = typeof ev.clientX === 'number' && !isNaN(ev.clientX) ? ev.clientX : startX;
      const delta = clientX - startX;
      const windowWidth =
        typeof window !== 'undefined' && window.innerWidth >= 900
          ? window.innerWidth
          : 1440;
      const maxAllowed = Math.max(
        MIN_LEFT_WIDTH,
        Math.min(MAX_LEFT_WIDTH, windowWidth - rightWidthRef.current - MIN_CENTER_WORKBENCH_WIDTH)
      );
      const nextWidth = Math.max(MIN_LEFT_WIDTH, Math.min(maxAllowed, startWidth + delta));
      setLeftWidth(Math.round(nextWidth));
    };

    const onUp = (ev: MouseEvent | PointerEvent) => {
      setIsDraggingLeft(false);
      if ('releasePointerCapture' in target && 'pointerId' in ev) {
        try {
          target.releasePointerCapture((ev as PointerEvent).pointerId);
        } catch {
          // ignore
        }
      }
      window.removeEventListener('pointermove', onMove as EventListener);
      window.removeEventListener('pointerup', onUp as EventListener);
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp as EventListener);
      try {
        localStorage.setItem('storia_layout_left_width', String(leftWidthRef.current));
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointermove', onMove as EventListener);
    window.addEventListener('pointerup', onUp as EventListener);
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp as EventListener);
  };

  const handleRightPointerDown = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    if ('setPointerCapture' in target && 'pointerId' in e) {
      try {
        target.setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {
        // ignore
      }
    }
    setIsDraggingRight(true);
    const startX = typeof e.clientX === 'number' && !isNaN(e.clientX) ? e.clientX : 0;
    const startWidth = rightWidthRef.current;

    const onMove = (ev: MouseEvent | PointerEvent) => {
      const clientX = typeof ev.clientX === 'number' && !isNaN(ev.clientX) ? ev.clientX : startX;
      const delta = startX - clientX; // Moving left widens right panel
      const windowWidth =
        typeof window !== 'undefined' && window.innerWidth >= 900
          ? window.innerWidth
          : 1440;
      const maxAllowed = Math.max(
        MIN_RIGHT_WIDTH,
        Math.min(MAX_RIGHT_WIDTH, windowWidth - leftWidthRef.current - MIN_CENTER_WORKBENCH_WIDTH)
      );
      const nextWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(maxAllowed, startWidth + delta));
      setRightWidth(Math.round(nextWidth));
    };

    const onUp = (ev: MouseEvent | PointerEvent) => {
      setIsDraggingRight(false);
      if ('releasePointerCapture' in target && 'pointerId' in ev) {
        try {
          target.releasePointerCapture((ev as PointerEvent).pointerId);
        } catch {
          // ignore
        }
      }
      window.removeEventListener('pointermove', onMove as EventListener);
      window.removeEventListener('pointerup', onUp as EventListener);
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp as EventListener);
      try {
        localStorage.setItem('storia_layout_right_width', String(rightWidthRef.current));
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointermove', onMove as EventListener);
    window.addEventListener('pointerup', onUp as EventListener);
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp as EventListener);
  };

  React.useEffect(() => {
    void syncCacheStatuses();
  }, [syncCacheStatuses]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Global Undo / Redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isTextInput) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isTextInput) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Hotkey Speaker Assignment (Alt+1 .. Alt+9) on active block
      if (e.altKey && !e.ctrlKey && !e.metaKey && selectedBlockId) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          e.preventDefault();
          assignSpeakerByHotkey(selectedBlockId, digit - 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveBlockRelative(selectedBlockId, 'up');
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveBlockRelative(selectedBlockId, 'down');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedBlockId, assignSpeakerByHotkey, moveBlockRelative]);

  const isLibraryEmpty = projects.length === 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <TopBar />
      <div
        className={`flex-1 flex min-h-0 overflow-hidden relative ${
          isDraggingLeft || isDraggingRight ? 'select-none cursor-col-resize' : ''
        } ${isLibraryEmpty ? 'pointer-events-none opacity-20 filter blur-[1px] select-none' : ''}`}
      >
        <CastSidebar width={leftWidth} />

        {/* Left Scalable Panel Splitter */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={leftWidth}
          data-testid="left-panel-splitter"
          onPointerDown={handleLeftPointerDown}
          onMouseDown={handleLeftPointerDown}
          title={t('leftSplitterTooltip')}
          className={`w-1.5 shrink-0 bg-slate-950 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors cursor-col-resize select-none z-20 flex items-center justify-center border-r border-slate-800/80 ${
            isDraggingLeft ? 'bg-indigo-500' : ''
          }`}
        >
          <div className="w-0.5 h-6 rounded-full bg-slate-700 pointer-events-none" />
        </div>

        <ScriptWorkbench />

        {/* Right Scalable Panel Splitter */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={rightWidth}
          data-testid="right-panel-splitter"
          onPointerDown={handleRightPointerDown}
          onMouseDown={handleRightPointerDown}
          title={t('rightSplitterTooltip')}
          className={`w-1.5 shrink-0 bg-slate-950 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors cursor-col-resize select-none z-20 flex items-center justify-center border-l border-slate-800/80 ${
            isDraggingRight ? 'bg-indigo-500' : ''
          }`}
        >
          <div className="w-0.5 h-6 rounded-full bg-slate-700 pointer-events-none" />
        </div>

        <AgentDock width={rightWidth} />
      </div>

      {/* Empty Library Studio Hero Overlay */}
      {isLibraryEmpty && !isEpisodePropertiesModalOpen && (
        <div
          data-testid="studio-empty-library-hero"
          className="absolute inset-0 top-14 z-30 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
        >
          <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
              <FolderPlus className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100">{t('emptyLibraryHeadline')}</h2>
              <p className="text-sm text-slate-400">{t('emptyLibraryLead')}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-testid="hero-create-episode-btn"
                onClick={() => createProject()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                <Plus className="w-4 h-4" />
                {t('createFirstEpisodeBtn')}
              </button>
              <button
                type="button"
                data-testid="hero-open-library-btn"
                onClick={() => setEpisodePropertiesModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderKanban className="w-4 h-4" />
                {t('episodesLibraryTitle')}
              </button>
              <button
                type="button"
                data-testid="hero-restore-samples-btn"
                onClick={() => resetToSampleProject()}
                className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-slate-800/60 text-amber-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('restoreSamplesBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
      <SpeakerConfigModal />
      <ApiKeyModal />
      <ProjectPropertiesModal />
      <ExportMasterModal />
      <AuxBusRackModal />
    </div>
  );
};

export default App;
