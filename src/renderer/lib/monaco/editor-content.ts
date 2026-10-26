import { IpcPushStream } from '@/lib/ipc-stream';
import {
  EditedModel,
  getBodyModel,
  getScriptModel,
  hasModelsForRequest,
  loadModelContent,
  refreshModelContent,
} from '@/lib/monaco/models';
import { TrufosId } from 'shim/objects/id';
import { ScriptType } from 'shim/scripting';

/** The editor models of a request whose content is on disk. */
const EDITED_MODELS: EditedModel[] = ['body', ...Object.values(ScriptType)];

/** Options of {@link loadEditorContent}. */
export interface LoadEditorContentOptions {
  /** Loads only this model instead of all. */
  only?: EditedModel;
  /**
   * The content is read once this settles, e.g. once main discarded the changes of the request.
   * Text typed meanwhile is replaced by the loaded content, so it is not sent as an edit. If this
   * rejects, nothing is loaded.
   */
  after?: Promise<unknown>;
}

/**
 * Loads the text body and the scripts of a request into its editor models, see
 * {@link loadModelContent}: the loaded content replaces anything typed meanwhile, and a model that
 * was disposed while its content was loading is left as it is. A request without a text body gets
 * an empty body editor, as main has no text body to stream for it. Nothing is loaded if the request
 * has no editor models (anymore), e.g. because it was deleted.
 * @param requestId the ID of the request
 */
export async function loadEditorContent(
  requestId: TrufosId,
  { only, after }: LoadEditorContentOptions = {}
): Promise<void> {
  if (!hasModelsForRequest(requestId)) return;
  const models: EditedModel[] = only != null ? [only] : EDITED_MODELS;
  await Promise.all(
    models.map((model) =>
      loadModelContent(getModel(requestId, model), async () => {
        await after;
        return await readContent(requestId, model);
      })
    )
  );
}

/**
 * Loads the text body and the scripts of a request into its editor models if they changed on
 * disk, e.g. outside the app, see {@link refreshModelContent}: a model the user edited meanwhile,
 * or that has pending edits, is left as it is. Nothing is loaded if the request has no editor
 * models.
 * @param requestId the ID of the request
 */
export async function refreshEditorContent(requestId: TrufosId): Promise<void> {
  if (!hasModelsForRequest(requestId)) return;
  await Promise.all(
    EDITED_MODELS.map((model) =>
      refreshModelContent(requestId, getModel(requestId, model), () =>
        readContent(requestId, model)
      )
    )
  );
}

function getModel(requestId: TrufosId, model: EditedModel) {
  return model === 'body' ? getBodyModel(requestId) : getScriptModel(requestId, model);
}

/** Reads the content of an editor model from main, or undefined if reading was canceled. */
async function readContent(requestId: TrufosId, model: EditedModel): Promise<string | undefined> {
  const stream = await IpcPushStream.open(
    model === 'body'
      ? { type: 'request-body', requestId }
      : { type: 'script', source: model, requestId },
    'utf-8'
  );
  return await stream.readAll();
}
