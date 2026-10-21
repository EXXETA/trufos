import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { RequestMethod } from '../objects/request-method';
import { AuthorizationType } from '../objects/auth';
import {
  assignChanges,
  emptyToNull,
  getAncestorIds,
  getChildren,
  getAuthorizationSource,
  getInheritanceChain,
  getInheritedHeaders,
  getDescendantIds,
  getParentFolderIds,
  getTopLevelIds,
  isSelfOrDescendant,
  normalizeCollection,
  resolveAuthorization,
  resolveHeaders,
  walkTree,
} from './model';
import { makeExampleCollection, makeRequest } from '../__mocks__/collection-fixtures';

/** See {@link makeExampleCollection}. */
const collection = makeExampleCollection({ title: 'Collection' });

describe('assignChanges()', () => {
  it('replaces, removes and keeps fields depending on the change', () => {
    // Arrange
    const base = {
      ...makeRequest('r1', 'col'),
      auth: { type: AuthorizationType.INHERIT } as const,
    };

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
    const base = makeRequest('r1', 'col');

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

describe('walkTree()', () => {
  it('visits parents before their children with their depth and ancestors', () => {
    const visited: [string, number, readonly string[]][] = [];

    walkTree(normalizeCollection(collection), 'col', (id, depth, ancestorIds) => {
      visited.push([id, depth, ancestorIds]);
    });

    expect(visited).toEqual([
      ['f1', 0, []],
      ['r1', 1, ['f1']],
      ['f2', 1, ['f1']],
      ['r2', 2, ['f1', 'f2']],
      ['r3', 0, []],
    ]);
  });

  it('skips the children of a folder if the visitor returns false and sorts the children', () => {
    const visited: string[] = [];

    walkTree(
      normalizeCollection(collection),
      'col',
      (id) => {
        visited.push(id);
        return id !== 'f2';
      },
      (a, b) => b.localeCompare(a)
    );

    expect(visited).toEqual(['r3', 'f1', 'r1', 'f2']);
  });
});

describe('getAncestorIds()', () => {
  it('lists the folders containing a node, innermost first', () => {
    const model = normalizeCollection(collection);
    expect(getAncestorIds(model, 'r2')).toEqual(['f2', 'f1']);
    expect(getAncestorIds(model, 'r3')).toEqual([]);
    expect(getAncestorIds(model, 'missing')).toEqual([]);
  });

  it('gives the same answers from the parent folder index as from the nodes', () => {
    const model = normalizeCollection(collection);
    const parentFolderIds = getParentFolderIds(model);

    for (const id of ['f1', 'r1', 'f2', 'r2', 'r3', 'missing']) {
      expect(getAncestorIds(parentFolderIds, id)).toEqual(getAncestorIds(model, id));
    }
    expect(getTopLevelIds(parentFolderIds, ['r2', 'f1', 'r3'])).toEqual(['f1', 'r3']);
    expect(isSelfOrDescendant(parentFolderIds, 'r2', 'f1')).toBe(true);
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

describe('getAuthorizationSource()', () => {
  const folderAuth = { type: AuthorizationType.BEARER, token: 'folder' } as const;
  const collectionAuth = { type: AuthorizationType.BEARER, token: 'collection' } as const;

  it('returns the collection if no folder above has an authorization', () => {
    const model = normalizeCollection({ ...collection, auth: collectionAuth });

    expect(getAuthorizationSource(model, 'f2')).toBe(model.collection);
    expect(getAuthorizationSource(model, 'col')).toBe(model.collection);
  });

  it('returns the closest folder that has an authorization', () => {
    const model = produce(normalizeCollection({ ...collection, auth: collectionAuth }), (draft) => {
      draft.folders.get('f1')!.auth = folderAuth;
    });

    expect(getAuthorizationSource(model, 'f2')).toBe(model.folders.get('f1'));
    expect(getAuthorizationSource(model, 'f1')).toBe(model.folders.get('f1'));
  });
});

describe('resolveAuthorization()', () => {
  const folderAuth = { type: AuthorizationType.BEARER, token: 'folder' } as const;
  const collectionAuth = { type: AuthorizationType.BEARER, token: 'collection' } as const;
  const inherit = { type: AuthorizationType.INHERIT } as const;

  it('returns the own authorization of a node that does not inherit', () => {
    const model = normalizeCollection({ ...collection, auth: collectionAuth });

    expect(resolveAuthorization(model, { auth: folderAuth, parentId: 'f2' })).toBe(folderAuth);
    expect(resolveAuthorization(model, { parentId: 'f2' })).toBeUndefined();
  });

  it('returns the authorization of the closest folder that has one', () => {
    const model = produce(normalizeCollection({ ...collection, auth: collectionAuth }), (draft) => {
      draft.folders.get('f1')!.auth = folderAuth;
    });

    expect(resolveAuthorization(model, { auth: inherit, parentId: 'f2' })).toEqual(folderAuth);
    expect(resolveAuthorization(model, { auth: inherit, parentId: 'col' })).toEqual(collectionAuth);
  });

  it('returns undefined if neither a folder above nor the collection has an authorization', () => {
    const model = normalizeCollection(collection);

    expect(resolveAuthorization(model, { auth: inherit, parentId: 'f2' })).toBeUndefined();
  });
});

describe('getInheritanceChain()', () => {
  it('returns the folders above a node, closest first, followed by the collection', () => {
    const model = normalizeCollection(collection);

    expect(getInheritanceChain(model, 'f2').map(({ id }) => id)).toEqual(['f2', 'f1', 'col']);
    expect(getInheritanceChain(model, 'col').map(({ id }) => id)).toEqual(['col']);
  });
});

describe('getInheritedHeaders()', () => {
  const header = (key: string, value: string, isActive = true) => ({ key, value, isActive });

  it('combines the headers of the collection and the folders above, closer levels overriding', () => {
    const model = produce(
      normalizeCollection({
        ...collection,
        headers: [header('X-Collection', 'c'), header('X-Shared', 'c'), header('X-Shared', 'c2')],
      }),
      (draft) => {
        draft.folders.get('f1')!.headers = [header('x-shared', 'f1'), header('X-Off', 'f1', false)];
        draft.folders.get('f2')!.headers = [header('X-Inner', 'f2'), header(' ', 'blank')];
      }
    );

    const inherited = getInheritedHeaders(model, { parentId: 'f2' });

    expect(inherited.map(({ header }) => header)).toEqual([
      header('X-Collection', 'c'),
      header('x-shared', 'f1'),
      header('X-Inner', 'f2'),
    ]);
    expect(inherited.map(({ source }) => source.id)).toEqual(['col', 'f1', 'f2']);
  });

  it('marks the headers the node overrides with a sent header or disables', () => {
    const model = normalizeCollection({
      ...collection,
      headers: [header('X-Kept', 'c'), header('X-Disabled', 'c'), header('X-Overridden', 'c')],
    });

    const inherited = getInheritedHeaders(model, {
      parentId: 'f2',
      headers: [header('x-overridden', 'r'), header('X-Kept', 'inactive', false)],
      disabledInheritedHeaders: ['x-disabled'],
    });

    expect(inherited.map(({ isOverridden, isDisabled }) => [isOverridden, isDisabled])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ]);
  });

  it('returns nothing if no level has headers', () => {
    expect(getInheritedHeaders(normalizeCollection(collection), { parentId: 'f2' })).toEqual([]);
  });
});

describe('resolveHeaders()', () => {
  const header = (key: string, value: string, isActive = true) => ({ key, value, isActive });
  const model = normalizeCollection({
    ...collection,
    headers: [header('X-Kept', 'c'), header('X-Disabled', 'c'), header('X-Overridden', 'c')],
  });

  it('sends the inherited headers that are neither disabled nor overridden, then its own', () => {
    const headers = resolveHeaders(model, {
      parentId: 'f2',
      headers: [header('x-overridden', 'r'), header('X-Kept', 'inactive', false)],
      disabledInheritedHeaders: ['x-disabled'],
    });

    expect(headers).toEqual([header('X-Kept', 'c'), header('x-overridden', 'r')]);
  });
});

describe('emptyToNull()', () => {
  it('turns an empty list into null and keeps other lists', () => {
    const list = [1];

    expect(emptyToNull([])).toBeNull();
    expect(emptyToNull(list)).toBe(list);
  });
});
