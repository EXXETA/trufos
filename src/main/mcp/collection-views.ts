import {
  type CollectionModel,
  getAncestorIds,
  getChildren,
  getNode,
  type TreeNode,
  walkTree,
} from 'shim/collection-model';
import type { AuthorizationInformation } from 'shim/objects/auth';
import type { TrufosHeader } from 'shim/objects/headers';
import type { TrufosQueryParam } from 'shim/objects/query-param';
import { type RequestBody, RequestBodyType, type TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { maskAuthorization } from './redaction';

/*
 * What the MCP tools return about the open collection. These are plain data, so the tools return
 * them as JSON.
 */

/** A request or folder in the tree of the collection. */
export type TreeEntry =
  | { type: 'folder'; id: string; title: string; children: TreeEntry[] }
  | { type: 'request'; id: string; title: string; method: string; url: string; draft: boolean };

/**
 * @param model the open collection
 * @param parentId the collection or folder whose children to describe
 * @returns the folders and requests below the parent, in order
 */
export function describeTree(model: CollectionModel, parentId = model.collection.id): TreeEntry[] {
  return getChildren(model, parentId).map((node) =>
    node.type === 'folder'
      ? { type: 'folder', id: node.id, title: node.title, children: describeTree(model, node.id) }
      : {
          type: 'request',
          id: node.id,
          title: node.title,
          method: node.method,
          url: buildUrl(node.url),
          draft: node.draft === true,
        }
  );
}

/**
 * @param model the open collection
 * @param id the ID of a request or folder
 * @returns the titles of the folders that contain it, outermost first, joined with ` / `. Empty at
 * the top level.
 */
export function getFolderPath(model: CollectionModel, id: string): string {
  return getAncestorIds(model, id)
    .reverse()
    .map((folderId) => model.folders.get(folderId)?.title ?? folderId)
    .join(' / ');
}

/** A request as it is returned to a client, see {@link describeRequest}. */
export interface RequestDescription {
  id: string;
  title: string;
  parentId: string;
  folderPath: string;
  method: string;
  url: string;
  query: TrufosQueryParam[];
  headers: TrufosHeader[];
  disabledHeaders: string[];
  /** A text body without its text, which is read with a tool of its own. */
  body: RequestBody;
  /** The authorization with its credentials masked. */
  auth?: AuthorizationInformation;
  draft: boolean;
  /** Whether the request was never saved. Discarding its draft deletes it. */
  neverSaved: boolean;
}

/**
 * Describes a request with its masked authorization. The text body and the scripts are not part of
 * it, as they may be large; they are read with tools of their own.
 * @param model the open collection
 * @param request the request
 */
export function describeRequest(
  model: CollectionModel,
  request: TrufosRequest
): RequestDescription {
  const { body } = request;
  return {
    id: request.id,
    title: request.title,
    parentId: request.parentId,
    folderPath: getFolderPath(model, request.id),
    method: request.method,
    url: buildUrl(request.url),
    query: request.url.query,
    headers: request.headers,
    disabledHeaders: request.disabledHeaders ?? [],
    body: body.type === RequestBodyType.TEXT ? { type: body.type, mimeType: body.mimeType } : body,
    auth: request.auth != null ? maskAuthorization(request.auth) : undefined,
    draft: request.draft === true,
    neverSaved: request.draft === true && !model.savedRequests.has(request.id),
  };
}

/** A request or folder that matches a search. */
export interface SearchResult {
  type: TreeNode['type'];
  id: string;
  title: string;
  method?: string;
  url?: string;
  folderPath: string;
}

/**
 * Finds the requests and folders whose title, URL or method contain every term of the query,
 * ignoring case. The URL is the stored template, not the resolved URL.
 * @param model the open collection
 * @param query the terms, separated by whitespace
 * @param limit the maximum number of results
 * @returns the matches in the order of the tree
 */
export function searchCollection(
  model: CollectionModel,
  query: string,
  limit: number
): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];
  walkTree(model, model.collection.id, (id) => {
    const node = getNode(model, id);
    if (node == null || results.length >= limit) return false;
    const fields =
      node.type === 'folder' ? [node.title] : [node.title, buildUrl(node.url), node.method];
    const haystack = fields.join('\n').toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return;
    results.push({
      type: node.type,
      id: node.id,
      title: node.title,
      ...(node.type === 'request' ? { method: node.method, url: buildUrl(node.url) } : {}),
      folderPath: getFolderPath(model, node.id),
    });
  });
  return results;
}
