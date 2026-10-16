import type { editor } from 'monaco-editor';
import { IpcPushStream } from '@/lib/ipc-stream';
import { getBodyModel, getScriptModel } from '@/lib/monaco/models';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';

/**
 * Loads the text body and the scripts of a request into its editor models. Replacing the whole
 * content counts as a flush, so it is not sent back to the main process as an edit. A model that
 * was disposed or changed while its content was loading is left as it is.
 * @param request the request. Its editor models must exist.
 */
export async function loadEditorContent(request: TrufosRequest): Promise<void> {
  await Promise.all([
    loadTextBody(request),
    ...Object.values(ScriptType).map((scriptType) => loadScript(request.id, scriptType)),
  ]);
}

async function loadTextBody(request: TrufosRequest) {
  const model = getBodyModel(request.id);
  if (request.body.type === RequestBodyType.TEXT) {
    const version = model.getVersionId();
    const stream = await IpcPushStream.open(
      { type: 'request-body', requestId: request.id },
      'utf-8'
    );
    setLoadedValue(model, version, await stream.readAll());
  } else {
    model.setValue('');
  }
}

async function loadScript(requestId: string, scriptType: ScriptType) {
  const model = getScriptModel(requestId, scriptType);
  const version = model.getVersionId();
  const stream = await IpcPushStream.open(
    { type: 'script', source: scriptType, requestId },
    'utf-8'
  );
  setLoadedValue(model, version, await stream.readAll());
}

/**
 * Sets the loaded content of a model, unless the model changed while it was loaded: it was
 * disposed because another request was selected, the user typed into it, or a newer load replaced
 * its content. The user's text then stays, and their pending edit sends it.
 * @param model the model the content was loaded for
 * @param version the version of the model when the load started
 * @param text the loaded content
 */
function setLoadedValue(model: editor.ITextModel, version: number, text: string) {
  if (!model.isDisposed() && model.getVersionId() === version) model.setValue(text);
}

/**
 * Converts the drop position of a dragged item into the index of a move of several items, so
 * they land where the dragged item was dropped.
 * @param childIds the children of the target parent
 * @param draggedId the dragged item, one of `movedIds`
 * @param dropIndex where the dragged item was dropped, among `childIds` without it
 * @param movedIds all moved items
 * @returns the index among `childIds` without all moved items, see the `move` command
 */
export function getMoveIndex(
  childIds: readonly string[],
  draggedId: string,
  dropIndex: number,
  movedIds: ReadonlySet<string>
): number {
  // the moved items are placed after the last sibling before the drop position that stays
  const anchor = childIds
    .filter((id) => id !== draggedId)
    .slice(0, dropIndex)
    .findLast((id) => !movedIds.has(id));
  return anchor == null ? 0 : childIds.filter((id) => !movedIds.has(id)).indexOf(anchor) + 1;
}
