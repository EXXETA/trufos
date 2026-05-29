import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { setScriptContent } from './collectionUtil';

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

  it('sets script model to empty string when scriptType is undefined', async () => {
    // Act
    await setScriptContent(REQUEST_ID, mockRequest, undefined);

    // Assert
    expect(openMock).not.toHaveBeenCalled();
    expect(setValueMock).toHaveBeenCalledWith('');
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
