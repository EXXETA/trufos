import { FolderInfo, RequestChanges } from 'shim/collection-model';
import { AuthorizationInformation, AuthorizationInformationNoInherit } from 'shim/objects/auth';
import { ClientCertificate } from 'shim/objects/collection';
import { EnvironmentMap } from 'shim/objects/environment';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { FormDataBody, RequestBody, TrufosRequest } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { ScriptType } from 'shim/scripting';
import { SortMode } from '@/components/sidebar/SidebarRequestList/treeUtilities';

type FormDataField = FormDataBody['fields'][number];

/**
 * The actions of the collection store. Every change to the collection is sent to the main process
 * as a command; the store shows it at once and is corrected by the patches main broadcasts.
 */
export interface CollectionStateActions {
  /**
   * Open the collection in the given directory. Unsaved editor changes are sent to main first. The
   * store is updated by the snapshot main broadcasts.
   * @param dirPath the directory path of the collection to open
   */
  changeCollection(dirPath: string): Promise<void>;

  /**
   * Create a new request that was never saved, and select it.
   * @param title the title of the request. A random one if not given.
   * @param parentId the folder to create it in. Defaults to the collection.
   */
  addNewRequest(title?: string, parentId?: string): Promise<void>;

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

  setSelectedRequest(id?: TrufosRequest['id']): void;

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
  toggleItemSelected(id: TrufosRequest['id'] | FolderInfo['id']): void;

  /**
   * Replace the sidebar's multi-selection with the given ids.
   * @param ids the request/folder ids to select
   */
  setSelection(ids: Iterable<TrufosRequest['id'] | FolderInfo['id']>): void;

  /**
   * Union the given ids into the sidebar's existing multi-selection, without removing any
   * currently-selected id.
   * @param ids the request/folder ids to add to the selection
   */
  addToSelection(ids: Iterable<TrufosRequest['id'] | FolderInfo['id']>): void;

  /**
   * Clear the sidebar's multi-selection.
   */
  clearSelection(): void;

  /**
   * Delete every top-level id in the sidebar's multi-selection (a selected folder's
   * already-selected descendants are not deleted a second time), then clear the selection.
   */
  deleteSelectedItems(): Promise<void>;

  /**
   * Duplicate every top-level id in the sidebar's multi-selection (a selected folder's
   * already-selected descendants are not duplicated a second time), then clear the selection.
   */
  duplicateSelectedItems(): Promise<void>;

  deleteRequest(id: TrufosRequest['id']): Promise<void>;

  /**
   * Discard the draft of the currently selected request. A request that was never saved is
   * deleted.
   */
  discardChanges(): Promise<void>;

  /**
   * Save the draft of the given request. Unsaved editor changes are sent to main first.
   * @param id the request id
   */
  saveRequest(id: TrufosRequest['id']): Promise<void>;

  /**
   * Rename the request title
   * @param id the request id
   * @param title the new title of the request
   */
  renameRequest(id: TrufosRequest['id'], title: string): Promise<void>;

  /**
   * Copy a request.
   *
   * @param id The id of the request to copy.
   */
  copyRequest(id: TrufosRequest['id']): Promise<void>;

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
  addNewFolder(title?: string, parentId?: string): Promise<void>;

  /**
   * Delete the folder to the file system
   * @param id
   */
  deleteFolder(id: string): Promise<void>;

  /**
   * Rename the folder title
   * @param id the folder id
   * @param title the new title of the folder
   */
  renameFolder(id: FolderInfo['id'], title: string): Promise<void>;

  /**
   * Copy a folder with all its children.
   *
   * @param id The id of the folder to copy.
   */
  copyFolder(id: FolderInfo['id']): Promise<void>;

  /** For functionality of the sidebar */
  /**
   * needed for rerendering of th sidebar
   * @param id the folder id
   */
  isFolderOpen(id: FolderInfo['id']): boolean;

  /**
   * must be set manually that the rendering of the sidebar open the folders correctly
   * @param id the folder id
   */
  setFolderOpen(id: FolderInfo['id']): void;

  /**
   * needed for rerendering of the sidebar
   * @param id the folder id
   */
  setFolderClose(id: FolderInfo['id']): void;

  /**
   * Update the authorization information of the given request. If the type or the OAuth method
   * changes, the authorization is replaced by a complete default for the new type or method.
   * @param request The request for which the authorization information should be updated.
   * @param updatedFields The fields to update in the authorization information. If null, the authorization information will be cleared.
   */
  updateAuthorization(
    request: TrufosRequest,
    updatedFields?: Partial<AuthorizationInformation> | null
  ): void;

  /**
   * Set or remove the authorization of the current collection.
   * @param auth the authorization, or undefined to remove it
   */
  setCollectionAuth(auth?: AuthorizationInformationNoInherit): Promise<void>;

  /**
   * Replace the variables of the current collection.
   * @param variables The new variables
   */
  setVariables(variables: VariableMap): Promise<void>;

  /**
   * Replace the environments of the current collection.
   * @param environments The new environments
   */
  setEnvironments(environments: EnvironmentMap): Promise<void>;

  /**
   * Select the environment whose variables are used. Not persisted.
   * @param key the environment key, or undefined to select none
   */
  selectEnvironment(key?: string): Promise<void>;

  /**
   * Rename the currently opened collection.
   *
   * @param title The new title of the collection.
   */
  renameCollection(title: string): Promise<void>;

  /**
   * Close the currently opened collection.
   * This removes it from the list of recent collections and opens another one, but does not
   * delete it from the file system. The store is updated by the snapshot main broadcasts.
   *
   * @param dirPath Optional path of the collection to close.
   */
  closeCollection(dirPath?: string): Promise<void>;

  moveItem(itemId: string, newParentId: string, position: number): Promise<void>;

  /**
   * Move each of `ids`, in order, so they form a contiguous run directly after `afterId`
   * (the first id right after `afterId`, each next one right after the previous), under
   * whichever parent the preceding item currently lives in. Each position is computed from
   * fresh state right before its move, so earlier moves can't shift later targets.
   * Reuses `moveItem` for every step.
   *
   * Throws before moving anything if `afterId` doesn't exist or if its parent is one of `ids`
   * or a descendant of one (that would nest a moved item inside itself). Also throws, leaving
   * the earlier moves in place, if a previously-placed item can no longer be found.
   *
   * @param afterId The id of the anchor item the run is placed after.
   * @param ids The ids to move, in the order they should appear.
   */
  moveItemsAfter(afterId: string, ids: string[]): Promise<void>;

  /**
   * Update the client certificate of the current collection.
   * @param certificate The certificate to set, or null to clear it.
   */
  setClientCertificate(certificate: ClientCertificate | null): Promise<void>;
}
