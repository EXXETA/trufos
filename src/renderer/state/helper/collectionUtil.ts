import { IpcPushStream } from '@/lib/ipc-stream';
import { REQUEST_MODEL } from '@/lib/monaco/models';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';

export async function setRequestTextBody(request: TrufosRequest) {
  if (request.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request);
    REQUEST_MODEL.setValue(await IpcPushStream.collect(stream));
  } else {
    REQUEST_MODEL.setValue('');
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
