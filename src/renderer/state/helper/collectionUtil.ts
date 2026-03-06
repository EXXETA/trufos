import { IpcPushStream } from '@/lib/ipc-stream';
import { REQUEST_MODEL, SCRIPT_MODEL } from '@/lib/monaco/models';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';

export async function setRequestTextBody(request?: TrufosRequest) {
  if (request?.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request, 'utf-8');
    REQUEST_MODEL.setValue(await stream.readAll());
  } else {
    REQUEST_MODEL.setValue('');
  }
}

export async function setScriptContent(request?: TrufosRequest, scriptType?: ScriptType) {
  if (request != null && scriptType != null) {
    const stream = await IpcPushStream.open(
      { type: 'script', source: scriptType, request },
      'utf-8'
    );
    SCRIPT_MODEL.setValue(await stream.readAll());
  } else {
    SCRIPT_MODEL.setValue('');
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
