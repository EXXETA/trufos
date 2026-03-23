import { describe, it, expect } from 'vitest';
import { getMaxTimestamp } from './treeUtilities';
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
