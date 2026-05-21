import { editor, Uri } from 'monaco-editor';
import { TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';
import { RendererEventService } from '@/services/event/renderer-event-service';

// URI scheme:
//   trufos://requests/{requestId}/body
//   trufos://requests/{requestId}/script/pre-request
//   trufos://requests/{requestId}/script/post-response
//   trufos://requests/{requestId}/response

const SCHEME = 'trufos';

export interface RequestModels {
  body: editor.ITextModel;
  script: editor.ITextModel;
  response: editor.ITextModel;
}

const registry = new Map<string, RequestModels>();

/** Callback registered externally (option B) to resolve a request by ID. */
let getRequest: ((id: string) => TrufosRequest | undefined) | null = null;

/**
 * Register the function used by onWillDisposeModel to look up a TrufosRequest
 * by its ID. Should be called once during app initialisation (e.g. from
 * CollectionStoreProvider or RequestWindow).
 */
export function registerGetRequest(fn: (id: string) => TrufosRequest | undefined) {
  getRequest = fn;
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

/** Parse a model URI and return its metadata, or null if it is not a trufos model. */
function parseModelUri(
  uri: Uri
): { requestId: string; kind: 'body' | 'script' | 'response'; scriptType?: ScriptType } | null {
  if (uri.scheme !== SCHEME) return null;
  // path: /requests/{id}/body|response  or  /requests/{id}/script/{type}
  const match = uri.path.match(/^\/requests\/([^/]+)\/(body|response|script\/([^/]+))$/);
  if (!match) return null;
  const requestId = match[1];
  if (match[2] === 'body') return { requestId, kind: 'body' };
  if (match[2] === 'response') return { requestId, kind: 'response' };
  return { requestId, kind: 'script', scriptType: match[3] as ScriptType };
}

// ── Registry API ─────────────────────────────────────────────────────────────

export function createModelsForRequest(requestId: string): RequestModels {
  if (registry.has(requestId)) {
    return registry.get(requestId)!;
  }
  const models: RequestModels = {
    body: editor.createModel('', undefined, bodyUri(requestId)),
    script: editor.createModel('', 'javascript', scriptUri(requestId, ScriptType.PRE_REQUEST)),
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

export function getScriptModel(requestId: string): editor.ITextModel {
  return registry.get(requestId)!.script;
}

export function getResponseModel(requestId: string): editor.ITextModel {
  return registry.get(requestId)!.response;
}

export function disposeModelsForRequest(requestId: string): void {
  const models = registry.get(requestId);
  if (!models) return;
  // Dispose each model — this triggers onWillDisposeModel for body & script,
  // which handles persisting their content.
  models.body.dispose();
  models.script.dispose();
  models.response.dispose();
  registry.delete(requestId);
}

// ── Save helper used by MainTopBar and CollectionStoreProvider ───────────────

const eventService = RendererEventService.instance;

/**
 * Given a live model (from editor.getModels()), save its content if it is a
 * body or script model. Response models are skipped (read-only display).
 * Returns a Promise that resolves when the save is complete (or immediately for
 * non-saveable models).
 */
export async function saveModelContent(model: editor.ITextModel): Promise<void> {
  const parsed = parseModelUri(model.uri);
  if (!parsed || !getRequest) return;
  const request = getRequest(parsed.requestId);
  if (!request) return;

  if (parsed.kind === 'body') {
    await eventService.saveRequest(request, model.getValue());
  } else if (parsed.kind === 'script' && parsed.scriptType != null) {
    await eventService.saveScript(request, parsed.scriptType, model.getValue());
  }
}

// ── onWillDisposeModel — save content when a model is about to be disposed ───

editor.onWillDisposeModel((model) => {
  const parsed = parseModelUri(model.uri);
  if (!parsed || !getRequest) return;
  const request = getRequest(parsed.requestId);
  if (!request) return;

  if (parsed.kind === 'body') {
    void eventService.saveRequest(request, model.getValue());
  } else if (parsed.kind === 'script' && parsed.scriptType != null) {
    void eventService.saveScript(request, parsed.scriptType, model.getValue());
  }
});
