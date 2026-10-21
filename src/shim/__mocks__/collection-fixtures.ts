/*
 * Builders for the objects of a collection, shared by the tests of all processes.
 */
import { Collection } from '../objects/collection';
import { Folder } from '../objects/folder';
import { RequestBodyType, TrufosRequest } from '../objects/request';
import { RequestMethod } from '../objects/request-method';
import { parseUrl } from '../objects/url';
import { CollectionModel, normalizeCollection } from '../collection-model/model';
import { AutomaticHeader, AutomaticHeaderKey, InheritedHeader } from '../collection-model/headers';

export function makeRequest(
  id: string,
  parentId: string,
  overrides: Partial<TrufosRequest> = {}
): TrufosRequest {
  return {
    id,
    parentId,
    type: 'request',
    lastModified: 0,
    title: id,
    url: parseUrl('http://localhost'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
    ...overrides,
  };
}

export function makeFolder(
  id: string,
  parentId: string,
  children: Folder['children'] = []
): Folder {
  return { id, parentId, type: 'folder', lastModified: 0, title: id, children };
}

export function makeCollection(
  id: string,
  children: Collection['children'] = [],
  overrides: Partial<Collection> = {}
): Collection {
  return {
    id,
    type: 'collection',
    title: 'Test',
    dirPath: `/${id}`,
    lastModified: 0,
    variables: {},
    environments: {},
    children,
    ...overrides,
  };
}

/**
 * The example collection most tests use:
 *
 * col
 * ├── f1
 * │   ├── r1
 * │   └── f2
 * │       └── r2
 * └── r3
 */
export function makeExampleCollection(overrides: Partial<Collection> = {}): Collection {
  return makeCollection(
    'col',
    [
      makeFolder('f1', 'col', [
        makeRequest('r1', 'f1'),
        makeFolder('f2', 'f1', [makeRequest('r2', 'f2')]),
      ]),
      makeRequest('r3', 'col'),
    ],
    overrides
  );
}

/** The model of the {@link makeExampleCollection example collection}. */
export function makeModel(overrides: Partial<Collection> = {}): CollectionModel {
  return normalizeCollection(makeExampleCollection(overrides));
}

/** The collection that {@link makeInheritedHeader} headers are inherited from. */
const INHERITED_HEADER_SOURCE = makeModel({ title: 'Collection' }).collection;

/** Builds a header that is inherited from the collection, see `getInheritedHeaders()`. */
export function makeInheritedHeader(
  key: string,
  value: string,
  flags: Partial<Pick<InheritedHeader, 'isOverridden' | 'isDisabled'>> = {}
): InheritedHeader {
  return {
    header: { key, value, isActive: true },
    source: INHERITED_HEADER_SOURCE,
    isOverridden: false,
    isDisabled: false,
    ...flags,
  };
}

/** Builds a header that Trufos sets itself, see `getAutomaticHeaders()`. */
export function makeAutomaticHeader(
  key: AutomaticHeaderKey,
  value?: string,
  overrides: Partial<Omit<AutomaticHeader, 'key' | 'value'>> = {}
): AutomaticHeader {
  return {
    key,
    value,
    canDisable: true,
    isConditional: false,
    isOverridden: false,
    isDisabled: false,
    ...overrides,
  };
}
