import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { RequestMethod } from '../objects/request-method';
import { AuthorizationType } from '../objects/auth';
import {
  assignChanges,
  getAncestorIds,
  getChildren,
  getDescendantIds,
  getTopLevelIds,
  isSelfOrDescendant,
  normalizeCollection,
  walkTree,
} from './model';
import { makeExampleCollection, makeRequest } from './fixtures';

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
