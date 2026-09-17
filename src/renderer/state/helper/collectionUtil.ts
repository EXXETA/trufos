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
  if (scriptType == null) return;
  const model = getScriptModel(requestId, scriptType);
  if (request != null) {
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

/**
 * Returns true if any ancestor folder of `itemId` is itself present in `selectedIds`.
 * Used to filter a multi-selection down to its "top-level" members before a bulk action,
 * so a selected folder's already-selected descendants aren't acted on a second time.
 */
export function hasSelectedAncestor(
  itemId: string,
  selectedIds: Set<string>,
  requests: Map<TrufosRequest['id'], TrufosRequest>,
  folders: Map<Folder['id'], Folder>
): boolean {
  let parentId = requests.get(itemId)?.parentId ?? folders.get(itemId)?.parentId;

  while (parentId != null) {
    if (selectedIds.has(parentId)) return true;
    const parentFolder = folders.get(parentId);
    if (parentFolder == null) return false; // reached the collection root
    parentId = parentFolder.parentId;
  }

  return false;
}

/**
 * Filters `selectedIds` down to its top-level members: ids that are not descendants of
 * another selected folder. A bulk action loops over only these, since deleting/duplicating a
 * selected folder already covers its own (also-selected) descendants.
 */
export function getTopLevelSelectedIds(
  selectedIds: Set<TrufosRequest['id'] | Folder['id']>,
  requests: Map<TrufosRequest['id'], TrufosRequest>,
  folders: Map<Folder['id'], Folder>
): (TrufosRequest['id'] | Folder['id'])[] {
  return [...selectedIds].filter((id) => !hasSelectedAncestor(id, selectedIds, requests, folders));
}
