import { describe, it, expect } from 'vitest';
import {
  flattenTree,
  getMaxTimestamps,
  getMoveIndex,
  getParentIds,
  getRangeSelection,
  getSortFields,
  getTopLevelIds,
  isSelfOrDescendant,
  selectRequestSortFields,
} from './treeUtilities';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { makeCollection, makeFolder, makeRequest } from 'shim/__mocks__/collection-fixtures';

const request = (id: string, parentId: string, lastModified = 0): TrufosRequest =>
  makeRequest(id, parentId, { lastModified });

const folder = (
  id: string,
  parentId: string,
  children: Folder['children'] = [],
  lastModified = 0
): Folder => ({ ...makeFolder(id, parentId, children), lastModified });

const tree = (children: Folder['children']): CollectionModel =>
  normalizeCollection(makeCollection('col', children));

const sortFieldsOf = (t: CollectionModel) => getSortFields(t, selectRequestSortFields(t.requests));

describe('selectRequestSortFields', () => {
  it('only changes when a sort field of a request changes', () => {
    const t = tree([request('req-1', 'col', 1)]);
    const edited = new Map(t.requests);
    edited.set('req-1', { ...t.requests.get('req-1')!, url: { base: 'http://edited', query: [] } });

    expect(selectRequestSortFields(edited)).toEqual(selectRequestSortFields(t.requests));
    expect(getSortFields(t, selectRequestSortFields(t.requests)).get('req-1')).toEqual({
      title: 'req-1',
      lastModified: 1,
    });
  });
});

describe('parent IDs', () => {
  const t = tree([
    folder('outer', 'col', [folder('inner', 'outer', [request('nested', 'inner')])]),
    request('top', 'col'),
  ]);
  const parentIds = getParentIds(t);

  it('keeps only the selected items that are not inside another selected folder', () => {
    expect(getTopLevelIds(parentIds, ['nested', 'outer', 'top'])).toEqual(['outer', 'top']);
  });

  it('tells whether an item is inside a folder', () => {
    expect(isSelfOrDescendant(parentIds, 'nested', 'outer')).toBe(true);
    expect(isSelfOrDescendant(parentIds, 'outer', 'outer')).toBe(true);
    expect(isSelfOrDescendant(parentIds, 'top', 'outer')).toBe(false);
  });
});

describe('getMaxTimestamps', () => {
  it('returns the timestamp for a request', () => {
    const t = tree([request('req-1', 'col', 1000)]);

    expect(getMaxTimestamps(t, 'col', sortFieldsOf(t)).get('req-1')).toBe(1000);
  });

  it('returns max timestamp of direct children for a folder', () => {
    const t = tree([
      folder('folder-1', 'col', [
        request('req-1', 'folder-1', 500),
        request('req-2', 'folder-1', 1500),
      ]),
    ]);

    expect(getMaxTimestamps(t, 'col', sortFieldsOf(t)).get('folder-1')).toBe(1500);
  });

  it('returns the folder timestamp for an empty folder', () => {
    const t = tree([folder('folder-1', 'col', [], 42)]);

    expect(getMaxTimestamps(t, 'col', sortFieldsOf(t)).get('folder-1')).toBe(42);
  });

  it('returns max timestamp recursively for nested folders', () => {
    const t = tree([
      folder('outer', 'col', [
        request('req-1', 'outer', 100),
        folder('inner', 'outer', [request('req-2', 'inner', 9000)]),
      ]),
    ]);

    const timestamps = getMaxTimestamps(t, 'col', sortFieldsOf(t));
    expect(timestamps.get('outer')).toBe(9000);
    expect(timestamps.get('inner')).toBe(9000);
    expect(timestamps.get('req-1')).toBe(100);
  });
});

describe('flattenTree', () => {
  const t = tree([
    folder('b-folder', 'col', [request('nested', 'b-folder')]),
    request('a-request', 'col'),
  ]);

  it('lists the children of open folders in order', () => {
    expect(flattenTree(t, 'col', new Set(['b-folder']))).toEqual([
      { id: 'b-folder', type: 'folder', depth: 0, parentId: 'col' },
      { id: 'nested', type: 'request', depth: 1, parentId: 'b-folder' },
      { id: 'a-request', type: 'request', depth: 0, parentId: 'col' },
    ]);
  });

  it('skips the children of closed folders', () => {
    expect(flattenTree(t, 'col', new Set()).map(({ id }) => id)).toEqual(['b-folder', 'a-request']);
  });

  it('sorts the children of each parent with the given function', () => {
    const items = flattenTree(t, 'col', new Set(), (a, b) => a.localeCompare(b));

    expect(items.map(({ id }) => id)).toEqual(['a-request', 'b-folder']);
  });
});

describe('getRangeSelection', () => {
  const ORDERED_IDS = ['a', 'b', 'c', 'd', 'e'];

  it('returns the inclusive range when anchor comes before target', () => {
    expect(getRangeSelection(ORDERED_IDS, 'b', 'd')).toEqual(['b', 'c', 'd']);
  });

  it('returns the inclusive range when target comes before anchor', () => {
    expect(getRangeSelection(ORDERED_IDS, 'd', 'b')).toEqual(['b', 'c', 'd']);
  });

  it('returns a single-item range when anchor and target are the same', () => {
    expect(getRangeSelection(ORDERED_IDS, 'c', 'c')).toEqual(['c']);
  });

  it('falls back to just the target when the anchor is not found', () => {
    expect(getRangeSelection(ORDERED_IDS, 'missing', 'c')).toEqual(['c']);
  });

  it('falls back to just the target when the target is not found', () => {
    expect(getRangeSelection(ORDERED_IDS, 'b', 'missing')).toEqual(['missing']);
  });
});

describe('getMoveIndex', () => {
  it('returns the drop index when only the dragged item moves', () => {
    // [p, a, q, b]: b dropped between a and q
    expect(getMoveIndex(['p', 'a', 'q', 'b'], 'b', 2, new Set(['b']))).toBe(2);
  });

  it('places the group after the last sibling before the drop position that stays', () => {
    // [p, b, q, c, r, a, s]: a dropped between b and q, b and c move along
    expect(
      getMoveIndex(['p', 'b', 'q', 'c', 'r', 'a', 's'], 'a', 2, new Set(['a', 'b', 'c']))
    ).toBe(1);
  });

  it('returns 0 when no staying sibling is before the drop position', () => {
    expect(getMoveIndex(['b', 'p'], 'a', 1, new Set(['a', 'b']))).toBe(0);
  });

  it('works for a dragged item from another parent', () => {
    expect(getMoveIndex(['p', 'q'], 'x', 1, new Set(['x', 'y']))).toBe(1);
  });
});
