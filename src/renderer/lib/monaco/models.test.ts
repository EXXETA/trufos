import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScriptType } from 'shim/scripting';
import {
  cancelModelEdits,
  createModelsForRequest,
  disposeModelsForRequest,
  flushModelEdits,
  getBodyModel,
  getScriptModel,
  MODEL_EDIT_DEBOUNCE_MS,
  registerModelPersistence,
} from './models';

const persistence = {
  setTextBody: vi.fn(),
  setScript: vi.fn(),
  markDraft: vi.fn(),
};

const REQUEST_ID = 'req-1';

/** Simulates typing, which, unlike `setValue`, is not a flush. */
const type = (model: ReturnType<typeof getBodyModel>, text: string) =>
  model.applyEdits([{ range: model.getFullModelRange(), text }]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  persistence.setTextBody.mockResolvedValue(undefined);
  persistence.setScript.mockResolvedValue(undefined);
  persistence.markDraft.mockResolvedValue(undefined);
  registerModelPersistence(persistence);
  createModelsForRequest(REQUEST_ID);
});

afterEach(() => {
  disposeModelsForRequest(REQUEST_ID);
  registerModelPersistence(undefined);
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

  it('does not send content that was loaded', () => {
    getBodyModel(REQUEST_ID).setValue('loaded');

    vi.advanceTimersByTime(MODEL_EDIT_DEBOUNCE_MS);

    expect(persistence.markDraft).not.toHaveBeenCalled();
    expect(persistence.setTextBody).not.toHaveBeenCalled();
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
    createModelsForRequest('req-2');
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
});
