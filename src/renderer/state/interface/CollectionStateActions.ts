import { CollectionChanges, RequestChanges } from 'shim/collection-model';
import { AuthorizationInformation } from 'shim/objects/auth';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { FormDataBody, RequestBody } from 'shim/objects/request';
import { TrufosId } from 'shim/objects/id';
import { TrufosResponse } from 'shim/objects/response';
import { ScriptType } from 'shim/scripting';
import { SortMode } from '@/components/sidebar/SidebarRequestList/treeUtilities';

type FormDataField = FormDataBody['fields'][number];

/**
 * The actions of the collection store. Every change to the collection is sent to the main process
 * as a command; the store shows it at once and is corrected by the patches main broadcasts.
 *
 * Async actions show their errors to the user themselves and resolve to false if they failed, so
 * callers can react to a failure without handling the error.
 */
export interface CollectionStateActions {
  /**
   * Open the collection in the given directory. Unsaved editor changes are sent to main first. The
   * store is updated by the snapshot main broadcasts.
   * @param dirPath the directory path of the collection to open
   */
  changeCollection(dirPath: string): Promise<boolean>;

  /**
   * Create a new collection and open it. Unsaved editor changes are sent to main first.
   * @param dirPath the directory of the new collection
   * @param title the title of the new collection
   */
  createCollection(dirPath: string, title: string): Promise<boolean>;

  /**
   * Create a new request that was never saved, and select it.
   * @param title the title of the request. A random one if not given.
   * @param parentId the folder to create it in. Defaults to the collection.
   */
  addNewRequest(title?: string, parentId?: string): Promise<boolean>;

  /**
   * Change the currently selected request. This creates a draft.
   * @param changes The properties to change
   */
  updateRequest(changes: RequestChanges): void;

  /**
   * Set the request body of the currently selected request
   * @param payload The new request body
   */
  setRequestBody(payload: RequestBody): void;

  /**
   * Set the mime type of the text-based request body.
   * @param mimeType The mime type to set, e.g. "application/json" or "text/plain"
   */
  setRequestBodyMimeType(mimeType?: string): void;

  /**
   * Select the given request, or none. The editor changes of the previously selected request are
   * sent to main and its editor models are disposed. The editor models of the selected request
   * are created and loaded.
   * @param id the request id, or undefined to select none
   * @returns a promise that resolves when main applied the editor changes of the previously
   * selected request, at once if there are none. It resolves to false if they could not be applied.
   */
  setSelectedRequest(id?: TrufosId): Promise<boolean>;

  /**
   * Set the currently active script type.
   * @param type The script type to switch to
   */
  setCurrentScriptType(type: ScriptType): void;

  setSortMode(mode: SortMode): void;

  /**
   * Toggle a request or folder's membership in the sidebar's multi-selection.
   * @param id the request or folder id
   */
  toggleItemSelected(id: TrufosId): void;

  /**
   * Replace the sidebar's multi-selection with the given ids.
   * @param ids the request/folder ids to select
   */
  setSelection(ids: Iterable<TrufosId>): void;

  /**
   * Union the given ids into the sidebar's existing multi-selection, without removing any
   * currently-selected id.
   * @param ids the request/folder ids to add to the selection
   */
  addToSelection(ids: Iterable<TrufosId>): void;

  /**
   * Clear the sidebar's multi-selection.
   */
  clearSelection(): void;

  /**
   * Delete every top-level id in the sidebar's multi-selection (a selected folder's
   * already-selected descendants are not deleted a second time) with a single command. The
   * selection is cleared at once.
   */
  deleteSelectedItems(): Promise<boolean>;

  /**
   * Duplicate every top-level id in the sidebar's multi-selection (a selected folder's
   * already-selected descendants are not duplicated a second time) with a single command. The
   * selection is cleared at once.
   */
  duplicateSelectedItems(): Promise<boolean>;

  /**
   * Delete a request, or a folder including its descendants. Their editor changes are dropped
   * and the selected request is deselected if it is one of them.
   * @param id the request or folder id
   */
  deleteItem(id: TrufosId): Promise<boolean>;

  /**
   * Rename a request or folder.
   * @param id the request or folder id
   * @param title the new title
   */
  renameItem(id: TrufosId, title: string): Promise<boolean>;

  /**
   * Copy a request, or a folder including its descendants, to the end of its parent. Unsaved
   * editor changes are sent to main first, as the copy captures the current state.
   * @param id the request or folder id
   */
  copyItem(id: TrufosId): Promise<boolean>;

  /**
   * Discard the draft of the currently selected request. A request that was never saved is
   * deleted.
   */
  discardChanges(): Promise<boolean>;

  /**
   * Save the draft of the given request. Unsaved editor changes are sent to main first.
   * @param id the request id
   */
  saveRequest(id: TrufosId): Promise<boolean>;

  /**
   * Send a request in its current state. Unsaved editor changes are sent to main first. Unlike the
   * other actions, errors are not shown but thrown, as callers show them differently.
   * @param id the request id
   * @param signal aborts the request
   * @returns the response, or null if the request was aborted
   * @throws {DisplayableError} if sending failed
   */
  sendRequest(id: TrufosId, signal?: AbortSignal): Promise<TrufosResponse | null>;

  /**
   * Add a new header to the currently selected request
   */
  addHeader(): void;

  /**
   * Update a header in the currently selected request
   * @param index The index of the header to update
   * @param updatedHeader The new header content
   */
  updateHeader(index: number, updatedHeader: Partial<TrufosHeader>): void;

  /**
   * Delete a header from the currently selected request
   * @param index The index of the header to delete
   */
  deleteHeader(index: number): void;

  /**
   * Clear all headers from the currently selected request and add a new empty header
   */
  clearHeaders(): void;

  /**
   * Add a new query parameter to the currently selected request
   */
  addQueryParam(): void;

  /**
   * Update a query parameter in the currently selected request
   * @param index The index of the query parameter to update
   * @param updatedParam The new query parameter content
   */
  updateQueryParam(index: number, updatedParam: Partial<TrufosQueryParam>): void;

  /**
   * Delete a query parameter from the currently selected request
   * @param index The index of the query parameter to delete
   */
  deleteQueryParam(index: number): void;

  /**
   * Clear all query parameters from the currently selected request and add a new empty query parameter
   */
  clearQueryParams(): void;

  /**
   * Toggle the active state of a query parameter
   * @param index The index of the query parameter to toggle
   * @param active OPTIONAL: If set, the query parameter will be set to this active state instead of toggling it
   */
  setQueryParamActive(index: number, active?: boolean): void;

  addFormDataField(): void;
  updateFormDataField(index: number, updatedField: Partial<FormDataField>): void;
  deleteFormDataField(index: number): void;

  /**
   * Add a new folder to the collection
   * @param title
   * @param parentId
   */
  addNewFolder(title?: string, parentId?: string): Promise<boolean>;

  /** For functionality of the sidebar */
  /**
   * needed for rerendering of th sidebar
   * @param id the folder id
   */
  isFolderOpen(id: TrufosId): boolean;

  /**
   * must be set manually that the rendering of the sidebar open the folders correctly
   * @param id the folder id
   */
  setFolderOpen(id: TrufosId): void;

  /**
   * needed for rerendering of the sidebar
   * @param id the folder id
   */
  setFolderClose(id: TrufosId): void;

  /**
   * Update the authorization of the selected request. If the type or the OAuth method changes,
   * the authorization is replaced by a complete default for the new type or method.
   * @param changes the fields to change, or null to remove the authorization
   */
  updateAuthorization(changes: Partial<AuthorizationInformation> | null): void;

  /**
   * Change the settings of the current collection. Settings that are not given stay unchanged.
   * @param changes the settings to change. `null` removes the client certificate or the
   * authorization.
   */
  updateCollection(changes: CollectionChanges): Promise<boolean>;

  /**
   * Select the environment whose variables are used. Not persisted.
   * @param key the environment key, or undefined to select none
   */
  selectEnvironment(key?: string): Promise<boolean>;

  /**
   * Close the currently opened collection.
   * This removes it from the list of recent collections and opens another one, but does not
   * delete it from the file system. The store is updated by the snapshot main broadcasts.
   *
   * @param dirPath Optional path of the collection to close.
   */
  closeCollection(dirPath?: string): Promise<boolean>;

  /**
   * Move requests and folders, in the given order, to the given index of a parent. None of them
   * may be inside another one or contain the parent.
   * @param ids the requests and folders to move
   * @param parentId the collection or folder to move them into
   * @param index the index among the children of the parent without the moved items
   */
  moveItems(ids: TrufosId[], parentId: TrufosId, index: number): Promise<boolean>;
}
