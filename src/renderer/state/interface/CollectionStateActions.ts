import { Collection } from 'shim/objects/collection';
import { RequestBody, TrufosRequest } from 'shim/objects/request';
import { TrufosHeader } from 'shim/objects/headers';
import { editor } from 'monaco-editor';

export interface CollectionStateActions {
  initialize(collection: Collection): void;

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

  setRequestBody(payload: RequestBody): void;

  setRequestEditor(requestEditor?: editor.ICodeEditor): void;

  setSelectedRequest(id?: TrufosRequest['id']): Promise<void>;

  deleteRequest(id: TrufosRequest['id']): Promise<void>;

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
   * Set the draft flag on the currently selected request
   */
  setDraftFlag(): void;

  /**
   * needed for rerendering of th sidebar
   * @param id
   */
  isFolderOpen(id: string): boolean;

  /**
   * must be set manually that the rendering of the sidebar open the folders correctly
   * @param id
   * @param isOpen
   */
  setFolderOpen(id: string, isOpen: boolean): void;
}
