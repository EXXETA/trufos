import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import {
  cancelModelEdits,
  createModelsForRequest,
  disposeModelsForRequest,
  flushModelEdits,
  getBodyModel,
  getScriptModel,
  loadModelContent,
  MODEL_EDIT_DEBOUNCE_MS,
  refreshModelContent,
} from './models';

const persistence = {
  setTextBody: vi.fn(),
  setScript: vi.fn(),
  markDraft: vi.fn(),
  editFailed: vi.fn(),
};

const REQUEST_ID = 'req-1';

/** Simulates typing. */
const type = (model: ReturnType<typeof getBodyModel>, text: string) =>
  model.applyEdits([{ range: model.getFullModelRange(), text }]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  persistence.setTextBody.mockResolvedValue(undefined);
  persistence.setScript.mockResolvedValue(undefined);
  persistence.markDraft.mockResolvedValue(undefined);
  createModelsForRequest(REQUEST_ID, persistence);
});

afterEach(() => {
  disposeModelsForRequest(REQUEST_ID);
  vi.useRealTimers();
});

describe('editor models', () => {
  it('sends the text body debounced and marks the request as draft at once', () => {
    type(getBodyModel(REQUEST_ID), 'a');
    type(getBodyModel(REQUEST_ID), 'ab');

    expect(persistence.markDraft).toHaveBeenCalledExactlyOnceWith(REQUEST_ID);
    expect(persistence.setTextBody).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.setTextBody).toHaveBeenCalledExactlyOnceWith(REQUEST_ID, 'ab');
  });

  it('sends scripts debounced', () => {
    type(getScriptModel(REQUEST_ID, ScriptType.POST_RESPONSE), 'test()');

    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.setScript).toHaveBeenCalledExactlyOnceWith(
      REQUEST_ID,
      ScriptType.POST_RESPONSE,
      'test()'
    );
  });

  it('flushModelEdits sends pending edits at once and only once', async () => {
    type(getBodyModel(REQUEST_ID), 'body');
    type(getScriptModel(REQUEST_ID, ScriptType.PRE_REQUEST), 'script');

    await flushModelEdits(REQUEST_ID);
    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.setTextBody).toHaveBeenCalledExactlyOnceWith(REQUEST_ID, 'body');
    expect(persistence.setScript).toHaveBeenCalledExactlyOnceWith(
      REQUEST_ID,
      ScriptType.PRE_REQUEST,
      'script'
    );
  });

  it('flushModelEdits without a request flushes all requests', async () => {
    createModelsForRequest('req-2', persistence);
    type(getBodyModel('req-2'), 'other');

    await flushModelEdits();

    expect(persistence.setTextBody).toHaveBeenCalledWith('req-2', 'other');
    disposeModelsForRequest('req-2');
  });

  it('marks the request as draft again after a flush', async () => {
    type(getBodyModel(REQUEST_ID), 'a');
    await flushModelEdits(REQUEST_ID);
    type(getBodyModel(REQUEST_ID), 'b');

    expect(persistence.markDraft).toHaveBeenCalledTimes(2);
  });

  it('cancelModelEdits drops pending edits', () => {
    type(getBodyModel(REQUEST_ID), 'discarded');

    cancelModelEdits(REQUEST_ID);
    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.setTextBody).not.toHaveBeenCalled();
  });

  it('does not send anything when the models are disposed', () => {
    type(getBodyModel(REQUEST_ID), 'unsaved');

    disposeModelsForRequest(REQUEST_ID);
    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.setTextBody).not.toHaveBeenCalled();
  });

  it('reports a debounced edit that could not be sent', async () => {
    const error = new Error('rejected');
    persistence.setTextBody.mockRejectedValue(error);
    type(getBodyModel(REQUEST_ID), 'lost');

    await vi.advanceTimersByTimeAsync(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.editFailed).toHaveBeenCalledExactlyOnceWith(REQUEST_ID, 'body', error);
  });

  describe('loadModelContent', () => {
    it('sets the loaded content and does not treat it as an edit', async () => {
      await loadModelContent(getBodyModel(REQUEST_ID), async () => 'loaded');
      vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

      expect(getBodyModel(REQUEST_ID).getValue()).toBe('loaded');
      expect(persistence.markDraft).not.toHaveBeenCalled();
      expect(persistence.setTextBody).not.toHaveBeenCalled();
    });

    it('leaves the model as it is if loading was canceled', async () => {
      await loadModelContent(getBodyModel(REQUEST_ID), async () => 'loaded');
      await loadModelContent(getBodyModel(REQUEST_ID), async () => undefined);

      expect(getBodyModel(REQUEST_ID).getValue()).toBe('loaded');
    });

    it('replaces text typed while the content was loading and does not send it', async () => {
      const { promise, resolve } = Promise.withResolvers<string>();
      const loaded = loadModelContent(getBodyModel(REQUEST_ID), () => promise);
      type(getBodyModel(REQUEST_ID), 'x');

      resolve('the whole body');
      await loaded;
      vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

      expect(getBodyModel(REQUEST_ID).getValue()).toBe('the whole body');
      expect(persistence.markDraft).not.toHaveBeenCalled();
      expect(persistence.setTextBody).not.toHaveBeenCalled();
    });

    it('keeps the content of the newest load', async () => {
      const first = Promise.withResolvers<string>();
      const second = Promise.withResolvers<string>();
      const loads = [
        loadModelContent(getBodyModel(REQUEST_ID), () => first.promise),
        loadModelContent(getBodyModel(REQUEST_ID), () => second.promise),
      ];

      second.resolve('second');
      first.resolve('first');
      await Promise.all(loads);

      expect(getBodyModel(REQUEST_ID).getValue()).toBe('second');
    });

    it('skips a model that was disposed while its content was loading', async () => {
      createModelsForRequest('req-2', persistence);
      const model = getBodyModel('req-2');
      const { promise, resolve } = Promise.withResolvers<string>();
      const loaded = loadModelContent(model, () => promise);

      disposeModelsForRequest('req-2');
      resolve('late');

      await expect(loaded).resolves.toBeUndefined();
      expect(model.isDisposed()).toBe(true);
    });
  });

  describe('refreshModelContent', () => {
    it('replaces the content with what is on disk and does not treat it as an edit', async () => {
      await refreshModelContent(REQUEST_ID, getBodyModel(REQUEST_ID), async () => 'on disk');
      vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

      expect(getBodyModel(REQUEST_ID).getValue()).toBe('on disk');
      expect(persistence.markDraft).not.toHaveBeenCalled();
      expect(persistence.setTextBody).not.toHaveBeenCalled();
    });

    it('keeps the undo history if the content did not change', async () => {
      const model = getBodyModel(REQUEST_ID);
      await loadModelContent(model, async () => 'same');
      const versionId = model.getVersionId();

      await refreshModelContent(REQUEST_ID, model, async () => 'same');

      expect(model.getVersionId()).toBe(versionId);
    });

    it('keeps text typed while the content was read', async () => {
      const model = getBodyModel(REQUEST_ID);
      const { promise, resolve } = Promise.withResolvers<string>();
      const refreshed = refreshModelContent(REQUEST_ID, model, () => promise);
      type(model, 'typed');

      resolve('on disk');
      await refreshed;

      expect(model.getValue()).toBe('typed');
    });

    it('keeps a model with pending edits', async () => {
      const model = getBodyModel(REQUEST_ID);
      type(model, 'typed');

      await refreshModelContent(REQUEST_ID, model, async () => 'on disk');

      expect(model.getValue()).toBe('typed');
    });

    it('skips a model that was disposed while its content was read', async () => {
      createModelsForRequest('req-2', persistence);
      const model = getBodyModel('req-2');
      const { promise, resolve } = Promise.withResolvers<string>();
      const refreshed = refreshModelContent('req-2', model, () => promise);

      disposeModelsForRequest('req-2');
      resolve('late');

      await expect(refreshed).resolves.toBeUndefined();
    });
  });
});
