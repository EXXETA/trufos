import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry } from 'shim/objects/history';
import { useActions } from '@/state/helper/util';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

interface HistoryState {
  entries: HistoryEntry[];
  isLoading: boolean;
}

interface HistoryActions {
  loadHistory(): Promise<void>;
  clearHistory(): Promise<void>;
}

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  immer((set) => ({
    entries: [],
    isLoading: false,

    async loadHistory() {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const entries = await eventService.getHistory();
        set((state) => {
          state.entries = entries;
          state.isLoading = false;
        });
      } catch (error) {
        console.error('Failed to load history:', error);
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    async clearHistory() {
      try {
        await eventService.clearHistory();
        set((state) => {
          state.entries = [];
        });
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    },
  }))
);

export const selectHistoryEntries = (state: HistoryState) => state.entries;
export const selectHistoryIsLoading = (state: HistoryState) => state.isLoading;
export const useHistoryActions = () => useHistoryStore(useActions());
