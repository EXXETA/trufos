import { useCallback } from 'react';
import { create } from 'zustand';
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
 * The one in-flight operation per kind, shared across every caller of `useSendRequest`/
 * `useSaveRequest` — a plain per-hook `useState` would instead give each caller its own
 * disconnected copy of the same fact. `activeSend` holds the controller of the send currently in
 * flight (`null` while none): being in flight and being cancellable are the same fact, so they are
 * one piece of state that cannot go stale against a separate "is sending" flag.
 */
const useInFlightStore = create<{ activeSend: AbortController | null; isSaving: boolean }>(() => ({
  activeSend: null,
  isSaving: false,
}));

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
  const isSending = useInFlightStore((state) => state.activeSend != null);
  const request = useCollectionStore(selectRequest);
  const { addResponse } = useResponseActions();

  const sendRequest = useCallback(async () => {
    if (request == null || useInFlightStore.getState().activeSend != null) return;

    const abortController = new AbortController();
    useInFlightStore.setState({ activeSend: abortController });

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
      useInFlightStore.setState({ activeSend: null });
    }
  }, [request, addResponse]);

  const cancelRequest = useCallback(() => useInFlightStore.getState().activeSend?.abort(), []);

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
  const isSaving = useInFlightStore((state) => state.isSaving);
  const request = useCollectionStore(selectRequest);
  const { updateRequest } = useCollectionActions();

  const saveRequest = useCallback(async () => {
    if (request == null) return;

    try {
      useInFlightStore.setState({ isSaving: true });
      await Promise.all(editor.getModels().map(saveModelContent));

      updateRequest(await eventService.saveChanges(request), true);
    } catch (error) {
      showError(error);
    } finally {
      useInFlightStore.setState({ isSaving: false });
    }
  }, [request, updateRequest]);

  return { saveRequest, isSaving };
}
