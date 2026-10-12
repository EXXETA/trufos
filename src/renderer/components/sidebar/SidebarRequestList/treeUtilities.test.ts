import { describe, it, expect } from 'vitest';
import { CollectionTree, flattenTree, getMaxTimestamp, getRangeSelection } from './treeUtilities';
import { FolderInfo } from 'shim/collection-model';
import { TrufosRequest } from 'shim/objects/request';
import { makeRequest } from '@/__mocks__/fake-collection-main';

const request = (id: string, parentId: string, lastModified = 0): TrufosRequest =>
  makeRequest(id, parentId, { lastModified });

const folder = (id: string, parentId: string, lastModified = 0): FolderInfo => ({
  id,
  type: 'folder',
  parentId,
  title: id,
  lastModified,
});

const tree = (nodes: (TrufosRequest | FolderInfo)[]): CollectionTree => {
  const childIds = new Map<string, string[]>([['col', []]]);
  for (const node of nodes) {
    if (node.type === 'folder') childIds.set(node.id, childIds.get(node.id) ?? []);
    childIds.set(node.parentId, [...(childIds.get(node.parentId) ?? []), node.id]);
  }
  return {
    childIds,
    requests: new Map(
      nodes.filter((node) => node.type === 'request').map((node) => [node.id, node])
    ),
    folders: new Map(nodes.filter((node) => node.type === 'folder').map((node) => [node.id, node])),
  };
};

describe('getMaxTimestamp', () => {
  it('returns the timestamp for a request', () => {
    const req = request('req-1', 'col', 1000);

    expect(getMaxTimestamp(req, tree([req]))).toBe(1000);
  });

  it('returns max timestamp of direct children for a folder', () => {
    const f = folder('folder-1', 'col');
    const t = tree([f, request('req-1', 'folder-1', 500), request('req-2', 'folder-1', 1500)]);

    expect(getMaxTimestamp(f, t)).toBe(1500);
  });

  it('returns the folder timestamp for an empty folder', () => {
    const f = folder('folder-1', 'col', 42);

    expect(getMaxTimestamp(f, tree([f]))).toBe(42);
  });

  it('returns max timestamp recursively for nested folders', () => {
    const outer = folder('outer', 'col');
    const t = tree([
      outer,
      request('req-1', 'outer', 100),
      folder('inner', 'outer'),
      request('req-2', 'inner', 9000),
    ]);

    expect(getMaxTimestamp(outer, t)).toBe(9000);
  });
});

describe('flattenTree', () => {
  const t = tree([
    folder('b-folder', 'col'),
    request('nested', 'b-folder'),
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
