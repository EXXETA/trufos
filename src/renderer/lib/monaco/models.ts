import { editor, Uri } from 'monaco-editor';
import { ScriptType } from 'shim/scripting';

// URI scheme:
//   trufos://requests/{requestId}/body
//   trufos://requests/{requestId}/script/pre-request
//   trufos://requests/{requestId}/script/post-response
//   trufos://requests/{requestId}/response

const SCHEME = 'trufos';

/** How long to wait after the last keystroke before an edit is sent to the main process. */
export const MODEL_EDIT_DEBOUNCE_MS = 1000;

export interface RequestModels {
  body: editor.ITextModel;
  scripts: Map<ScriptType, editor.ITextModel>;
  response: editor.ITextModel;
}

/**
 * Sends the content of the editor models to the main process. The models own the text body and
 * the scripts of a request, so this is the only way they are persisted.
 */
export interface ModelPersistence {
  /** Replaces the text body of a request. */
  setTextBody(requestId: string, text: string): Promise<void>;
  /** Replaces a script of a request. */
  setScript(requestId: string, scriptType: ScriptType, text: string): Promise<void>;
  /** Turns the request into a draft if it is none yet, so the change is visible at once. */
  markDraft(requestId: string): Promise<void>;
}

/** An edit that waits for its debounce timer. */
interface PendingEdit {
  timer: ReturnType<typeof setTimeout>;
  /** Sends the current content of the model. Must read it synchronously. */
  send: () => Promise<void>;
}

const registry = new Map<string, RequestModels>();

/** Pending edits by request ID, then by model (`body` or a script type). */
const pendingEdits = new Map<string, Map<string, PendingEdit>>();

let persistence: ModelPersistence | undefined;

/**
 * Registers how the content of the editor models is persisted. Called once by the collection
 * store provider.
 */
export function registerModelPersistence(value: ModelPersistence | undefined): void {
  persistence = value;
}

// ── URI helpers ─────────────────────────────────────────────────────────────

export function bodyUri(requestId: string): Uri {
  return Uri.from({ scheme: SCHEME, path: `/requests/${requestId}/body` });
}

export function scriptUri(requestId: string, scriptType: ScriptType): Uri {
  return Uri.from({ scheme: SCHEME, path: `/requests/${requestId}/script/${scriptType}` });
}

export function responseUri(requestId: string): Uri {
  return Uri.from({ scheme: SCHEME, path: `/requests/${requestId}/response` });
}

// ── Registry API ─────────────────────────────────────────────────────────────

export function createModelsForRequest(requestId: string): RequestModels {
  if (registry.has(requestId)) {
    return registry.get(requestId)!;
  }
  const body = editor.createModel('', undefined, bodyUri(requestId));
  trackEdits(requestId, 'body', body, (text) => persistence?.setTextBody(requestId, text));

  const scripts = new Map<ScriptType, editor.ITextModel>();
  for (const type of Object.values(ScriptType)) {
    const model = editor.createModel('', 'javascript', scriptUri(requestId, type));
    trackEdits(requestId, type, model, (text) => persistence?.setScript(requestId, type, text));
    scripts.set(type, model);
  }

  const models: RequestModels = {
    body,
    scripts,
    response: editor.createModel('', undefined, responseUri(requestId)),
  };
  registry.set(requestId, models);
  return models;
}

export function getModelsForRequest(requestId: string): RequestModels | undefined {
  return registry.get(requestId);
}

export function getBodyModel(requestId: string): editor.ITextModel {
  return registry.get(requestId)!.body;
}

export function getScriptModel(requestId: string, scriptType: ScriptType): editor.ITextModel {
  return registry.get(requestId)!.scripts.get(scriptType)!;
}

export function getResponseModel(requestId: string): editor.ITextModel {
  return registry.get(requestId)!.response;
}

/**
 * Disposes all models of the given request. Pending edits are dropped, so call
 * {@link flushModelEdits} first to keep them.
 * @param requestId the ID of the request
 */
export function disposeModelsForRequest(requestId: string): void {
  const models = registry.get(requestId);
  cancelModelEdits(requestId);
  if (!models) return;
  try {
    models.body.dispose();
    for (const scriptModel of models.scripts.values()) {
      scriptModel.dispose();
    }
    models.response.dispose();
  } finally {
    registry.delete(requestId);
  }
}

// ── Edits ────────────────────────────────────────────────────────────────────

/**
 * Sends the pending edits of the given request, or of all requests, right away instead of waiting
 * for their debounce timers. The content is read synchronously, so the models may be disposed as
 * soon as this returns.
 * @returns a promise that resolves when main applied the edits
 */
export function flushModelEdits(requestId?: string): Promise<void> {
  const requestIds = requestId == null ? [...pendingEdits.keys()] : [requestId];
  const sent: Promise<void>[] = [];
  for (const id of requestIds) {
    for (const edit of pendingEdits.get(id)?.values() ?? []) {
      clearTimeout(edit.timer);
      sent.push(edit.send());
    }
    pendingEdits.delete(id);
  }
  return Promise.all(sent).then(() => undefined);
}

/**
 * Drops the pending edits of the given request, e.g. because it is deleted or its changes are
 * discarded.
 */
export function cancelModelEdits(requestId: string): void {
  for (const edit of pendingEdits.get(requestId)?.values() ?? []) {
    clearTimeout(edit.timer);
  }
  pendingEdits.delete(requestId);
}

/** Schedules a debounced edit whenever the user changes the content of the model. */
function trackEdits(
  requestId: string,
  key: string,
  model: editor.ITextModel,
  persist: (text: string) => Promise<void> | undefined
) {
  // the listener is disposed together with the model
  model.onDidChangeContent((event) => {
    // a flush replaces the whole content, i.e. the content was loaded and not edited
    if (event.isFlush) return;

    let edits = pendingEdits.get(requestId);
    if (edits == null) {
      pendingEdits.set(requestId, (edits = new Map()));
      persistence?.markDraft(requestId).catch(logError);
    }

    const send = async () => {
      await persist(model.getValue());
    };
    clearTimeout(edits.get(key)?.timer);
    const timer = setTimeout(() => {
      const current = pendingEdits.get(requestId);
      current?.delete(key);
      if (current?.size === 0) pendingEdits.delete(requestId);
      send().catch(logError);
    }, MODEL_EDIT_DEBOUNCE_MS);
    edits.set(key, { timer, send });
  });
}

function logError(error: unknown) {
  console.error('Could not persist an editor change:', error);
}
