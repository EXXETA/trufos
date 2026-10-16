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
  /**
   * Called when a debounced edit could not be sent. The editor then shows text that is not
   * persisted, so the caller should tell the user and reload the content of the model.
   */
  editFailed(requestId: string, model: EditedModel, error: unknown): void;
}

/** An edit that waits for its debounce timer. */
interface PendingEdit {
  timer: ReturnType<typeof setTimeout>;
  /** Sends the current content of the model. Must read it synchronously. */
  send: () => Promise<void>;
}

const registry = new Map<string, RequestModels>();

/** The editor models whose edits are tracked: the text body or a script. */
export type EditedModel = 'body' | ScriptType;

/** Pending edits by request ID, then by model. */
const pendingEdits = new Map<string, Map<EditedModel, PendingEdit>>();

/** The requests whose changes are ignored at the moment, see {@link suspendModelEdits}. */
const suspended = new Set<string>();

/** The models whose content is being loaded, with the token of the latest load. */
const loading = new Map<editor.ITextModel, symbol>();

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

/**
 * Creates the editor models of a request, unless they exist already.
 * @param requestId the ID of the request
 * @param persistence sends the edits of the text body and the scripts to the main process
 */
export function createModelsForRequest(
  requestId: string,
  persistence: ModelPersistence
): RequestModels {
  if (registry.has(requestId)) {
    return registry.get(requestId)!;
  }
  const body = editor.createModel('', undefined, bodyUri(requestId));
  trackEdits(requestId, 'body', body, persistence);

  const scripts = new Map<ScriptType, editor.ITextModel>();
  for (const type of Object.values(ScriptType)) {
    const model = editor.createModel('', 'javascript', scriptUri(requestId, type));
    trackEdits(requestId, type, model, persistence);
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
  const sent = requestIds.flatMap(takePendingEdits).map((edit) => edit.send());
  return Promise.all(sent).then(() => undefined);
}

/**
 * Drops the pending edits of the given request, e.g. because it is deleted or its changes are
 * discarded.
 */
export function cancelModelEdits(requestId: string): void {
  takePendingEdits(requestId);
}

/**
 * Ignores the changes of the models of a request until the returned function is called, e.g. while
 * its changes are discarded: text typed meanwhile is replaced anyway, so it must not be sent.
 * @returns resumes tracking the edits
 */
export function suspendModelEdits(requestId: string): () => void {
  suspended.add(requestId);
  return () => suspended.delete(requestId);
}

/**
 * Loads the content of a model. Changes made while it loads are not edits, as the loaded content
 * replaces them: sending them would persist a fragment instead of the whole content. If the model
 * is disposed or loaded again meanwhile, the loaded content is dropped.
 * @param model the model to load the content of
 * @param load loads the content
 */
export async function loadModelContent(
  model: editor.ITextModel,
  load: () => Promise<string>
): Promise<void> {
  const token = Symbol('load');
  loading.set(model, token);
  try {
    const text = await load();
    // setValue is a flush, so it is not tracked as an edit
    if (!model.isDisposed() && loading.get(model) === token) model.setValue(text);
  } finally {
    if (loading.get(model) === token) loading.delete(model);
  }
}

/** Removes the pending edits of a request and stops their timers. */
function takePendingEdits(requestId: string): PendingEdit[] {
  const edits = [...(pendingEdits.get(requestId)?.values() ?? [])];
  pendingEdits.delete(requestId);
  for (const edit of edits) clearTimeout(edit.timer);
  return edits;
}

/** Schedules a debounced edit whenever the user changes the content of the model. */
function trackEdits(
  requestId: string,
  key: EditedModel,
  model: editor.ITextModel,
  persistence: ModelPersistence
) {
  const send = () => {
    const text = model.getValue();
    return key === 'body'
      ? persistence.setTextBody(requestId, text)
      : persistence.setScript(requestId, key, text);
  };

  // the listener is disposed together with the model
  model.onDidChangeContent((event) => {
    // a flush replaces the whole content, i.e. the content was loaded and not edited
    if (event.isFlush || suspended.has(requestId) || loading.has(model)) return;

    let edits = pendingEdits.get(requestId);
    if (edits == null) {
      pendingEdits.set(requestId, (edits = new Map()));
      // the edit that follows reports its own failure
      persistence
        .markDraft(requestId)
        .catch((error) => console.error('Could not mark the request as draft:', error));
    }

    clearTimeout(edits.get(key)?.timer);
    const timer = setTimeout(() => {
      const current = pendingEdits.get(requestId);
      current?.delete(key);
      if (current?.size === 0) pendingEdits.delete(requestId);
      send().catch((error) => persistence.editFailed(requestId, key, error));
    }, MODEL_EDIT_DEBOUNCE_MS);
    edits.set(key, { timer, send });
  });
}
