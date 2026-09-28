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
 * Filters `selectedIds` down to its top-level members: items that are not descendants of
 * another selected folder, resolved to their full request/folder objects. A bulk action loops
 * over only these, since deleting/duplicating a selected folder already covers its own
 * (also-selected) descendants.
 */
export function getTopLevelSelectedItems(
  selectedIds: Set<TrufosRequest['id'] | Folder['id']>,
  requests: Map<TrufosRequest['id'], TrufosRequest>,
  folders: Map<Folder['id'], Folder>
): (TrufosRequest | Folder)[] {
  return [...selectedIds]
    .filter((id) => !hasSelectedAncestor(id, selectedIds, requests, folders))
    .map((id) => requests.get(id) ?? folders.get(id))
    .filter((item): item is TrufosRequest | Folder => item != null);
}

/**
 * Returns the insertion index that places `movingId` directly after `afterId` among `children`,
 * matching `moveItem`'s index semantics: for a same-parent move the item is spliced out before
 * being re-inserted, so the index is computed with `movingId` filtered out; for a cross-parent
 * move `movingId` isn't in `children` and the filter is a no-op. Returns 0 if `afterId` is not
 * among `children`.
 */
export function getIndexAfter(
  children: { id: string }[],
  movingId: string,
  afterId: string
): number {
  return children.filter((child) => child.id !== movingId).findIndex((c) => c.id === afterId) + 1;
}

/**
 * Returns true if `targetParentId` is one of `groupIds` or a descendant of one of them. A group
 * move into such a parent would nest a group member inside itself (a tree cycle), so it must be
 * rejected before any item is moved.
 */
export function isWithinGroup(
  targetParentId: string,
  groupIds: Set<string>,
  requests: Map<TrufosRequest['id'], TrufosRequest>,
  folders: Map<Folder['id'], Folder>
): boolean {
  return (
    groupIds.has(targetParentId) || hasSelectedAncestor(targetParentId, groupIds, requests, folders)
  );
}
