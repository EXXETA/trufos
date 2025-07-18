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

/**
 * Create a deep copy of the given folder with all its children.
 * The copied folder and all its children will have a new unique ID and the same structure as the original object.
 *
 *
 * @param folder The folder to copy.
 * @param addCopySuffix If true, the title of the copied folder will have a "(Copy)" suffix added to it.
 * @returns A new folder object with a unique ID and the same structure as the original folder.
 */
export function copyFolder(folder: Folder, addCopySuffix: boolean = true): Folder {
  const folderId = crypto.randomUUID();

  return {
    ...structuredClone(folder),
    id: folderId,
    title: addCopySuffix ? `${folder.title} (Copy)` : folder.title,
    children: folder.children.map((child) => {
      return child.type === 'folder'
        ? copyFolder({ ...child, parentId: folderId }, false)
        : copyTrufosRequest({ ...child, parentId: folderId }, false);
    }),
  };
}

/**
 * Create a deep copy of the given TrufosRequest object.
 * The copied request will have a new unique ID and the same properties as the original request.
 *
 * @param request The request to copy.
 * @param addCopySuffix If true, the title of the copied request will have a "(Copy)" suffix added to it.
 * @returns A new request object with a unique ID and the same properties as the original request.
 */
export function copyTrufosRequest(
  request: TrufosRequest,
  addCopySuffix: boolean = true
): TrufosRequest {
  return {
    ...structuredClone(request),
    id: crypto.randomUUID(),
    title: addCopySuffix ? `${request.title} (Copy)` : request.title,
    draft: false,
  };
}
