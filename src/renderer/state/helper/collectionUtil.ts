import { IpcPushStream } from '@/lib/ipc-stream';
import { EditedModel, getBodyModel, getScriptModel, loadModelContent } from '@/lib/monaco/models';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';

/**
 * Loads the text body and the scripts of a request into its editor models, see
 * {@link loadModelContent}: the loaded content replaces anything typed meanwhile, and a model that
 * was disposed while its content was loading is left as it is.
 * @param request the request. Its editor models must exist.
 * @param only loads only this model instead of all
 */
export async function loadEditorContent(request: TrufosRequest, only?: EditedModel): Promise<void> {
  const models: EditedModel[] = only != null ? [only] : ['body', ...Object.values(ScriptType)];
  await Promise.all(
    models.map((model) =>
      model === 'body' ? loadTextBody(request) : loadScript(request.id, model)
    )
  );
}

async function loadTextBody(request: TrufosRequest) {
  const model = getBodyModel(request.id);
  if (request.body.type === RequestBodyType.TEXT) {
    await loadModelContent(model, async () => {
      const stream = await IpcPushStream.open(
        { type: 'request-body', requestId: request.id },
        'utf-8'
      );
      return await stream.readAll();
    });
  } else {
    model.setValue('');
  }
}

async function loadScript(requestId: string, scriptType: ScriptType) {
  await loadModelContent(getScriptModel(requestId, scriptType), async () => {
    const stream = await IpcPushStream.open(
      { type: 'script', source: scriptType, requestId },
      'utf-8'
    );
    return await stream.readAll();
  });
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
