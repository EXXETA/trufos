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
   * @param collection The collection to change to
   */
  changeCollection(collection: Collection): void;

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
   * @param id
   * @param title
   */
  renameRequest(id: TrufosRequest['id'], title: string): void;

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
   */
  toggleQueryParam(index: number): void;

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
   * @param id
   * @param title
   */
  renameFolder(id: Folder['id'], title: string): void;

  /** For functionality of the sidebar */
  /**
   * needed for rerendering of th sidebar
   * @param id
   */
  isFolderOpen(id: string): boolean;

  /**
   * must be set manually that the rendering of the sidebar open the folders correctly
   * @param id
   */
  setFolderOpen(id: string): void;

  /**
   * needed for rerendering of th sidebar
   * @param id
   */
  setFolderClose(id: string): void;
}
