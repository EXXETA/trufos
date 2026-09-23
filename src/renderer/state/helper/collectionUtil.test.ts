import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { getTopLevelSelectedItems, hasSelectedAncestor, setScriptContent } from './collectionUtil';

const { setValueMock, readAllMock, openMock } = vi.hoisted(() => ({
  setValueMock: vi.fn(),
  readAllMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock('@/lib/monaco/models', () => ({
  getBodyModel: vi.fn(() => ({ setValue: vi.fn() })),
  getScriptModel: vi.fn(() => ({ setValue: setValueMock })),
}));

vi.mock('monaco-editor', () => ({
  editor: { createModel: vi.fn() },
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: {
    open: openMock,
  },
}));

const mockRequest = {
  id: 'req-1',
  parentId: 'col-1',
  type: 'request',
  title: 'Test Request',
  url: { raw: 'http://localhost', query: [] },
  method: 'GET',
  headers: [],
  body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  draft: false,
} as unknown as TrufosRequest;

const REQUEST_ID = 'req-1';

describe('setScriptContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockResolvedValue({ readAll: readAllMock });
  });

  it('opens a stream and sets script model value when request and scriptType are given', async () => {
    // Arrange
    readAllMock.mockResolvedValue('trufos.setCollectionVariable("key", "value");');

    // Act
    await setScriptContent(REQUEST_ID, mockRequest, ScriptType.PRE_REQUEST);

    // Assert
    expect(openMock).toHaveBeenCalledWith(
      { type: 'script', source: ScriptType.PRE_REQUEST, request: mockRequest },
      'utf-8'
    );
    expect(setValueMock).toHaveBeenCalledWith('trufos.setCollectionVariable("key", "value");');
  });

  it('sets script model to empty string when request is undefined', async () => {
    // Act
    await setScriptContent(REQUEST_ID, undefined, ScriptType.PRE_REQUEST);

    // Assert
    expect(openMock).not.toHaveBeenCalled();
    expect(setValueMock).toHaveBeenCalledWith('');
  });

  it('does nothing when scriptType is undefined', async () => {
    // Act
    await setScriptContent(REQUEST_ID, mockRequest, undefined);

    // Assert
    expect(openMock).not.toHaveBeenCalled();
    expect(setValueMock).not.toHaveBeenCalled();
  });

  it('opens the correct stream for POST_RESPONSE script type', async () => {
    // Arrange
    readAllMock.mockResolvedValue('');

    // Act
    await setScriptContent(REQUEST_ID, mockRequest, ScriptType.POST_RESPONSE);

    // Assert
    expect(openMock).toHaveBeenCalledWith(
      { type: 'script', source: ScriptType.POST_RESPONSE, request: mockRequest },
      'utf-8'
    );
  });
});

const makeReq = (id: string, parentId: string): TrufosRequest =>
  ({ id, parentId, type: 'request', title: id }) as unknown as TrufosRequest;

const makeFolder = (id: string, parentId: string): Folder =>
  ({ id, parentId, type: 'folder', title: id, children: [] }) as unknown as Folder;

const COL_ID = 'col-1';

describe('hasSelectedAncestor', () => {
  it('returns false when the item has no selected ancestor', () => {
    const req = makeReq('req-1', COL_ID);
    const requests = new Map([['req-1', req]]);
    const folders = new Map<string, Folder>();

    expect(hasSelectedAncestor('req-1', new Set(), requests, folders)).toBe(false);
  });

  it('returns true when the item is directly inside a selected folder', () => {
    const folder = makeFolder('folder-a', COL_ID);
    const req = makeReq('req-1', 'folder-a');
    const requests = new Map([['req-1', req]]);
    const folders = new Map([['folder-a', folder]]);

    expect(hasSelectedAncestor('req-1', new Set(['folder-a']), requests, folders)).toBe(true);
  });

  it('returns true when a grandparent folder is selected', () => {
    const outer = makeFolder('outer', COL_ID);
    const inner = makeFolder('inner', 'outer');
    const req = makeReq('req-1', 'inner');
    const requests = new Map([['req-1', req]]);
    const folders = new Map([
      ['outer', outer],
      ['inner', inner],
    ]);

    expect(hasSelectedAncestor('req-1', new Set(['outer']), requests, folders)).toBe(true);
  });

  it('returns false when only a sibling folder is selected', () => {
    const folderA = makeFolder('folder-a', COL_ID);
    const folderB = makeFolder('folder-b', COL_ID);
    const req = makeReq('req-1', 'folder-a');
    const requests = new Map([['req-1', req]]);
    const folders = new Map([
      ['folder-a', folderA],
      ['folder-b', folderB],
    ]);

    expect(hasSelectedAncestor('req-1', new Set(['folder-b']), requests, folders)).toBe(false);
  });
});

describe('getTopLevelSelectedItems', () => {
  it('returns all selected items when none are nested under another selected folder', () => {
    const req1 = makeReq('req-1', COL_ID);
    const req2 = makeReq('req-2', COL_ID);
    const requests = new Map([
      ['req-1', req1],
      ['req-2', req2],
    ]);
    const folders = new Map<string, Folder>();

    const result = getTopLevelSelectedItems(new Set(['req-1', 'req-2']), requests, folders);

    expect(result.map((item) => item.id).sort()).toEqual(['req-1', 'req-2']);
  });

  it('excludes a selected descendant whose parent folder is also selected', () => {
    const folder = makeFolder('folder-a', COL_ID);
    const childReq = makeReq('child-req', 'folder-a');
    const requests = new Map([['child-req', childReq]]);
    const folders = new Map([['folder-a', folder]]);

    const result = getTopLevelSelectedItems(new Set(['folder-a', 'child-req']), requests, folders);

    expect(result).toEqual([folder]);
  });

  it('keeps a selected descendant whose ancestor folder is not selected', () => {
    const folder = makeFolder('folder-a', COL_ID);
    const childReq = makeReq('child-req', 'folder-a');
    const requests = new Map([['child-req', childReq]]);
    const folders = new Map([['folder-a', folder]]);

    const result = getTopLevelSelectedItems(new Set(['child-req']), requests, folders);

    expect(result).toEqual([childReq]);
  });
});
