import { useCallback, useSyncExternalStore } from 'react';
import { editor } from 'monaco-editor';
import { saveModelContent } from '@/lib/monaco/models';
import { HttpService } from '@/services/http/http-service';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useResponseActions } from '@/state/responseStore';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

/**
 * A fact shared across every subscriber, independent of React's per-component state. Used so
 * `isSending`/`isSaving` reflect one real in-flight operation no matter how many components call
 * `useSendRequest`/`useSaveRequest` — a plain per-hook `useState` would instead give each caller
 * its own disconnected copy of the same fact.
 */
function createSharedState<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * The controller of the send that is currently in flight, or `null` while none is. Being in flight
 * and being cancellable are the same fact, so they are one piece of state: it cannot go stale
 * against a separate "is sending" flag.
 */
const activeSend = createSharedState<AbortController | null>(null);
const savingFlag = createSharedState(false);

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
  const isSending = useSyncExternalStore(activeSend.subscribe, activeSend.get) != null;
  const request = useCollectionStore(selectRequest);
  const { addResponse } = useResponseActions();

  const sendRequest = useCallback(async () => {
    if (request == null || activeSend.get() != null) return;

    const abortController = new AbortController();
    activeSend.set(abortController);

    try {
      // Cancelling during this flush aborts the signal before the request goes out, so the send
      // below returns null without ever reaching the main process.
      await Promise.all(editor.getModels().map(saveModelContent));

      // No response means the user cancelled, so there is nothing to store.
      const response = await httpService.sendRequest(request, abortController.signal);
      if (response != null) addResponse(request.id, response);
    } catch (error) {
      showError(error);
    } finally {
      activeSend.set(null);
    }
  }, [request, addResponse]);

  const cancelRequest = useCallback(() => activeSend.get()?.abort(), []);

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
