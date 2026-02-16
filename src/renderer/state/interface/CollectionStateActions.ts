import { editor } from 'monaco-editor';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { RequestBody, TrufosRequest } from 'shim/objects/request';

export interface CollectionStateActions {
  initialize(collection: Collection): void;

  /**
   * Change the current collection to the given collection. Will save any unsaved changes
   * @param collection the collection or collection directory path to open
   */
  changeCollection(collection: Collection | string): Promise<void>;

  addNewRequest(title?: string, parentId?: string): Promise<void>;

  /**
   * Replace the current request with the updated request
   * @param request The new request content
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: TrufosRequest, overwrite: true): void;

  /**
   * Merge the current request with the updated request. This will also set the draft flag on the request
   * @param request The properties to update
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: Partial<TrufosRequest>, overwrite?: false): void;

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
   * Set the editor instance for text-based request bodies
   * @param requestEditor The editor instance
   */
  setRequestEditor(requestEditor?: editor.ICodeEditor): void;

  /**
   * Format the text in the request editor.
   * This will only work if the request editor is set and the request body type is text-based.
   */
  formatRequestEditorText(): Promise<void>;

  setSelectedRequest(id?: TrufosRequest['id']): Promise<void>;

  deleteRequest(id: TrufosRequest['id']): Promise<void>;

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
  copyRequest(id: TrufosRequest['id']): void;

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

  /**
   * Set the draft flag on the currently selected request
   */
  setDraftFlag(): void;

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
  renameFolder(id: Folder['id'], title: string): Promise<void>;

  /**
   * Copy a folder with all its children.
   *
   * @param id The id of the folder to copy.
   */
  copyFolder(id: Folder['id']): void;

  /** For functionality of the sidebar */
  /**
   * needed for rerendering of th sidebar
   * @param id the folder id
   */
  isFolderOpen(id: Folder['id']): boolean;

  /**
   * must be set manually that the rendering of the sidebar open the folders correctly
   * @param id the folder id
   */
  setFolderOpen(id: Folder['id']): void;

  /**
   * needed for rerendering of the sidebar
   * @param id the folder id
   */
  setFolderClose(id: Folder['id']): void;

  /**
   * Update the authorization information of the given object.
   * @param object The object for which the authorization information should be updated.
   * @param updatedFields The fields to update in the authorization information. If null, the authorization information will be cleared.
   */
  updateAuthorization<T extends Collection | TrufosRequest>(
    object: T,
    updatedFields?: Partial<T['auth']> | null
  ): void;

  /**
   * Rename the currently opened collection.
   *
   * @param title The new title of the collection.
   */
  renameCollection(title: string): Promise<void>;

  /**
   * Close the currently opened collection.
   * This will clear the current collection from memory
   * and reset related state in the application, but will not
   * delete the collection from the file system.
   *
   * @param dirPath Optional path of the collection to close.
   */
  closeCollection(dirPath?: string): Promise<void>;

  moveItem(itemId: string, newParentId: string, position: number): Promise<void>;
}
