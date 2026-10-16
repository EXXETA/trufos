import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import { loadEditorContent } from './editor-content';

const { bodyModel, scriptModel, openMock } = vi.hoisted(() => {
  const fakeModel = () => ({
    setValue: vi.fn(),
    isDisposed: vi.fn(() => false),
  });
  return { bodyModel: fakeModel(), scriptModel: fakeModel(), openMock: vi.fn() };
});
const bodySetValue = bodyModel.setValue;
const scriptSetValue = scriptModel.setValue;

vi.mock('@/lib/monaco/models', () => ({
  getBodyModel: vi.fn(() => bodyModel),
  getScriptModel: vi.fn(() => scriptModel),
  // the loading semantics are tested with the real models, see models.test.ts
  loadModelContent: vi.fn(async (model: typeof bodyModel, load: () => Promise<string>) => {
    const text = await load();
    if (!model.isDisposed()) model.setValue(text);
  }),
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
  /** Lets every stream opened from now on wait until the returned function is called. */
  const holdStreams = () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    openMock.mockImplementation(async (input: { source?: string }) => {
      await promise;
      return { readAll: async () => input.source ?? 'body' };
    });
    return () => resolve();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of [bodyModel, scriptModel]) {
      model.isDisposed.mockReturnValue(false);
    }
    openMock.mockImplementation(async (input: { type: string; source?: string }) => ({
      readAll: async () => input.source ?? 'body',
    }));
  });

  it('loads the text body and every script', async () => {
    await loadEditorContent('req-1');

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

  it('reads the content only once the given promise settled', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();

    const loaded = loadEditorContent('req-1', { after: promise });
    await new Promise((r) => setTimeout(r));
    expect(openMock).not.toHaveBeenCalled();
    resolve();
    await loaded;

    expect(bodySetValue).toHaveBeenCalledWith('body');
  });

  it('loads nothing if the given promise rejects', async () => {
    await expect(
      loadEditorContent('req-1', { after: Promise.reject(new Error('rejected')) })
    ).rejects.toThrow('rejected');

    expect(openMock).not.toHaveBeenCalled();
    expect(bodySetValue).not.toHaveBeenCalled();
  });

  it('skips models that were disposed while the content was loading', async () => {
    const finishLoading = holdStreams();

    const loaded = loadEditorContent('req-1');
    // another request is selected meanwhile, which disposes the models of this one
    bodyModel.isDisposed.mockReturnValue(true);
    scriptModel.isDisposed.mockReturnValue(true);
    finishLoading();

    await expect(loaded).resolves.toBeUndefined();
    expect(bodySetValue).not.toHaveBeenCalled();
    expect(scriptSetValue).not.toHaveBeenCalled();
  });

  it('loads only the given model', async () => {
    await loadEditorContent('req-1', { only: ScriptType.PRE_REQUEST });

    expect(openMock).toHaveBeenCalledExactlyOnceWith(
      { type: 'script', source: ScriptType.PRE_REQUEST, requestId: 'req-1' },
      'utf-8'
    );
    expect(bodySetValue).not.toHaveBeenCalled();
    expect(scriptSetValue).toHaveBeenCalledExactlyOnceWith(ScriptType.PRE_REQUEST);
  });

  it('loads only the text body if asked to', async () => {
    await loadEditorContent('req-1', { only: 'body' });

    expect(openMock).toHaveBeenCalledExactlyOnceWith(
      { type: 'request-body', requestId: 'req-1' },
      'utf-8'
    );
    expect(bodySetValue).toHaveBeenCalledExactlyOnceWith('body');
    expect(scriptSetValue).not.toHaveBeenCalled();
  });
});
