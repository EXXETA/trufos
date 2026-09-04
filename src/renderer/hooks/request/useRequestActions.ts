import { useCallback, useSyncExternalStore } from 'react';
import { editor } from 'monaco-editor';
import { saveModelContent } from '@/lib/monaco/models';
import { HttpService } from '@/services/http/http-service';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { RequestAbortedError } from 'shim/error/RequestAbortedError';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useResponseActions } from '@/state/responseStore';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

/**
 * A boolean fact shared across every subscriber, independent of React's per-component state.
 * Used so `isSending`/`isSaving` reflect one real in-flight operation no matter how many
 * components call `useSendRequest`/`useSaveRequest` — a plain per-hook `useState` would instead
 * give each caller its own disconnected copy of the same fact.
 */
function createBusyFlag() {
  let value = false;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next: boolean) {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const sendingFlag = createBusyFlag();
const savingFlag = createBusyFlag();

/**
 * Abort key of the send that is currently in flight, if any. Module-level for the same reason as
 * {@link sendingFlag}: cancelling from any component must hit the one real in-flight send, not a
 * per-caller copy.
 */
let activeAbortKey: string | null = null;
let abortKeySequence = 0;

/**
 * Shared send-request side effect: flushes every open Monaco editor model, sends the currently
 * selected request via the HTTP service, and stores the response. No-ops when there is no selected
 * request or a send is already in flight. Never throws — errors are caught and shown as a toast.
 *
 * `isSending` is a single fact shared across every caller of this hook (not a per-caller local
 * state), so any UI reading it reflects whether the current request is being sent right now,
 * regardless of which component triggered the send. `cancelRequest` aborts that same send.
 */
export function useSendRequest() {
  const isSending = useSyncExternalStore(sendingFlag.subscribe, sendingFlag.get);
  const request = useCollectionStore(selectRequest);
  const { addResponse } = useResponseActions();

  const sendRequest = useCallback(async () => {
    if (request == null || sendingFlag.get()) return;

    const abortKey = `send-request:${abortKeySequence++}`;
    activeAbortKey = abortKey;

    try {
      sendingFlag.set(true);
      await Promise.all(editor.getModels().map(saveModelContent));

      addResponse(request.id, await httpService.sendRequest(request, abortKey));
    } catch (error) {
      // Cancelling is the user's own doing, so it is not reported back to them as a failure.
      if (!(error instanceof RequestAbortedError)) showError(error);
    } finally {
      activeAbortKey = null;
      sendingFlag.set(false);
    }
  }, [request, addResponse]);

  const cancelRequest = useCallback(() => {
    if (activeAbortKey == null) return;
    void httpService.abortRequest(activeAbortKey).catch(console.error);
  }, []);

  return { sendRequest, cancelRequest, isSending };
}

/**
 * Shared save-request side effect: flushes every open Monaco editor model, persists the currently
 * selected request via the event service, and syncs the store with the saved result. No-ops when
 * there is no selected request. Never throws — errors are caught and shown as a toast.
 *
 * `isSaving` is a single fact shared across every caller of this hook (not a per-caller local
 * state), so any UI reading it reflects whether the current request is being saved right now,
 * regardless of which component triggered the save.
 */
export function useSaveRequest() {
  const isSaving = useSyncExternalStore(savingFlag.subscribe, savingFlag.get);
  const request = useCollectionStore(selectRequest);
  const { updateRequest } = useCollectionActions();

  const saveRequest = useCallback(async () => {
    if (request == null) return;

    try {
      savingFlag.set(true);
      await Promise.all(editor.getModels().map(saveModelContent));

      updateRequest(await eventService.saveChanges(request), true);
    } catch (error) {
      showError(error);
    } finally {
      savingFlag.set(false);
    }
  }, [request, updateRequest]);

  return { saveRequest, isSaving };
}
