import { stableAudioClient } from '../../core/sfx/stableAudioClient';
import { StoriaStoreState, StoreSliceContext } from '../storeTypes';

export type StableAudioSlice = Pick<
  StoriaStoreState,
  | 'setBackgroundServicesModalOpen'
  | 'refreshStableAudioStatus'
  | 'startStableAudioDaemon'
  | 'stopStableAudioDaemon'
  | 'restartStableAudioDaemon'
  | 'hibernateStableAudioDaemon'
  | 'wakeStableAudioDaemon'
  | 'downloadStableAudioModel'
>;

export function createStableAudioSlice({
  set,
  get,
}: StoreSliceContext): StableAudioSlice {
  return {
    setBackgroundServicesModalOpen: (open: boolean) => {
      set({ isBackgroundServicesModalOpen: open });
      if (open) {
        void get().refreshStableAudioStatus();
      }
    },

    refreshStableAudioStatus: async () => {
      try {
        const [statusRes, modelsRes] = await Promise.allSettled([
          stableAudioClient.getStatus(),
          stableAudioClient.getModels(),
        ]);

        const status = statusRes.status === 'fulfilled' ? statusRes.value : null;
        const models = modelsRes.status === 'fulfilled' ? modelsRes.value : get().stableAudioModels;
        const isOnline = Boolean(status !== null);

        set({
          stableAudioStatus: status,
          stableAudioModels: models,
          isStableAudioDaemonOnline: isOnline,
          stableAudioError: null,
        });
      } catch {
        set({
          stableAudioStatus: null,
          isStableAudioDaemonOnline: false,
          stableAudioError: null,
        });
      }
    },

    startStableAudioDaemon: async () => {
      set({ isStartingOrStoppingDaemon: true, stableAudioError: null });
      try {
        await stableAudioClient.startService();
        // Give daemon a brief moment to initialize before refreshing
        await new Promise((r) => setTimeout(r, 1000));
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Failed to start background daemon' });
      } finally {
        set({ isStartingOrStoppingDaemon: false });
      }
    },

    stopStableAudioDaemon: async () => {
      set({ isStartingOrStoppingDaemon: true, stableAudioError: null });
      try {
        await stableAudioClient.stopService();
        await new Promise((r) => setTimeout(r, 600));
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Failed to stop background daemon' });
      } finally {
        set({ isStartingOrStoppingDaemon: false });
      }
    },

    restartStableAudioDaemon: async () => {
      set({ isStartingOrStoppingDaemon: true, stableAudioError: null });
      try {
        await stableAudioClient.restartService();
        await new Promise((r) => setTimeout(r, 1200));
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Failed to restart background daemon' });
      } finally {
        set({ isStartingOrStoppingDaemon: false });
      }
    },

    hibernateStableAudioDaemon: async () => {
      try {
        await stableAudioClient.hibernate();
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Hibernate failed' });
      }
    },

    wakeStableAudioDaemon: async () => {
      try {
        await stableAudioClient.wake();
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Wake failed' });
      }
    },

    downloadStableAudioModel: async (modelName: string) => {
      try {
        await stableAudioClient.downloadModel(modelName);
        await get().refreshStableAudioStatus();
      } catch (err: any) {
        set({ stableAudioError: err?.message || 'Model download failed' });
      }
    },
  };
}
