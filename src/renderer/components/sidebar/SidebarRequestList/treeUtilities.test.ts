import { describe, it, expect } from 'vitest';
import { flattenTree, getMaxTimestamps, getRangeSelection } from './treeUtilities';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { makeCollection, makeFolder, makeRequest } from '@/__mocks__/fake-collection-main';

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

describe('getMaxTimestamps', () => {
  it('returns the timestamp for a request', () => {
    const t = tree([request('req-1', 'col', 1000)]);

    expect(getMaxTimestamps(t, 'col').get('req-1')).toBe(1000);
  });

  it('returns max timestamp of direct children for a folder', () => {
    const t = tree([
      folder('folder-1', 'col', [
        request('req-1', 'folder-1', 500),
        request('req-2', 'folder-1', 1500),
      ]),
    ]);

    expect(getMaxTimestamps(t, 'col').get('folder-1')).toBe(1500);
  });

  it('returns the folder timestamp for an empty folder', () => {
    const t = tree([folder('folder-1', 'col', [], 42)]);

    expect(getMaxTimestamps(t, 'col').get('folder-1')).toBe(42);
  });

  it('returns max timestamp recursively for nested folders', () => {
    const t = tree([
      folder('outer', 'col', [
        request('req-1', 'outer', 100),
        folder('inner', 'outer', [request('req-2', 'inner', 9000)]),
      ]),
    ]);

    const timestamps = getMaxTimestamps(t, 'col');
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
    const items = flattenTree(t, 'col', new Set(), (a, b) => a.title.localeCompare(b.title));

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
