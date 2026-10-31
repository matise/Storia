import React from 'react';
import { TopBar } from './components/layout/TopBar';
import { CastSidebar } from './components/layout/CastSidebar';
import { ScriptWorkbench } from './components/layout/ScriptWorkbench';
import { AgentDock } from './components/layout/AgentDock';
import { SpeakerConfigModal } from './components/modals/SpeakerConfigModal';
import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { ProjectPropertiesModal } from './components/modals/ProjectPropertiesModal';
import { ExportMasterModal } from './components/modals/ExportMasterModal';
import { useStoriaStore } from './store/useStoriaStore';

export const App: React.FC = () => {
  const undo = useStoriaStore((s) => s.undo);
  const redo = useStoriaStore((s) => s.redo);
  const selectedBlockId = useStoriaStore((s) => s.selectedBlockId);
  const assignSpeakerByHotkey = useStoriaStore((s) => s.assignSpeakerByHotkey);
  const moveBlockRelative = useStoriaStore((s) => s.moveBlockRelative);
  const syncCacheStatuses = useStoriaStore((s) => s.syncCacheStatuses);

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
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <CastSidebar />
        <ScriptWorkbench />
        <AgentDock />
      </div>
      <SpeakerConfigModal />
      <ApiKeyModal />
      <ProjectPropertiesModal />
      <ExportMasterModal />
    </div>
  );
};

export default App;
