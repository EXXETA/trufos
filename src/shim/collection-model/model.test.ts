import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { RequestBodyType, TrufosRequest } from '../objects/request';
import { RequestMethod } from '../objects/request-method';
import { parseUrl } from '../objects/url';
import { AuthorizationType } from '../objects/auth';
import { Collection } from '../objects/collection';
import {
  assignChanges,
  getAncestorIds,
  getChildren,
  getDescendantIds,
  getTopLevelIds,
  isSelfOrDescendant,
  normalizeCollection,
} from './model';

function request(id: string, parentId: string): TrufosRequest {
  return {
    id,
    parentId,
    type: 'request',
    lastModified: 0,
    title: id,
    url: parseUrl('http://example.com'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
  };
}

/**
 * col
 * ├── f1
 * │   ├── r1
 * │   └── f2
 * │       └── r2
 * └── r3
 */
const collection: Collection = {
  id: 'col',
  type: 'collection',
  title: 'Collection',
  dirPath: '/col',
  lastModified: 0,
  variables: {},
  environments: {},
  children: [
    {
      id: 'f1',
      parentId: 'col',
      type: 'folder',
      lastModified: 0,
      title: 'f1',
      children: [
        request('r1', 'f1'),
        {
          id: 'f2',
          parentId: 'f1',
          type: 'folder',
          lastModified: 0,
          title: 'f2',
          children: [request('r2', 'f2')],
        },
      ],
    },
    request('r3', 'col'),
  ],
};

describe('assignChanges()', () => {
  it('replaces, removes and keeps fields depending on the change', () => {
    // Arrange
    const base = { ...request('r1', 'col'), auth: { type: AuthorizationType.INHERIT } as const };

    // Act
    const changed = produce(base, (draft) =>
      assignChanges(draft, { method: RequestMethod.PUT, auth: null, headers: undefined })
    );

    // Assert
    expect(changed.method).toBe(RequestMethod.PUT);
    expect('auth' in changed).toBe(false);
    expect(changed.headers).toBe(base.headers);
  });

  it('changes nothing for empty changes', () => {
    const base = request('r1', 'col');

    expect(produce(base, (draft) => assignChanges(draft, {}))).toBe(base);
  });
});

describe('getChildren()', () => {
  it('returns the nodes of a parent in order', () => {
    const model = normalizeCollection(collection);

    expect(getChildren(model, 'col').map(({ id }) => id)).toEqual(['f1', 'r3']);
    expect(getChildren(model, 'f1').map(({ id }) => id)).toEqual(['r1', 'f2']);
    expect(getChildren(model, 'r3')).toEqual([]);
  });

  it('skips child IDs without a node', () => {
    const model = normalizeCollection(collection);
    model.requests.delete('r1');

    expect(getChildren(model, 'f1').map(({ id }) => id)).toEqual(['f2']);
  });
});

describe('getDescendantIds()', () => {
  it('lists parents before their children', () => {
    expect(getDescendantIds(normalizeCollection(collection), 'f1')).toEqual(['r1', 'f2', 'r2']);
  });
});

describe('getAncestorIds()', () => {
  it('lists the folders containing a node, innermost first', () => {
    const model = normalizeCollection(collection);
    expect(getAncestorIds(model, 'r2')).toEqual(['f2', 'f1']);
    expect(getAncestorIds(model, 'r3')).toEqual([]);
    expect(getAncestorIds(model, 'missing')).toEqual([]);
  });
});

describe('isSelfOrDescendant()', () => {
  it('is true for the node itself and its descendants only', () => {
    const model = normalizeCollection(collection);
    expect(isSelfOrDescendant(model, 'f1', 'f1')).toBe(true);
    expect(isSelfOrDescendant(model, 'r2', 'f1')).toBe(true);
    expect(isSelfOrDescendant(model, 'r3', 'f1')).toBe(false);
    expect(isSelfOrDescendant(model, 'f1', 'f2')).toBe(false);
  });
});

describe('getTopLevelIds()', () => {
  it('drops the IDs inside a folder that is given as well', () => {
    const model = normalizeCollection(collection);
    expect(getTopLevelIds(model, ['r2', 'f1', 'r3'])).toEqual(['f1', 'r3']);
    expect(getTopLevelIds(model, ['r1', 'f2'])).toEqual(['r1', 'f2']);
  });
});
