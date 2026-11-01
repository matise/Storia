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

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <TopBar />
      <div
        className={`flex-1 flex min-h-0 overflow-hidden ${
          isDraggingLeft || isDraggingRight ? 'select-none cursor-col-resize' : ''
        }`}
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
      <SpeakerConfigModal />
      <ApiKeyModal />
      <ProjectPropertiesModal />
      <ExportMasterModal />
      <AuxBusRackModal />
    </div>
  );
};

export default App;
