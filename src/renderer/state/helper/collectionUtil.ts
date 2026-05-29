import { IpcPushStream } from '@/lib/ipc-stream';
import { getBodyModel, getScriptModel } from '@/lib/monaco/models';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';

export async function setRequestTextBody(requestId: string, request?: TrufosRequest) {
  const model = getBodyModel(requestId);
  if (request?.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request, 'utf-8');
    model.setValue(await stream.readAll());
  } else {
    model.setValue('');
  }
}

export async function setScriptContent(
  requestId: string,
  request?: TrufosRequest,
  scriptType?: ScriptType
) {
  const model = getScriptModel(requestId);
  if (request != null && scriptType != null) {
    const stream = await IpcPushStream.open(
      { type: 'script', source: scriptType, request },
      'utf-8'
    );
    model.setValue(await stream.readAll());
  } else {
    model.setValue('');
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
