import { useCallback, useState } from 'react';
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
 * Shared send-request side effect: flushes every open Monaco editor model, sends the currently
 * selected request via the HTTP service, and stores the response. No-ops when there is no
 * selected request. Never throws — errors are caught and shown as a toast.
 */
export function useSendRequest() {
  const [isSending, setIsSending] = useState(false);
  const request = useCollectionStore(selectRequest);
  const { addResponse } = useResponseActions();

  const sendRequest = useCallback(async () => {
    if (request == null) return;

    try {
      setIsSending(true);
      await Promise.all(editor.getModels().map(saveModelContent));

      const response = await httpService.sendRequest(request);
      addResponse(request.id, response);
    } catch (error) {
      showError(error);
    } finally {
      setIsSending(false);
    }
  }, [request, addResponse]);

  return { sendRequest, isSending };
}

/**
 * Shared save-request side effect: flushes every open Monaco editor model, persists the currently
 * selected request via the event service, and syncs the store with the saved result. No-ops when
 * there is no selected request. Never throws — errors are caught and shown as a toast.
 */
export function useSaveRequest() {
  const [isSaving, setIsSaving] = useState(false);
  const request = useCollectionStore(selectRequest);
  const { updateRequest } = useCollectionActions();

  const saveRequest = useCallback(async () => {
    if (request == null) return;

    try {
      setIsSaving(true);
      await Promise.all(editor.getModels().map(saveModelContent));

      updateRequest(await eventService.saveChanges(request), true);
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  }, [request, updateRequest]);

  return { saveRequest, isSaving };
}
