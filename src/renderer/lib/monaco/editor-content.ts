import { IpcPushStream } from '@/lib/ipc-stream';
import { EditedModel, getBodyModel, getScriptModel, loadModelContent } from '@/lib/monaco/models';
import { TrufosId } from 'shim/objects/id';
import { ScriptType } from 'shim/scripting';

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
 * an empty body editor, as main has no text body to stream for it.
 * @param requestId the ID of the request. Its editor models must exist.
 */
export async function loadEditorContent(
  requestId: TrufosId,
  { only, after }: LoadEditorContentOptions = {}
): Promise<void> {
  const models: EditedModel[] = only != null ? [only] : ['body', ...Object.values(ScriptType)];
  await Promise.all(
    models.map((model) =>
      loadModelContent(
        model === 'body' ? getBodyModel(requestId) : getScriptModel(requestId, model),
        async () => {
          await after;
          const stream = await IpcPushStream.open(
            model === 'body'
              ? { type: 'request-body', requestId }
              : { type: 'script', source: model, requestId },
            'utf-8'
          );
          return await stream.readAll();
        }
      )
    )
  );
}
