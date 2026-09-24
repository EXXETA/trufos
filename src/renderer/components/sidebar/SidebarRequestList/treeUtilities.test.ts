import { describe, it, expect } from 'vitest';
import { getGroupMoveTargets, getMaxTimestamp, getRangeSelection } from './treeUtilities';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';

const makeRequest = (id: string, lastModified = 0): TrufosRequest =>
  ({
    id,
    type: 'request',
    parentId: 'parent',
    title: id,
    lastModified,
    url: { base: '', query: [] },
    method: 'GET',
    headers: [],
    body: { type: 'text', mimeType: 'text/plain' },
  }) as unknown as TrufosRequest;

const makeFolder = (
  id: string,
  children: (TrufosRequest | Folder)[] = [],
  lastModified = 0
): Folder =>
  ({
    id,
    type: 'folder',
    parentId: 'parent',
    title: id,
    lastModified,
    children,
  }) as unknown as Folder;

describe('getMaxTimestamp', () => {
  it('returns the timestamp for a request', () => {
    const req = makeRequest('req-1', 1000);
    const requests = new Map([['req-1', req]]);
    const folders = new Map<string, Folder>();

    expect(getMaxTimestamp(req, requests, folders)).toBe(1000);
  });

  it('returns 0 for a request with no entry in requests map', () => {
    const req = makeRequest('req-1', 0);
    const requests = new Map<string, TrufosRequest>();
    const folders = new Map<string, Folder>();

    expect(getMaxTimestamp(req, requests, folders)).toBe(0);
  });

  it('returns max timestamp of direct children for a folder', () => {
    const req1 = makeRequest('req-1', 500);
    const req2 = makeRequest('req-2', 1500);
    const folder = makeFolder('folder-1', [req1, req2]);

    const requests = new Map([
      ['req-1', req1],
      ['req-2', req2],
    ]);
    const folders = new Map([['folder-1', folder]]);

    expect(getMaxTimestamp(folder, requests, folders)).toBe(1500);
  });

  it('returns 0 for an empty folder', () => {
    const folder = makeFolder('folder-1', [], 0);
    const requests = new Map<string, TrufosRequest>();
    const folders = new Map([['folder-1', folder]]);

    expect(getMaxTimestamp(folder, requests, folders)).toBe(0);
  });

  it('returns 0 for a folder not found in the folders map', () => {
    const folder = makeFolder('folder-1', [makeRequest('req-1')], 0);
    const requests = new Map<string, TrufosRequest>();
    const folders = new Map<string, Folder>(); // folder-1 not in map

    expect(getMaxTimestamp(folder, requests, folders)).toBe(0);
  });

  it('returns max timestamp recursively for nested folders', () => {
    const req1 = makeRequest('req-1', 100);
    const req2 = makeRequest('req-2', 9000);
    const innerFolder = makeFolder('inner', [req2]);
    const outerFolder = makeFolder('outer', [req1, innerFolder]);

    const requests = new Map([
      ['req-1', req1],
      ['req-2', req2],
    ]);
    const folders = new Map([
      ['outer', outerFolder],
      ['inner', innerFolder],
    ]);

    expect(getMaxTimestamp(outerFolder, requests, folders)).toBe(9000);
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

describe('getGroupMoveTargets', () => {
  it('returns an empty list when there are no other ids', () => {
    expect(getGroupMoveTargets({ parentId: 'col-1', newIndex: 2 }, [])).toEqual([]);
  });

  it('places each other id right after the active item, in the same parent', () => {
    const result = getGroupMoveTargets({ parentId: 'col-1', newIndex: 2 }, ['b', 'c']);

    expect(result).toEqual([
      { id: 'b', parentId: 'col-1', newIndex: 3 },
      { id: 'c', parentId: 'col-1', newIndex: 4 },
    ]);
  });

  it('preserves the given relative order of the other ids', () => {
    const result = getGroupMoveTargets({ parentId: 'folder-a', newIndex: 0 }, ['z', 'a', 'm']);

    expect(result.map((target) => target.id)).toEqual(['z', 'a', 'm']);
  });
});
