import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry, HistoryEntrySummary } from 'shim/history';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';
import { showError } from '@/error/errorHandler';

const eventService = RendererEventService.instance;

interface HistoryState {
  /** The entries of the request history, newest first. */
  entries: HistoryEntrySummary[];
  selectedId?: string;
  /** The full selected entry. Only this one is loaded, so the list stays lightweight. */
  selectedEntry?: HistoryEntry;
}

interface HistoryActions {
  /** Loads the list, e.g. when the history is shown. */
  load(): Promise<void>;
  /**
   * Takes over a list received from the main process, e.g. the one it pushes after every change.
   * @param entries the entries, newest first
   */
  receive(entries: HistoryEntrySummary[]): void;
  select(id: string): Promise<void>;
  /** Closes the selected entry. */
  deselect(): void;
  clear(): Promise<void>;
}

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  immer((set, get) => ({
    entries: [],

    async load() {
      try {
        get().receive(await eventService.getHistory());
      } catch (error) {
        showError('Could not load the request history', error);
      }
    },

    receive(entries) {
      set((state) => {
        state.entries = entries;
        // the selected entry may have been evicted, cleared, or belong to another collection
        if (!entries.some((entry) => entry.id === state.selectedId)) {
          state.selectedId = undefined;
          state.selectedEntry = undefined;
        }
      });
    },

    async select(id) {
      set((state) => {
        state.selectedId = id;
        state.selectedEntry = undefined;
      });
      try {
        const entry = await eventService.getHistoryEntry(id);
        // ignore the result if another entry was selected in the meantime
        if (get().selectedId !== id) return;
        set((state) => {
          state.selectedEntry = entry;
        });
      } catch (error) {
        showError('Could not load the history entry', error);
      }
    },

    deselect() {
      set((state) => {
        state.selectedId = undefined;
        state.selectedEntry = undefined;
      });
    },

    async clear() {
      try {
        await eventService.clearHistory();
      } catch (error) {
        showError('Could not clear the request history', error);
      }
    },
  }))
);

export const selectHistoryEntries = (state: HistoryState) => state.entries;
export const selectSelectedHistoryId = (state: HistoryState) => state.selectedId;
export const selectSelectedHistoryEntry = (state: HistoryState) => state.selectedEntry;
export const useHistoryActions = () => useHistoryStore(useActions());
