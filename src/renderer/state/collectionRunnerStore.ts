import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { HttpService } from '@/services/http/http-service';
import { useResponseStore } from '@/state/responseStore';
import { useActions } from '@/state/helper/util';

export enum RunResultStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface RunResult {
  requestId: TrufosRequest['id'];
  status: RunResultStatus;
  response?: TrufosResponse;
  error?: string;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  durationMs: number;
}

interface CollectionRunnerState {
  /** Whether the runner view is currently shown instead of the request window */
  isOpen: boolean;

  /** Whether a run is currently in progress */
  isRunning: boolean;

  /** Whether the run should stop (skip remaining requests) after the first failure */
  stopOnFailure: boolean;

  /** Requests explicitly excluded from the run. All requests are included by default. */
  deselectedRequestIds: Set<TrufosRequest['id']>;

  /** Execution order of the current/last run */
  runOrder: TrufosRequest['id'][];

  /** Results of the current/last run, keyed by request ID */
  results: Record<TrufosRequest['id'], RunResult>;

  /** Total duration of the last completed run in milliseconds */
  lastRunDurationMs?: number;

  /** Set while a run is in progress to stop execution before the next request */
  cancelRequested: boolean;
}

interface CollectionRunnerActions {
  openRunner: () => void;
  closeRunner: () => void;
  setStopOnFailure: (stopOnFailure: boolean) => void;
  toggleRequestSelection: (requestId: TrufosRequest['id']) => void;
  setAllSelected: (requestIds: TrufosRequest['id'][], selected: boolean) => void;

  /**
   * Run the given requests sequentially in the given order. Requests that are
   * deselected in the runner are skipped. Pre- and post-request scripts are executed
   * by the main process for each request, and variables changed by scripts are
   * persisted there, so scripts can pass data from one request to the next.
   * @param requests The requests to run, in execution order.
   */
  run: (requests: TrufosRequest[]) => Promise<void>;

  /** Request cancellation of the current run. The in-flight request still completes. */
  cancel: () => void;
}

/** A request is considered passed if the server responded with a non-error status code. */
const isPassed = (response: TrufosResponse) => response.metaInfo.status < 400;

export const useCollectionRunnerStore = create<CollectionRunnerState & CollectionRunnerActions>()(
  immer((set, get) => ({
    isOpen: false,
    isRunning: false,
    stopOnFailure: false,
    deselectedRequestIds: new Set<string>(),
    runOrder: [],
    results: {},
    cancelRequested: false,

    openRunner: () => set({ isOpen: true }),

    closeRunner: () => set({ isOpen: false }),

    setStopOnFailure: (stopOnFailure) => set({ stopOnFailure }),

    toggleRequestSelection: (requestId) =>
      set((state) => {
        if (state.deselectedRequestIds.has(requestId)) {
          state.deselectedRequestIds.delete(requestId);
        } else {
          state.deselectedRequestIds.add(requestId);
        }
      }),

    setAllSelected: (requestIds, selected) =>
      set((state) => {
        if (selected) {
          for (const id of requestIds) state.deselectedRequestIds.delete(id);
        } else {
          for (const id of requestIds) state.deselectedRequestIds.add(id);
        }
      }),

    run: async (requests) => {
      if (get().isRunning) return;
      const selected = requests.filter(({ id }) => !get().deselectedRequestIds.has(id));
      if (selected.length === 0) return;

      set((state) => {
        state.isRunning = true;
        state.cancelRequested = false;
        state.lastRunDurationMs = undefined;
        state.runOrder = selected.map(({ id }) => id);
        state.results = {};
        for (const { id } of selected) {
          state.results[id] = { requestId: id, status: RunResultStatus.PENDING };
        }
      });

      const start = performance.now();
      for (const request of selected) {
        if (get().cancelRequested) {
          set((state) => {
            state.results[request.id].status = RunResultStatus.SKIPPED;
          });
          continue;
        }

        set((state) => {
          state.results[request.id].status = RunResultStatus.RUNNING;
        });

        try {
          const response = await HttpService.instance.sendRequest(request);
          useResponseStore.getState().addResponse(request.id, response);
          set((state) => {
            const result = state.results[request.id];
            result.response = response;
            result.status = isPassed(response) ? RunResultStatus.PASSED : RunResultStatus.FAILED;
          });
        } catch (error) {
          console.error(`Request "${request.title}" failed during collection run:`, error);
          set((state) => {
            const result = state.results[request.id];
            result.status = RunResultStatus.FAILED;
            result.error = error instanceof Error ? error.message : String(error);
          });
        }

        if (
          get().stopOnFailure &&
          get().results[request.id].status === RunResultStatus.FAILED &&
          !get().cancelRequested
        ) {
          set({ cancelRequested: true });
        }
      }

      set((state) => {
        state.isRunning = false;
        state.cancelRequested = false;
        state.lastRunDurationMs = performance.now() - start;
      });
    },

    cancel: () => {
      if (get().isRunning) set({ cancelRequested: true });
    },
  }))
);

/**
 * Flatten a collection/folder subtree into the list of requests in execution order
 * (depth-first, in the manual order of the collection tree).
 */
export const listRequestsInOrder = (children: (Folder | TrufosRequest)[]): TrufosRequest[] => {
  const requests: TrufosRequest[] = [];
  for (const child of children) {
    if (child.type === 'request') {
      requests.push(child);
    } else {
      requests.push(...listRequestsInOrder(child.children));
    }
  }
  return requests;
};

/** An entry of the runner checklist: a request or folder and its depth in the tree. */
export interface RunnerTreeItem {
  item: Folder | TrufosRequest;
  depth: number;
}

/**
 * Flatten a collection/folder subtree into a list of checklist entries (folders and
 * requests) in tree order, keeping track of the nesting depth for indentation.
 */
export const listRunnerTreeItems = (
  children: (Folder | TrufosRequest)[],
  depth = 0
): RunnerTreeItem[] => {
  const items: RunnerTreeItem[] = [];
  for (const child of children) {
    items.push({ item: child, depth });
    if (child.type === 'folder') {
      items.push(...listRunnerTreeItems(child.children, depth + 1));
    }
  }
  return items;
};

export const selectRunSummary = (state: CollectionRunnerState): RunSummary => {
  const summary: RunSummary = {
    total: state.runOrder.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    durationMs: state.lastRunDurationMs ?? 0,
  };
  for (const id of state.runOrder) {
    switch (state.results[id]?.status) {
      case RunResultStatus.PASSED:
        summary.passed++;
        break;
      case RunResultStatus.FAILED:
        summary.failed++;
        break;
      case RunResultStatus.SKIPPED:
        summary.skipped++;
        break;
      default:
        summary.pending++;
    }
  }
  return summary;
};

export const useCollectionRunnerActions = () => useCollectionRunnerStore(useActions());
