import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import { RequestBodyType } from 'shim/objects/request';
import { makeRequest } from '@/__mocks__/fake-collection-main';
import { getMoveIndex, loadEditorContent } from './collectionUtil';

const { bodySetValue, scriptSetValue, openMock } = vi.hoisted(() => ({
  bodySetValue: vi.fn(),
  scriptSetValue: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock('@/lib/monaco/models', () => ({
  getBodyModel: vi.fn(() => ({ setValue: bodySetValue })),
  getScriptModel: vi.fn(() => ({ setValue: scriptSetValue })),
}));

vi.mock('monaco-editor', () => ({
  editor: { createModel: vi.fn() },
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: {
    open: openMock,
  },
}));

describe('loadEditorContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockImplementation(async (input: { type: string; source?: string }) => ({
      readAll: async () => input.source ?? 'body',
    }));
  });

  it('loads the text body and every script', async () => {
    await loadEditorContent(makeRequest('req-1', 'col-1'));

    expect(openMock).toHaveBeenCalledWith({ type: 'request-body', requestId: 'req-1' }, 'utf-8');
    expect(bodySetValue).toHaveBeenCalledWith('body');
    for (const scriptType of Object.values(ScriptType)) {
      expect(openMock).toHaveBeenCalledWith(
        { type: 'script', source: scriptType, requestId: 'req-1' },
        'utf-8'
      );
      expect(scriptSetValue).toHaveBeenCalledWith(scriptType);
    }
  });

  it('clears the body editor of a request without a text body', async () => {
    await loadEditorContent(
      makeRequest('req-1', 'col-1', { body: { type: RequestBodyType.FILE } })
    );

    expect(openMock).not.toHaveBeenCalledWith(
      { type: 'request-body', requestId: 'req-1' },
      'utf-8'
    );
    expect(bodySetValue).toHaveBeenCalledWith('');
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
