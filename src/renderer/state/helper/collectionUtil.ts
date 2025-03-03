import { editor } from 'monaco-editor';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { IpcPushStream } from '@/lib/ipc-stream';
import { Folder } from 'shim/objects/folder';

export async function setRequestTextBody(
  requestEditor: editor.ICodeEditor,
  request: TrufosRequest
) {
  // load the new request body
  if (request.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request);
    requestEditor.setValue(await IpcPushStream.collect(stream));
  } else {
    requestEditor.setValue('');
  }
}

export function isRequestInAParentFolder(requestId: string, folder: Folder): boolean {
  return folder.children.some((child) => {
    if (child.type === 'folder') {
      return isRequestInAParentFolder(requestId, child);
    }
    return child.id === requestId;
  });
}
